import { type IncomingMessage, type ServerResponse } from 'node:http'

import { type AuthUser } from '../auth/auth-user.js'

/**
 * The parts of the Express request the API relies on. Express extends
 * IncomingMessage, so node:http types suffice without @types/express.
 */
export interface HttpRequest extends IncomingMessage {
  originalUrl?: string
  requestId?: string
  user?: AuthUser
  /** Request parts validated against the endpoint contract */
  input?: Partial<Record<'params' | 'query' | 'body', unknown>>
  params?: Record<string, string>
  query?: unknown
  body?: unknown
}

export type HttpResponse = ServerResponse
