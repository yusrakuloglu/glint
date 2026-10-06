import { Controller } from '@nestjs/common'

import { type EndpointResult } from '../common/contract/endpoint-contract.js'
import { Endpoint } from '../common/contract/endpoint.decorator.js'

import { healthCheck } from './health.contracts.js'

@Controller()
export class HealthController {
  @Endpoint(healthCheck)
  check(): EndpointResult<typeof healthCheck> {
    return { status: 'ok' }
  }
}
