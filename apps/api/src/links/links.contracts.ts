import { z } from 'zod'

import { defineEndpoint } from '../common/contract/endpoint-contract.js'
import { pageQuerySchema, pageSchema } from '../common/pagination/cursor.js'
import { ContentStatus } from '../generated/prisma/enums.js'

import { InvalidUrlError, normalizeUrl } from './normalize-url.js'

const TAG = 'links'
const MAX_INPUT_URL_LENGTH = 4096
const MAX_TITLE_LENGTH = 500
const MAX_NOTE_LENGTH = 10_000
/** Serialized DOM of the page; extraction runs in the worker (Phase 3 plan, 1c) */
const MAX_PAGE_HTML_LENGTH = 5_000_000
/** BCP 47 language tags fit in 35 characters */
const MAX_LANG_LENGTH = 35

/**
 * JSON body limit of POST /links, in bytes. Above MAX_PAGE_HTML_LENGTH for
 * JSON escaping and the other fields; every other route keeps Nest's 100 KB.
 */
export const SAVE_LINK_BODY_LIMIT = '6mb'

const urlMessages: Record<InvalidUrlError['reason'], string> = {
  unparseable: 'Must be a valid URL',
  unsupported_protocol: 'Only http and https URLs can be saved',
  has_credentials: 'URLs with a username or password cannot be saved',
  too_long: 'URL is too long',
}

/** Accepts any URL string and yields both the original and the normalized form. */
const savedUrlSchema = z
  .string()
  .max(MAX_INPUT_URL_LENGTH)
  .transform((value, ctx) => {
    try {
      return { original: value.trim(), normalized: normalizeUrl(value) }
    } catch (error) {
      if (!(error instanceof InvalidUrlError)) {
        throw error
      }
      ctx.addIssue({ code: 'custom', message: urlMessages[error.reason] })
      return z.NEVER
    }
  })

const titleSchema = z.string().trim().min(1).max(MAX_TITLE_LENGTH)
const pageInputSchema = z.strictObject({
  /** `document.documentElement.outerHTML` */
  html: z.string().min(1).max(MAX_PAGE_HTML_LENGTH),
  /** `document.documentElement.lang`, if set */
  lang: z.string().trim().min(1).max(MAX_LANG_LENGTH).optional(),
})
const noteSchema = z.string().max(MAX_NOTE_LENGTH)
// Handlers return Date; clients receive an ISO 8601 string. The pipe keeps the
// output documented as `string (date-time)` in OpenAPI
const timestampSchema = z
  .date()
  .transform((date) => date.toISOString())
  .pipe(z.iso.datetime())

export const linkSchema = z
  .object({
    id: z.uuid(),
    /** URL as the user saved it */
    url: z.string(),
    /** Normalized URL shared by everyone who saved the same page */
    canonicalUrl: z.string(),
    /** User's title, falling back to the page title */
    title: z.string().nullable(),
    siteName: z.string().nullable(),
    excerpt: z.string().nullable(),
    summary: z.string().nullable(),
    /** AI tag suggestions for the page */
    suggestedTags: z.array(z.string()),
    /**
     * Processing status of the page. AWAITING_CONTENT: no page content has
     * been sent yet (the server does not fetch pages).
     */
    status: z.enum(ContentStatus),
    note: z.string().nullable(),
    readAt: timestampSchema.nullable(),
    /** When the user saved the link; refreshed when a deleted link is saved again */
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .meta({ id: 'Link' })

const linkIdParams = z.object({ id: z.uuid() })

export const createLink = defineEndpoint({
  method: 'POST',
  path: '/links',
  operationId: 'createLink',
  summary: 'Save a link',
  tag: TAG,
  body: z.strictObject({
    url: savedUrlSchema,
    title: titleSchema.optional(),
    note: noteSchema.optional(),
    /** Page content captured by the client; starts processing unless the page is already processed */
    page: pageInputSchema.optional(),
  }),
  response: {
    status: 201,
    // Nest sets one success status per route, so repeat saves also return 201
    description:
      'The saved link. Idempotent: saving an already saved URL returns the existing link; ' +
      'saving a deleted one restores it.',
    schema: linkSchema,
  },
})

export const getLink = defineEndpoint({
  method: 'GET',
  path: '/links/:id',
  operationId: 'getLink',
  summary: 'Get a saved link',
  tag: TAG,
  params: linkIdParams,
  response: { status: 200, description: 'The saved link', schema: linkSchema },
})

export const listLinks = defineEndpoint({
  method: 'GET',
  path: '/links',
  operationId: 'listLinks',
  summary: 'List saved links, newest first',
  tag: TAG,
  query: pageQuerySchema,
  response: {
    status: 200,
    description: 'A page of saved links',
    schema: pageSchema(linkSchema).meta({ id: 'LinkPage' }),
  },
})

export const updateLink = defineEndpoint({
  method: 'PATCH',
  path: '/links/:id',
  operationId: 'updateLink',
  summary: 'Update a saved link',
  tag: TAG,
  params: linkIdParams,
  body: z
    .strictObject({
      /** null falls back to the page title */
      title: titleSchema.nullable().optional(),
      note: noteSchema.nullable().optional(),
      /** Marks the link read (keeps the first read time) or unread */
      read: z.boolean().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' }),
  response: { status: 200, description: 'The updated link', schema: linkSchema },
})

export const deleteLink = defineEndpoint({
  method: 'DELETE',
  path: '/links/:id',
  operationId: 'deleteLink',
  summary: 'Delete a saved link',
  tag: TAG,
  params: linkIdParams,
  response: {
    status: 204,
    description: 'Deleted. Saving the same URL again restores the link with its highlights.',
  },
})
