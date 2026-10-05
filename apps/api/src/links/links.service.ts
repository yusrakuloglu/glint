import { Injectable } from '@nestjs/common'
import { type z } from 'zod'

import { ProblemException } from '../common/problem-details.js'
import { type Content, Prisma, type SavedLink } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'

import { type linkSchema } from './links.contracts.js'

type LinkWithContent = SavedLink & { content: Content }
type LinkResponse = z.input<typeof linkSchema>

export interface SaveLinkInput {
  url: { original: string; normalized: string }
  title?: string | undefined
  note?: string | undefined
}

/**
 * Every query for a user's links goes through this filter: it scopes rows to
 * the caller and hides soft-deleted ones. Another user's link is therefore
 * indistinguishable from a missing one (404, never 403).
 */
function activeLinks(userId: string) {
  return { userId, deletedAt: null } satisfies Prisma.SavedLinkWhereInput
}

const linkNotFound = () =>
  new ProblemException({ status: 404, code: 'not_found', detail: 'Link not found' })

export function toLinkResponse(link: LinkWithContent): LinkResponse {
  return {
    id: link.id,
    url: link.originalUrl,
    canonicalUrl: link.content.url,
    title: link.title ?? link.content.title,
    siteName: link.content.siteName,
    summary: link.content.summary,
    status: link.content.status,
    note: link.note,
    readAt: link.readAt,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  }
}

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, input: SaveLinkInput): Promise<LinkResponse> {
    const content = await this.findOrCreateContent(input.url.normalized)

    const existing = await this.prisma.savedLink.findUnique({
      where: { userId_contentId: { userId, contentId: content.id } },
      include: { content: true },
    })

    if (existing?.deletedAt === null) {
      // Idempotent: a repeated save does not overwrite the user's edits
      return toLinkResponse(existing)
    }

    if (existing !== null) {
      // Restore instead of creating a new row: keeps highlights and tags
      const restored = await this.prisma.savedLink.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          originalUrl: input.url.original,
          title: input.title ?? null,
          note: input.note ?? null,
          readAt: null,
          // Saving again moves the link to the top of the list
          createdAt: new Date(),
        },
        include: { content: true },
      })
      return toLinkResponse(restored)
    }

    try {
      const created = await this.prisma.savedLink.create({
        data: {
          userId,
          contentId: content.id,
          originalUrl: input.url.original,
          title: input.title ?? null,
          note: input.note ?? null,
        },
        include: { content: true },
      })
      return toLinkResponse(created)
    } catch (error) {
      // A concurrent save of the same URL won the race: return its result
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.save(userId, input)
      }
      throw error
    }
  }

  async get(userId: string, id: string): Promise<LinkResponse> {
    const link = await this.prisma.savedLink.findFirst({
      where: { id, ...activeLinks(userId) },
      include: { content: true },
    })
    if (link === null) {
      throw linkNotFound()
    }
    return toLinkResponse(link)
  }

  /** Race-free: INSERT ... ON CONFLICT DO NOTHING, then read the row. */
  private async findOrCreateContent(url: string): Promise<Content> {
    await this.prisma.content.createMany({ data: [{ url }], skipDuplicates: true })
    return this.prisma.content.findUniqueOrThrow({ where: { url } })
  }
}
