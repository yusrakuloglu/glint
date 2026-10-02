import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { contrastRatio, oklchToSrgb } from './color'
import { parseTokens, type ThemeName } from './read-tokens'

const tokens = parseTokens(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8'))

/** WCAG 2.2 AA: 1.4.3 text, 1.4.11 non-text (input borders, focus ring). */
const TEXT = 4.5
const NON_TEXT = 3

const pairs: { fg: string; bg: string; min: number }[] = [
  { fg: 'fg', bg: 'bg', min: TEXT },
  { fg: 'fg', bg: 'surface', min: TEXT },
  { fg: 'fg', bg: 'surface-raised', min: TEXT },
  { fg: 'fg-muted', bg: 'bg', min: TEXT },
  { fg: 'fg-muted', bg: 'surface', min: TEXT },
  { fg: 'fg-muted', bg: 'surface-raised', min: TEXT },
  { fg: 'primary', bg: 'surface', min: TEXT },
  { fg: 'primary-fg', bg: 'primary', min: TEXT },
  { fg: 'primary-fg', bg: 'primary-hover', min: TEXT },
  { fg: 'danger', bg: 'surface', min: TEXT },
  { fg: 'danger-fg', bg: 'danger', min: TEXT },
  { fg: 'danger-fg', bg: 'danger-hover', min: TEXT },
  { fg: 'success', bg: 'surface', min: TEXT },
  { fg: 'warning', bg: 'surface', min: TEXT },
  { fg: 'border-input', bg: 'bg', min: NON_TEXT },
  { fg: 'border-input', bg: 'surface', min: NON_TEXT },
  { fg: 'ring', bg: 'bg', min: NON_TEXT },
  { fg: 'ring', bg: 'surface', min: NON_TEXT },
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
