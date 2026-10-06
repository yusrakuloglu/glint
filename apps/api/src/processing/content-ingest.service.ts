import { Injectable } from '@nestjs/common'

import { type Content, ContentStatus } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { QueueService } from '../queue/queue.service.js'

import { contentExtractQueue } from './processing.queues.js'

export interface PageInput {
  html: string
  lang?: string | undefined
}

/** Statuses in which a newly sent page starts processing */
const ACCEPTS_PAGE: ContentStatus[] = [ContentStatus.AWAITING_CONTENT, ContentStatus.FAILED]

@Injectable()
export class ContentIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService
  ) {}

  /**
   * Stores a page sent by a client and queues the pipeline for its content.
   * A page for content that is READY or already being processed is dropped:
   * the existing result is shared (decision 005).
   *
   * The status change, the snapshot and the job commit together. The
   * conditional update claims the content, so of two concurrent saves only
   * one stores its page and queues a job.
   *
   * @returns whether this page started processing
   */
  async submitPage(userId: string, content: Content, page: PageInput): Promise<boolean> {
    if (!ACCEPTS_PAGE.includes(content.status)) {
      return false
    }

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.content.updateMany({
        where: { id: content.id, status: { in: ACCEPTS_PAGE } },
        data: {
          status: ContentStatus.PENDING,
          processingStep: 'EXTRACT',
          failureReason: null,
          statusChangedAt: new Date(),
        },
      })
      if (count === 0) {
        return false
      }

      await tx.pageSnapshot.create({
        data: { contentId: content.id, userId, html: page.html, lang: page.lang ?? null },
      })
      await this.queue.send(contentExtractQueue, { contentId: content.id }, { tx })
      return true
    })
  }
}
