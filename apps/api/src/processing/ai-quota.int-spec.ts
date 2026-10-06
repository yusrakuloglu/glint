import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PG_BOSS_SCHEMA } from '../queue/queue.service.js'
import { createTestApp, type TestApp, type TestUser } from '../testing/integration/test-app.js'
import { testEnv } from '../testing/test-env.js'

import { AiQuotaService } from './ai-quota.service.js'
import { contentExtractQueue } from './processing.queues.js'
import { addUtcDays, toUtcDateString } from './utc-day.js'

const LIMIT = testEnv.AI_DAILY_LIMIT_PER_USER
const MAX_DEFER_DAYS = testEnv.AI_MAX_DEFER_DAYS
const page = { html: '<html><body><article>Hello</article></body></html>' }

describe('daily AI quota', () => {
  let t: TestApp
  let alice: TestUser
  let bob: TestUser

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

  const uniqueUrl = () => `https://example.com/${randomUUID()}`

  const save = (user: TestUser, body: Record<string, unknown>) =>
    t.http().post('/links').set('authorization', user.authorization).send(body)

  /** Fills the user's quota for the days `offsets` days from today */
  async function fillDays(user: TestUser, offsets: number[], count = LIMIT) {
    await t.prisma.aiUsage.createMany({
      data: offsets.map((offset) => ({
        userId: user.id,
        day: addUtcDays(new Date(), offset),
        count,
      })),
    })
  }

  async function usage(user: TestUser, offset: number): Promise<number> {
    const row = await t.prisma.aiUsage.findUnique({
      where: { userId_day: { userId: user.id, day: addUtcDays(new Date(), offset) } },
    })
    return row?.count ?? 0
  }

  /** start_after of the extract job queued for the URL */
  async function jobStartAfter(url: string): Promise<Date> {
    const content = await t.prisma.content.findUniqueOrThrow({ where: { url } })
    const rows = await t.prisma.$queryRawUnsafe<{ startAfter: Date }[]>(
      `SELECT start_after AS "startAfter" FROM ${PG_BOSS_SCHEMA}.job
       WHERE name = $1 AND data->>'contentId' = $2`,
      contentExtractQueue.name,
      content.id
    )
    const [job, ...others] = rows
    expect(others).toHaveLength(0)
    if (job === undefined) throw new Error(`No extract job for ${url}`)
    return job.startAfter
  }

  const dateOf = (offset: number) => toUtcDateString(addUtcDays(new Date(), offset))

  it('charges the sender one run and starts processing now', async () => {
    const url = uniqueUrl()
    const before = new Date()

    await save(alice, { url, page })

    expect(await usage(alice, 0)).toBe(1)
    expect((await jobStartAfter(url)).getTime()).toBeLessThanOrEqual(Date.now())
    expect((await jobStartAfter(url)).getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
  })

  it('does not charge for content that is already processing or ready', async () => {
    const url = uniqueUrl()
    await save(alice, { url, page })

    await save(bob, { url, page })
    await t.prisma.content.update({ where: { url }, data: { status: 'READY' } })
    await save(bob, { url: `${url}#again`, page })

    expect(await usage(bob, 0)).toBe(0)
  })

  it('does not charge for a save without page content', async () => {
    await save(alice, { url: uniqueUrl() })

    expect(await usage(alice, 0)).toBe(0)
  })

  it('defers to the next day with room instead of rejecting the save', async () => {
    await fillDays(alice, [0, 1])
    const url = uniqueUrl()

    const response = await save(alice, { url, page })

    expect(response.status).toBe(201)
    expect((response.body as { status: string }).status).toBe('PENDING')
    expect(toUtcDateString(await jobStartAfter(url))).toBe(dateOf(2))
    expect((await jobStartAfter(url)).toISOString()).toMatch(/T00:00:00\.000Z$/)
    expect(await usage(alice, 0)).toBe(LIMIT)
    expect(await usage(alice, 2)).toBe(1)
  })

  it('keeps quotas separate per user', async () => {
    await fillDays(alice, [0])

    await save(bob, { url: uniqueUrl(), page })

    expect(await usage(bob, 0)).toBe(1)
  })

  it('never exceeds the limit under concurrent reservations', async () => {
    await fillDays(alice, [0], LIMIT - 5)
    const quota = t.app.get(AiQuotaService)
    const now = new Date()

    // Twenty transactions race for the five runs left today
    await Promise.all(
      Array.from({ length: 20 }, () =>
        t.prisma.$transaction((tx) => quota.reserve(tx, alice.id, now))
      )
    )

    expect(await usage(alice, 0)).toBe(LIMIT)
    expect(await usage(alice, 1)).toBe(15)
  })

  it('uses the last day of the defer window', async () => {
    await fillDays(
      alice,
      Array.from({ length: MAX_DEFER_DAYS - 1 }, (_, offset) => offset)
    )
    const url = uniqueUrl()

    const response = await save(alice, { url, page })

    expect(response.status).toBe(201)
    expect(toUtcDateString(await jobStartAfter(url))).toBe(dateOf(MAX_DEFER_DAYS - 1))
  })

  it(`rejects with 429 when the next ${String(MAX_DEFER_DAYS)} days are booked`, async () => {
    await fillDays(
      alice,
      Array.from({ length: MAX_DEFER_DAYS }, (_, offset) => offset)
    )
    const url = uniqueUrl()

    const response = await save(alice, { url, page })

    expect(response.status).toBe(429)
    expect(JSON.parse(response.text)).toMatchObject({ code: 'too_many_requests' })
    // The claim, snapshot and job were rolled back together
    const content = await t.prisma.content.findUniqueOrThrow({ where: { url } })
    expect(content.status).toBe('AWAITING_CONTENT')
    expect(await t.prisma.pageSnapshot.count({ where: { contentId: content.id } })).toBe(0)
  })
})
