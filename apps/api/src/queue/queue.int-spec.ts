import { Test, type TestingModule } from '@nestjs/testing'
import pg from 'pg'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { z } from 'zod'

import { ConfigModule } from '../config/config.module.js'
import { ENV } from '../config/env.js'
import { PrismaModule } from '../prisma/prisma.module.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { createTestDatabase } from '../testing/integration/test-database.js'
import { testEnv } from '../testing/test-env.js'

import { defineQueue } from './queue-definition.js'
import { QueueModule } from './queue.module.js'
import { PG_BOSS_SCHEMA, QueueService } from './queue.service.js'

const fastPolling = { pollingIntervalSeconds: 0.5 }

const testQueue = defineQueue({
  name: 'test.echo',
  payload: z.object({ value: z.number() }),
})

const exclusiveQueue = defineQueue({
  name: 'test.exclusive',
  payload: z.object({ key: z.string() }),
  singletonKey: ({ key }) => key,
  options: { policy: 'exclusive' },
})

interface Context {
  databaseUrl: string
  moduleRef: TestingModule
  queue: QueueService
  prisma: PrismaService
}

const openContexts: Context[] = []

/** Worker-role queue module on a fresh database */
async function createContext(): Promise<Context> {
  const databaseUrl = await createTestDatabase()
  const moduleRef = await Test.createTestingModule({
    // Queue before Prisma: destroy hooks then run Prisma's first, so the
    // shutdown test fails unless Prisma waits for onApplicationShutdown
    imports: [QueueModule.forRoot({ role: 'worker' }), PrismaModule, ConfigModule],
  })
    .overrideProvider(ENV)
    .useValue({ ...testEnv, DATABASE_URL: databaseUrl })
    .compile()
  moduleRef.useLogger(false)
  await moduleRef.init()

  const context = {
    databaseUrl,
    moduleRef,
    queue: moduleRef.get(QueueService),
    prisma: moduleRef.get(PrismaService),
  }
  openContexts.push(context)
  return context
}

/** A promise with its resolve function (Promise.withResolvers needs lib es2024) */
function deferred<T = undefined>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function countJobs(prisma: PrismaService, name: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT count(*)::int AS count FROM ${PG_BOSS_SCHEMA}.job WHERE name = $1`,
    name
  )
  return rows[0]?.count ?? 0
}

/** Open connections to the context's database, seen from the admin database */
async function countConnections(databaseUrl: string): Promise<number> {
  const client = new pg.Client({ connectionString: inject('adminDatabaseUrl') })
  await client.connect()
  try {
    const { rows } = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1',
      [new URL(databaseUrl).pathname.slice(1)]
    )
    return rows[0]?.count ?? 0
  } finally {
    await client.end()
  }
}

afterEach(async () => {
  await Promise.all(openContexts.splice(0).map(({ moduleRef }) => moduleRef.close()))
})

describe('QueueService', () => {
  it('delivers the validated payload to a worker', async () => {
    const { queue } = await createContext()
    const received = deferred<{ value: number }>()
    await queue.work(
      testQueue,
      (payload) => {
        received.resolve(payload)
        return Promise.resolve()
      },
      fastPolling
    )

    await queue.send(testQueue, { value: 42 })

    await expect(received.promise).resolves.toEqual({ value: 42 })
  })

  it('rejects an invalid payload without creating a job', async () => {
    const { queue, prisma } = await createContext()

    // @ts-expect-error -- the payload type is checked at compile time too
    await expect(queue.send(testQueue, { value: 'not a number' })).rejects.toThrow(z.ZodError)
    expect(await countJobs(prisma, testQueue.name)).toBe(0)
  })

  it('drops a duplicate while a job with the same key is queued', async () => {
    const { queue, prisma } = await createContext()

    const first = await queue.send(exclusiveQueue, { key: 'a' })
    const duplicate = await queue.send(exclusiveQueue, { key: 'a' })
    const otherKey = await queue.send(exclusiveQueue, { key: 'b' })

    expect(first).toEqual(expect.any(String))
    expect(duplicate).toBeNull()
    expect(otherKey).toEqual(expect.any(String))
    expect(await countJobs(prisma, exclusiveQueue.name)).toBe(2)
  })

  it('creates a job only if the surrounding transaction commits', async () => {
    const { queue, prisma } = await createContext()
    const rollback = new Error('rollback')

    await expect(
      prisma.$transaction(async (tx) => {
        await queue.send(testQueue, { value: 1 }, { tx })
        throw rollback
      })
    ).rejects.toBe(rollback)
    expect(await countJobs(prisma, testQueue.name)).toBe(0)

    await prisma.$transaction(async (tx) => {
      await queue.send(testQueue, { value: 2 }, { tx })
    })
    expect(await countJobs(prisma, testQueue.name)).toBe(1)
  })

  it('waits for a running job on shutdown, with the database still connected', async () => {
    const context = await createContext()
    const { queue, prisma, moduleRef, databaseUrl } = context
    openContexts.splice(openContexts.indexOf(context), 1)

    const started = deferred()
    const release = deferred()
    let finished = false
    await queue.work(
      testQueue,
      async () => {
        started.resolve(undefined)
        await release.promise
        // Fails if Prisma disconnected before the worker drained
        await prisma.$queryRaw`SELECT 1`
        finished = true
      },
      fastPolling
    )
    await queue.send(testQueue, { value: 1 })
    await started.promise

    let closed = false
    const closing = moduleRef.close().then(() => {
      closed = true
    })
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(closed).toBe(false)

    release.resolve(undefined)
    await closing
    expect(finished).toBe(true)
    // Prisma reconnects on a query after $disconnect; a handler running after
    // it would leave a pool behind. Backends may take a moment to exit.
    await expect.poll(() => countConnections(databaseUrl)).toBe(0)
  })
})
