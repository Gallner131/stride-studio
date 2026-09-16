import { describe, expect, it } from "vitest";
import { FONT_STACKS } from "../../src/engine/text";
import {
  FAMILY_ORDER,
  groupByFamily,
  type Look,
  looksSuited,
  resolveTokens,
  tokenTable,
} from "../../src/engine/tokens";
import { DEFAULT_LOOK_ID, getLook, LOOK_BY_ID, LOOKS } from "../../src/looks";

/** §4.5 and §4.3: the 24 looks, and the token contract that makes them work. */

describe("the look library", () => {
  it("has 24 looks in six families of four", () => {
    expect(LOOKS).toHaveLength(24);
    const groups = groupByFamily(LOOKS);
    expect(groups).toHaveLength(6);
    for (const g of groups) expect(g.looks, g.family).toHaveLength(4);
  });

  it("has unique ids and a resolvable default", () => {
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(24);
    expect(getLook(DEFAULT_LOOK_ID)).not.toBeNull();
    expect(getLook("nope")).toBeNull();
    expect(getLook(null)).toBeNull();
  });

  it("defines every token, with no inheritance between looks (§4.5)", () => {
    for (const look of LOOKS) {
      for (const key of ["bg", "surface", "text", "textMuted", "accent", "accent2"] as const) {
        expect(look.colors[key], `${look.id}.${key}`).toBeTruthy();
      }
      expect(look.fonts.display, look.id).toBeTruthy();
      expect(look.legacyFonts.display, look.id).toBeTruthy();
      expect(look.chart.zoneColors, look.id).toHaveLength(5);
      expect(look.photo.suits.length, look.id).toBeGreaterThan(0);
      expect(["shadow", "scrim", "pill"], look.id).toContain(look.legibility);
    }
  });

  it("gives every family a look for a bright photo and one for a dark photo (§12.7)", () => {
    for (const family of FAMILY_ORDER) {
      const inFamily = LOOKS.filter((l) => l.family === family);
      const suits = inFamily.map((l) => l.photo.suits.join(" ")).join(" ");
      expect(/any|bright|snow|sky|soft|indoor/.test(suits), `${family} needs a bright option`).toBe(true);
      expect(/any|dark|night|city|gym/.test(suits), `${family} needs a dark option`).toBe(true);
    }
  });

  it("carries a motion signature, so a look changes how a design moves (§5.8)", () => {
    for (const look of LOOKS) {
      expect(look.motion.entrance, look.id).toBeTruthy();
      expect(look.motion.speed, look.id).toBeGreaterThan(0);
    }
  });
});

describe("token resolution", () => {
  const look = LOOK_BY_ID.get("volt") as Look;
  const tokens = tokenTable(look);

  it("replaces a token with the look's value", () => {
    expect(resolveTokens("$accent", tokens)).toBe("#D8FF3A");
    expect(resolveTokens("$text", tokens)).toBe("#F5F5F5");
  });

  it("leaves literals alone — a user override survives a look change (§4.3)", () => {
    expect(resolveTokens("#FF2D95", tokens)).toBe("#FF2D95");
    expect(resolveTokens("rgba(0,0,0,0.5)", tokens)).toBe("rgba(0,0,0,0.5)");
  });

  it("resolves nested objects and arrays", () => {
    const style = {
      color: "$text",
      fill: { color: "$accent", pad: 18 },
      gradient: ["$accent", "$textMuted"],
      size: 72,
    };
    expect(resolveTokens(style, tokens)).toEqual({
      color: "#F5F5F5",
      fill: { color: "#D8FF3A", pad: 18 },
      gradient: ["#D8FF3A", "rgba(245,245,245,.66)"],
      size: 72,
    });
  });

  it("expands $zoneColors to the look's five zone colours", () => {
    expect(resolveTokens("$zoneColors", tokens)).toHaveLength(5);
  });

  it("leaves an unknown token visible rather than blanking it", () => {
    // A design referencing a token this look does not define should look wrong in the
    // editor, not silently transparent in an export.
    expect(resolveTokens("$brandColour", tokens)).toBe("$brandColour");
  });

  it("resolves fonts to the face the look actually asked for (§5.6)", () => {
    // These used to resolve to `legacyFonts` — "cond" and "sans" — which was the stand-in
    // until the real faces were bundled. They are bundled now, and while this still pointed
    // at the fallback every one of the twenty-four looks rendered in Impact no matter which
    // typeface it declared.
    const look = LOOKS.find((l) => l.id === "neon");
    const neon = tokenTable(look!);
    expect(resolveTokens("$display", neon)).toBe("monoton");
    expect(resolveTokens("$body", neon)).toBe("inter");
  });

  it("every look names a display face that is actually bundled", () => {
    const missing = LOOKS.filter((l) => !FONT_STACKS[l.fonts.display]).map(
      (l) => `${l.id}: ${l.fonts.display}`,
    );
    expect(missing, missing.join(", ")).toEqual([]);
  });
});

describe("photo suitability (§2.7 S1)", () => {
  it("keeps every look when the brightness is unknown", () => {
    expect(looksSuited(LOOKS, null)).toHaveLength(24);
  });

  it("narrows for a bright photo and for a dark one", () => {
    const bright = looksSuited(LOOKS, 0.8);
    const dark = looksSuited(LOOKS, 0.15);
    expect(bright.length).toBeGreaterThan(0);
    expect(dark.length).toBeGreaterThan(0);
    expect(bright.length).toBeLessThan(24);
    // Telemetry is a dark-photo look and should not be proposed for a snowy one.
    expect(bright.map((l) => l.id)).not.toContain("telemetry");
    expect(dark.map((l) => l.id)).toContain("telemetry");
  });
});
