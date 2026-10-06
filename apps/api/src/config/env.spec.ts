import { describe, expect, it } from 'vitest'

import { parseEnv } from './env.js'

const SUPABASE_URL = 'https://abcdefgh.supabase.co'

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv({ SUPABASE_URL })).toEqual({ API_PORT: 3001, SUPABASE_URL })
  })

  it('coerces the port', () => {
    expect(parseEnv({ SUPABASE_URL, API_PORT: '4000' }).API_PORT).toBe(4000)
  })

  it('strips a trailing slash from the Supabase URL', () => {
    expect(parseEnv({ SUPABASE_URL: `${SUPABASE_URL}/` }).SUPABASE_URL).toBe(SUPABASE_URL)
  })

  it.each([
    ['missing Supabase URL', {}],
    ['Supabase URL with a path', { SUPABASE_URL: `${SUPABASE_URL}/rest/v1/` }],
    ['non-http Supabase URL', { SUPABASE_URL: 'ftp://abcdefgh.supabase.co' }],
    ['invalid port', { SUPABASE_URL, API_PORT: 'abc' }],
  ])('rejects %s', (_, source) => {
    expect(() => parseEnv(source)).toThrow(/Invalid environment variables/)
  })
})
