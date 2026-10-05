import { describe, expect, it } from 'vitest'

import { InvalidUrlError, MAX_URL_LENGTH, normalizeUrl } from './normalize-url.js'

describe('normalizeUrl', () => {
  it.each([
    ['lowercases scheme and host', 'HTTPS://Example.COM/Path', 'https://example.com/Path'],
    ['trims whitespace', '  https://example.com/a  ', 'https://example.com/a'],
    ['adds root path', 'https://example.com', 'https://example.com/'],
    ['converts IDN to punycode', 'https://bücher.example/', 'https://xn--bcher-kva.example/'],
    ['removes default https port', 'https://example.com:443/a', 'https://example.com/a'],
    ['removes default http port', 'http://example.com:80/a', 'http://example.com/a'],
    ['keeps non-default port', 'https://example.com:8443/a', 'https://example.com:8443/a'],
    ['removes trailing dot in host', 'https://example.com./a', 'https://example.com/a'],
    ['removes fragment', 'https://example.com/a#section-2', 'https://example.com/a'],
    ['removes empty fragment', 'https://example.com/a#', 'https://example.com/a'],
    ['keeps hash-bang route', 'https://example.com/#!/post/1', 'https://example.com/#!/post/1'],
    ['keeps hash route', 'https://example.com/#/post/1', 'https://example.com/#/post/1'],
    [
      'removes utm params',
      'https://example.com/a?utm_source=x&UTM_Medium=y',
      'https://example.com/a',
    ],
    [
      'removes click ids and keeps others',
      'https://example.com/a?fbclid=1&id=5&gclid=2',
      'https://example.com/a?id=5',
    ],
    ['keeps ref param', 'https://example.com/a?ref=home', 'https://example.com/a?ref=home'],
    [
      'sorts params by key',
      'https://example.com/a?b=2&a=1&c=3',
      'https://example.com/a?a=1&b=2&c=3',
    ],
    [
      'keeps order of duplicate keys',
      'https://example.com/a?t=2&a=1&t=1',
      'https://example.com/a?a=1&t=2&t=1',
    ],
    ['removes empty query', 'https://example.com/a?', 'https://example.com/a'],
    ['removes empty segments', 'https://example.com/a?&a=1&&b=2&', 'https://example.com/a?a=1&b=2'],
    ['keeps valueless params as is', 'https://example.com/a?amp', 'https://example.com/a?amp'],
    [
      'keeps value encoding',
      'https://example.com/a?q=a%20b&p=x/y',
      'https://example.com/a?p=x/y&q=a%20b',
    ],
    ['encodes spaces in path', 'https://example.com/a b', 'https://example.com/a%20b'],
    ['keeps path case', 'https://example.com/Docs/API', 'https://example.com/Docs/API'],
    ['keeps trailing slash', 'https://example.com/a/', 'https://example.com/a/'],
    ['keeps www', 'https://www.example.com/', 'https://www.example.com/'],
    ['keeps http scheme', 'http://example.com/', 'http://example.com/'],
  ])('%s', (_, input, expected) => {
    expect(normalizeUrl(input)).toBe(expected)
  })

  it('is idempotent', () => {
    const once = normalizeUrl('HTTPS://Example.com:443/a b?utm_source=x&b=2&a=1#top')
    expect(normalizeUrl(once)).toBe(once)
  })

  it.each([
    ['unparseable', 'not a url'],
    ['unparseable', ''],
    ['unparseable', 'https://./'],
    ['unsupported_protocol', 'ftp://example.com/'],
    ['unsupported_protocol', 'javascript:alert(1)'],
    ['unsupported_protocol', 'file:///etc/passwd'],
    ['has_credentials', 'https://user:pass@example.com/'],
    ['has_credentials', 'https://user@example.com/'],
    ['too_long', `https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`],
  ])('rejects with %s: %s', (reason, input) => {
    expect(() => normalizeUrl(input)).toThrow(expect.objectContaining({ reason }))
    expect(() => normalizeUrl(input)).toThrow(InvalidUrlError)
  })

  it('accepts a URL of exactly the maximum length', () => {
    const base = 'https://example.com/'
    const url = base + 'a'.repeat(MAX_URL_LENGTH - base.length)
    expect(normalizeUrl(url)).toHaveLength(MAX_URL_LENGTH)
  })
})
