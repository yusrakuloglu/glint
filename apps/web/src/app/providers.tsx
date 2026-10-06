'use client'

import { configureApiClient } from '@glint/api-client/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

configureApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  // Supabase session token comes with auth in Phase 4
  getAccessToken: () => null,
})

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  // One client per browser session; useState keeps it stable across renders
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  )
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
