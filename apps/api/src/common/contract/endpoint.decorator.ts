import {
  applyDecorators,
  createParamDecorator,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common'

import { Public } from '../../auth/public.decorator.js'
import { type HttpRequest } from '../http.js'

import { CONTRACT_KEY, ContractInterceptor } from './contract.interceptor.js'
import { type EndpointContract, type HttpMethod } from './endpoint-contract.js'

const routeDecorators: Record<HttpMethod, (path: string) => MethodDecorator> = {
  GET: Get,
  POST: Post,
  PUT: Put,
  PATCH: Patch,
  DELETE: Delete,
}

/** Registers a route from its contract: path, status, auth and validation. */
export function Endpoint(contract: EndpointContract) {
  return applyDecorators(
    routeDecorators[contract.method](contract.path),
    HttpCode(contract.response.status),
    SetMetadata(CONTRACT_KEY, contract),
    UseInterceptors(ContractInterceptor),
    ...(contract.auth === 'public' ? [Public()] : [])
  )
}

/** Injects the validated request parts. Type it with EndpointInput<typeof contract>. */
export const Input = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const input = context.switchToHttp().getRequest<HttpRequest>().input
  if (input === undefined) {
    throw new Error('@Input() used on a route without @Endpoint()')
  }
  return input
})
