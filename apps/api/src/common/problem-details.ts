import { z } from 'zod'

/** Stable, machine-readable error codes. Clients branch on these, not on titles. */
export const problemCodes = [
  'bad_request',
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'not_found',
  'method_not_allowed',
  'conflict',
  'payload_too_large',
  'unsupported_media_type',
  'too_many_requests',
  'internal_error',
  'service_unavailable',
] as const

export type ProblemCode = (typeof problemCodes)[number]

const defaultTitles: Record<ProblemCode, string> = {
  bad_request: 'Bad request',
  validation_failed: 'Validation failed',
  unauthenticated: 'Authentication required',
  forbidden: 'Forbidden',
  not_found: 'Not found',
  method_not_allowed: 'Method not allowed',
  conflict: 'Conflict',
  payload_too_large: 'Payload too large',
  unsupported_media_type: 'Unsupported media type',
  too_many_requests: 'Too many requests',
  internal_error: 'Internal server error',
  service_unavailable: 'Service unavailable',
}

export const fieldErrorSchema = z
  .object({
    /** Dot path inside the request, e.g. `body.url` or `query.limit` */
    path: z.string(),
    message: z.string(),
  })
  .meta({ id: 'FieldError' })

/** RFC 9457 Problem Details with Glint's extension members. */
export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    code: z.enum(problemCodes),
    requestId: z.string().optional(),
    errors: z.array(fieldErrorSchema).optional(),
  })
  .meta({ id: 'ProblemDetails' })

export type FieldError = z.infer<typeof fieldErrorSchema>
export type ProblemDetails = z.infer<typeof problemDetailsSchema>

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

export function problemType(code: ProblemCode): string {
  return `/problems/${code.replaceAll('_', '-')}`
}

export interface ProblemOptions {
  status: number
  code: ProblemCode
  title?: string
  detail?: string
  errors?: FieldError[]
  /** Extra response headers, e.g. WWW-Authenticate on 401 */
  headers?: Record<string, string>
}

/** Thrown anywhere in the API; the global filter turns it into a problem response. */
export class ProblemException extends Error {
  readonly status: number
  readonly code: ProblemCode
  readonly title: string
  readonly detail: string | undefined
  readonly errors: FieldError[] | undefined
  readonly headers: Record<string, string>

  constructor(options: ProblemOptions) {
    const title = options.title ?? defaultTitles[options.code]
    super(options.detail ?? title)
    this.name = 'ProblemException'
    this.status = options.status
    this.code = options.code
    this.title = title
    this.detail = options.detail
    this.errors = options.errors
    this.headers = options.headers ?? {}
  }
}

const codeByStatus: Partial<Record<number, ProblemCode>> = {
  400: 'bad_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  429: 'too_many_requests',
  503: 'service_unavailable',
}

export function codeForStatus(status: number): ProblemCode {
  return codeByStatus[status] ?? (status < 500 ? 'bad_request' : 'internal_error')
}
