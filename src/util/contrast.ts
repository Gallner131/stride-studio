// Contrast maths for the chrome — §6.14.
//
// The chrome takes its accent from whatever look the athlete is designing in, which means
// accepting a colour chosen for a completely different background. A look's accent is
// picked to work against that look's own canvas: `blueprint`'s is pure white on deep blue,
// and white is invisible as a selected-state border on an off-white chrome. So the accent
// is used when it can be seen, and substituted when it cannot.

/** Relative luminance, WCAG 2.1 definition. Returns null for anything that is not #rrggbb. */
function luminance(hex: string): number | null {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const channel = (from: number) => {
    const c = Number.parseInt(hex.slice(from, from + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio, 1 to 21. Returns 1 — "indistinguishable" — for unparseable input. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Returns "#000000" or "#FFFFFF" — whichever is more readable on `hex`. */
export function contrastText(hex: string): "#000000" | "#FFFFFF" {
  const l = luminance(hex);
  // White is the safer default for anything we cannot read: look accents are sometimes
  // rgba() strings, and the surfaces this lands on are more often dark than not.
  if (l === null) return "#FFFFFF";
  return l > 0.36 ? "#000000" : "#FFFFFF";
}

/** Channel spread, 0 to 1. Near zero means white, black or grey — nothing to preserve. */
function chroma(hex: string): number {
  const ch = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return (Math.max(...ch) - Math.min(...ch)) / 255;
}

/**
 * Scales a colour straight toward black until it clears `min` against `against`.
 *
 * A straight scale, so hue and saturation are untouched — the same move
 * `scripts/make-looks.mjs` makes when a look's own accent misses §12.7's bar. Steps of 2 %
 * so the result is the least darkening that works rather than an arbitrary jump.
 */
function darkenToContrast(hex: string, against: string, min: number): string | null {
  const ch = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  for (let k = 0.98; k > 0; k -= 0.02) {
    const scaled = `#${ch
      .map((c) =>
        Math.round(c * k)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
    if (contrastRatio(scaled, against) >= min) return scaled;
  }
  return null;
}

/**
 * The accent to actually paint the chrome with.
 *
 * `accent` is the look's own; `against` is the chrome background it has to survive on. The
 * 3:1 bar is the same one §12.7 holds looks to for their own backgrounds — enough for a
 * border, a focus ring or a filled chip to be distinguishable, which is all the chrome asks
 * of it.
 */
export function readableAccent(accent: string | undefined, against: string, fallback: string): string {
  if (!accent || !/^#[0-9a-f]{6}$/i.test(accent)) return fallback;
  if (contrastRatio(accent, against) >= 3) return accent;

  // A colour with hue is worth keeping — the athlete chose a loud look and the chrome
  // should say so. A near-white or near-grey accent has nothing to preserve: darkening it
  // just produces a washed-out version of the neutral, so use the neutral.
  if (chroma(accent) < 0.15) return fallback;
  return darkenToContrast(accent, against, 3) ?? fallback;
}
