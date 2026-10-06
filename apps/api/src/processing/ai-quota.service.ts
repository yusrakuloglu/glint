import { Inject, Injectable } from '@nestjs/common'

import { ProblemException } from '../common/problem-details.js'
import { ENV, type Env } from '../config/env.js'
import { type Prisma } from '../generated/prisma/client.js'

import { addUtcDays, toUtcDateString } from './utc-day.js'

@Injectable()
export class AiQuotaService {
  private readonly dailyLimit: number
  private readonly maxDeferDays: number

  constructor(@Inject(ENV) env: Env) {
    this.dailyLimit = env.AI_DAILY_LIMIT_PER_USER
    this.maxDeferDays = env.AI_MAX_DEFER_DAYS
  }

  /**
   * Reserves one AI processing run for the user on the first UTC day, from
   * today, that still has room, and returns that day's midnight. A full day
   * defers the run instead of rejecting the save; counting it on the day it
   * runs keeps the limit per day even for deferred work. The search stops
   * after AI_MAX_DEFER_DAYS days (today included) with a 429.
   *
   * Each attempt is one atomic upsert: the row is only incremented while
   * below the limit, so concurrent requests cannot overshoot it.
   */
  async reserve(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<Date> {
    for (let offset = 0; offset < this.maxDeferDays; offset++) {
      const day = addUtcDays(now, offset)
      const rows = await tx.$queryRaw<{ count: number }[]>`
        INSERT INTO ai_usage (user_id, day, count)
        VALUES (${userId}::uuid, ${toUtcDateString(day)}::date, 1)
        ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1
        WHERE ai_usage.count < ${this.dailyLimit}
        RETURNING count`
      if (rows.length > 0) {
        return day
      }
    }
    throw new ProblemException({
      status: 429,
      code: 'too_many_requests',
      detail: `AI processing is booked for the next ${String(this.maxDeferDays)} days`,
    })
  }
}
