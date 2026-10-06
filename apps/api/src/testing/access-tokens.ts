import { randomUUID } from 'node:crypto'

import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose'

import { testEnv } from './test-env.js'

export interface TestTokenOptions {
  /** Claims to add or override; `undefined` removes a default claim */
  claims?: Record<string, unknown>
  /** Seconds until expiry; negative for an expired token */
  expiresIn?: number
}

export interface TestTokenIssuer {
  /** Drop-in replacement for the Supabase JWKS resolver */
  keyResolver: JWTVerifyGetKey
  sign(userId: string, options?: TestTokenOptions): Promise<string>
}

const KEY_ID = 'test-key'

/** Issues ES256 tokens shaped like Supabase access tokens, verified offline. */
export async function createTestTokenIssuer(): Promise<TestTokenIssuer> {
  const { privateKey, publicKey } = await generateKeyPair('ES256')
  const jwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'ES256' }

  return {
    keyResolver: createLocalJWKSet({ keys: [jwk] }),
    async sign(userId, { claims = {}, expiresIn = 3600 } = {}) {
      const now = Math.floor(Date.now() / 1000)
      const defaults: JWTPayload = {
        iss: `${testEnv.SUPABASE_URL}/auth/v1`,
        aud: 'authenticated',
        sub: userId,
        role: 'authenticated',
        iat: now,
        exp: now + expiresIn,
        session_id: randomUUID(),
      }
      const payload = Object.fromEntries(
        Object.entries({ ...defaults, ...claims }).filter(([, value]) => value !== undefined)
      )
      return new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
        .sign(privateKey)
    },
  }
}
