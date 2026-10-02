import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseTokens } from './read-tokens'

const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

describe('parseTokens', () => {
  it('reads primitives and resolves semantic tokens per theme', () => {
    const tokens = parseTokens(`
      :root,
      :host {
        --gray-50: oklch(0.985 0.002 264);
        --gray-950: oklch(0.13 0.028 261);
        --bg: light-dark(var(--gray-50), var(--gray-950));
        --surface: light-dark(white, oklch(0.21 0.034 264));
      }
    `)

    expect(tokens.primitives['gray-50']).toEqual({ l: 0.985, c: 0.002, h: 264 })
    expect(tokens.semantic.light.bg).toEqual({ l: 0.985, c: 0.002, h: 264 })
    expect(tokens.semantic.dark.bg).toEqual({ l: 0.13, c: 0.028, h: 261 })
    expect(tokens.semantic.light.surface).toEqual({ l: 1, c: 0, h: 0 })
    expect(tokens.semantic.dark.surface).toEqual({ l: 0.21, c: 0.034, h: 264 })
  })

  it('ignores comments and declarations outside the token block', () => {
    const tokens = parseTokens(`
      /* :root, :host { --fake: light-dark(white, black); } */
      :root,
      :host {
        color-scheme: light dark;
        --fg: light-dark(black, white);
      }
      :root[data-theme='dark'] { --other: light-dark(white, black); }
    `)

    expect(Object.keys(tokens.semantic.light)).toEqual(['fg'])
  })

  it('throws on a reference to an unknown primitive', () => {
    expect(() => parseTokens(':root, :host { --bg: light-dark(var(--missing), white); }')).toThrow(
      '--bg references unknown primitive --missing'
    )
  })

  it('throws on an unsupported color format', () => {
    expect(() => parseTokens(':root, :host { --bg: light-dark(#fff, white); }')).toThrow(
      'Unsupported color value: #fff'
    )
  })

  it('throws when the token block is missing', () => {
    expect(() => parseTokens('.button { color: red; }')).toThrow('Token block')
  })

  it('resolves every semantic token in tokens.css for both themes', () => {
    const tokens = parseTokens(tokensCss)
    const names = Object.keys(tokens.semantic.light)

    expect(names).toContain('bg')
    expect(names).toContain('primary-fg')
    expect(Object.keys(tokens.semantic.dark)).toEqual(names)
  })
})
