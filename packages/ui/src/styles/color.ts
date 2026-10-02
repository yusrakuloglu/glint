/** OKLCH color: l in [0, 1], c >= 0, h in degrees. */
export interface Oklch {
  l: number
  c: number
  h: number
}

/** sRGB color with gamma-encoded channels in [0, 1]. */
export interface Srgb {
  r: number
  g: number
  b: number
}

const OKLCH_PATTERN = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/

/** Parses `oklch(L C H)` with unitless numbers, the only form tokens.css uses. */
export function parseOklch(value: string): Oklch {
  const match = OKLCH_PATTERN.exec(value.trim())
  if (!match) {
    throw new Error(`Unsupported color value: ${value}`)
  }
  const [, l, c, h] = match
  return { l: Number(l), c: Number(c), h: Number(h) }
}

/**
 * Converts OKLCH to gamma-encoded sRGB.
 * Out-of-gamut colors: decide whether to clip channels to [0, 1] or report them.
 */
export function oklchToSrgb(_color: Oklch): Srgb {
  // TODO(yusra): implement OKLCH -> OKLab -> linear sRGB -> gamma-encoded sRGB
  throw new Error('oklchToSrgb is not implemented yet')
}

/** WCAG 2.x contrast ratio between two colors, in [1, 21]. */
export function contrastRatio(_a: Srgb, _b: Srgb): number {
  // TODO(yusra): implement relative luminance and the (L1 + 0.05) / (L2 + 0.05) ratio
  throw new Error('contrastRatio is not implemented yet')
}
