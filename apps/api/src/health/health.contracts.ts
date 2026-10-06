import { z } from 'zod'

import { defineEndpoint } from '../common/contract/endpoint-contract.js'

export const healthCheck = defineEndpoint({
  method: 'GET',
  path: '/health',
  operationId: 'getHealth',
  summary: 'Liveness check',
  tag: 'health',
  auth: 'public',
  response: {
    status: 200,
    description: 'The API is running',
    schema: z.object({ status: z.literal('ok') }).meta({ id: 'Health' }),
  },
})
