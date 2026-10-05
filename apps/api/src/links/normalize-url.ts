export const MAX_URL_LENGTH = 2048

export type InvalidUrlReason =
  'unparseable' | 'unsupported_protocol' | 'has_credentials' | 'too_long'

export class InvalidUrlError extends Error {
  constructor(readonly reason: InvalidUrlReason) {
    super(`Invalid URL: ${reason}`)
    this.name = 'InvalidUrlError'
  }
}

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'yclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  '_ga',
  'ref_src',
])

function isTrackingParam(rawKey: string): boolean {
  let key: string
  try {
    key = decodeURIComponent(rawKey.replaceAll('+', ' ')).toLowerCase()
  } catch {
    // Malformed percent-encoding: not a known tracking key
    return false
  }
  return key.startsWith('utm_') || TRACKING_PARAMS.has(key)
}

/**
 * Removes tracking parameters and sorts the rest by key.
 * Works on raw segments instead of URLSearchParams, which would re-encode
 * values (`/` → `%2F`, `%20` → `+`, `?a` → `?a=`) and change the URL.
 */
function normalizeSearch(search: string): string {
  const segments = search
    .slice(1)
    .split('&')
    .filter((segment) => segment !== '')
    .map((segment) => ({ segment, key: segment.split('=', 1)[0] ?? '' }))
    .filter(({ key }) => !isTrackingParam(key))

  // Array.prototype.sort is stable: duplicate keys keep their order
  segments.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  return segments.length === 0 ? '' : `?${segments.map(({ segment }) => segment).join('&')}`
}

/** Old SPA routes live in the fragment, so these fragments identify a page. */
function isRoutingFragment(hash: string): boolean {
  return hash.startsWith('#!') || hash.startsWith('#/')
}

/**
 * Returns the canonical form used to share one Content per URL.
 * Conservative on purpose: path case, trailing slashes, `www.` and the
 * scheme are kept, because they can point to different resources.
 * Rules and rationale: docs/learn/url-normalizasyonu.md
 */
export function normalizeUrl(input: string): string {
  let url: URL
  try {
    // WHATWG parsing lowercases scheme and host, converts IDN to punycode,
    // drops default ports and normalizes percent-encoding
    url = new URL(input.trim())
  } catch {
    throw new InvalidUrlError('unparseable')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidUrlError('unsupported_protocol')
  }
  if (url.username !== '' || url.password !== '') {
    throw new InvalidUrlError('has_credentials')
  }

  const hostname = url.hostname.replace(/\.$/, '')
  if (hostname === '') {
    throw new InvalidUrlError('unparseable')
  }
  url.hostname = hostname

  url.search = normalizeSearch(url.search)
  if (!isRoutingFragment(url.hash)) {
    url.hash = ''
  }

  const normalized = url.href
  if (normalized.length > MAX_URL_LENGTH) {
    throw new InvalidUrlError('too_long')
  }
  return normalized
}
