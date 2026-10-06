import { randomUUID } from 'node:crypto'
import { type Server } from 'node:http'

import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../../app.module.js'
import { JWT_KEY_RESOLVER } from '../../auth/access-token-verifier.js'
import { ENV } from '../../config/env.js'
import { PrismaService } from '../../prisma/prisma.service.js'
import { createTestTokenIssuer, type TestTokenIssuer } from '../access-tokens.js'
import { testEnv } from '../test-env.js'

import { createTestDatabase } from './test-database.js'

export interface TestUser {
  id: string
  /** Value for the Authorization header */
  authorization: string
}

export interface TestApp {
  app: INestApplication<Server>
  prisma: PrismaService
  tokens: TestTokenIssuer
  /** Supertest agent bound to the app */
  http: () => ReturnType<typeof request>
  /** A new user with a valid access token */
  createUser: () => Promise<TestUser>
  close: () => Promise<void>
}

/** The full AppModule on a fresh database, with locally signed access tokens. */
export async function createTestApp(): Promise<TestApp> {
  const databaseUrl = await createTestDatabase()
  const tokens = await createTestTokenIssuer()

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue({ ...testEnv, DATABASE_URL: databaseUrl })
    .overrideProvider(JWT_KEY_RESOLVER)
    .useValue(tokens.keyResolver)
    .compile()

  const app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false })
  await app.init()

  return {
    app,
    prisma: app.get(PrismaService),
    tokens,
    http: () => request(app.getHttpServer()),
    async createUser() {
      const id = randomUUID()
      return { id, authorization: `Bearer ${await tokens.sign(id)}` }
    },
    close: () => app.close(),
  }
}
