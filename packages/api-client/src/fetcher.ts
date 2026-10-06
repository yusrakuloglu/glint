import type { ProblemDetails } from './generated/models'

export interface ApiClientConfig {
  /** API origin, e.g. http://localhost:3001 */
  baseUrl: string
  /** Supabase access token of the signed-in user; null for anonymous calls */
  getAccessToken?: () => string | null | Promise<string | null>
}

let config: ApiClientConfig | undefined

/** Call once at app start, before any generated hook runs. */
export function configureApiClient(next: ApiClientConfig): void {
  config = next
}

/** Thrown for every non-2xx response; `problem.code` is the stable error code. */
export class ApiProblemError extends Error {
  constructor(
    readonly problem: ProblemDetails,
    readonly response: Response
  ) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiProblemError'
  }
}

const PROBLEM_CONTENT_TYPE = 'application/problem+json'

async function toProblem(response: Response): Promise<ProblemDetails> {
  if (response.headers.get('content-type')?.startsWith(PROBLEM_CONTENT_TYPE) === true) {
    return (await response.json()) as ProblemDetails
  }
  // Not from our API (proxy, gateway): keep the same shape for callers
  return {
    type: 'about:blank',
    title: response.statusText || 'Request failed',
    status: response.status,
    code: response.status >= 500 ? 'internal_error' : 'bad_request',
  }
}

/** orval mutator: every generated request goes through here. */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  if (config === undefined) {
    throw new Error('configureApiClient() must be called before using the API client')
  }

  const headers = new Headers(init.headers)
  const token = await config.getAccessToken?.()
  if (token != null) {
    headers.set('authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${config.baseUrl}${url}`, { ...init, headers })
  if (!response.ok) {
    throw new ApiProblemError(await toProblem(response), response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

/** Error type of generated hooks (orval reads this export from the mutator). */
export type ErrorType<_Error> = ApiProblemError
