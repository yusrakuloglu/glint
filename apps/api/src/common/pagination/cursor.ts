import { z } from 'zod'

/** Position after the last item of a page in (createdAt DESC, id DESC) order. */
export interface Cursor {
  createdAt: Date
  id: string
}

const CURSOR_VERSION = 1

const payloadSchema = z.object({
  v: z.literal(CURSOR_VERSION),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
})

/** Opaque to clients: base64url JSON, versioned so the format can change. */
export function encodeCursor({ createdAt, id }: Cursor): string {
  const payload: z.input<typeof payloadSchema> = {
    v: CURSOR_VERSION,
    createdAt: createdAt.toISOString(),
    id,
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeCursor(value: string): Cursor | undefined {
  try {
    const json: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    const payload = payloadSchema.parse(json)
    return { createdAt: new Date(payload.createdAt), id: payload.id }
  } catch {
    return undefined
  }
}

/** Query parameter schema: invalid cursors become a `query.cursor` validation error. */
export const cursorParamSchema = z.string().transform((value, ctx) => {
  const cursor = decodeCursor(value)
  if (cursor === undefined) {
    ctx.addIssue({ code: 'custom', message: 'Invalid cursor' })
    return z.NEVER
  }
  return cursor
})

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const pageQuerySchema = z.object({
  cursor: cursorParamSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    /** Pass as `cursor` to get the next page; null on the last page */
    nextCursor: z.string().nullable(),
  })
}

/**
 * Splits `limit + 1` rows into a page: the extra row only signals that
 * another page exists, so no separate COUNT query is needed.
 */
export function toPage<T extends Cursor>(rows: T[], limit: number) {
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last) : null,
  }
}
