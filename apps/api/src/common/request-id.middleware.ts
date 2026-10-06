import { randomUUID } from 'node:crypto'

import { Injectable, type NestMiddleware } from '@nestjs/common'

import { type HttpRequest, type HttpResponse } from './http.js'

export const REQUEST_ID_HEADER = 'x-request-id'

// Accept a caller-provided id (e.g. from a proxy) only if it is safe to log
const SAFE_REQUEST_ID = /^[\w-]{1,64}$/

/** Tags every request with an id that appears in logs and problem responses. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware<HttpRequest, HttpResponse> {
  use(request: HttpRequest, response: HttpResponse, next: () => void) {
    const incoming = request.headers[REQUEST_ID_HEADER]
    const requestId =
      typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID()

    request.requestId = requestId
    response.setHeader(REQUEST_ID_HEADER, requestId)
    next()
  }
}
