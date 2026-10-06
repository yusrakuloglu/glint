import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { type TestProject } from 'vitest/node'

const execFileAsync = promisify(execFile)

// Same image as docker-compose.yml, so tests run against the local setup
const IMAGE = 'pgvector/pgvector:pg17'
export const TEMPLATE_DATABASE = 'glint_template'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connection URL of the container's maintenance database */
    adminDatabaseUrl: string
  }
}

/**
 * Starts Postgres once per run and migrates a template database. Each test
 * file clones the template (CREATE DATABASE ... TEMPLATE), which is much
 * faster than migrating and keeps files isolated while running in parallel.
 */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer(IMAGE)
    .withDatabase(TEMPLATE_DATABASE)
    .withUsername('glint')
    .withPassword('glint')
    .start()

  await execFileAsync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: new URL('../../..', import.meta.url),
    // prisma.config.ts loads the repo .env only for variables not set here
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
  })

  const adminUrl = new URL(container.getConnectionUri())
  adminUrl.pathname = '/postgres'
  project.provide('adminDatabaseUrl', adminUrl.toString())

  return async () => {
    await container.stop()
  }
}
