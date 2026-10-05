import { randomBytes } from 'node:crypto'

import pg from 'pg'
import { inject } from 'vitest'

import { TEMPLATE_DATABASE } from './global-setup.js'

/** Clones the migrated template into a fresh database and returns its URL. */
export async function createTestDatabase(): Promise<string> {
  const adminUrl = inject('adminDatabaseUrl')
  const name = `test_${randomBytes(6).toString('hex')}`

  const client = new pg.Client({ connectionString: adminUrl })
  await client.connect()
  try {
    // Identifiers cannot be parameters; the name is generated above
    await client.query(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE_DATABASE}"`)
  } finally {
    await client.end()
  }

  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  return url.toString()
}
