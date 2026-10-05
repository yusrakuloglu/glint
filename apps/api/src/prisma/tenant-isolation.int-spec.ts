import { randomUUID } from 'node:crypto'

import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaClient } from '../generated/prisma/client.js'
import { createTestDatabase } from '../testing/integration/test-database.js'

/**
 * Database-level guarantees from the composite (id, user_id) foreign keys:
 * even if application code forgets an ownership check, rows of different
 * users cannot be linked. Endpoints for these models come in later phases.
 */
describe('tenant isolation constraints', () => {
  let prisma: PrismaClient
  const alice = randomUUID()
  const bob = randomUUID()

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: await createTestDatabase() }),
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function createLink(userId: string) {
    const content = await prisma.content.create({
      data: { url: `https://example.com/${randomUUID()}` },
    })
    return prisma.savedLink.create({
      data: { userId, contentId: content.id, originalUrl: content.url },
    })
  }

  const createTag = (userId: string, slug: string = randomUUID()) =>
    prisma.tag.create({ data: { userId, name: slug, slug } })

  const createCollection = (userId: string) =>
    prisma.collection.create({ data: { userId, name: randomUUID() } })

  const selector = { type: 'TextQuoteSelector', exact: 'hello' }

  describe('allows linking rows of the same user', () => {
    it('tag on own link', async () => {
      const link = await createLink(alice)
      const tag = await createTag(alice)

      await expect(
        prisma.savedLinkTag.create({ data: { userId: alice, savedLinkId: link.id, tagId: tag.id } })
      ).resolves.toMatchObject({ source: 'USER' })
    })

    it('own link in own collection', async () => {
      const link = await createLink(alice)
      const collection = await createCollection(alice)

      await expect(
        prisma.collectionItem.create({
          data: {
            userId: alice,
            collectionId: collection.id,
            savedLinkId: link.id,
            position: 'a0',
          },
        })
      ).resolves.toBeDefined()
    })
  })

  describe('rejects linking rows of different users', () => {
    it("another user's tag on a link", async () => {
      const link = await createLink(alice)
      const bobsTag = await createTag(bob)

      for (const userId of [alice, bob]) {
        await expect(
          prisma.savedLinkTag.create({ data: { userId, savedLinkId: link.id, tagId: bobsTag.id } })
        ).rejects.toMatchObject({ code: 'P2003' })
      }
    })

    it("a link in another user's collection", async () => {
      const link = await createLink(alice)
      const bobsCollection = await createCollection(bob)

      for (const userId of [alice, bob]) {
        await expect(
          prisma.collectionItem.create({
            data: { userId, collectionId: bobsCollection.id, savedLinkId: link.id, position: 'a0' },
          })
        ).rejects.toMatchObject({ code: 'P2003' })
      }
    })

    it("a highlight on another user's link", async () => {
      const link = await createLink(alice)

      await expect(
        prisma.highlight.create({
          data: { userId: bob, savedLinkId: link.id, quote: 'hello', selector },
        })
      ).rejects.toMatchObject({ code: 'P2003' })
    })
  })

  describe('uniqueness', () => {
    it('allows one saved link per user and content', async () => {
      const link = await createLink(alice)

      await expect(
        prisma.savedLink.create({
          data: { userId: alice, contentId: link.contentId, originalUrl: link.originalUrl },
        })
      ).rejects.toMatchObject({ code: 'P2002' })
      await expect(
        prisma.savedLink.create({
          data: { userId: bob, contentId: link.contentId, originalUrl: link.originalUrl },
        })
      ).resolves.toBeDefined()
    })

    it('scopes tag slugs to a user', async () => {
      await createTag(alice, 'reading')

      await expect(createTag(alice, 'reading')).rejects.toMatchObject({ code: 'P2002' })
      await expect(createTag(bob, 'reading')).resolves.toBeDefined()
    })

    it('limits normalized URLs to 2048 characters', async () => {
      await expect(
        prisma.content.create({ data: { url: `https://example.com/${'a'.repeat(2048)}` } })
      ).rejects.toThrow(/contents_url_length_check/)
    })
  })

  describe('deletion', () => {
    it('cascades from a saved link to its tags, collection items and highlights', async () => {
      const link = await createLink(alice)
      const tag = await createTag(alice)
      const collection = await createCollection(alice)
      await prisma.savedLinkTag.create({
        data: { userId: alice, savedLinkId: link.id, tagId: tag.id },
      })
      await prisma.collectionItem.create({
        data: { userId: alice, collectionId: collection.id, savedLinkId: link.id, position: 'a0' },
      })
      await prisma.highlight.create({
        data: { userId: alice, savedLinkId: link.id, quote: 'hello', selector },
      })

      await prisma.savedLink.delete({ where: { id: link.id } })

      const where = { savedLinkId: link.id }
      expect(await prisma.savedLinkTag.count({ where })).toBe(0)
      expect(await prisma.collectionItem.count({ where })).toBe(0)
      expect(await prisma.highlight.count({ where })).toBe(0)
      // Tags and collections themselves stay
      expect(await prisma.tag.count({ where: { id: tag.id } })).toBe(1)
      expect(await prisma.collection.count({ where: { id: collection.id } })).toBe(1)
    })

    it('keeps content that is still saved by someone', async () => {
      const link = await createLink(alice)

      await expect(prisma.content.delete({ where: { id: link.contentId } })).rejects.toMatchObject({
        code: 'P2003',
      })
    })
  })
})
