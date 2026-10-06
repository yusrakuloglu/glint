import { Inject, Injectable, Logger } from '@nestjs/common'
import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { z } from 'zod'

import { ProblemException } from '../common/problem-details.js'
import { ENV, type Env } from '../config/env.js'

import { type AuthUser } from './auth-user.js'

/** Resolves the verification key for a token; the Supabase JWKS in production. */
export const JWT_KEY_RESOLVER = Symbol('JWT_KEY_RESOLVER')

// Asymmetric only: rejects `none` and HS256 tokens forged with a public key
const ALLOWED_ALGORITHMS = ['ES256', 'RS256']
const AUDIENCE = 'authenticated'
const CLOCK_TOLERANCE_SECONDS = 5

// jose errors that mean "this token is not acceptable". Anything else
// (timeouts, network errors, a broken JWKS response) is an upstream failure.
const INVALID_TOKEN_ERROR_CODES = new Set<string>([
  errors.JWTClaimValidationFailed.code,
  errors.JWTExpired.code,
  errors.JOSEAlgNotAllowed.code,
  errors.JOSENotSupported.code,
  errors.JWSInvalid.code,
  errors.JWTInvalid.code,
  errors.JWKInvalid.code,
  errors.JWKSNoMatchingKey.code,
  errors.JWKSMultipleMatchingKeys.code,
  errors.JWSSignatureVerificationFailed.code,
])

const claimsSchema = z.object({
  sub: z.uuid(),
  role: z.literal('authenticated'),
  is_anonymous: z.boolean().optional(),
})

export function invalidTokenProblem(detail: string): ProblemException {
  return new ProblemException({
    status: 401,
    code: 'unauthenticated',
    detail,
    // RFC 6750: tell the client which scheme to use
    headers: { 'www-authenticate': 'Bearer' },
  })
}

@Injectable()
export class AccessTokenVerifier {
  private readonly logger = new Logger(AccessTokenVerifier.name)
  private readonly issuer: string

  constructor(
    @Inject(JWT_KEY_RESOLVER) private readonly getKey: JWTVerifyGetKey,
    @Inject(ENV) env: Env
  ) {
    this.issuer = `${env.SUPABASE_URL}/auth/v1`
  }

  async verify(token: string): Promise<AuthUser> {
    let payload: unknown
    try {
      ;({ payload } = await jwtVerify(token, this.getKey, {
        issuer: this.issuer,
        audience: AUDIENCE,
        algorithms: ALLOWED_ALGORITHMS,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ['exp', 'sub'],
      }))
    } catch (error) {
      if (error instanceof errors.JOSEError && INVALID_TOKEN_ERROR_CODES.has(error.code)) {
        throw invalidTokenProblem('Invalid or expired access token')
      }
      this.logger.error('Could not verify access token', error)
      throw new ProblemException({
        status: 503,
        code: 'service_unavailable',
        detail: 'Authentication service is unavailable',
      })
    }

    const claims = claimsSchema.safeParse(payload)
    if (!claims.success || claims.data.is_anonymous === true) {
      throw invalidTokenProblem('Invalid or expired access token')
    }
    return { id: claims.data.sub }
  }
}
