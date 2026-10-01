import { existsSync } from 'node:fs'

import { defineConfig } from 'prisma/config'

// Prisma 7 no longer loads .env files. Local dev uses the repo-root .env;
// CI and production provide DATABASE_URL directly.
const rootEnvFile = new URL('../../.env', import.meta.url)
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile)
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not env(): `prisma generate` must work without a database URL
    url: process.env.DATABASE_URL,
  },
})
