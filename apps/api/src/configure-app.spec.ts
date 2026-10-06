import { type Server } from 'node:http'

import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from './app.module.js'
import { ENV } from './config/env.js'
import { configureApp } from './configure-app.js'
import { testEnv } from './testing/test-env.js'

describe('configureApp CORS', () => {
  let app: INestApplication<Server>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .compile()
    app = moduleRef.createNestApplication({ logger: false })
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  const preflight = (origin: string) =>
    request(app.getHttpServer())
      .options('/links')
      .set('origin', origin)
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'authorization,content-type')

  it('allows the web app origin with the auth header', async () => {
    const response = await preflight(testEnv.WEB_ORIGIN)

    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(testEnv.WEB_ORIGIN)
    expect(response.headers['access-control-allow-headers']).toContain('authorization')
  })

  it('does not allow other origins', async () => {
    const response = await preflight('https://evil.example')

    // A fixed allowed origin is always echoed; the browser blocks the request
    // because it does not match the calling page's origin
    expect(response.headers['access-control-allow-origin']).toBe(testEnv.WEB_ORIGIN)
  })

  it('exposes the request id to the browser', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('origin', testEnv.WEB_ORIGIN)

    expect(response.headers['access-control-expose-headers']).toBe('x-request-id')
  })
})
