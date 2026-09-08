// Look linter (spec §12.7).
//
// Wired up in Phase 0 so the gate exists before the first look is written, and so §13
// Phase 3 starts with the checker rather than ending with it. There are no looks yet
// (src/looks/ arrives in Phase 3), so today this passes with zero files — but the moment
// someone adds volt.json it is checked.
//
// Implemented now (no dependencies, pure maths):
//   - completeness: every token present, colours parseable, referenced fonts exist
//   - contrast on the look's own background: text >= 4.5:1, textMuted >= 3:1, accent >= 3:1
//   - family metadata: family and photo.suits present
//
// Deferred to Phase 3, when `culori` lands (§11.1) and fixture photos exist:
//   - accent distinct from text (ΔE₀₀ >= 20 unless accentIsText)
//   - zone colours pairwise ΔE₀₀ >= 15, and >= 8 under deuteranopia/protanopia
//   - legibility over the six fixture photos with the look's `legibility` mechanism
//   - auto-generated preview card matches tokens
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LOOKS_DIR = resolve(ROOT, "src/looks");

/** Font tokens available to a look (§5.6). Phase 0 ships the legacy system-font set. */
const KNOWN_FONTS = new Set([
  "inter",
  "bebas",
  "jetbrains",
  "caveat",
  "anton",
  "fraunces",
  "grotesk",
  "instrument",
  "archivo",
  "syne",
  "unbounded",
  "monoton",
  "shoulders",
  "playfair",
  "rubikmono",
]);

const REQUIRED_COLORS = ["bg", "surface", "text", "textMuted", "accent", "accent2"];
const REQUIRED_FONTS = ["display", "body", "mono"];
const VALID_LEGIBILITY = new Set(["shadow", "scrim", "pill"]);

/** Parses #rgb, #rrggbb and rgba() into linear-ready 0-255 channels plus alpha. */
function parseColor(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();

  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgba = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }

  // Gradient accents are declared as "gradient #AAA→#BBB" in Appendix B; those are checked
  // in Phase 3 against both stops.
  if (v.startsWith("gradient")) return { gradient: true };
  return null;
}

/** WCAG 2.1 relative luminance. */
function luminance({ r, g, b }) {
  const ch = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Composites a possibly-translucent foreground over an opaque background. */
function flatten(fg, bg) {
  if (fg.a >= 1) return fg;
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function contrast(fg, bg) {
  const a = luminance(flatten(fg, bg));
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function lintLook(look) {
  const problems = [];
  const colors = look.colors ?? {};
  const parsed = {};

  for (const key of REQUIRED_COLORS) {
    const value = colors[key];
    if (value === undefined) {
      problems.push(`colors.${key} is missing`);
      continue;
    }
    const c = parseColor(value);
    if (!c) problems.push(`colors.${key} is not a valid colour: ${JSON.stringify(value)}`);
    else parsed[key] = c;
  }

  for (const key of REQUIRED_FONTS) {
    const font = look.fonts?.[key];
    if (!font) problems.push(`fonts.${key} is missing`);
    else if (!KNOWN_FONTS.has(font)) problems.push(`fonts.${key} references unknown family "${font}" (§5.6)`);
  }

  if (!look.family) problems.push("family is missing (§4.5)");
  if (!Array.isArray(look.photo?.suits) || look.photo.suits.length === 0) {
    problems.push("photo.suits is missing or empty — Three for you (§2.7 S1) needs it");
  }
  if (look.legibility && !VALID_LEGIBILITY.has(look.legibility)) {
    problems.push(`legibility must be one of ${[...VALID_LEGIBILITY].join(", ")}`);
  }

  const bg = parsed.bg;
  if (bg && !bg.gradient) {
    const checks = [
      ["text", 4.5],
      ["textMuted", 3],
      ["accent", 3],
    ];
    for (const [key, min] of checks) {
      const fg = parsed[key];
      if (!fg || fg.gradient) continue;
      const ratio = contrast(fg, bg);
      if (ratio < min) {
        problems.push(`colors.${key} vs bg is ${ratio.toFixed(2)}:1, needs ${min}:1`);
      }
    }
  }

  return problems;
}

if (!existsSync(LOOKS_DIR)) {
  console.log("lint:looks — src/looks/ does not exist yet (looks arrive in Phase 3, §13). Nothing to check.");
  process.exit(0);
}

const files = readdirSync(LOOKS_DIR).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.log("lint:looks — no looks in src/looks/ yet. Nothing to check.");
  process.exit(0);
}

let failed = 0;
for (const file of files.sort()) {
  const path = resolve(LOOKS_DIR, file);
  let look;
  try {
    look = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`FAIL ${file}: not valid JSON — ${err.message}`);
    failed++;
    continue;
  }
  const problems = lintLook(look);
  if (problems.length) {
    failed++;
    console.error(`FAIL ${file}\n  ${problems.join("\n  ")}`);
  } else {
    console.log(`ok   ${file}`);
  }
}

console.log(
  `\nlint:looks — ${files.length - failed}/${files.length} passed.` +
    "\nNote: ΔE₀₀, colour-blind simulation and photo-legibility checks land in Phase 3 (§12.7).",
);
process.exit(failed ? 1 : 0);
