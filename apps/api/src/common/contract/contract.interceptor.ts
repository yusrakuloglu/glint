import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { map, type Observable } from 'rxjs'
import { type z } from 'zod'

import { type HttpRequest } from '../http.js'
import { type FieldError, ProblemException } from '../problem-details.js'

import { type EndpointContract } from './endpoint-contract.js'

export const CONTRACT_KEY = 'glint:contract'

type RequestPart = 'params' | 'query' | 'body'

function toFieldErrors(part: RequestPart, error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: [part, ...issue.path.map(String)].join('.'),
    message: issue.message,
  }))
}

/**
 * Validates params, query and body against the contract before the handler
 * runs (after guards, so unauthenticated requests get 401, not 400), and
 * parses the handler's result with the response schema so only documented
 * fields leave the API.
 */
@Injectable()
export class ContractInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const contract = this.reflector.get<EndpointContract | undefined>(
      CONTRACT_KEY,
      context.getHandler()
    )
    if (contract === undefined) {
      throw new Error('ContractInterceptor used without @Endpoint()')
    }

    const request = context.switchToHttp().getRequest<HttpRequest>()
    const input: Partial<Record<RequestPart, unknown>> = {}
    const errors: FieldError[] = []

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = contract[part]
      if (schema === undefined) {
        continue
      }
      const result = schema.safeParse(request[part])
      if (result.success) {
        input[part] = result.data
      } else {
        errors.push(...toFieldErrors(part, result.error))
      }
    }

    if (errors.length > 0) {
      throw new ProblemException({
        status: 400,
        code: 'validation_failed',
        detail: 'The request is invalid. See errors for details.',
        errors,
      })
    }
    request.input = input

    const responseSchema = contract.response.schema
    // A response that does not match its schema is a bug: the ZodError
    // reaches the problem filter and becomes a 500
    return next
      .handle()
      .pipe(
        map((value) => (responseSchema === undefined ? undefined : responseSchema.parse(value)))
      )
  }
}
