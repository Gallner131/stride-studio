// Renderer registry — §5.3. One entry per layer type, each exposing render() and
// measure(). Adding a layer type is a new entry, never a switch statement.
import type { FieldTable } from "../model/bindings";
import { resolveBindings } from "../model/bindings";
import type { ImageLayer, Layer, ShapeLayer, StickerLayer, TextLayer } from "../model/types";
import type { AnimState } from "./anim";
import { typewriter } from "./anim";
import { stickerPath } from "./stickers";
import { applyLetterSpacing, clearLetterSpacing, cssFont, measureRun, wrapText } from "./text";

export interface RenderEnv {
  ctx: CanvasRenderingContext2D;
  fields: FieldTable;
  /** Resolves an image asset id to something drawable. */
  asset: (assetId: string) => CanvasImageSource | null;
  anim: AnimState;
}

export interface Box {
  w: number;
  h: number;
}

interface LayerRenderer<L extends Layer> {
  /** Untransformed size in canvas units. Used by hit-testing, handles and snapping. */
  measure(layer: L, env: RenderEnv): Box;
  /** Draws with the origin already translated to the layer's top-left. */
  render(layer: L, env: RenderEnv): void;
}

// ---------------------------------------------------------------- text

/** The string actually drawn: bindings resolved, then typewriter applied. */
export function textContent(layer: TextLayer, env: RenderEnv): string {
  const resolved = resolveBindings(layer.text, env.fields);
  return layer.anim.preset === "typewriter" ? typewriter(resolved, env.anim.progress) : resolved;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const textRenderer: LayerRenderer<TextLayer> = {
  measure(layer, env) {
    const wrapped = wrapText(env.ctx, textContent(layer, env) || " ", layer.style);
    const pad = layer.style.fill ? layer.style.fill.pad : 0;
    return { w: wrapped.width + pad * 2, h: wrapped.height + pad * 2 };
  },

  render(layer, env) {
    const { ctx } = env;
    const style = layer.style;
    const content = textContent(layer, env);
    if (!content) return;

    const wrapped = wrapText(ctx, content, style);
    const pad = style.fill ? style.fill.pad : 0;

    if (style.fill) {
      ctx.fillStyle = style.fill.color;
      roundRect(ctx, 0, 0, wrapped.width + pad * 2, wrapped.height + pad * 2, style.fill.radius);
      ctx.fill();
    }

    ctx.font = cssFont(style);
    applyLetterSpacing(ctx, style);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    // Baseline of the first line: pad + ascent-ish. 0.8 of the line box reads correctly
    // across the six legacy font stacks without per-font metrics.
    let y = pad + style.size * 0.82;

    for (const line of wrapped.lines) {
      const lineW = measureRun(ctx, line, style);
      const x =
        pad +
        (style.align === "center"
          ? (wrapped.width - lineW) / 2
          : style.align === "right"
            ? wrapped.width - lineW
            : 0);

      drawTextLine(ctx, line, x, y, layer, wrapped.width);
      y += wrapped.lineHeight;
    }

    clearLetterSpacing(ctx);
  },
};

function drawTextLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  layer: TextLayer,
  blockWidth: number,
): void {
  const style = layer.style;
  const effect = style.effect.kind;

  ctx.save();

  if (style.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.max(6, style.size * 0.18);
    ctx.shadowOffsetY = Math.max(1, style.size * 0.03);
  }

  if (effect === "highlight") {
    // Marker behind the glyphs (§2.7 S10).
    const w = ctx.measureText(line).width;
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = style.effect.color ?? "#D8FF3A";
    ctx.fillRect(x - style.size * 0.06, y - style.size * 0.78, w + style.size * 0.12, style.size * 0.98);
    ctx.restore();
  }

  if (effect === "longShadow") {
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    const steps = Math.round(style.size * 0.25);
    for (let i = steps; i > 0; i--) ctx.fillText(line, x + i, y + i);
    ctx.restore();
  }

  if (effect === "glow") {
    ctx.shadowColor = style.effect.color ?? style.color;
    ctx.shadowBlur = style.size * 0.5;
    ctx.shadowOffsetY = 0;
  }

  if (effect === "gradient") {
    const g = ctx.createLinearGradient(0, y - style.size, 0, y + style.size * 0.2);
    g.addColorStop(0, style.color);
    g.addColorStop(1, style.effect.color ?? "rgba(255,255,255,0.35)");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = style.color;
  }

  if (effect === "outline") {
    ctx.lineWidth = Math.max(1, style.size * 0.06);
    ctx.strokeStyle = style.color;
    ctx.strokeText(line, x, y);
  } else {
    ctx.fillText(line, x, y);
  }

  if (style.stroke) {
    ctx.shadowColor = "transparent";
    ctx.lineWidth = style.stroke.width;
    ctx.strokeStyle = style.stroke.color;
    ctx.strokeText(line, x, y);
  }

  ctx.restore();
  void blockWidth;
}

// ---------------------------------------------------------------- shape

const shapeRenderer: LayerRenderer<ShapeLayer> = {
  measure(layer) {
    return { w: typeof layer.w === "number" ? layer.w : 200, h: typeof layer.h === "number" ? layer.h : 200 };
  },

  render(layer, env) {
    const { ctx } = env;
    const { w, h } = shapeRenderer.measure(layer, env);
    const s = layer.style;

    ctx.save();
    if (s.dash) ctx.setLineDash(s.dash);

    if (layer.shape === "line") {
      ctx.strokeStyle = s.fill ?? "#FFFFFF";
      ctx.lineWidth = h;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (layer.shape === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (layer.shape === "tape") {
      // A torn strip: straight sides, ragged top and bottom.
      ctx.beginPath();
      ctx.moveTo(0, h * 0.12);
      const teeth = 8;
      for (let i = 0; i <= teeth; i++) {
        ctx.lineTo((w / teeth) * i, i % 2 ? 0 : h * 0.16);
      }
      ctx.lineTo(w, h * 0.86);
      for (let i = teeth; i >= 0; i--) {
        ctx.lineTo((w / teeth) * i, i % 2 ? h : h * 0.84);
      }
      ctx.closePath();
    } else {
      roundRect(ctx, 0, 0, w, h, layer.shape === "pill" ? h / 2 : s.radius);
    }

    if (s.fill) {
      ctx.fillStyle = s.fill;
      ctx.fill();
    }
    if (s.stroke) {
      ctx.lineWidth = s.stroke.width;
      ctx.strokeStyle = s.stroke.color;
      ctx.stroke();
    }
    ctx.restore();
  },
};

// ---------------------------------------------------------------- image

const imageRenderer: LayerRenderer<ImageLayer> = {
  measure(layer) {
    return { w: typeof layer.w === "number" ? layer.w : 300, h: typeof layer.h === "number" ? layer.h : 300 };
  },

  render(layer, env) {
    const src = env.asset(layer.assetId);
    if (!src) return;
    const { ctx } = env;
    const { w, h } = imageRenderer.measure(layer, env);

    ctx.save();
    if (layer.style.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 8;
    }
    if (layer.style.radius > 0) {
      roundRect(ctx, 0, 0, w, h, layer.style.radius);
      ctx.clip();
    }
    try {
      ctx.drawImage(src, 0, 0, w, h);
    } catch {
      // A decoding image is not an error worth failing the frame for.
    }
    ctx.restore();
  },
};

// ---------------------------------------------------------------- sticker

const stickerRenderer: LayerRenderer<StickerLayer> = {
  measure(layer) {
    return { w: typeof layer.w === "number" ? layer.w : 160, h: typeof layer.h === "number" ? layer.h : 160 };
  },

  render(layer, env) {
    const path = stickerPath(layer.svgId);
    if (!path) return;
    const { ctx } = env;
    const { w, h } = stickerRenderer.measure(layer, env);

    ctx.save();
    ctx.scale(w / 100, h / 100);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const def = stickerPath(layer.svgId) && layer.svgId;
    const strokeOnly = STROKE_ONLY.has(String(def));

    if (strokeOnly) {
      ctx.strokeStyle = layer.style.fill;
      ctx.lineWidth = Math.max(4, layer.style.strokeWidth || 8);
      ctx.stroke(path);
    } else {
      ctx.fillStyle = layer.style.fill;
      ctx.fill(path);
      if (layer.style.stroke && layer.style.strokeWidth > 0) {
        ctx.strokeStyle = layer.style.stroke;
        ctx.lineWidth = layer.style.strokeWidth;
        ctx.stroke(path);
      }
    }
    ctx.restore();
  },
};

const STROKE_ONLY = new Set(["wind", "check", "cross", "route"]);

// ---------------------------------------------------------------- registry

export const RENDERERS = {
  text: textRenderer,
  shape: shapeRenderer,
  image: imageRenderer,
  sticker: stickerRenderer,
} as const;

export function measureLayer(layer: Layer, env: RenderEnv): Box {
  switch (layer.type) {
    case "text":
      return RENDERERS.text.measure(layer, env);
    case "shape":
      return RENDERERS.shape.measure(layer, env);
    case "image":
      return RENDERERS.image.measure(layer, env);
    case "sticker":
      return RENDERERS.sticker.measure(layer, env);
  }
}

export function renderLayer(layer: Layer, env: RenderEnv): void {
  switch (layer.type) {
    case "text":
      RENDERERS.text.render(layer, env);
      return;
    case "shape":
      RENDERERS.shape.render(layer, env);
      return;
    case "image":
      RENDERERS.image.render(layer, env);
      return;
    case "sticker":
      RENDERERS.sticker.render(layer, env);
      return;
  }
}
