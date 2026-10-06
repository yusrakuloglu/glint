import { existsSync } from 'node:fs'

import type { NextConfig } from 'next'

// Next only reads .env files next to this config; local dev keeps all variables
// in the repo-root .env. Existing variables are not overridden.
const rootEnvFile = new URL('../../.env', import.meta.url)
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile)
}

const nextConfig: NextConfig = {
  // Internal packages ship TypeScript source (decisions 014, 024)
  transpilePackages: ['@glint/api-client'],
}

export default nextConfig
