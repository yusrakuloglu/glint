import { describe, expect, it } from 'vitest'

import { parseEnv } from './env.js'

const SUPABASE_URL = 'https://abcdefgh.supabase.co'
const DATABASE_URL = 'postgresql://glint:glint@localhost:5432/glint'
const base = { DATABASE_URL, SUPABASE_URL }

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv(base)).toEqual({ ...base, API_PORT: 3001 })
  })

  it('coerces the port', () => {
    expect(parseEnv({ ...base, API_PORT: '4000' }).API_PORT).toBe(4000)
  })

  it('strips a trailing slash from the Supabase URL', () => {
    expect(parseEnv({ ...base, SUPABASE_URL: `${SUPABASE_URL}/` }).SUPABASE_URL).toBe(SUPABASE_URL)
  })

  it.each([
    ['missing Supabase URL', { DATABASE_URL }],
    ['missing database URL', { SUPABASE_URL }],
    ['non-Postgres database URL', { ...base, DATABASE_URL: 'mysql://localhost/glint' }],
    ['Supabase URL with a path', { ...base, SUPABASE_URL: `${SUPABASE_URL}/rest/v1/` }],
    ['non-http Supabase URL', { ...base, SUPABASE_URL: 'ftp://abcdefgh.supabase.co' }],
    ['invalid port', { ...base, API_PORT: 'abc' }],
  ])('rejects %s', (_, source) => {
    expect(() => parseEnv(source)).toThrow(/Invalid environment variables/)
  })
})
