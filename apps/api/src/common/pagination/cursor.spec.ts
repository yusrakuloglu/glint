import { describe, expect, it } from 'vitest'

import { decodeCursor, encodeCursor, pageQuerySchema, toPage } from './cursor.js'

const id = '01920000-0000-7000-8000-000000000001'
const createdAt = new Date('2026-10-05T12:34:56.789Z')

describe('cursor', () => {
  it('round-trips with millisecond precision', () => {
    expect(decodeCursor(encodeCursor({ createdAt, id }))).toEqual({ createdAt, id })
  })

  it('is URL safe', () => {
    expect(encodeCursor({ createdAt, id })).toMatch(/^[\w-]+$/)
  })

  it.each([
    ['garbage', 'not-a-cursor'],
    ['empty', ''],
    ['wrong version', Buffer.from(JSON.stringify({ v: 2, createdAt, id })).toString('base64url')],
    [
      'non-uuid id',
      Buffer.from(JSON.stringify({ v: 1, createdAt, id: "1' OR 1=1" })).toString('base64url'),
    ],
    [
      'invalid date',
      Buffer.from(JSON.stringify({ v: 1, createdAt: 'x', id })).toString('base64url'),
    ],
  ])('rejects %s', (_, value) => {
    expect(decodeCursor(value)).toBeUndefined()
  })
})

describe('pageQuerySchema', () => {
  it('defaults the limit', () => {
    expect(pageQuerySchema.parse({})).toEqual({ limit: 20 })
  })

  it('decodes the cursor', () => {
    expect(pageQuerySchema.parse({ cursor: encodeCursor({ createdAt, id }), limit: '5' })).toEqual({
      cursor: { createdAt, id },
      limit: 5,
    })
  })

  it.each([['0'], ['101'], ['1.5'], ['abc']])('rejects limit %s', (limit) => {
    expect(pageQuerySchema.safeParse({ limit }).success).toBe(false)
  })

  it('reports an invalid cursor on its own path', () => {
    const result = pageQuerySchema.safeParse({ cursor: 'nope' })

    expect(result.error?.issues).toMatchObject([{ path: ['cursor'], message: 'Invalid cursor' }])
  })
})

describe('toPage', () => {
  const rows = [3, 2, 1].map((n) => ({ id: `${id.slice(0, -1)}${String(n)}`, createdAt }))

  it('returns a cursor to the last item when more rows exist', () => {
    const page = toPage(rows, 2)

    expect(page.items).toEqual(rows.slice(0, 2))
    expect(decodeCursor(page.nextCursor ?? '')).toEqual(rows[1])
  })

  it('returns no cursor on the last page', () => {
    expect(toPage(rows, 3).nextCursor).toBeNull()
    expect(toPage([], 3)).toEqual({ items: [], nextCursor: null })
  })
})
