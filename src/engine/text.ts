// Text layout — §5.4. Word wrap, uppercase-at-render, letter-spacing fallback.
import type { TextStyle } from "../model/types";

export const FONT_STACKS: Record<string, string> = {
  // Bundled faces, named by the id every look already uses (src/looks/*.json).
  bebas: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
  anton: '"Anton", Impact, "Arial Narrow", sans-serif',
  archivo: '"Archivo Black", Impact, system-ui, sans-serif',
  inter: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  grotesk: '"Space Grotesk", system-ui, -apple-system, sans-serif',
  playfair: '"Playfair Display", Georgia, "Times New Roman", serif',
  jetbrains: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
  fraunces: '"Fraunces", Georgia, "Times New Roman", serif',
  instrument: '"Instrument Serif", Georgia, "Times New Roman", serif',
  monoton: '"Monoton", Impact, "Arial Narrow", sans-serif',
  rubikmono: '"Rubik Mono One", Impact, system-ui, sans-serif',
  shoulders: '"Big Shoulders Display", Impact, "Arial Narrow", sans-serif',
  syne: '"Syne", system-ui, -apple-system, sans-serif',
  unbounded: '"Unbounded", Impact, system-ui, sans-serif',

  // The legacy ids the 27 original templates still ask for.
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  cond: '"Bebas Neue", Impact, "Arial Narrow", "Helvetica Neue", Arial, sans-serif',
  serif: '"Fraunces", Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, Consolas, "Courier New", monospace',
  script: '"Brush Script MT", "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive',
  rounded: '"SF Pro Rounded", "Arial Rounded MT Bold", Nunito, "Varela Round", system-ui, sans-serif',
};

/**
 * The bundled families, for the one thing a browser will not do by itself.
 *
 * A canvas `ctx.font` that names a web font does NOT trigger that font to load — it silently
 * falls back and never tells you. `document.fonts.ready` resolves immediately because
 * nothing is pending. So every face here reports "unloaded" and every design renders in
 * Impact unless something asks for them explicitly, which src/App.jsx does on startup.
 */
export const BUNDLED_FAMILIES = [
  "Bebas Neue",
  "Anton",
  "Archivo Black",
  "Inter",
  "Space Grotesk",
  "Playfair Display",
  "JetBrains Mono",
  "Fraunces",
  "Instrument Serif",
  "Monoton",
  "Rubik Mono One",
  "Big Shoulders Display",
  "Syne",
  "Unbounded",
] as const;

const SANS_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const fontStack = (id: string): string => FONT_STACKS[id] ?? SANS_FALLBACK;

export function cssFont(style: TextStyle): string {
  const italic = style.italic ? "italic " : "";
  return `${italic}${style.weight} ${Math.round(style.size)}px ${fontStack(style.font)}`;
}

/** Uppercase is a render-time transform, never a mutation of the text. §5.4 */
export const displayText = (text: string, style: TextStyle): string =>
  style.uppercase ? text.toUpperCase() : text;

const supportsLetterSpacing = (ctx: CanvasRenderingContext2D): boolean => "letterSpacing" in ctx;

export function applyLetterSpacing(ctx: CanvasRenderingContext2D, style: TextStyle): void {
  if (supportsLetterSpacing(ctx)) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${(style.letterSpacing * style.size).toFixed(2)}px`;
  }
}

export function clearLetterSpacing(ctx: CanvasRenderingContext2D): void {
  if (supportsLetterSpacing(ctx)) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }
}

/** Measures a run of text, falling back to manual advance when letterSpacing is missing. */
export function measureRun(ctx: CanvasRenderingContext2D, text: string, style: TextStyle): number {
  const w = ctx.measureText(text).width;
  if (supportsLetterSpacing(ctx)) return w;
  return w + Math.max(0, text.length - 1) * style.letterSpacing * style.size;
}

export interface WrappedText {
  lines: string[];
  width: number;
  height: number;
  lineHeight: number;
}

/**
 * Wraps to style.maxWidth. Long unbreakable words are split at grapheme boundaries rather
 * than overflowing the frame (§5.4).
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, style: TextStyle): WrappedText {
  ctx.font = cssFont(style);
  applyLetterSpacing(ctx, style);

  const maxWidth = style.maxWidth > 0 ? style.maxWidth : Number.POSITIVE_INFINITY;
  const lines: string[] = [];

  for (const paragraph of displayText(text, style).split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureRun(ctx, candidate, style) <= maxWidth || line === "") {
        // A single word that is itself too wide gets broken up.
        if (line === "" && measureRun(ctx, word, style) > maxWidth) {
          let chunk = "";
          for (const ch of Array.from(word)) {
            if (measureRun(ctx, chunk + ch, style) > maxWidth && chunk !== "") {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
        } else {
          line = candidate;
        }
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }

  const lineHeight = style.size * style.lineHeight;
  const width = lines.reduce((max, l) => Math.max(max, measureRun(ctx, l, style)), 0);
  clearLetterSpacing(ctx);

  return { lines, width, height: Math.max(lineHeight, lines.length * lineHeight), lineHeight };
}
