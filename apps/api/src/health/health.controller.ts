import { Controller, Get } from '@nestjs/common'

import { Public } from '../auth/public.decorator.js'

export interface HealthResponse {
  status: 'ok'
}

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' }
  }
}
