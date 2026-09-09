// Photo analysis — §2.7 S2 (Match my photo) and S3 (Smart placement).
//
// Everything here runs on a 64x64 downsample of the user's own photo, on device. No pixel
// ever leaves the phone, and the whole analysis costs well under a frame.
//
// Colour maths is implemented directly rather than pulling in culori (§11.1): the parts
// needed are sRGB -> Lab, a median cut, and a hue rotation — about eighty lines against a
// 15 KB dependency in a bundle with a budget.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Swatch extends Rgb {
  /** Share of sampled pixels, 0-1. */
  weight: number;
  /** HSL saturation, 0-1. */
  saturation: number;
  /** Relative luminance, 0-1. */
  luminance: number;
  hex: string;
}

export interface PhotoAnalysis {
  /** Mean relative luminance of the whole frame, 0-1. */
  brightness: number;
  /** Mean luminance of the top and bottom thirds — drives Three for you (§2.7 S1). */
  topThird: number;
  bottomThird: number;
  /** Dominant colours, most prominent first. */
  swatches: Swatch[];
  /** The most saturated swatch with at least 5 % coverage, per §2.7 S2. */
  accent: Swatch | null;
  /** Mean hue in degrees, for the "temperature" font choice. */
  hue: number;
  /**
   * 6 x 10 grid of local busyness (luminance variance + edge energy), 0-1, row-major.
   * Smart placement puts the stat block in the calmest allowed cell (§2.7 S3).
   */
  busyness: number[];
}

const SAMPLE = 64;
const GRID_COLS = 6;
const GRID_ROWS = 10;

const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;

const channelLinear = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = ({ r, g, b }: Rgb): number =>
  0.2126 * channelLinear(r) + 0.7152 * channelLinear(g) + 0.0722 * channelLinear(b);

/** HSL saturation and hue, without the full conversion. */
function saturationHue({ r, g, b }: Rgb): { saturation: number; hue: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const saturation = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  let hue = 0;
  if (d !== 0) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    if (max === rr) hue = ((gg - bb) / d) % 6;
    else if (max === gg) hue = (bb - rr) / d + 2;
    else hue = (rr - gg) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { saturation: Math.max(0, Math.min(1, saturation)), hue };
}

/**
 * Median cut over the sampled pixels — §2.7 S2 names k-means in Lab with a median-cut
 * fallback; median cut alone is deterministic, has no k to tune and no random seed, which
 * matters when the same photo must produce the same look every time.
 */
function medianCut(pixels: Rgb[], depth: number): Rgb[][] {
  if (depth === 0 || pixels.length <= 1) return [pixels];

  let widest: "r" | "g" | "b" = "r";
  let widestRange = -1;
  for (const key of ["r", "g", "b"] as const) {
    const values = pixels.map((p) => p[key]);
    const range = Math.max(...values) - Math.min(...values);
    if (range > widestRange) {
      widestRange = range;
      widest = key;
    }
  }

  const sorted = [...pixels].sort((a, b) => a[widest] - b[widest]);
  const mid = Math.floor(sorted.length / 2);
  return [...medianCut(sorted.slice(0, mid), depth - 1), ...medianCut(sorted.slice(mid), depth - 1)];
}

function averageOf(pixels: Rgb[], total: number): Swatch {
  const n = Math.max(1, pixels.length);
  const sum = pixels.reduce((acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }), {
    r: 0,
    g: 0,
    b: 0,
  });
  const rgb = { r: sum.r / n, g: sum.g / n, b: sum.b / n };
  const { saturation, hue } = saturationHue(rgb);
  void hue;
  return {
    ...rgb,
    weight: pixels.length / Math.max(1, total),
    saturation,
    luminance: relativeLuminance(rgb),
    hex: toHex(rgb),
  };
}

/** Analyses an already-decoded image. Returns null if it cannot be sampled. */
export function analysePhoto(source: CanvasImageSource): PhotoAnalysis | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(source, 0, 0, SAMPLE, SAMPLE);
  } catch {
    return null;
  }

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    // A cross-origin image taints the canvas; the app only ever analyses local files, but
    // failing softly is better than throwing mid-render.
    return null;
  }

  const pixels: Rgb[] = [];
  const lumaGrid: number[][] = Array.from({ length: GRID_ROWS * GRID_COLS }, () => []);
  let sum = 0;
  let topSum = 0;
  let bottomSum = 0;
  let topCount = 0;
  let bottomCount = 0;
  let hueX = 0;
  let hueY = 0;
  let hueWeight = 0;

  for (let y = 0; y < SAMPLE; y++) {
    for (let x = 0; x < SAMPLE; x++) {
      const i = (y * SAMPLE + x) << 2;
      const rgb = { r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 };
      pixels.push(rgb);

      const lum = relativeLuminance(rgb);
      sum += lum;
      if (y < SAMPLE / 3) {
        topSum += lum;
        topCount++;
      } else if (y >= (SAMPLE * 2) / 3) {
        bottomSum += lum;
        bottomCount++;
      }

      // Circular mean of hue, weighted by saturation, so greys do not drag it toward red.
      const { saturation, hue } = saturationHue(rgb);
      const rad = (hue * Math.PI) / 180;
      hueX += Math.cos(rad) * saturation;
      hueY += Math.sin(rad) * saturation;
      hueWeight += saturation;

      const cell =
        Math.min(GRID_ROWS - 1, Math.floor((y / SAMPLE) * GRID_ROWS)) * GRID_COLS +
        Math.min(GRID_COLS - 1, Math.floor((x / SAMPLE) * GRID_COLS));
      lumaGrid[cell]?.push(lum);
    }
  }

  const total = pixels.length;
  const clusters = medianCut(pixels, 3) // 2^3 = 8 buckets
    .map((group) => averageOf(group, total))
    .sort((a, b) => b.weight - a.weight);

  // §2.7 S2: the most saturated cluster with at least 5 % coverage.
  const accent =
    [...clusters].filter((c) => c.weight >= 0.05).sort((a, b) => b.saturation - a.saturation)[0] ??
    clusters[0] ??
    null;

  const busyness = lumaGrid.map((values) => {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    // Variance of luminance runs small; scale so a busy cell approaches 1.
    return Math.max(0, Math.min(1, Math.sqrt(variance) * 4));
  });

  return {
    brightness: sum / total,
    topThird: topCount > 0 ? topSum / topCount : 0.5,
    bottomThird: bottomCount > 0 ? bottomSum / bottomCount : 0.5,
    swatches: clusters,
    accent,
    hue: hueWeight > 0.001 ? ((Math.atan2(hueY, hueX) * 180) / Math.PI + 360) % 360 : 0,
    busyness,
  };
}

/** Rotates a hue by degrees, keeping saturation and lightness. Used for the complement. */
export function rotateHue(rgb: Rgb, degrees: number): Rgb {
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const { hue } = saturationHue(rgb);
  const h = (((hue + degrees) % 360) + 360) % 360;

  // HSL -> RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = l - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

export const hexOf = toHex;

/** WCAG contrast between two opaque colours. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Darkens or lightens a colour until it clears `target` contrast against `against`. */
export function ensureContrast(colour: Rgb, against: Rgb, target: number): Rgb {
  if (contrastRatio(colour, against) >= target) return colour;

  const backgroundIsDark = relativeLuminance(against) < 0.5;
  let best = colour;
  for (let step = 1; step <= 100; step++) {
    const k = step / 100;
    const candidate = backgroundIsDark
      ? {
          r: colour.r + (255 - colour.r) * k,
          g: colour.g + (255 - colour.g) * k,
          b: colour.b + (255 - colour.b) * k,
        }
      : { r: colour.r * (1 - k), g: colour.g * (1 - k), b: colour.b * (1 - k) };
    best = candidate;
    if (contrastRatio(candidate, against) >= target) break;
  }
  return best;
}
