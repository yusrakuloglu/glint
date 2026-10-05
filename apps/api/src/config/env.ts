import { z } from 'zod'

const DEFAULT_PORT = 3001

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
  SUPABASE_URL: z
    .url({ protocol: /^https?$/ })
    .refine((value) => new URL(value).pathname === '/', {
      message: 'Must be the project URL without a path, e.g. https://<ref>.supabase.co',
    })
    .transform((value) => new URL(value).origin),
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
