import { z } from 'zod'

const DEFAULT_PORT = 3001
const DEFAULT_AI_DAILY_LIMIT = 50
const DEFAULT_AI_MAX_DEFER_DAYS = 7

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
  /** Browser origin of the web app, allowed by CORS */
  WEB_ORIGIN: z
    .url({ protocol: /^https?$/ })
    .default('http://localhost:3000')
    .transform((value) => new URL(value).origin),
  SUPABASE_URL: z
    .url({ protocol: /^https?$/ })
    .refine((value) => new URL(value).pathname === '/', {
      message: 'Must be the project URL without a path, e.g. https://<ref>.supabase.co',
    })
    .transform((value) => new URL(value).origin),
  /** AI-backed processing runs per user and UTC day; extra pages wait for a later day */
  AI_DAILY_LIMIT_PER_USER: z.coerce.number().int().min(1).default(DEFAULT_AI_DAILY_LIMIT),
  /**
   * How many UTC days, from today, a page over the limit may wait. Each waiting
   * page keeps its snapshot, so this bounds snapshot storage per user.
   */
  AI_MAX_DEFER_DAYS: z.coerce.number().int().min(1).max(30).default(DEFAULT_AI_MAX_DEFER_DAYS),
})

export type Env = z.infer<typeof envSchema>

export const ENV = Symbol('ENV')

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
