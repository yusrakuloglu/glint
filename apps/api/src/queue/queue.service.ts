import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common'
import { fromPrisma, type Job, PgBoss, type SendOptions, type WorkOptions } from 'pg-boss'
import { type z } from 'zod'

import { ENV, type Env } from '../config/env.js'
import { type Prisma } from '../generated/prisma/client.js'

import { type QueueDefinition } from './queue-definition.js'

/** pg-boss keeps its tables in their own schema, outside Prisma's migrations */
export const PG_BOSS_SCHEMA = 'pgboss'

/** How long a graceful stop waits for running jobs before giving up */
const STOP_TIMEOUT_MS = 30_000

export interface QueueModuleOptions {
  /**
   * `api` only produces jobs and starts pg-boss on the first send. `worker`
   * starts it on boot and also runs maintenance and cron schedules, so those
   * live in a single process.
   */
  role: 'api' | 'worker'
}

export const QUEUE_MODULE_OPTIONS = Symbol('QUEUE_MODULE_OPTIONS')

export interface EnqueueOptions extends Pick<SendOptions, 'startAfter'> {
  /** Sends the job in this Prisma transaction: it exists only if the transaction commits */
  tx?: Prisma.TransactionClient
}

export type JobHandler<TPayload extends z.ZodType> = (
  payload: z.output<TPayload>,
  job: Job<unknown>
) => Promise<void>

export type ConsumeOptions = Pick<WorkOptions, 'localConcurrency' | 'pollingIntervalSeconds'>

@Injectable()
export class QueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name)
  private readonly boss: PgBoss
  private starting: Promise<PgBoss> | undefined
  /** Queues created (or updated) by this process, by name */
  private readonly ensuredQueues = new Map<string, Promise<void>>()

  constructor(
    @Inject(ENV) env: Env,
    @Inject(QUEUE_MODULE_OPTIONS) private readonly options: QueueModuleOptions
  ) {
    const isWorker = options.role === 'worker'
    this.boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: PG_BOSS_SCHEMA,
      application_name: `glint-${options.role}`,
      supervise: isWorker,
      schedule: isWorker,
    })
    // Without a listener an EventEmitter 'error' crashes the process
    this.boss.on('error', (error) => {
      this.logger.error(error)
    })
  }

  async onApplicationBootstrap() {
    if (this.options.role === 'worker') {
      await this.start()
    }
  }

  async onModuleDestroy() {
    if (this.starting === undefined) return
    await this.starting.catch(() => undefined)
    // Graceful: stops fetching, then waits for running handlers. Prisma
    // disconnects later (onApplicationShutdown), so handlers can still query.
    await this.boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS })
  }

  /**
   * Validates the payload and creates a job. Returns the job id, or `null`
   * when the queue's singleton policy rejected it as a duplicate.
   */
  async send<TPayload extends z.ZodType>(
    queue: QueueDefinition<TPayload>,
    payload: z.input<TPayload>,
    { tx, ...options }: EnqueueOptions = {}
  ): Promise<string | null> {
    const data = queue.payload.parse(payload)
    const boss = await this.ensureQueue(queue)
    return boss.send(queue.name, data as object, {
      ...options,
      ...(queue.singletonKey && { singletonKey: queue.singletonKey(data) }),
      ...(tx && { db: fromPrisma(tx) }),
    })
  }

  /**
   * Runs `handler` for each job. A thrown error fails the attempt and pg-boss
   * retries it according to the queue's retry options.
   */
  async work<TPayload extends z.ZodType>(
    queue: QueueDefinition<TPayload>,
    handler: JobHandler<TPayload>,
    options: ConsumeOptions = {}
  ): Promise<void> {
    const boss = await this.ensureQueue(queue)
    await boss.work<unknown>(queue.name, options, async ([job]) => {
      if (job === undefined) return
      // A payload that does not parse is a bug, not a transient error; it
      // still fails loudly so the job stays visible in pg-boss
      await handler(queue.payload.parse(job.data), job)
    })
  }

  private start(): Promise<PgBoss> {
    this.starting ??= this.boss.start()
    return this.starting
  }

  /**
   * createQueue is a no-op for an existing queue, so changed options are
   * applied with updateQueue. Policy and partitioning are fixed at creation.
   */
  private async ensureQueue(queue: QueueDefinition): Promise<PgBoss> {
    const boss = await this.start()
    let ensured = this.ensuredQueues.get(queue.name)
    if (ensured === undefined) {
      const { policy: _policy, partition: _partition, ...updatable } = queue.options ?? {}
      ensured = (async () => {
        await boss.createQueue(queue.name, queue.options)
        if (Object.keys(updatable).length > 0) {
          await boss.updateQueue(queue.name, updatable)
        }
      })()
      // A failed attempt is retried on the next call instead of being cached
      ensured.catch(() => this.ensuredQueues.delete(queue.name))
      this.ensuredQueues.set(queue.name, ensured)
    }
    await ensured
    return boss
  }
}
