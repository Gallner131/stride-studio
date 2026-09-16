// Adaptive legibility — §2.7 S4.
//
// A look declares how it keeps text readable over a photo (a shadow, a scrim, a pill), and
// until now nothing ever measured the photo. So the mechanism was either always on — a scrim
// over a dark sky, dimming a photo that needed no help — or always off, and a white headline
// vanished into a bright one.
//
// The measuring cannot happen in here per frame. `ctx.getImageData` forces a GPU readback of
// several milliseconds, and doing that for every text layer on every frame of a six-second
// animation is seconds of jank. It also cannot happen in here at all: the engine takes no
// DOM (CLAUDE.md rule 6).
//
// So the caller measures the photo ONCE, when the photo changes, into a coarse grid of
// luminances, and this module — pure arithmetic over that grid — decides per layer whether
// the text needs help. A photo does not change during a layer animation, so once is enough.

/** A coarse luminance map of whatever sits behind the layers, in row-major order. */
export interface Backdrop {
  cols: number;
  rows: number;
  /** Mean relative luminance per cell, 0–1. */
  lum: number[];
}

export type LegibilityMode = "shadow" | "scrim" | "pill";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Relative luminance of #rrggbb, WCAG 2.1. Null for anything else. */
export function hexLuminance(hex: string): number | null {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const channel = (from: number) => {
    const c = Number.parseInt(hex.slice(from, from + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * Mean luminance of the backdrop under a box, given in fractions of the canvas.
 *
 * Averaging rather than taking the darkest cell: a headline crossing a bright horizon and a
 * dark hill is legible against neither extreme, and the mean is what a scrim has to lift.
 */
export function luminanceUnder(
  backdrop: Backdrop,
  x: number,
  y: number,
  w: number,
  h: number,
): number | null {
  if (backdrop.cols <= 0 || backdrop.rows <= 0 || backdrop.lum.length === 0) return null;

  const c0 = Math.floor(clamp01(x) * backdrop.cols);
  const c1 = Math.ceil(clamp01(x + w) * backdrop.cols);
  const r0 = Math.floor(clamp01(y) * backdrop.rows);
  const r1 = Math.ceil(clamp01(y + h) * backdrop.rows);

  let total = 0;
  let n = 0;
  for (let r = r0; r < Math.max(r1, r0 + 1) && r < backdrop.rows; r++) {
    for (let c = c0; c < Math.max(c1, c0 + 1) && c < backdrop.cols; c++) {
      const v = backdrop.lum[r * backdrop.cols + c];
      if (typeof v === "number") {
        total += v;
        n++;
      }
    }
  }
  return n === 0 ? null : total / n;
}

/** WCAG contrast between two relative luminances. */
export function contrastOf(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Whether text of `color` needs help to be read over `lum`, and which way to lean.
 *
 * 3:1 rather than 4.5:1 because this is display type — the figures on these designs are
 * enormous, and §12.7 holds the looks themselves to the same bar.
 */
export function legibilityNeed(
  color: string,
  lum: number | null,
): { needed: false } | { needed: true; darken: boolean } {
  if (lum === null) return { needed: false };
  const text = hexLuminance(color);
  if (text === null) return { needed: false };
  if (contrastOf(text, lum) >= 3) return { needed: false };
  // Light text wants a darker ground behind it, and vice versa.
  return { needed: true, darken: text > lum };
}

/**
 * Opacity for a scrim or pill that lifts `lum` far enough away from the text.
 *
 * Solved rather than guessed: the scrim composites toward black or white, so the resulting
 * luminance is a linear blend, and this is the least opacity that clears 3:1. Capped at 0.72
 * because a scrim dark enough to hide the photo entirely defeats the point of the photo.
 */
export function scrimOpacity(color: string, lum: number, darken: boolean): number {
  const text = hexLuminance(color);
  if (text === null) return 0;
  const target = darken ? (text + 0.05) / 3 - 0.05 : 3 * (text + 0.05) - 0.05;
  const toward = darken ? 0 : 1;
  if (darken ? target >= lum : target <= lum) return 0;
  // lum * (1 - a) + toward * a = target
  const a = (target - lum) / (toward - lum);
  return Math.max(0, Math.min(0.72, Number.isFinite(a) ? a : 0));
}
