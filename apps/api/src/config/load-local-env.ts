import { existsSync } from 'node:fs'

/**
 * Local dev reads the repo-root .env; deployed environments set variables directly.
 * Resolved from this file so every entrypoint (api, worker) finds the same file.
 */
export function loadLocalEnv() {
  const rootEnvFile = new URL('../../../../.env', import.meta.url)
  if (existsSync(rootEnvFile)) {
    process.loadEnvFile(rootEnvFile)
  }
}
