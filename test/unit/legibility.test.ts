import { describe, expect, it } from "vitest";
import type { Backdrop } from "../../src/engine/legibility";
import {
  contrastOf,
  hexLuminance,
  legibilityNeed,
  luminanceUnder,
  scrimOpacity,
} from "../../src/engine/legibility";

/**
 * §2.7 S4. A look declares how it keeps text readable over a photo and nothing ever measured
 * the photo, so the mechanism was either always on — dimming a dark sky that needed no help —
 * or always off, and a white headline disappeared into a bright one.
 */

/** Top half bright sky, bottom half dark ground. 2 columns so a box can sit in either. */
const skyline: Backdrop = {
  cols: 2,
  rows: 2,
  lum: [0.92, 0.9, 0.06, 0.05],
};

describe("luminanceUnder", () => {
  it("reads the bright half and the dark half apart", () => {
    expect(luminanceUnder(skyline, 0, 0, 1, 0.5)).toBeCloseTo(0.91, 2);
    expect(luminanceUnder(skyline, 0, 0.5, 1, 0.5)).toBeCloseTo(0.055, 2);
  });

  it("averages a box that straddles both", () => {
    const mid = luminanceUnder(skyline, 0, 0, 1, 1) ?? 0;
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });

  it("never returns nothing for a box clipped to the edges", () => {
    // A layer can sit partly off-canvas; clamping must still yield a reading.
    expect(luminanceUnder(skyline, -0.5, -0.5, 0.6, 0.6)).not.toBeNull();
    expect(luminanceUnder(skyline, 0.95, 0.95, 0.5, 0.5)).not.toBeNull();
  });

  it("is null when there is no backdrop to read", () => {
    expect(luminanceUnder({ cols: 0, rows: 0, lum: [] }, 0, 0, 1, 1)).toBeNull();
  });
});

describe("legibilityNeed", () => {
  const white = "#FFFFFF";
  const black = "#111111";

  it("leaves white text alone over a dark ground", () => {
    expect(legibilityNeed(white, 0.05).needed).toBe(false);
  });

  it("helps white text over a bright sky, and darkens to do it", () => {
    const need = legibilityNeed(white, 0.91);
    expect(need.needed).toBe(true);
    if (need.needed) expect(need.darken).toBe(true);
  });

  it("helps dark text over a dark ground, and lightens to do it", () => {
    const need = legibilityNeed(black, 0.05);
    expect(need.needed).toBe(true);
    if (need.needed) expect(need.darken).toBe(false);
  });

  it("does nothing when there is no photo behind the design", () => {
    expect(legibilityNeed(white, null).needed).toBe(false);
  });

  it("does nothing for a colour it cannot read, rather than guessing", () => {
    expect(legibilityNeed("$accent", 0.9).needed).toBe(false);
    expect(legibilityNeed("rgba(0,0,0,.5)", 0.9).needed).toBe(false);
  });
});

describe("scrimOpacity", () => {
  it("returns the least opacity that actually clears 3:1", () => {
    const lum = 0.91;
    const a = scrimOpacity("#FFFFFF", lum, true);
    expect(a).toBeGreaterThan(0);
    // Composite the scrim and check the result really is readable.
    const after = lum * (1 - a) + 0 * a;
    expect(contrastOf(hexLuminance("#FFFFFF") ?? 1, after)).toBeGreaterThanOrEqual(2.99);
  });

  it("asks for nothing when the ground is already dark enough", () => {
    expect(scrimOpacity("#FFFFFF", 0.02, true)).toBe(0);
  });

  it("never dims the photo past three quarters", () => {
    // A scrim heavy enough to hide the photo defeats the point of having one.
    expect(scrimOpacity("#FFFFFF", 1, true)).toBeLessThanOrEqual(0.72);
    expect(scrimOpacity("#111111", 0, false)).toBeLessThanOrEqual(0.72);
  });
});
