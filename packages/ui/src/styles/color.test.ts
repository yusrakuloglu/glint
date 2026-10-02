import { describe, expect, it } from 'vitest'

import { contrastRatio, oklchToSrgb, parseOklch, type Srgb } from './color'

/** Gamma-encoded sRGB channels as 0-255 integers, the precision of a hex color. */
function toBytes({ r, g, b }: Srgb): [number, number, number] {
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function hex(value: string): Srgb {
  const n = Number.parseInt(value.slice(1), 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

describe('parseOklch', () => {
  it('parses unitless L C H', () => {
    expect(parseOklch(' oklch(0.5 0.134 243) ')).toEqual({ l: 0.5, c: 0.134, h: 243 })
  })

  it('rejects other formats', () => {
    expect(() => parseOklch('oklch(50% 0.1 243)')).toThrow('Unsupported color value')
  })
})

describe('oklchToSrgb', () => {
  it('maps white and black to the sRGB extremes', () => {
    expect(toBytes(oklchToSrgb({ l: 1, c: 0, h: 0 }))).toEqual([255, 255, 255])
    expect(toBytes(oklchToSrgb({ l: 0, c: 0, h: 0 }))).toEqual([0, 0, 0])
  })

  it('ignores hue when chroma is zero', () => {
    expect(oklchToSrgb({ l: 0.6, c: 0, h: 0 })).toEqual(oklchToSrgb({ l: 0.6, c: 0, h: 200 }))
  })

  // Reference values: CSS Color 4 examples and Tailwind's published palette
  it.each([
    { oklch: { l: 0.62796, c: 0.25768, h: 29.23 }, expected: [255, 0, 0] },
    { oklch: { l: 0.985, c: 0.002, h: 247.839 }, expected: [249, 250, 251] },
    { oklch: { l: 0.5, c: 0.134, h: 242.749 }, expected: [0, 105, 168] },
  ])('converts $oklch within one step per channel', ({ oklch, expected }) => {
    const actual = toBytes(oklchToSrgb(oklch))
    actual.forEach((channel, i) => {
      expect(Math.abs(channel - (expected[i] ?? 0))).toBeLessThanOrEqual(1)
    })
  })

  it('clips out-of-gamut colors to [0, 1]', () => {
    const { r, g, b } = oklchToSrgb({ l: 0.7, c: 0.4, h: 150 })
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(1)
    }
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio(hex('#000000'), hex('#ffffff'))).toBeCloseTo(21, 5)
    expect(contrastRatio(hex('#777777'), hex('#777777'))).toBe(1)
  })

  it('does not depend on argument order', () => {
    expect(contrastRatio(hex('#0369a1'), hex('#ffffff'))).toBe(
      contrastRatio(hex('#ffffff'), hex('#0369a1'))
    )
  })

  // Values from WebAIM's contrast checker
  it.each([
    { fg: '#777777', bg: '#ffffff', expected: 4.48 },
    { fg: '#767676', bg: '#ffffff', expected: 4.54 },
    { fg: '#0369a1', bg: '#ffffff', expected: 5.93 },
  ])('$fg on $bg is about $expected:1', ({ fg, bg, expected }) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeCloseTo(expected, 2)
  })
})
