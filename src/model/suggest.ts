// Match my photo (§2.7 S2) and Three for you (§2.7 S1).
//
// Both are deterministic: the same photo and activity always produce the same suggestions,
// which is what makes "Shuffle" feel like a choice rather than a dice roll, and what makes
// them testable.

import type { PhotoAnalysis, Rgb } from "../engine/photo";
import { contrastRatio, ensureContrast, hexOf, relativeLuminance, rotateHue } from "../engine/photo";
import type { Look } from "../engine/tokens";
import { LOOKS } from "../looks";
import type { ActivityCapabilities, TemplateDef } from "../templates";
import { TEMPLATES, templateAvailable } from "../templates";

// ---------------------------------------------------------------- Match my photo

export const MATCHED_LOOK_ID = "from-photo";

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 17, g: 17, b: 17 };

/**
 * Builds a look from the photo — §2.7 S2.
 *
 * The accent is the photo's most saturated dominant colour, accent2 its complement at the
 * same lightness, and text light or dark depending on the photo's own brightness. The
 * accent is then forced to clear 3:1 against the resulting background, because a look
 * derived from a washed-out photo would otherwise fail the same contrast rule every
 * curated look has to pass (§12.7).
 */
export function lookFromPhoto(analysis: PhotoAnalysis): Look {
  const source = analysis.accent ?? {
    r: 216,
    g: 255,
    b: 58,
    weight: 1,
    saturation: 1,
    luminance: 0.8,
    hex: "#D8FF3A",
  };
  const sourceRgb: Rgb = { r: source.r, g: source.g, b: source.b };

  // Dark photo -> light type, and vice versa.
  const photoIsDark = analysis.brightness < 0.5;
  const text = photoIsDark ? WHITE : BLACK;
  const bg = photoIsDark ? { r: 14, g: 14, b: 14 } : { r: 244, g: 244, b: 244 };

  const accent = ensureContrast(sourceRgb, bg, 3);
  const accent2 = ensureContrast(rotateHue(sourceRgb, 180), bg, 3);

  // Font temperature: warm hues get the editorial serif, cool ones the condensed face,
  // and near-neutral photos the plain one (§2.7 S2).
  const warm = analysis.hue < 60 || analysis.hue > 300;
  const cool = analysis.hue >= 160 && analysis.hue <= 260;
  const display = warm ? "serif" : cool ? "cond" : "sans";

  const muted = photoIsDark ? "rgba(255,255,255,0.70)" : "rgba(17,17,17,0.62)";

  return {
    id: MATCHED_LOOK_ID,
    name: "From your photo",
    family: "quiet",
    colors: {
      bg: hexOf(bg),
      surface: photoIsDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
      text: hexOf(text),
      textMuted: muted,
      accent: hexOf(accent),
      accent2: hexOf(accent2),
    },
    fonts: { display: "inter", body: "inter", mono: "jetbrains" },
    legacyFonts: { display, body: "sans" },
    shape: { radius: 16, glass: false, stroke: 3, pad: 24 },
    type: { uppercase: false, letterSpacing: -0.01, displayWeight: 800, tabular: true },
    texture: { grain: 0, vignette: 0.25, pattern: null },
    // A photo-derived look cannot be legibility-tested in advance, so it takes the safest
    // of the three mechanisms rather than the prettiest.
    legibility: "shadow",
    chart: {
      zones: "default",
      zoneColors: ["#8FA3B5", "#4FC1E9", "#7BE495", "#FFB347", "#FF5A5F"],
    },
    photo: { suits: ["any"] },
    motion: { ease: "outCubic", speed: 1, entrance: "slideUp", loop: null },
  };
}

/** Does the derived look meet the same bar as a curated one? Used by the tests. */
export function matchedLookPassesContrast(look: Look): boolean {
  const parse = (hex: string): Rgb => ({
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  });
  const bg = parse(look.colors.bg);
  return (
    contrastRatio(parse(look.colors.text), bg) >= 4.5 && contrastRatio(parse(look.colors.accent), bg) >= 3
  );
}

// ---------------------------------------------------------------- Three for you

export interface Suggestion {
  template: TemplateDef;
  look: Look;
  /** Why this was proposed, shown as the card's subtitle. */
  reason: string;
}

/** Appendix B.3 pairings, as look ids per template id. Anything unlisted falls back. */
const PAIRINGS: Record<string, string[]> = {
  trace: ["clean", "shade", "volt", "telemetry"],
  ribbon: ["ledger", "telemetry", "blueprint", "film"],
  splitsTable: ["ledger", "clean", "broadsheet", "dashboard"],
  session: ["dashboard", "clinic", "pulse", "iron"],
  workout: ["pulse", "iron", "clinic", "volt"],
  effort: ["dashboard", "clinic", "frost", "y2k"],
  pb: ["volt", "flare", "ember", "track"],
  kit: ["kit", "track", "retro78"],
  hyroxCard: ["iron", "pulse", "dashboard", "volt"],
  hyroxStations: ["dashboard", "ledger", "iron"],
  hyroxSplits: ["ledger", "telemetry", "clean"],
};

const lookById = (id: string): Look | null => LOOKS.find((l) => l.id === id) ?? null;

/** Picks the first paired look that suits the photo, else the first pairing, else Clean. */
function pickLook(templateId: string, analysis: PhotoAnalysis | null, offset: number): Look {
  const ids = PAIRINGS[templateId] ?? ["clean", "volt", "paper"];
  const candidates = ids.map(lookById).filter((l): l is Look => l !== null);
  if (candidates.length === 0) return LOOKS[0] as Look;

  if (analysis) {
    const wantsDark = analysis.brightness < 0.4;
    const wantsBright = analysis.brightness > 0.6;
    const suited = candidates.filter((l) => {
      const suits = l.photo.suits.join(" ");
      if (suits.includes("any")) return true;
      if (wantsDark) return /dark|night|city|gym/.test(suits);
      if (wantsBright) return /bright|snow|sky|soft|indoor/.test(suits);
      return true;
    });
    if (suited.length > 0) return suited[offset % suited.length] as Look;
  }
  return candidates[offset % candidates.length] as Look;
}

/**
 * Three complete designs — §2.7 S1.
 *
 * Not random: one quiet, one loud, and one editorial-or-health, chosen from what the
 * activity actually has. A route gets a Map design, heart rate gets a Health one, a HYROX
 * result outranks both because it is the most specific thing we know.
 *
 * `shuffle` rotates the choice within the same rules, so the button explores rather than
 * rerolls.
 */
export function threeForYou(
  caps: ActivityCapabilities,
  analysis: PhotoAnalysis | null,
  shuffle = 0,
): Suggestion[] {
  const available = TEMPLATES.filter((t) => templateAvailable(t, caps));
  if (available.length === 0) return [];

  const byId = (id: string) => available.find((t) => t.id === id);

  // Preference order, most specific first.
  const ordered: { template: TemplateDef; reason: string }[] = [];
  const push = (id: string, reason: string) => {
    const t = byId(id);
    if (t && !ordered.some((o) => o.template.id === t.id)) ordered.push({ template: t, reason });
  };

  if (caps.hyrox) {
    push("hyroxCard", "Your whole HYROX race");
    push("hyroxStations", "Where the time went");
    push("hyroxSplits", "All sixteen segments");
  }
  if (caps.route) {
    push("trace", "Your route, coloured by pace");
    if (caps.elevation) push("ribbon", "Route over the climb");
  }
  if (caps.hr) {
    push("session", "Effort and time in zone");
    push("workout", "Your heart rate through it");
    push("effort", "Effort at a glance");
  }
  if (caps.splits) push("splitsTable", "Every kilometre");
  push("pb", "For a day worth marking");
  if (caps.distance) push("kit", "Your distance as a shirt number");

  // Fill from whatever is left, so there are always three when three exist.
  for (const t of available) push(t.id, t.desc);

  const rotated = ordered
    .slice(shuffle % Math.max(1, ordered.length))
    .concat(ordered.slice(0, shuffle % Math.max(1, ordered.length)));

  return rotated.slice(0, 3).map((entry, i) => ({
    template: entry.template,
    look: pickLook(entry.template.id, analysis, shuffle + i),
    reason: entry.reason,
  }));
}

// ---------------------------------------------------------------- Smart placement

export type Anchor = { ax: number; ay: number };

/**
 * Smart placement — §2.7 S3.
 *
 * Scores the photo's busyness grid and returns the calmest of the offered anchors, so the
 * stat block lands on the quiet part of the picture. Returns the first option unchanged
 * when there is no photo to analyse.
 */
export function calmestAnchor(options: Anchor[], analysis: PhotoAnalysis | null): Anchor {
  const first = options[0] ?? { ax: 0.06, ay: 1 };
  if (!analysis || options.length === 0) return first;

  const COLS = 6;
  const ROWS = 10;

  let best = first;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const option of options) {
    // Sample the 2x3 block of cells around the anchor.
    const cx = Math.min(COLS - 1, Math.max(0, Math.round(option.ax * (COLS - 1))));
    const cy = Math.min(ROWS - 1, Math.max(0, Math.round(option.ay * (ROWS - 1))));
    let sum = 0;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
        sum += analysis.busyness[y * COLS + x] ?? 0;
        count++;
      }
    }
    const score = count > 0 ? sum / count : 1;
    if (score < bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best;
}

/** Is the photo dark enough that light type is the right call? */
export const prefersLightType = (analysis: PhotoAnalysis | null): boolean =>
  analysis === null || analysis.brightness < 0.5;

export { relativeLuminance };
