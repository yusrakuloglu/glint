import { type Server } from 'node:http'

import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '../app.module.js'
import { ENV } from '../config/env.js'
import { testEnv } from '../testing/test-env.js'

describe('GET /health', () => {
  let app: INestApplication<Server>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })

  it('returns 404 for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/unknown')

    expect(response.status).toBe(404)
  })
})
