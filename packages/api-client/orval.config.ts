import { defineConfig } from 'orval'

export default defineConfig({
  glint: {
    input: {
      // Committed by `pnpm --filter @glint/api openapi:generate`
      target: '../../apps/api/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/generated/endpoints',
      schemas: 'src/generated/models',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: 'src/fetcher.ts', name: 'apiFetch' },
        fetch: {
          // Hooks resolve to the response body; errors are thrown as ApiProblemError
          includeHttpResponseReturnType: false,
        },
        query: {
          version: 5,
          signal: true,
        },
        operations: {
          listLinks: {
            query: {
              useQuery: true,
              useInfinite: true,
              useInfiniteQueryParam: 'cursor',
            },
          },
        },
      },
    },
  },
})
