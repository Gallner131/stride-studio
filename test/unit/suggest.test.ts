import { describe, expect, it } from "vitest";
import type { PhotoAnalysis } from "../../src/engine/photo";
import { contrastRatio, ensureContrast, relativeLuminance, rotateHue } from "../../src/engine/photo";
import {
  calmestAnchor,
  lookFromPhoto,
  matchedLookPassesContrast,
  prefersLightType,
  threeForYou,
} from "../../src/model/suggest";
import type { ActivityCapabilities } from "../../src/templates";

/** §2.7 S1, S2, S3. All three must be deterministic — the same input, the same suggestion. */

const analysis = (over: Partial<PhotoAnalysis> = {}): PhotoAnalysis => ({
  brightness: 0.3,
  topThird: 0.6,
  bottomThird: 0.15,
  swatches: [],
  accent: { r: 216, g: 255, b: 58, weight: 0.3, saturation: 0.9, luminance: 0.85, hex: "#D8FF3A" },
  hue: 75,
  busyness: Array.from({ length: 60 }, () => 0.5),
  ...over,
});

const CAPS: ActivityCapabilities = {
  route: true,
  hr: true,
  splits: true,
  elevation: true,
  distance: true,
  hyrox: false,
};

describe("colour helpers", () => {
  it("computes relative luminance the WCAG way", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });

  it("rotates hue while keeping the colour's character", () => {
    const complement = rotateHue({ r: 255, g: 0, b: 0 }, 180);
    // Red -> cyan.
    expect(Math.round(complement.r)).toBeLessThan(40);
    expect(Math.round(complement.g)).toBeGreaterThan(200);
    expect(Math.round(complement.b)).toBeGreaterThan(200);
  });

  it("lifts a colour until it clears a contrast target", () => {
    const dark = { r: 30, g: 30, b: 30 };
    const onBlack = ensureContrast(dark, { r: 0, g: 0, b: 0 }, 3);
    expect(contrastRatio(onBlack, { r: 0, g: 0, b: 0 })).toBeGreaterThanOrEqual(3);
  });

  it("leaves a colour alone when it already passes", () => {
    const white = { r: 255, g: 255, b: 255 };
    expect(ensureContrast(white, { r: 0, g: 0, b: 0 }, 3)).toEqual(white);
  });
});

describe("lookFromPhoto (§2.7 S2)", () => {
  it("derives accent from the photo and its complement as accent2", () => {
    const look = lookFromPhoto(analysis());
    expect(look.id).toBe("from-photo");
    expect(look.colors.accent).toMatch(/^#[0-9A-F]{6}$/);
    expect(look.colors.accent2).toMatch(/^#[0-9A-F]{6}$/);
    expect(look.colors.accent).not.toBe(look.colors.accent2);
  });

  it("uses light type on a dark photo and dark type on a bright one", () => {
    expect(lookFromPhoto(analysis({ brightness: 0.15 })).colors.text).toBe("#FFFFFF");
    expect(lookFromPhoto(analysis({ brightness: 0.85 })).colors.text).toBe("#111111");
  });

  it("meets the same contrast bar every curated look has to pass (§12.7)", () => {
    // Including the awkward cases: a washed-out photo and a nearly black one.
    for (const brightness of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      for (const accent of [
        { r: 250, g: 250, b: 240 },
        { r: 20, g: 20, b: 30 },
        { r: 120, g: 200, b: 190 },
      ]) {
        const look = lookFromPhoto(
          analysis({
            brightness,
            accent: { ...accent, weight: 0.2, saturation: 0.5, luminance: 0.5, hex: "#000000" },
          }),
        );
        expect(matchedLookPassesContrast(look), `brightness ${brightness}`).toBe(true);
      }
    }
  });

  it("picks a font by the photo's temperature", () => {
    expect(lookFromPhoto(analysis({ hue: 20 })).legacyFonts.display).toBe("serif"); // warm
    expect(lookFromPhoto(analysis({ hue: 210 })).legacyFonts.display).toBe("cond"); // cool
    expect(lookFromPhoto(analysis({ hue: 110 })).legacyFonts.display).toBe("sans"); // neutral
  });

  it("is deterministic", () => {
    expect(lookFromPhoto(analysis())).toEqual(lookFromPhoto(analysis()));
  });

  it("takes the safest legibility mechanism, since it cannot be pre-tested", () => {
    expect(lookFromPhoto(analysis()).legibility).toBe("shadow");
  });
});

describe("threeForYou (§2.7 S1)", () => {
  it("returns exactly three suggestions", () => {
    expect(threeForYou(CAPS, analysis())).toHaveLength(3);
  });

  it("only offers templates the activity can fill", () => {
    const noData: ActivityCapabilities = {
      route: false,
      hr: false,
      splits: false,
      elevation: false,
      distance: false,
      hyrox: false,
    };
    for (const s of threeForYou(noData, null)) {
      expect(s.template.requires, s.template.id).toEqual([]);
    }
  });

  it("leads with HYROX when a result is present, because it is the most specific thing known", () => {
    const s = threeForYou({ ...CAPS, hyrox: true }, analysis());
    expect(s[0]?.template.cat).toBe("HYROX");
  });

  it("leads with the route when there is GPS and no HYROX", () => {
    expect(threeForYou(CAPS, analysis())[0]?.template.id).toBe("trace");
  });

  it("shuffles to a different set within the same rules", () => {
    const a = threeForYou(CAPS, analysis(), 0).map((s) => s.template.id);
    const b = threeForYou(CAPS, analysis(), 1).map((s) => s.template.id);
    expect(b).not.toEqual(a);
    expect(b).toHaveLength(3);
  });

  it("is deterministic for the same shuffle index", () => {
    const a = threeForYou(CAPS, analysis(), 3);
    const b = threeForYou(CAPS, analysis(), 3);
    expect(a.map((s) => `${s.template.id}/${s.look.id}`)).toEqual(
      b.map((s) => `${s.template.id}/${s.look.id}`),
    );
  });

  it("gives every suggestion a reason and a look", () => {
    for (const s of threeForYou(CAPS, analysis())) {
      expect(s.reason).toBeTruthy();
      expect(s.look.id).toBeTruthy();
    }
  });

  it("proposes dark-suited looks for a dark photo", () => {
    const dark = threeForYou(CAPS, analysis({ brightness: 0.1 }));
    for (const s of dark) {
      const suits = s.look.photo.suits.join(" ");
      expect(/any|dark|night|city|gym/.test(suits), `${s.look.id}`).toBe(true);
    }
  });
});

describe("smart placement (§2.7 S3)", () => {
  const anchors = [
    { ax: 0.06, ay: 1 },
    { ax: 0.94, ay: 1 },
    { ax: 0.06, ay: 0 },
  ];

  it("picks the calmest of the offered anchors", () => {
    // Busy everywhere except the top-left corner.
    const busyness = Array.from({ length: 60 }, () => 0.9);
    busyness[0] = 0.02;
    busyness[1] = 0.02;
    busyness[6] = 0.02;
    busyness[7] = 0.02;
    expect(calmestAnchor(anchors, analysis({ busyness }))).toEqual({ ax: 0.06, ay: 0 });
  });

  it("falls back to the first option with no photo", () => {
    expect(calmestAnchor(anchors, null)).toEqual(anchors[0]);
  });

  it("handles an empty option list without throwing", () => {
    expect(calmestAnchor([], analysis())).toEqual({ ax: 0.06, ay: 1 });
  });
});

describe("prefersLightType", () => {
  it("wants light type on a dark photo, and assumes light with no photo", () => {
    expect(prefersLightType(analysis({ brightness: 0.2 }))).toBe(true);
    expect(prefersLightType(analysis({ brightness: 0.8 }))).toBe(false);
    expect(prefersLightType(null)).toBe(true);
  });
});
