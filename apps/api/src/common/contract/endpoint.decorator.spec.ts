import { type Server } from 'node:http'

import { Controller, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'

import { JWT_KEY_RESOLVER } from '../../auth/access-token-verifier.js'
import { AuthModule } from '../../auth/auth.module.js'
import { ConfigModule } from '../../config/config.module.js'
import { ENV } from '../../config/env.js'
import { createTestTokenIssuer, type TestTokenIssuer } from '../../testing/access-tokens.js'
import { testEnv } from '../../testing/test-env.js'
import { CommonModule } from '../common.module.js'

import { defineEndpoint, type EndpointInput, type EndpointResult } from './endpoint-contract.js'
import { Endpoint, Input } from './endpoint.decorator.js'

const itemSchema = z.object({ id: z.string(), name: z.string() })

const updateItem = defineEndpoint({
  method: 'PATCH',
  path: '/items/:id',
  operationId: 'updateItem',
  summary: 'Update an item',
  tag: 'test',
  params: z.object({ id: z.uuid() }),
  query: z.object({ dryRun: z.stringbool().default(false) }),
  body: z.strictObject({ name: z.string().min(1) }),
  response: { status: 200, description: 'Updated', schema: itemSchema },
})

const brokenResponse = defineEndpoint({
  method: 'GET',
  path: '/broken',
  operationId: 'broken',
  summary: 'Returns a value that violates its schema',
  tag: 'test',
  auth: 'public',
  response: { status: 200, description: 'Never valid', schema: itemSchema },
})

const deleteItem = defineEndpoint({
  method: 'DELETE',
  path: '/items/:id',
  operationId: 'deleteItem',
  summary: 'Delete an item',
  tag: 'test',
  auth: 'public',
  response: { status: 204, description: 'Deleted' },
})

@Controller()
class TestController {
  @Endpoint(updateItem)
  update(@Input() input: EndpointInput<typeof updateItem>): EndpointResult<typeof updateItem> {
    const item = {
      id: input.params.id,
      name: `${input.body.name}:${String(input.query.dryRun)}`,
      // Extra fields must not reach the client
      secret: 'x',
    }
    return item
  }

  @Endpoint(brokenResponse)
  broken() {
    return { id: 1 }
  }

  @Endpoint(deleteItem)
  remove(): EndpointResult<typeof deleteItem> {
    return undefined
  }
}

const ITEM_ID = '5f0c8e9a-3b7d-4c21-8f6e-1a2b3c4d5e6f'
const USER_ID = '0b9a4c1e-6f43-4f6b-9a63-2f7d4a6f1c11'

describe('@Endpoint', () => {
  let app: INestApplication<Server>
  let issuer: TestTokenIssuer
  let token: string

  beforeAll(async () => {
    issuer = await createTestTokenIssuer()
    token = await issuer.sign(USER_ID)
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, CommonModule, AuthModule],
      controllers: [TestController],
    })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .overrideProvider(JWT_KEY_RESOLVER)
      .useValue(issuer.keyResolver)
      .compile()
    app = moduleRef.createNestApplication({ logger: false })
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  const patch = (path: string, body: unknown, auth = true) => {
    const req = request(app.getHttpServer())
      .patch(path)
      .send(body as object)
    return auth ? req.set('authorization', `Bearer ${token}`) : req
  }

  it('passes parsed input and serializes the response', async () => {
    const response = await patch(`/items/${ITEM_ID}?dryRun=true`, { name: 'new' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ id: ITEM_ID, name: 'new:true' })
  })

  it('applies schema defaults', async () => {
    const response = await patch(`/items/${ITEM_ID}`, { name: 'new' })

    expect(response.body).toEqual({ id: ITEM_ID, name: 'new:false' })
  })

  it('reports every invalid part with its path', async () => {
    const response = await patch('/items/not-a-uuid?dryRun=maybe', { name: '' })

    expect(response.status).toBe(400)
    const problem = JSON.parse(response.text) as { code: string; errors: { path: string }[] }
    expect(problem.code).toBe('validation_failed')
    expect(problem.errors.map((error) => error.path)).toEqual([
      'params.id',
      'query.dryRun',
      'body.name',
    ])
  })

  it('rejects unknown body fields', async () => {
    const response = await patch(`/items/${ITEM_ID}`, { name: 'new', userId: USER_ID })

    expect(response.status).toBe(400)
    expect(JSON.parse(response.text)).toMatchObject({
      errors: [{ path: 'body', message: expect.stringContaining('userId') as unknown }],
    })
  })

  it('authenticates before validating', async () => {
    const response = await patch('/items/not-a-uuid', {}, false)

    expect(response.status).toBe(401)
  })

  it('turns a response that violates its schema into a 500', async () => {
    const response = await request(app.getHttpServer()).get('/broken')

    expect(response.status).toBe(500)
    expect(JSON.parse(response.text)).toMatchObject({ code: 'internal_error' })
  })

  it('uses the contract status and sends no body for 204', async () => {
    const response = await request(app.getHttpServer()).delete(`/items/${ITEM_ID}`)

    expect(response.status).toBe(204)
    expect(response.text).toBe('')
  })

  it('infers handler types from the contract', () => {
    expectTypeOf<EndpointInput<typeof updateItem>>().toEqualTypeOf<{
      params: { id: string }
      query: { dryRun: boolean }
      body: { name: string }
    }>()
    expectTypeOf<EndpointInput<typeof deleteItem>['body']>().toEqualTypeOf<undefined>()
    expectTypeOf<EndpointResult<typeof updateItem>>().toEqualTypeOf<{ id: string; name: string }>()
    expectTypeOf<EndpointResult<typeof deleteItem>>().toEqualTypeOf<undefined>()
  })
})
