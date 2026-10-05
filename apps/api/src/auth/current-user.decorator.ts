import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import { type HttpRequest } from '../common/http.js'

import { type AuthUser } from './auth-user.js'

/** Injects the authenticated caller. Only valid on routes not marked @Public(). */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<HttpRequest>().user
    if (user === undefined) {
      // A @Public() route asked for a user: a programming error, not a client error
      throw new Error('CurrentUser used on a route without authentication')
    }
    return user
  }
)
