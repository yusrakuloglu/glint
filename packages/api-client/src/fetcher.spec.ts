import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiProblemError, apiFetch, configureApiClient } from './fetcher'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    configureApiClient({ baseUrl: 'http://api.test', getAccessToken: () => 'token-123' })
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('prefixes the base URL and sends the access token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))

    await expect(apiFetch('/health?x=1', { method: 'GET' })).resolves.toEqual({ status: 'ok' })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://api.test/health?x=1')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-123')
    expect(init?.method).toBe('GET')
  })

  it('keeps headers passed by the caller', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))

    await apiFetch('/links', { headers: { 'content-type': 'application/json' } })

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('authorization')).toBe('Bearer token-123')
  })

  it('omits the Authorization header without a token', async () => {
    configureApiClient({ baseUrl: 'http://api.test', getAccessToken: () => Promise.resolve(null) })
    fetchMock.mockResolvedValue(jsonResponse({}))

    await apiFetch('/health')

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has('authorization')).toBe(false)
  })

  it('resolves to undefined for 204 responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiFetch('/links/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('throws ApiProblemError with the problem details', async () => {
    const problem = {
      type: '/problems/not-found',
      title: 'Not found',
      status: 404,
      detail: 'Link not found',
      code: 'not_found',
    }
    fetchMock.mockResolvedValue(
      jsonResponse(problem, {
        status: 404,
        headers: { 'content-type': 'application/problem+json; charset=utf-8' },
      })
    )

    const error = await apiFetch('/links/1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiProblemError)
    expect(error).toMatchObject({ problem, message: 'Link not found' })
  })

  it('wraps non-problem error responses in the same shape', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' })
    )

    const error = await apiFetch('/links').catch((e: unknown) => e)

    expect(error).toMatchObject({
      problem: { status: 502, title: 'Bad Gateway', code: 'internal_error' },
    })
  })
})

describe('apiFetch network failures', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    configureApiClient({ baseUrl: 'http://api.test' })
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('turns an unreachable API into a service_unavailable problem', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await apiFetch('/health').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiProblemError)
    expect(error).toMatchObject({
      problem: { status: 0, code: 'service_unavailable' },
      response: null,
    })
  })

  it('rethrows aborts unchanged', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortError = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValue(abortError)

    await expect(apiFetch('/health', { signal: controller.signal })).rejects.toBe(abortError)
  })
})

describe('apiFetch without configuration', () => {
  it('fails fast', async () => {
    vi.resetModules()
    const fresh = await import('./fetcher')

    await expect(fresh.apiFetch('/health')).rejects.toThrow(/configureApiClient/)
  })
})
