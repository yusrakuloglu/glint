import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

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
        status: 'PENDING',
        readAt: null,
      })
      expect(Object.keys(response.body).sort()).toEqual(
        [
          'canonicalUrl',
          'createdAt',
          'id',
          'note',
          'readAt',
          'siteName',
          'status',
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

  describe('authentication', () => {
    it.each([
      ['POST', '/links'],
      ['GET', '/links/01920000-0000-7000-8000-000000000000'],
    ])('%s %s requires a token', async (method, path) => {
      const response = await t.http()[method === 'POST' ? 'post' : 'get'](path).send({})

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
