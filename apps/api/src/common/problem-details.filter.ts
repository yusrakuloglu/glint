import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common'

import { Prisma } from '../generated/prisma/client.js'

import { type HttpRequest, type HttpResponse } from './http.js'
import {
  codeForStatus,
  PROBLEM_CONTENT_TYPE,
  type ProblemDetails,
  ProblemException,
  problemType,
} from './problem-details.js'

/**
 * Turns every error into an RFC 9457 problem response.
 * Only 4xx details reach the client; 5xx details stay in the logs.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp()
    const request = http.getRequest<HttpRequest>()
    const response = http.getResponse<HttpResponse>()

    const problem = this.toProblem(exception)

    if (problem.status >= 500) {
      this.logger.error(
        `${request.method ?? ''} ${request.originalUrl ?? request.url ?? ''} failed (requestId=${request.requestId ?? '-'})`,
        exception instanceof Error ? exception.stack : String(exception)
      )
    }

    const body: ProblemDetails = {
      type: problemType(problem.code),
      title: problem.title,
      status: problem.status,
      ...(problem.detail !== undefined && { detail: problem.detail }),
      instance: (request.originalUrl ?? request.url ?? '').split('?')[0],
      code: problem.code,
      ...(request.requestId !== undefined && { requestId: request.requestId }),
      ...(problem.errors !== undefined && { errors: problem.errors }),
    }

    if (response.headersSent) {
      // Streaming responses cannot be replaced; just end them
      response.end()
      return
    }
    for (const [name, value] of Object.entries(problem.headers)) {
      response.setHeader(name, value)
    }
    response.statusCode = problem.status
    response.setHeader('content-type', `${PROBLEM_CONTENT_TYPE}; charset=utf-8`)
    response.end(JSON.stringify(body))
  }

  private toProblem(exception: unknown): ProblemException {
    if (exception instanceof ProblemException) {
      return exception
    }

    if (exception instanceof HttpException) {
      // Nest built-ins: unknown routes, malformed JSON bodies, payload limits
      const status = exception.getStatus()
      const code = codeForStatus(status)
      return new ProblemException({
        status,
        code,
        ...(status < 500 && { detail: exception.message }),
      })
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Services check ownership and existence themselves; these are races
      // (two concurrent saves, a row deleted between read and write)
      if (exception.code === 'P2002') {
        return new ProblemException({ status: 409, code: 'conflict' })
      }
      if (exception.code === 'P2025') {
        return new ProblemException({ status: 404, code: 'not_found' })
      }
    }

    // Anything else is a bug, including ZodErrors from internal parsing:
    // request validation converts its own errors to 400 problems
    return new ProblemException({ status: 500, code: 'internal_error' })
  }
}
