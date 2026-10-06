import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { type HttpRequest } from '../common/http.js'

import { AccessTokenVerifier, invalidTokenProblem } from './access-token-verifier.js'
import { IS_PUBLIC_KEY } from './public.decorator.js'

const BEARER = /^Bearer[ ]+(\S+)$/i

/** Global guard: every route requires a Supabase access token unless @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: AccessTokenVerifier
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic === true) {
      return true
    }

    const request = context.switchToHttp().getRequest<HttpRequest>()
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1]
    if (token === undefined) {
      throw invalidTokenProblem('Missing bearer token')
    }

    request.user = await this.verifier.verify(token)
    return true
  }
}
