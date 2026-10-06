import { randomUUID } from 'node:crypto'

import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaClient } from '../generated/prisma/client.js'
import { createTestDatabase } from '../testing/integration/test-database.js'

/** Database-level defaults and constraints of the processing pipeline's tables */
describe('processing data model', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: await createTestDatabase() }),
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  const createContent = () =>
    prisma.content.create({ data: { url: `https://example.com/${randomUUID()}` } })

  it('starts new content waiting for page content, before the first step', async () => {
    const content = await createContent()

    expect(content).toMatchObject({
      status: 'AWAITING_CONTENT',
      processingStep: 'EXTRACT',
      suggestedTags: [],
      contentHash: null,
      aiProvider: null,
    })
  })

  it('deletes page snapshots with their content', async () => {
    const content = await createContent()
    await prisma.pageSnapshot.create({
      data: { contentId: content.id, userId: randomUUID(), html: '<html></html>' },
    })

    await prisma.content.delete({ where: { id: content.id } })

    expect(await prisma.pageSnapshot.count({ where: { contentId: content.id } })).toBe(0)
  })

  it('keeps one usage row per user and day, never negative', async () => {
    const userId = randomUUID()
    const day = new Date('2026-10-06T00:00:00Z')
    await prisma.aiUsage.create({ data: { userId, day } })

    await expect(prisma.aiUsage.create({ data: { userId, day } })).rejects.toMatchObject({
      code: 'P2002',
    })
    await expect(
      prisma.aiUsage.update({
        where: { userId_day: { userId, day } },
        data: { count: { decrement: 1 } },
      })
    ).rejects.toThrow(/ai_usage_count_check/)
  })
})
