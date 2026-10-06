import { writeFile } from 'node:fs/promises'

import { createOpenApiDocument } from './openapi-document.js'

// Run from dist/ by `pnpm --filter @glint/api openapi:generate`; writes apps/api/openapi.json,
// the input of packages/api-client. A unit test fails when the file is stale.
const target = new URL('../../openapi.json', import.meta.url)

await writeFile(target, `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`)
console.log(`OpenAPI document written to ${target.pathname}`)
