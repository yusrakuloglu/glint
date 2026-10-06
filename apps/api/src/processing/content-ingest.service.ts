import { Injectable } from '@nestjs/common'

import { type Content, ContentStatus } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { QueueService } from '../queue/queue.service.js'

import { AiQuotaService } from './ai-quota.service.js'
import { compressSnapshotHtml, stripScriptsAndStyles } from './page-snapshot.js'
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
    private readonly queue: QueueService,
    private readonly quota: AiQuotaService
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
   * Processing costs the sender one run of their daily AI quota; content
   * that is reused costs nothing. Over the limit, the job waits for the
   * first day with room.
   *
   * The snapshot is stored without script and style elements and gzipped:
   * deferred pages keep their snapshot for days (decision 028).
   *
   * @returns whether this page started processing
   */
  async submitPage(userId: string, content: Content, page: PageInput): Promise<boolean> {
    if (!ACCEPTS_PAGE.includes(content.status)) {
      return false
    }

    // CPU work stays outside the transaction, which holds a connection
    const htmlGzip = await compressSnapshotHtml(stripScriptsAndStyles(page.html))
    const now = new Date()
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

      const runDay = await this.quota.reserve(tx, userId, now)
      await tx.pageSnapshot.create({
        data: { contentId: content.id, userId, htmlGzip, lang: page.lang ?? null },
      })
      await this.queue.send(
        contentExtractQueue,
        { contentId: content.id },
        { tx, ...(runDay > now && { startAfter: runDay }) }
      )
      return true
    })
  }
}
