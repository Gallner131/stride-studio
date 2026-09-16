// Look token resolution — §4.3, §4.5.
//
// Any colour or font field on a layer may be a token reference: "$accent", "$text",
// "$display". Tokens are resolved AT RENDER TIME, which is what makes swapping a look
// restyle every layer at once. A literal value ("#FF2D95") is a user override and survives
// a look change untouched — that distinction is the whole contract.
import type { Layer } from "../model/types";

export interface Look {
  id: string;
  name: string;
  family: string;
  colors: {
    bg: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    accent2: string;
  };
  accentGradient?: [string, string];
  fonts: { display: string; body: string; mono: string };
  /** The nearest of the six system stacks, until §5.6's real faces are bundled. */
  legacyFonts: { display: string; body: string };
  shape: { radius: number; glass: boolean; stroke: number; pad: number };
  type: { uppercase: boolean; letterSpacing: number; displayWeight: number; tabular: boolean };
  texture: { grain: number; vignette: number; pattern: string | null };
  legibility: "shadow" | "scrim" | "pill";
  chart: { zones: string; zoneColors: string[] };
  photo: { suits: string[] };
  motion: { ease: string; speed: number; entrance: string; loop: string | null };
  accentIsText?: boolean;
}

/** Builds the token table a look resolves to. */
export function tokenTable(look: Look): Record<string, string | number | string[]> {
  return {
    // colours
    bg: look.colors.bg,
    surface: look.colors.surface,
    text: look.colors.text,
    textMuted: look.colors.textMuted,
    accent: look.colors.accent,
    accent2: look.colors.accent2,
    // fonts resolve to the legacy stacks for now, so a look looks right today (§5.6)
    // The real face the look asked for, with the system stack behind it. `legacyFonts` was
    // the stand-in "until §5.6's real faces are bundled" — they are bundled now, and while
    // this still pointed at the fallback every look rendered in Impact regardless of what
    // it declared. That one line is why fourteen looks shared one typeface.
    display: look.fonts.display || look.legacyFonts.display,
    body: look.fonts.body || look.legacyFonts.body,
    mono: look.fonts.mono || "mono",
    // shape and type
    radius: look.shape.radius,
    pad: look.shape.pad,
    stroke: look.shape.stroke,
    displayWeight: look.type.displayWeight,
    letterSpacing: look.type.letterSpacing,
    zoneColors: look.chart.zoneColors,
  };
}

const isToken = (v: unknown): v is string => typeof v === "string" && v.startsWith("$");

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Replaces every "$token" in a value tree with its look value.
 *
 * Unknown tokens are left as-is rather than blanked: a design referencing "$brand" from a
 * look that does not define it should look obviously wrong in the editor, not silently
 * transparent in an export.
 */
export function resolveTokens<T>(value: T, tokens: Record<string, string | number | string[]>): T {
  if (isToken(value)) {
    const key = value.slice(1);
    const resolved = tokens[key];
    return (resolved === undefined ? value : resolved) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTokens(v, tokens)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTokens(v, tokens);
    return out as T;
  }
  return value;
}

/** A layer with its tokens resolved, ready to render. */
export const resolveLayer = (layer: Layer, look: Look | null): Layer =>
  look ? resolveTokens(layer, tokenTable(look)) : layer;

/**
 * Applies a look's typographic character to layers that opted into it.
 *
 * A look is more than colour: Volt is uppercase and condensed, Paper is not. Layers using
 * "$displayWeight" / "$letterSpacing" tokens pick that up through resolveTokens; uppercase
 * is a boolean rather than a token, so it is applied here — and only when the layer has not
 * set it itself.
 */
export function applyLookType(layer: Layer, look: Look | null): Layer {
  if (!look || layer.type !== "text") return layer;
  if (layer.style.uppercase) return layer;
  // Only headline-scale text takes the look's uppercase setting; body copy stays as typed.
  if (!look.type.uppercase || layer.style.size < 80) return layer;
  return { ...layer, style: { ...layer.style, uppercase: true } };
}

/** Looks grouped by family, for the picker (§6.9). */
export const FAMILY_ORDER = ["quiet", "loud", "editorial", "data", "health", "fun"] as const;

export const FAMILY_LABEL: Record<string, string> = {
  quiet: "Quiet — the photo wins",
  loud: "Loud — night, track, speed",
  editorial: "Editorial — magazine, journal",
  data: "Data — technical",
  health: "Health — effort, gym",
  fun: "Fun — nostalgia, kit",
};

export function groupByFamily(looks: Look[]): { family: string; label: string; looks: Look[] }[] {
  return FAMILY_ORDER.map((family) => ({
    family,
    label: FAMILY_LABEL[family] ?? family,
    looks: looks.filter((l) => l.family === family),
  })).filter((g) => g.looks.length > 0);
}

/**
 * Does this look suit this photo? Used by Three for you (§2.7 S1) and to sort the picker.
 * `brightness` is the photo's mean luminance, 0-1.
 */
export function looksSuited(looks: Look[], brightness: number | null): Look[] {
  if (brightness === null) return looks;
  const wantsBright = brightness > 0.58;
  const wantsDark = brightness < 0.38;
  return looks.filter((l) => {
    const suits = l.photo.suits.join(" ");
    if (suits.includes("any")) return true;
    if (wantsBright) return /bright|snow|sky|soft|indoor/.test(suits);
    if (wantsDark) return /dark|night|city|gym/.test(suits);
    return true;
  });
}
