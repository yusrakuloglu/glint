import { type Queue } from 'pg-boss'
import { type z } from 'zod'

/**
 * A queue's name, payload schema and pg-boss settings in one place. Producers
 * and consumers both go through the definition, so the payload is validated on
 * send and parsed again on receive.
 */
export interface QueueDefinition<TPayload extends z.ZodType = z.ZodType> {
  /** pg-boss queue name: letters, digits, `_`, `-`, `.`, `/` */
  name: string
  payload: TPayload
  /**
   * Key for the queue's singleton policy (e.g. `exclusive`): pg-boss rejects a
   * second job with the same key while one is queued or running.
   */
  singletonKey?: (payload: z.output<TPayload>) => string
  options?: Omit<Queue, 'name'>
}

export function defineQueue<TPayload extends z.ZodType>(
  definition: QueueDefinition<TPayload>
): QueueDefinition<TPayload> {
  return definition
}
