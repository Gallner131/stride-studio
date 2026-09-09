// Text layout — §5.4. Word wrap, uppercase-at-render, letter-spacing fallback.
import type { TextStyle } from "../model/types";

export const FONT_STACKS: Record<string, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  cond: 'Impact, "Arial Narrow", "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SF Mono", Menlo, Consolas, "Courier New", monospace',
  script: '"Brush Script MT", "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive',
  rounded: '"SF Pro Rounded", "Arial Rounded MT Bold", Nunito, "Varela Round", system-ui, sans-serif',
};

const SANS_FALLBACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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
