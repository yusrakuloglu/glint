import { readFile } from 'node:fs/promises'
import { type Server } from 'node:http'

import { type INestApplication } from '@nestjs/common'
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '../app.module.js'
import { CONTRACT_KEY } from '../common/contract/contract.interceptor.js'
import { type EndpointContract } from '../common/contract/endpoint-contract.js'
import { ENV } from '../config/env.js'
import { testEnv } from '../testing/test-env.js'

import { endpoints } from './endpoints.js'
import { createOpenApiDocument } from './openapi-document.js'

describe('OpenAPI', () => {
  let app: INestApplication<Server>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .compile()
    app = moduleRef.createNestApplication({ logger: false })
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('documents every route registered with @Endpoint()', () => {
    const scanner = app.get(MetadataScanner)
    const reflector = app.get(Reflector)
    const registered = app
      .get(DiscoveryService)
      .getControllers()
      .flatMap(({ instance }) => {
        const prototype = Object.getPrototypeOf(instance) as Record<string, () => unknown>
        return scanner.getAllMethodNames(prototype).flatMap((name) => {
          const method = prototype[name]
          return method === undefined
            ? []
            : (reflector.get<EndpointContract | undefined>(CONTRACT_KEY, method) ?? [])
        })
      })

    expect(registered.map((c) => c.operationId).sort()).toEqual(
      endpoints.map((c) => c.operationId).sort()
    )
  })

  it('keeps the committed openapi.json up to date', async () => {
    const committed: unknown = JSON.parse(
      await readFile(new URL('../../openapi.json', import.meta.url), 'utf8')
    )

    expect(
      committed,
      'apps/api/openapi.json is stale: run `pnpm --filter @glint/api openapi:generate`'
    ).toEqual(createOpenApiDocument())
  })

  it('requires the bearer token except on public endpoints', () => {
    const document = createOpenApiDocument()

    expect(document.paths?.['/health']?.get?.security).toEqual([])
    expect(document.paths?.['/links']?.get?.security).toEqual([{ bearerAuth: [] }])
  })

  it('serves the document without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ openapi: '3.1.0', info: { title: 'Glint API' } })
  })

  it('serves the Scalar reference at /docs', async () => {
    const response = await request(app.getHttpServer()).get('/docs')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/^text\/html/)
    expect(response.text).toContain('/openapi.json')
  })
})
