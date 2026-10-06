import { describe, expect, it } from 'vitest'

import { addUtcDays, startOfUtcDay, toUtcDateString } from './utc-day.js'

describe('UTC day helpers', () => {
  it('uses the UTC day, not the local one', () => {
    // 01:30 in Istanbul (UTC+3) is still the previous day in UTC
    const date = new Date('2026-10-06T22:30:00Z')

    expect(startOfUtcDay(date).toISOString()).toBe('2026-10-06T00:00:00.000Z')
    expect(toUtcDateString(date)).toBe('2026-10-06')
  })

  it('treats the last millisecond as the same day and midnight as the next', () => {
    expect(toUtcDateString(new Date('2026-10-06T23:59:59.999Z'))).toBe('2026-10-06')
    expect(toUtcDateString(new Date('2026-10-07T00:00:00.000Z'))).toBe('2026-10-07')
  })

  it('adds days from midnight across month and year ends', () => {
    expect(addUtcDays(new Date('2026-10-31T15:00:00Z'), 1).toISOString()).toBe(
      '2026-11-01T00:00:00.000Z'
    )
    expect(addUtcDays(new Date('2026-12-31T23:00:00Z'), 1).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z'
    )
    expect(addUtcDays(new Date('2026-10-06T12:00:00Z'), 0).toISOString()).toBe(
      '2026-10-06T00:00:00.000Z'
    )
  })
})
