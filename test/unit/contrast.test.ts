import { describe, expect, it } from "vitest";
import { contrastRatio, contrastText, readableAccent } from "../../src/util/contrast";

/**
 * §6.14 — the chrome takes its accent from the look the athlete is designing in.
 *
 * The catch the brief did not consider: a look's accent is chosen to work against that
 * look's own background, which is often dark. `paper`'s accent is near-black and `blueprint`'s
 * is pure white — and white is invisible as a selected-state border on an off-white chrome.
 * So the accent is used when it can be seen and substituted when it cannot.
 */

describe("contrastText", () => {
  it("returns black for light backgrounds", () => {
    expect(contrastText("#FFFFFF")).toBe("#000000");
    expect(contrastText("#D8FF3A")).toBe("#000000");
    expect(contrastText("#F5F4F1")).toBe("#000000");
  });

  it("returns white for dark backgrounds", () => {
    expect(contrastText("#000000")).toBe("#FFFFFF");
    expect(contrastText("#1A1A1A")).toBe("#FFFFFF");
    expect(contrastText("#242426")).toBe("#FFFFFF");
  });

  it("defensively handles input that is not a hex colour", () => {
    // Look accents are sometimes rgba() strings, so this is reachable, not theoretical.
    expect(contrastText("rgba(255,255,255,.10)")).toBe("#FFFFFF");
    expect(contrastText("not a hex")).toBe("#FFFFFF");
    expect(contrastText("")).toBe("#FFFFFF");
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#3AA76D", "#3AA76D")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#1A1A1A", "#F5F4F1")).toBeCloseTo(contrastRatio("#F5F4F1", "#1A1A1A"), 5);
  });
});

describe("readableAccent", () => {
  const CHROME = "#f5f4f1";
  const FALLBACK = "#1a1a1a";

  it("keeps an accent that can be seen against the chrome", () => {
    expect(readableAccent("#0F3DA8", CHROME, FALLBACK)).toBe("#0F3DA8");
    expect(readableAccent("#c8323c", CHROME, FALLBACK)).toBe("#c8323c");
  });

  it("darkens a colourful accent until it can be seen, keeping its hue", () => {
    // volt's #D8FF3A is 1.3:1 on the chrome. Falling back to neutral would mean the athlete
    // picks the loudest look in the set and the chrome ignores it. The repo already does
    // this to the looks themselves (scripts/make-looks.mjs): the least straight scale toward
    // black that clears the bar, so hue and saturation survive.
    const out = readableAccent("#D8FF3A", CHROME, FALLBACK);
    expect(out).not.toBe(FALLBACK);
    expect(contrastRatio(out, CHROME)).toBeGreaterThanOrEqual(3);
    // Still recognisably the same colour: green stays the dominant channel.
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => Number.parseInt(out.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
  });

  it("darkens ember's orange and frost's blue rather than dropping them", () => {
    for (const accent of ["#FF7A18", "#5AC8FA"]) {
      const out = readableAccent(accent, CHROME, FALLBACK);
      expect(out, accent).not.toBe(FALLBACK);
      expect(contrastRatio(out, CHROME), accent).toBeGreaterThanOrEqual(3);
    }
  });

  it("falls back rather than darkening a colour with no hue to preserve", () => {
    // Darkening white gives mid-grey, which is not the look's identity — it is just a
    // washed-out version of the neutral. film's #F3E9D8 is near-white cream, same story.
    expect(readableAccent("#FFFFFF", CHROME, FALLBACK)).toBe(FALLBACK);
    expect(readableAccent("#F3E9D8", CHROME, FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a white accent on a light chrome", () => {
    // blueprint.json's accent is #FFFFFF. As a selected-state border it would be invisible.
    expect(readableAccent("#FFFFFF", CHROME, FALLBACK)).toBe(FALLBACK);
  });

  it("confirms the old neon lime never had enough contrast to be chrome as-is", () => {
    // 1.3:1 against off-white — the reason it only ever worked on a near-black chrome.
    expect(contrastRatio("#d8ff3a", CHROME)).toBeLessThan(3);
  });

  it("falls back for an accent it cannot parse", () => {
    expect(readableAccent("rgba(255,255,255,.10)", CHROME, FALLBACK)).toBe(FALLBACK);
    expect(readableAccent(undefined, CHROME, FALLBACK)).toBe(FALLBACK);
  });

  it("keeps a white accent when the chrome is dark", () => {
    expect(readableAccent("#FFFFFF", "#242426", "#f2f2f2")).toBe("#FFFFFF");
  });
});
