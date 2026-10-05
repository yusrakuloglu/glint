import { type Server } from 'node:http'

import { Controller, Get, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { errors, generateSecret, type JWTVerifyGetKey, SignJWT, UnsecuredJWT } from 'jose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CommonModule } from '../common/common.module.js'
import { ConfigModule } from '../config/config.module.js'
import { ENV } from '../config/env.js'
import { createTestTokenIssuer, type TestTokenIssuer } from '../testing/access-tokens.js'
import { testEnv } from '../testing/test-env.js'

import { JWT_KEY_RESOLVER } from './access-token-verifier.js'
import { type AuthUser } from './auth-user.js'
import { AuthModule } from './auth.module.js'
import { CurrentUser } from './current-user.decorator.js'
import { Public } from './public.decorator.js'

@Controller('test')
class TestController {
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user
  }

  @Public()
  @Get('open')
  open() {
    return { open: true }
  }
}

const USER_ID = '0b9a4c1e-6f43-4f6b-9a63-2f7d4a6f1c11'

describe('AuthGuard', () => {
  let app: INestApplication<Server>
  let issuer: TestTokenIssuer
  let resolveKey: JWTVerifyGetKey

  beforeAll(async () => {
    issuer = await createTestTokenIssuer()
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, CommonModule, AuthModule],
      controllers: [TestController],
    })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .overrideProvider(JWT_KEY_RESOLVER)
      // Indirection so single tests can simulate an unavailable JWKS
      .useValue(((header, token) => resolveKey(header, token)) satisfies JWTVerifyGetKey)
      .compile()
    app = moduleRef.createNestApplication({ logger: false })
    await app.init()
  })

  beforeEach(() => {
    resolveKey = issuer.keyResolver
  })

  afterAll(async () => {
    await app.close()
  })

  const getMe = (authorization?: string) => {
    const req = request(app.getHttpServer()).get('/test/me')
    return authorization === undefined ? req : req.set('authorization', authorization)
  }

  function expectUnauthenticated(response: request.Response) {
    expect(response.status).toBe(401)
    expect(response.headers['www-authenticate']).toBe('Bearer')
    expect(JSON.parse(response.text)).toMatchObject({ code: 'unauthenticated' })
  }

  describe('accepts', () => {
    it('a valid token and exposes the user id', async () => {
      const response = await getMe(`Bearer ${await issuer.sign(USER_ID)}`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ id: USER_ID })
    })

    it('a case-insensitive scheme', async () => {
      const response = await getMe(`bearer ${await issuer.sign(USER_ID)}`)

      expect(response.status).toBe(200)
    })

    it('a token expired within the clock tolerance', async () => {
      const response = await getMe(`Bearer ${await issuer.sign(USER_ID, { expiresIn: -2 })}`)

      expect(response.status).toBe(200)
    })

    it('requests to public routes without a token', async () => {
      const response = await request(app.getHttpServer()).get('/test/open')

      expect(response.status).toBe(200)
    })
  })

  describe('rejects with 401', () => {
    it('a missing Authorization header', async () => {
      const response = await getMe()

      expectUnauthenticated(response)
      expect(JSON.parse(response.text)).toMatchObject({ detail: 'Missing bearer token' })
    })

    it('a non-Bearer scheme', async () => {
      expectUnauthenticated(await getMe('Basic dXNlcjpwYXNz'))
    })

    it('a malformed token', async () => {
      expectUnauthenticated(await getMe('Bearer not-a-jwt'))
    })

    it('an expired token', async () => {
      expectUnauthenticated(await getMe(`Bearer ${await issuer.sign(USER_ID, { expiresIn: -60 })}`))
    })

    it.each([
      ['wrong issuer', { iss: 'https://other.supabase.co/auth/v1' }],
      ['wrong audience', { aud: 'anon' }],
      ['anon role', { role: 'anon' }],
      ['service_role', { role: 'service_role' }],
      ['anonymous user', { is_anonymous: true }],
      ['non-uuid subject', { sub: 'admin' }],
      ['missing subject', { sub: undefined }],
      ['missing expiry', { exp: undefined }],
    ])('a token with %s', async (_, claims) => {
      expectUnauthenticated(await getMe(`Bearer ${await issuer.sign(USER_ID, { claims })}`))
    })

    it('a token signed by an unknown key with the same kid', async () => {
      const attacker = await createTestTokenIssuer()

      expectUnauthenticated(await getMe(`Bearer ${await attacker.sign(USER_ID)}`))
    })

    it('an unsigned token (alg: none)', async () => {
      const token = new UnsecuredJWT({ sub: USER_ID, role: 'authenticated' })
        .setIssuer(`${testEnv.SUPABASE_URL}/auth/v1`)
        .setAudience('authenticated')
        .setExpirationTime('1h')
        .encode()

      expectUnauthenticated(await getMe(`Bearer ${token}`))
    })

    it('an HS256 token (algorithm confusion)', async () => {
      const token = await new SignJWT({ sub: USER_ID, role: 'authenticated' })
        .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
        .setIssuer(`${testEnv.SUPABASE_URL}/auth/v1`)
        .setAudience('authenticated')
        .setExpirationTime('1h')
        .sign(await generateSecret('HS256'))

      expectUnauthenticated(await getMe(`Bearer ${token}`))
    })
  })

  describe('returns 503 when the JWKS is unavailable', () => {
    it.each([
      ['network error', new TypeError('fetch failed')],
      ['timeout', new errors.JWKSTimeout()],
      ['bad JWKS response', new errors.JOSEError('Expected 200 OK')],
    ])('%s', async (_, error) => {
      resolveKey = () => Promise.reject(error)

      const response = await getMe(`Bearer ${await issuer.sign(USER_ID)}`)

      expect(response.status).toBe(503)
      expect(JSON.parse(response.text)).toMatchObject({ code: 'service_unavailable' })
    })
  })
})
