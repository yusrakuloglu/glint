import { z } from 'zod'

import { defineQueue } from '../queue/queue-definition.js'

/** Transient failures (provider 429/5xx, timeouts) retry with exponential backoff */
const retry = { retryLimit: 5, retryDelay: 30, retryBackoff: true } as const

/** First pipeline step: turns a page snapshot into article text (Readability). */
export const contentExtractQueue = defineQueue({
  name: 'content.extract',
  payload: z.object({ contentId: z.uuid() }),
  // Exclusive per content: saves of the same URL while a job is queued or
  // running do not start a second pipeline
  singletonKey: ({ contentId }) => contentId,
  options: { policy: 'exclusive', ...retry },
})
