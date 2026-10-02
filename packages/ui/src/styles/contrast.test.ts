import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { contrastRatio, oklchToSrgb } from './color'
import { parseTokens, type ThemeName } from './read-tokens'

const tokens = parseTokens(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8'))

/** WCAG 2.2 AA: 1.4.3 text, 1.4.11 non-text (input borders, focus ring). */
const TEXT = 4.5
const NON_TEXT = 3

const surfaces = ['bg', 'surface', 'surface-raised', 'surface-hover']
const textTokens = ['fg', 'fg-muted', 'primary', 'danger', 'success', 'warning']

const pairs: { fg: string; bg: string; min: number }[] = [
  // Any text token may appear on any surface (e.g. a danger menu item on hover)
  ...textTokens.flatMap((fg) => surfaces.map((bg) => ({ fg, bg, min: TEXT }))),
  { fg: 'primary-fg', bg: 'primary', min: TEXT },
  { fg: 'primary-fg', bg: 'primary-hover', min: TEXT },
  { fg: 'danger-fg', bg: 'danger', min: TEXT },
  { fg: 'danger-fg', bg: 'danger-hover', min: TEXT },
  ...surfaces.map((bg) => ({ fg: 'border-input', bg, min: NON_TEXT })),
  ...surfaces.map((bg) => ({ fg: 'ring', bg, min: NON_TEXT })),
]

const themes: ThemeName[] = ['light', 'dark']

describe.each(themes)('%s theme contrast', (theme) => {
  it.each(pairs)('$fg on $bg >= $min:1', ({ fg, bg, min }) => {
    const foreground = tokens.semantic[theme][fg]
    const background = tokens.semantic[theme][bg]
    if (!foreground || !background) {
      throw new Error(`Unknown token pair: --${fg} on --${bg}`)
    }

    expect(contrastRatio(oklchToSrgb(foreground), oklchToSrgb(background))).toBeGreaterThanOrEqual(
      min
    )
  })
})
