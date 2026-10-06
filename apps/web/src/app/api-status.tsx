'use client'

import { useGetHealth } from '@glint/api-client/health'

/** Calls the API through the generated, typed client. */
export function ApiStatus() {
  const { data, error, isPending } = useGetHealth()

  let message: string
  if (isPending) {
    message = 'API: checking…'
  } else if (error !== null) {
    message = `API: unreachable (${error.problem.code})`
  } else {
    message = `API: ${data.status}`
  }

  return (
    <p role="status" className="text-sm">
      {message}
    </p>
  )
}
