import {
  createDocument,
  type ZodOpenApiObject,
  type ZodOpenApiOperationObject,
  type ZodOpenApiPathsObject,
} from 'zod-openapi'

import { type EndpointContract } from '../common/contract/endpoint-contract.js'
import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from '../common/problem-details.js'

import { endpoints } from './endpoints.js'

const BEARER_AUTH = 'bearerAuth'

/** `/links/:id` (Nest) → `/links/{id}` (OpenAPI) */
function toOpenApiPath(path: string): string {
  return path.replaceAll(/:(\w+)/g, '{$1}')
}

function toOperation(contract: EndpointContract): ZodOpenApiOperationObject {
  const { response } = contract
  return {
    operationId: contract.operationId,
    summary: contract.summary,
    tags: [contract.tag],
    security: contract.auth === 'public' ? [] : [{ [BEARER_AUTH]: [] }],
    requestParams: {
      ...(contract.params !== undefined && { path: contract.params }),
      ...(contract.query !== undefined && { query: contract.query }),
    },
    ...(contract.body !== undefined && {
      requestBody: {
        required: true,
        content: { 'application/json': { schema: contract.body } },
      },
    }),
    responses: {
      [response.status]: {
        description: response.description,
        ...(response.schema !== undefined && {
          content: { 'application/json': { schema: response.schema } },
        }),
      },
      // Every error is an RFC 9457 problem; clients branch on `code`
      default: {
        description: 'Error',
        content: { [PROBLEM_CONTENT_TYPE]: { schema: problemDetailsSchema } },
      },
    },
  }
}

export function createOpenApiDocument(contracts: readonly EndpointContract[] = endpoints) {
  const paths: ZodOpenApiPathsObject = {}
  for (const contract of contracts) {
    const path = toOpenApiPath(contract.path)
    paths[path] = {
      ...paths[path],
      [contract.method.toLowerCase()]: toOperation(contract),
    }
  }

  const document: ZodOpenApiObject = {
    openapi: '3.1.0',
    info: {
      title: 'Glint API',
      version: '0.0.0',
      description: 'AI-powered reading memory. Errors use RFC 9457 problem details.',
    },
    components: {
      securitySchemes: {
        [BEARER_AUTH]: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase access token',
        },
      },
    },
    paths,
  }
  return createDocument(document)
}
