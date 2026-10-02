import { parseOklch, type Oklch } from './color'

export type ThemeName = 'light' | 'dark'

export interface Tokens {
  primitives: Record<string, Oklch>
  semantic: Record<ThemeName, Record<string, Oklch>>
}

const KEYWORDS: Record<string, Oklch> = {
  white: { l: 1, c: 0, h: 0 },
  black: { l: 0, c: 0, h: 0 },
}

const DECLARATION_PATTERN = /--([\w-]+):\s*([^;]+);/g
const LIGHT_DARK_PATTERN = /^light-dark\(\s*(.+?)\s*,\s*(.+?)\s*\)$/
const VAR_PATTERN = /^var\(--([\w-]+)\)$/

/**
 * Reads the token block (`:root, :host { ... }`) of tokens.css.
 * Primitives are `oklch(...)` values; semantic tokens are `light-dark(<light>, <dark>)`
 * whose sides reference a primitive with `var(--name)` or use a color keyword.
 */
export function parseTokens(css: string): Tokens {
  const block = extractRootBlock(css)
  const declarations = [...block.matchAll(DECLARATION_PATTERN)].map(
    ([, name = '', value = '']) => ({
      name,
      value: value.trim(),
    })
  )

  const primitives: Record<string, Oklch> = {}
  for (const { name, value } of declarations) {
    if (value.startsWith('oklch(')) {
      primitives[name] = parseOklch(value)
    }
  }

  const semantic: Tokens['semantic'] = { light: {}, dark: {} }
  for (const { name, value } of declarations) {
    const match = LIGHT_DARK_PATTERN.exec(value)
    if (!match) {
      continue
    }
    const [, light = '', dark = ''] = match
    semantic.light[name] = resolve(light, primitives, name)
    semantic.dark[name] = resolve(dark, primitives, name)
  }

  return { primitives, semantic }
}

function extractRootBlock(css: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const match = /:root,\s*:host\s*\{([^}]*)\}/.exec(withoutComments)
  if (!match?.[1]) {
    throw new Error('Token block ":root, :host { ... }" not found')
  }
  return match[1]
}

function resolve(value: string, primitives: Record<string, Oklch>, token: string): Oklch {
  const keyword = KEYWORDS[value]
  if (keyword) {
    return keyword
  }
  const reference = VAR_PATTERN.exec(value)?.[1]
  if (reference) {
    const primitive = primitives[reference]
    if (!primitive) {
      throw new Error(`--${token} references unknown primitive --${reference}`)
    }
    return primitive
  }
  return parseOklch(value)
}
