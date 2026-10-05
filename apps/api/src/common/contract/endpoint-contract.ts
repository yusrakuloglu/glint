import { type z } from 'zod'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Single source of truth for one endpoint: routing, request validation,
 * response serialization and (later) the OpenAPI document all read it.
 */
export interface EndpointContract {
  method: HttpMethod
  /** Nest route path, e.g. `/links/:id` */
  path: string
  operationId: string
  summary: string
  tag: string
  /** Defaults to `user`: a valid access token is required */
  auth?: 'public' | 'user'
  params?: z.ZodObject
  query?: z.ZodObject
  body?: z.ZodType
  response: {
    status: 200 | 201 | 204
    description: string
    /** Omitted for 204; the handler's return value is parsed with it otherwise */
    schema?: z.ZodType
  }
}

/** Keeps literal types of a contract so handler input and output can be inferred. */
export function defineEndpoint<const C extends EndpointContract>(contract: C): C {
  return contract
}

type OutputOf<C, K extends 'params' | 'query' | 'body'> =
  C extends Record<K, infer S extends z.ZodType> ? z.output<S> : undefined

/** Validated request parts a handler receives through @Input(). */
export interface EndpointInput<C extends EndpointContract> {
  params: OutputOf<C, 'params'>
  query: OutputOf<C, 'query'>
  body: OutputOf<C, 'body'>
}

/** What a handler must return; serialized through the response schema. */
export type EndpointResult<C extends EndpointContract> = C['response'] extends {
  schema: infer S extends z.ZodType
}
  ? z.input<S>
  : undefined
