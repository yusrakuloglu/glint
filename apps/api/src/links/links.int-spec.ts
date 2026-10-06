import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { decompressSnapshotHtml } from '../processing/page-snapshot.js'
import { contentExtractQueue } from '../processing/processing.queues.js'
import { PG_BOSS_SCHEMA } from '../queue/queue.service.js'
import { createTestApp, type TestApp, type TestUser } from '../testing/integration/test-app.js'

interface LinkBody {
  id: string
  url: string
  canonicalUrl: string
  title: string | null
  note: string | null
  status: string
  readAt: string | null
  createdAt: string
}

interface ProblemBody {
  status: number
  code: string
  errors?: { path: string; message: string }[]
}

const parseProblem = (text: string) => JSON.parse(text) as ProblemBody

describe('links API', () => {
  let t: TestApp
  let alice: TestUser
  let bob: TestUser
  let counter = 0

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(async () => {
    await t.close()
  })

  beforeEach(async () => {
    alice = await t.createUser()
    bob = await t.createUser()
  })

  const uniqueUrl = () => `https://example.com/article-${String(++counter)}-${String(Date.now())}`

  async function save(user: TestUser, body: Record<string, unknown>) {
    const response = await t
      .http()
      .post('/links')
      .set('authorization', user.authorization)
      .send(body)
    return { status: response.status, body: response.body as LinkBody, text: response.text }
  }

  const getLink = (user: TestUser, id: string) =>
    t.http().get(`/links/${id}`).set('authorization', user.authorization)

  describe('POST /links', () => {
    it('saves a link with its normalized URL', async () => {
      const url = `${uniqueUrl()}?utm_source=x&b=2&a=1#intro`

      const response = await save(alice, { url, title: 'Read later', note: 'note' })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        url,
        canonicalUrl: url.replace('?utm_source=x&b=2&a=1#intro', '?a=1&b=2'),
        title: 'Read later',
        note: 'note',
        status: 'AWAITING_CONTENT',
        readAt: null,
      })
      expect(Object.keys(response.body).sort()).toEqual(
        [
          'canonicalUrl',
          'createdAt',
          'excerpt',
          'id',
          'note',
          'readAt',
          'siteName',
          'status',
          'suggestedTags',
          'summary',
          'title',
          'updatedAt',
          'url',
        ].sort()
      )
    })

    it('is idempotent for the same user and URL', async () => {
      const url = uniqueUrl()
      const first = await save(alice, { url, note: 'keep me' })

      const second = await save(alice, { url: `${url}#other-section`, note: 'ignored' })

      expect(second.status).toBe(201)
      expect(second.body).toEqual(first.body)
      expect(await t.prisma.savedLink.count({ where: { userId: alice.id } })).toBe(1)
    })

    it('shares one content between users', async () => {
      const url = uniqueUrl()

      const aliceLink = await save(alice, { url })
      const bobLink = await save(bob, { url })

      expect(aliceLink.body.id).not.toBe(bobLink.body.id)
      expect(await t.prisma.content.count({ where: { url: aliceLink.body.canonicalUrl } })).toBe(1)
    })

    it('handles concurrent saves of the same URL', async () => {
      const url = uniqueUrl()

      const results = await Promise.all([
        save(alice, { url }),
        save(alice, { url }),
        save(bob, { url }),
      ])

      expect(results.map((r) => r.status)).toEqual([201, 201, 201])
      expect(results[0].body.id).toBe(results[1].body.id)
      expect(await t.prisma.content.count({ where: { url } })).toBe(1)
    })

    it.each([
      ['missing url', {}, 'body.url'],
      ['invalid url', { url: 'not a url' }, 'body.url'],
      ['javascript url', { url: 'javascript:alert(1)' }, 'body.url'],
      ['url with credentials', { url: 'https://user:pass@example.com/' }, 'body.url'],
      ['empty title', { url: 'https://example.com/', title: '   ' }, 'body.title'],
      ['unknown field', { url: 'https://example.com/', userId: 'x' }, 'body'],
    ])('rejects %s', async (_, body, path) => {
      const response = await save(alice, body)

      expect(response.status).toBe(400)
      const problem = parseProblem(response.text)
      expect(problem.code).toBe('validation_failed')
      expect(problem.errors?.map((error) => error.path)).toContain(path)
    })

    it('ignores a userId in the body (mass assignment)', async () => {
      const response = await save(alice, { url: uniqueUrl(), userId: bob.id })

      expect(response.status).toBe(400)
      expect(await t.prisma.savedLink.count({ where: { userId: bob.id } })).toBe(0)
    })
  })

  describe('POST /links with page content', () => {
    const page = { html: '<html><body><article>Hello</article></body></html>', lang: 'en' }

    /** Extract jobs queued for a content, by the content's normalized URL */
    async function extractJobs(url: string) {
      const content = await t.prisma.content.findUniqueOrThrow({ where: { url } })
      return t.prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM ${PG_BOSS_SCHEMA}.job WHERE name = $1 AND data->>'contentId' = $2`,
        contentExtractQueue.name,
        content.id
      )
    }

    const snapshots = (url: string) => t.prisma.pageSnapshot.count({ where: { content: { url } } })

    it('stores the page and queues extraction', async () => {
      const url = uniqueUrl()

      const response = await save(alice, { url, page })

      expect(response.status).toBe(201)
      expect(response.body.status).toBe('PENDING')
      expect(await extractJobs(url)).toHaveLength(1)
      const snapshot = await t.prisma.pageSnapshot.findFirstOrThrow({ where: { content: { url } } })
      expect(snapshot).toMatchObject({ userId: alice.id, lang: 'en' })
      await expect(decompressSnapshotHtml(snapshot.htmlGzip)).resolves.toBe(page.html)
    })

    it('stores the snapshot gzipped, without scripts and styles', async () => {
      const url = uniqueUrl()
      const article = `<article>${'<p>Paragraph of the article.</p>'.repeat(500)}</article>`
      const html =
        `<html><head><style>${'.a { color: red }'.repeat(500)}</style></head>` +
        `<body>${article}<script>${'track();'.repeat(500)}</script></body></html>`

      await save(alice, { url, page: { html } })

      const snapshot = await t.prisma.pageSnapshot.findFirstOrThrow({ where: { content: { url } } })
      await expect(decompressSnapshotHtml(snapshot.htmlGzip)).resolves.toBe(
        `<html><head></head><body>${article}</body></html>`
      )
      expect(snapshot.htmlGzip.byteLength).toBeLessThan(article.length / 10)
    })

    it('queues nothing without page content', async () => {
      const url = uniqueUrl()

      await save(alice, { url })

      expect(await extractJobs(url)).toHaveLength(0)
      expect(await snapshots(url)).toBe(0)
    })

    it('starts one pipeline when users send the same page concurrently', async () => {
      const url = uniqueUrl()

      const results = await Promise.all([
        save(alice, { url, page }),
        save(bob, { url, page }),
        save(alice, { url, page }),
      ])

      expect(results.map((r) => r.status)).toEqual([201, 201, 201])
      expect(await extractJobs(url)).toHaveLength(1)
      expect(await snapshots(url)).toBe(1)
    })

    it('reuses processed content without queueing again', async () => {
      const url = uniqueUrl()
      await save(alice, { url })
      await t.prisma.content.update({ where: { url }, data: { status: 'READY', summary: 'Done' } })

      const response = await save(bob, { url, page })

      expect(response.body).toMatchObject({ status: 'READY', summary: 'Done' })
      expect(await extractJobs(url)).toHaveLength(0)
      expect(await snapshots(url)).toBe(0)
    })

    it('retries failed content with a new page', async () => {
      const url = uniqueUrl()
      await save(alice, { url })
      await t.prisma.content.update({
        where: { url },
        data: { status: 'FAILED', processingStep: 'SUMMARIZE', failureReason: 'too short' },
      })

      const response = await save(bob, { url, page })

      expect(response.body.status).toBe('PENDING')
      expect(await t.prisma.content.findUniqueOrThrow({ where: { url } })).toMatchObject({
        processingStep: 'EXTRACT',
        failureReason: null,
      })
      expect(await extractJobs(url)).toHaveLength(1)
    })

    it('accepts a page larger than the default 100 KB body limit', async () => {
      const url = uniqueUrl()
      const html = `<html><body>${'a'.repeat(2_000_000)}</body></html>`

      const response = await save(alice, { url, page: { html } })

      expect(response.status).toBe(201)
    })

    it('rejects page html over 5 million characters', async () => {
      const response = await save(alice, {
        url: uniqueUrl(),
        page: { html: 'a'.repeat(5_000_001) },
      })

      expect(response.status).toBe(400)
      expect(parseProblem(response.text).errors?.map((error) => error.path)).toContain(
        'body.page.html'
      )
    })

    it('returns a problem response for a body over the limit', async () => {
      const response = await save(alice, {
        url: uniqueUrl(),
        page: { html: 'a'.repeat(6 * 1024 * 1024) },
      })

      expect(response.status).toBe(413)
      expect(parseProblem(response.text).code).toBe('payload_too_large')
    })

    it('keeps the default limit on other routes', async () => {
      const { body: link } = await save(alice, { url: uniqueUrl() })

      const response = await t
        .http()
        .patch(`/links/${link.id}`)
        .set('authorization', alice.authorization)
        .send({ note: 'a'.repeat(200_000) })

      expect(response.status).toBe(413)
      expect(parseProblem(response.text).code).toBe('payload_too_large')
    })
  })

  describe('GET /links/:id', () => {
    it('returns the caller’s link', async () => {
      const saved = await save(alice, { url: uniqueUrl() })

      const response = await getLink(alice, saved.body.id)

      expect(response.status).toBe(200)
      expect(response.body).toEqual(saved.body)
    })

    it('returns 404 for another user’s link, same as a missing one', async () => {
      const saved = await save(alice, { url: uniqueUrl() })

      const foreign = await getLink(bob, saved.body.id)
      const missing = await getLink(bob, '01920000-0000-7000-8000-000000000000')

      expect(foreign.status).toBe(404)
      expect(parseProblem(foreign.text)).toEqual({
        ...parseProblem(missing.text),
        instance: `/links/${saved.body.id}`,
        requestId: expect.any(String) as unknown,
      })
    })

    it('rejects a malformed id', async () => {
      const response = await getLink(alice, 'not-a-uuid')

      expect(response.status).toBe(400)
      expect(parseProblem(response.text).errors?.[0]?.path).toBe('params.id')
    })
  })

  describe('GET /links', () => {
    interface PageBody {
      items: LinkBody[]
      nextCursor: string | null
    }

    async function list(user: TestUser, query: Record<string, string | number> = {}) {
      const response = await t
        .http()
        .get('/links')
        .query(query)
        .set('authorization', user.authorization)
      return { status: response.status, body: response.body as PageBody, text: response.text }
    }

    async function listAll(user: TestUser, limit: number) {
      const ids: string[] = []
      let cursor: string | null = null
      do {
        const page = await list(user, { limit, ...(cursor !== null && { cursor }) })
        expect(page.status).toBe(200)
        ids.push(...page.body.items.map((item) => item.id))
        cursor = page.body.nextCursor
      } while (cursor !== null)
      return ids
    }

    async function saveMany(user: TestUser, count: number) {
      const ids: string[] = []
      for (let i = 0; i < count; i++) {
        ids.push((await save(user, { url: uniqueUrl() })).body.id)
      }
      return ids
    }

    it('returns newest first with a cursor to the next page', async () => {
      const ids = await saveMany(alice, 3)

      const first = await list(alice, { limit: 2 })
      expect(first.body.items.map((item) => item.id)).toEqual([ids[2], ids[1]])
      expect(first.body.nextCursor).toEqual(expect.any(String))

      const second = await list(alice, { limit: 2, cursor: first.body.nextCursor ?? '' })
      expect(second.body.items.map((item) => item.id)).toEqual([ids[0]])
      expect(second.body.nextCursor).toBeNull()
    })

    it('neither skips nor repeats links saved in the same millisecond', async () => {
      const ids = await saveMany(alice, 7)
      await t.prisma.savedLink.updateMany({
        where: { userId: alice.id },
        data: { createdAt: new Date('2026-10-05T12:00:00.000Z') },
      })

      const listed = await listAll(alice, 2)

      expect(listed).toHaveLength(7)
      expect(new Set(listed)).toEqual(new Set(ids))
      // Ties are ordered by id descending
      expect(listed).toEqual([...listed].sort().reverse())
    })

    it('uses the default page size', async () => {
      await saveMany(alice, 21)

      const page = await list(alice)

      expect(page.body.items).toHaveLength(20)
      expect(page.body.nextCursor).not.toBeNull()
    })

    it('only lists the caller’s links', async () => {
      const aliceIds = await saveMany(alice, 2)
      const bobIds = await saveMany(bob, 2)

      expect(await listAll(alice, 10)).toEqual([...aliceIds].reverse())
      expect(await listAll(bob, 10)).toEqual([...bobIds].reverse())
    })

    it('does not leak links through another user’s cursor', async () => {
      await saveMany(alice, 3)
      const bobIds = await saveMany(bob, 1)
      const aliceCursor = (await list(alice, { limit: 1 })).body.nextCursor ?? ''

      const page = await list(bob, { cursor: aliceCursor })

      expect(page.status).toBe(200)
      expect(page.body.items.every((item) => bobIds.includes(item.id))).toBe(true)
    })

    it('hides soft-deleted links', async () => {
      const [kept, deleted] = await saveMany(alice, 2)
      await t.prisma.savedLink.update({ where: { id: deleted }, data: { deletedAt: new Date() } })

      expect(await listAll(alice, 10)).toEqual([kept])
    })

    it.each([
      ['an invalid cursor', { cursor: 'garbage' }, 'query.cursor'],
      ['a limit above the maximum', { limit: 101 }, 'query.limit'],
      ['a zero limit', { limit: 0 }, 'query.limit'],
    ])('rejects %s', async (_, query, path) => {
      const page = await list(alice, query)

      expect(page.status).toBe(400)
      expect(parseProblem(page.text).errors?.map((error) => error.path)).toEqual([path])
    })
  })

  describe('PATCH /links/:id', () => {
    const patch = (user: TestUser, id: string, body: Record<string, unknown>) =>
      t.http().patch(`/links/${id}`).set('authorization', user.authorization).send(body)

    it('updates title and note', async () => {
      const saved = await save(alice, { url: uniqueUrl(), title: 'Old' })

      const response = await patch(alice, saved.body.id, { title: 'New', note: 'Worth it' })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ title: 'New', note: 'Worth it' })
    })

    it('clears fields with null and leaves omitted ones', async () => {
      const saved = await save(alice, { url: uniqueUrl(), title: 'Mine', note: 'keep' })

      const response = await patch(alice, saved.body.id, { title: null })

      // Falls back to the page title, unknown until processing
      expect(response.body).toMatchObject({ title: null, note: 'keep' })
    })

    it('keeps the first read time and clears it when unread', async () => {
      const saved = await save(alice, { url: uniqueUrl() })

      const read = (await patch(alice, saved.body.id, { read: true })).body as LinkBody
      const readAgain = (await patch(alice, saved.body.id, { read: true })).body as LinkBody
      const unread = (await patch(alice, saved.body.id, { read: false })).body as LinkBody

      expect(read.readAt).toEqual(expect.any(String))
      expect(readAgain.readAt).toBe(read.readAt)
      expect(unread.readAt).toBeNull()
    })

    it.each([
      ['an empty body', {}],
      ['an unknown field', { deletedAt: null }],
      ['a too long note', { note: 'x'.repeat(10_001) }],
    ])('rejects %s', async (_, body) => {
      const saved = await save(alice, { url: uniqueUrl() })

      const response = await patch(alice, saved.body.id, body)

      expect(response.status).toBe(400)
      expect(parseProblem(response.text).code).toBe('validation_failed')
    })

    it('returns 404 for another user’s link and leaves it unchanged', async () => {
      const saved = await save(alice, { url: uniqueUrl(), note: 'private' })

      const response = await patch(bob, saved.body.id, { note: 'hacked' })

      expect(response.status).toBe(404)
      expect((await getLink(alice, saved.body.id)).body).toMatchObject({ note: 'private' })
    })
  })

  describe('DELETE /links/:id', () => {
    const remove = (user: TestUser, id: string) =>
      t.http().delete(`/links/${id}`).set('authorization', user.authorization)

    it('soft deletes the link', async () => {
      const saved = await save(alice, { url: uniqueUrl() })

      const response = await remove(alice, saved.body.id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect((await getLink(alice, saved.body.id)).status).toBe(404)
      expect(await t.prisma.savedLink.count({ where: { id: saved.body.id } })).toBe(1)
    })

    it('returns 404 when deleting twice or updating a deleted link', async () => {
      const saved = await save(alice, { url: uniqueUrl() })
      await remove(alice, saved.body.id)

      expect((await remove(alice, saved.body.id)).status).toBe(404)
      expect(
        (
          await t
            .http()
            .patch(`/links/${saved.body.id}`)
            .set('authorization', alice.authorization)
            .send({ note: 'x' })
        ).status
      ).toBe(404)
    })

    it('returns 404 for another user’s link and keeps it', async () => {
      const saved = await save(alice, { url: uniqueUrl() })

      expect((await remove(bob, saved.body.id)).status).toBe(404)
      expect((await getLink(alice, saved.body.id)).status).toBe(200)
    })

    it('restores the same link with its highlights when saved again', async () => {
      const url = uniqueUrl()
      const saved = await save(alice, { url, note: 'old note' })
      await t.prisma.highlight.create({
        data: {
          userId: alice.id,
          savedLinkId: saved.body.id,
          quote: 'hello',
          selector: { type: 'TextQuoteSelector', exact: 'hello' },
        },
      })
      await remove(alice, saved.body.id)

      const restored = await save(alice, { url })

      expect(restored.body.id).toBe(saved.body.id)
      expect(restored.body.note).toBeNull()
      expect(Date.parse(restored.body.createdAt)).toBeGreaterThan(Date.parse(saved.body.createdAt))
      expect(await t.prisma.highlight.count({ where: { savedLinkId: saved.body.id } })).toBe(1)
    })
  })

  describe('authentication', () => {
    const someId = '01920000-0000-7000-8000-000000000000'

    it.each([
      ['post', '/links'],
      ['get', '/links'],
      ['get', `/links/${someId}`],
      ['patch', `/links/${someId}`],
      ['delete', `/links/${someId}`],
    ] as const)('%s %s requires a token', async (method, path) => {
      const response = await t.http()[method](path).send({})

      expect(response.status).toBe(401)
      expect(parseProblem(response.text).code).toBe('unauthenticated')
    })

    it('rejects an expired token', async () => {
      const token = await t.tokens.sign(alice.id, { expiresIn: -60 })

      const response = await t
        .http()
        .get('/links/01920000-0000-7000-8000-000000000000')
        .set('authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
    })
  })
})
