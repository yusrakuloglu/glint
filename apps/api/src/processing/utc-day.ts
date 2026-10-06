const DAY_MS = 24 * 60 * 60 * 1000

/** Midnight UTC of the day `date` falls on */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** Midnight UTC, `days` days after the day `date` falls on */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(startOfUtcDay(date).getTime() + days * DAY_MS)
}

/** `YYYY-MM-DD` of the UTC day, as Postgres reads a `date` */
export function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}
