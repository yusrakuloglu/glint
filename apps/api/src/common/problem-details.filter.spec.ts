import { type Server } from 'node:http'

import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { Prisma } from '../generated/prisma/client.js'

import { CommonModule } from './common.module.js'
import { ProblemException } from './problem-details.js'

@Controller('test')
class TestController {
  @Get('problem')
  problem() {
    throw new ProblemException({
      status: 400,
      code: 'validation_failed',
      detail: 'Request is invalid',
      errors: [{ path: 'body.url', message: 'Invalid URL' }],
      headers: { 'x-extra': 'yes' },
    })
  }

  @Get('nest-exception')
  nestException() {
    throw new NotFoundException('Link not found')
  }

  @Get('crash')
  crash() {
    throw new Error('database password is hunter2')
  }

  @Get('zod-error')
  zodError() {
    // Internal parsing errors are bugs, not client errors
    return z.string().parse(42)
  }

  @Get('prisma/:code')
  prisma(@Param('code') code: string) {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on (url)', {
      code,
      clientVersion: 'test',
    })
  }

  @Post('echo')
  echo(@Body() body: unknown) {
    return body
  }
}

describe('ProblemDetailsFilter', () => {
  let app: INestApplication<Server>

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const moduleRef = await Test.createTestingModule({
      imports: [CommonModule],
      controllers: [TestController],
    }).compile()
    app = moduleRef.createNestApplication({ logger: false })
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('renders a ProblemException as problem+json', async () => {
    const response = await request(app.getHttpServer()).get('/test/problem?x=1')

    expect(response.status).toBe(400)
    expect(response.headers['content-type']).toBe('application/problem+json; charset=utf-8')
    expect(response.headers['x-extra']).toBe('yes')
    expect(JSON.parse(response.text)).toEqual({
      type: '/problems/validation-failed',
      title: 'Validation failed',
      status: 400,
      detail: 'Request is invalid',
      instance: '/test/problem',
      code: 'validation_failed',
      requestId: response.headers['x-request-id'],
      errors: [{ path: 'body.url', message: 'Invalid URL' }],
    })
  })

  it('maps Nest HTTP exceptions by status and keeps 4xx details', async () => {
    const response = await request(app.getHttpServer()).get('/test/nest-exception')

    expect(response.status).toBe(404)
    expect(JSON.parse(response.text)).toMatchObject({
      code: 'not_found',
      title: 'Not found',
      detail: 'Link not found',
    })
  })

  it('returns not_found for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/nope')

    expect(response.status).toBe(404)
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
    expect(JSON.parse(response.text)).toMatchObject({ code: 'not_found', instance: '/nope' })
  })

  it('hides details of unexpected errors', async () => {
    const response = await request(app.getHttpServer()).get('/test/crash')

    expect(response.status).toBe(500)
    expect(response.text).not.toContain('hunter2')
    expect(JSON.parse(response.text)).toMatchObject({
      code: 'internal_error',
      title: 'Internal server error',
    })
    expect(JSON.parse(response.text)).not.toHaveProperty('detail')
  })

  it('treats internal ZodErrors as server errors', async () => {
    const response = await request(app.getHttpServer()).get('/test/zod-error')

    expect(response.status).toBe(500)
    expect(JSON.parse(response.text)).toMatchObject({ code: 'internal_error' })
  })

  it.each([
    ['P2002', 409, 'conflict'],
    ['P2025', 404, 'not_found'],
    ['P2003', 500, 'internal_error'],
  ])('maps Prisma error %s to %i', async (prismaCode, status, code) => {
    const response = await request(app.getHttpServer()).get(`/test/prisma/${prismaCode}`)

    expect(response.status).toBe(status)
    expect(JSON.parse(response.text)).toMatchObject({ code })
    expect(response.text).not.toContain('Unique constraint')
  })

  it('returns bad_request for malformed JSON bodies', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/echo')
      .set('content-type', 'application/json')
      .send('{"url":')

    expect(response.status).toBe(400)
    expect(JSON.parse(response.text)).toMatchObject({ code: 'bad_request' })
  })

  it('reuses a safe incoming request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/test/problem')
      .set('x-request-id', 'proxy-123')

    expect(response.headers['x-request-id']).toBe('proxy-123')
    expect(JSON.parse(response.text)).toMatchObject({ requestId: 'proxy-123' })
  })

  it.each([
    ['with spaces', 'bad id <script>'],
    ['too long', 'a'.repeat(65)],
  ])('replaces an unsafe incoming request id (%s)', async (_, unsafeId) => {
    const response = await request(app.getHttpServer())
      .get('/test/problem')
      .set('x-request-id', unsafeId)

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })
})
