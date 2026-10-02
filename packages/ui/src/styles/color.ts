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
 * Converts OKLCH to gamma-encoded sRGB (CSS Color 4 / Björn Ottosson's OKLab matrices).
 * Out-of-gamut channels are clipped to [0, 1]. Browsers map the gamut by reducing chroma
 * instead, so clipped colors can differ slightly from what is rendered.
 */
export function oklchToSrgb({ l, c, h }: Oklch): Srgb {
  // OKLCH -> OKLab: polar to cartesian
  const hue = (h * Math.PI) / 180
  const a = c * Math.cos(hue)
  const b = c * Math.sin(hue)

  // OKLab -> LMS (cone response), then undo the cube root
  const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  // LMS -> linear sRGB
  const red = 4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone
  const green = -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone
  const blue = -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone

  return { r: encode(red), g: encode(green), b: encode(blue) }
}

/** WCAG 2.x contrast ratio between two colors, in [1, 21]. Order does not matter. */
export function contrastRatio(first: Srgb, second: Srgb): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG relative luminance: linearize each channel, then weight by eye sensitivity. */
function relativeLuminance({ r, g, b }: Srgb): number {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b)
}

/** Linear light -> gamma-encoded sRGB channel, clipped to [0, 1]. */
function encode(linear: number): number {
  const clipped = Math.min(1, Math.max(0, linear))
  return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055
}

/** Gamma-encoded sRGB channel -> linear light. */
function decode(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}
