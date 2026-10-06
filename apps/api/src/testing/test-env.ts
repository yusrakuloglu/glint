import { type Env } from '../config/env.js'

export const testEnv: Env = {
  // Never connected in unit tests; integration tests point it at a container
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  API_PORT: 3001,
  WEB_ORIGIN: 'http://localhost:3000',
  SUPABASE_URL: 'https://test-project.supabase.co',
}
