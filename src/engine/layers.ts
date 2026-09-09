// Renderer registry — §5.3. One entry per layer type, each exposing render() and
// measure(). Adding a layer type is a new entry, never a switch statement.
import type { FieldTable } from "../model/bindings";
import { resolveBindings } from "../model/bindings";
import type { HyroxResult } from "../model/hyrox";
import type {
  ChartLayer,
  HyroxBreakdownLayer,
  HyroxSplitsLayer,
  HyroxStationsLayer,
  ImageLayer,
  Layer,
  RouteLayer,
  ShapeLayer,
  StatLayer,
  StatRowLayer,
  StickerLayer,
  TextLayer,
} from "../model/types";
import type { AnimState } from "./anim";
import { typewriter } from "./anim";
import { type ChartData, chartHasData, drawChart } from "./chartLayers";
import { drawStat, drawStatRow, measureStat, measureStatRow, presentStats, resolveStat } from "./dataLayers";
import type { LatLng } from "./geometry";
import { DEFAULT_HYROX_STYLE, drawHyroxBreakdown, drawHyroxSplits, drawHyroxStations } from "./hyroxLayers";
import { drawRoute } from "./routeLayer";
import { stickerPath } from "./stickers";
import { applyLetterSpacing, clearLetterSpacing, cssFont, measureRun, wrapText } from "./text";

export interface RenderEnv {
  ctx: CanvasRenderingContext2D;
  fields: FieldTable;
  /** Resolves an image asset id to something drawable. */
  asset: (assetId: string) => CanvasImageSource | null;
  anim: AnimState;
  /** The current HYROX result, when the activity is a HYROX race. */
  hyrox?: HyroxResult | null;
  /**
   * Raw activity series for the data-bound layers. Separate from `fields`, which holds
   * formatted strings: a chart needs the numbers, a text layer needs the text.
   */
  series?: {
    route?: LatLng[];
    hr?: number[];
    hrMax?: number;
    splits?: number[];
    altitude?: number[];
    distanceKm?: number;
    durationSeconds?: number;
    avgHr?: number;
    effort?: number;
    calories?: number;
  };
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

// ---------------------------------------------------------------- data-bound

const fixed = (layer: Layer, fw: number, fh: number): Box => ({
  w: typeof layer.w === "number" ? layer.w : fw,
  h: typeof layer.h === "number" ? layer.h : fh,
});

const statRenderer: LayerRenderer<StatLayer> = {
  measure(layer, env) {
    const stat = resolveStat(layer.field, env.fields, 1);
    return measureStat(env.ctx, stat, layer.style, {
      layout: layer.layout,
      showLabel: layer.showLabel,
      countUpProgress: 1,
    });
  },
  render(layer, env) {
    const progress = layer.countUp ? env.anim.progress : 1;
    const stat = resolveStat(layer.field, env.fields, progress);
    drawStat(env.ctx, stat, layer.style, {
      layout: layer.layout,
      showLabel: layer.showLabel,
      countUpProgress: progress,
    });
  },
};

const statRowRenderer: LayerRenderer<StatRowLayer> = {
  measure(layer, env) {
    const stats = presentStats(layer.fields, env.fields, 1);
    return measureStatRow(env.ctx, stats, layer.style, {
      layout: layer.layout,
      gap: layer.gap,
      divider: layer.divider,
      showLabels: layer.showLabels,
      countUpProgress: 1,
    });
  },
  render(layer, env) {
    const progress = layer.countUp ? env.anim.progress : 1;
    const stats = presentStats(layer.fields, env.fields, progress);
    const options = {
      layout: layer.layout,
      gap: layer.gap,
      divider: layer.divider,
      showLabels: layer.showLabels,
      countUpProgress: progress,
    };
    const measured = measureStatRow(env.ctx, stats, layer.style, options);
    drawStatRow(env.ctx, stats, layer.style, options, measured);
  },
};

/** Drawn when a data layer has nothing to show, so it explains itself in the editor. */
function drawNoData(ctx: CanvasRenderingContext2D, w: number, h: number, reason: string): void {
  ctx.save();
  ctx.setLineDash([9, 7]);
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.max(14, Math.min(26, h * 0.13))}px system-ui, sans-serif`;
  ctx.fillText(reason, w / 2, h / 2);
  ctx.restore();
}

const routeRenderer: LayerRenderer<RouteLayer> = {
  measure: (layer) => fixed(layer, 620, 620),
  render(layer, env) {
    const { w, h } = fixed(layer, 620, 620);
    const route = env.series?.route ?? [];
    if (route.length < 2) {
      drawNoData(env.ctx, w, h, "No GPS in this activity");
      return;
    }
    drawRoute(
      env.ctx,
      {
        points: route,
        hr: env.series?.hr,
        splits: env.series?.splits,
        altitude: env.series?.altitude,
        distanceKm: env.series?.distanceKm,
      },
      w,
      h,
      layer.style,
      { progress: env.anim.progress },
    );
  },
};

const CHART_REASON: Record<ChartLayer["kind"], string> = {
  hr: "No heart rate in this activity",
  zones: "No heart rate in this activity",
  pace: "No split data in this activity",
  splits: "No split data in this activity",
  elevation: "No elevation in this activity",
  rings: "No effort data in this activity",
};

const chartRenderer: LayerRenderer<ChartLayer> = {
  measure: (layer) => fixed(layer, 880, 280),
  render(layer, env) {
    const { w, h } = fixed(layer, 880, 280);
    const data: ChartData = {
      hr: env.series?.hr,
      hrMax: env.series?.hrMax,
      splits: env.series?.splits,
      altitude: env.series?.altitude,
      effort: env.series?.effort,
      avgHr: env.series?.avgHr,
      durationSeconds: env.series?.durationSeconds,
      calories: env.series?.calories,
    };
    if (!chartHasData(layer.kind, data)) {
      drawNoData(env.ctx, w, h, CHART_REASON[layer.kind]);
      return;
    }
    drawChart(env.ctx, layer.kind, data, w, h, layer.style, {
      ...layer.options,
      progress: env.anim.progress,
    });
  },
};

// ---------------------------------------------------------------- HYROX

const hyroxStyleOf = (style: {
  run: string;
  station: string;
  roxzone: string;
  text: string;
  muted: string;
}) => ({
  ...DEFAULT_HYROX_STYLE,
  ...style,
});

/** Drawn when there is no HYROX result yet, so the layer is visible and explains itself. */
function drawHyroxPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.max(16, Math.min(28, h * 0.12))}px ${DEFAULT_HYROX_STYLE.font}`;
  ctx.fillText(label, w / 2, h / 2 - 12);
  ctx.font = `500 ${Math.max(13, Math.min(22, h * 0.09))}px ${DEFAULT_HYROX_STYLE.font}`;
  ctx.fillText("Paste your HYROX splits in the Data tab", w / 2, h / 2 + 18);
  ctx.restore();
}

const hyroxBreakdownRenderer: LayerRenderer<HyroxBreakdownLayer> = {
  measure: (layer) => fixed(layer, 880, 220),
  render(layer, env) {
    const { w, h } = fixed(layer, 880, 220);
    if (!env.hyrox) return drawHyroxPlaceholder(env.ctx, w, h, "Time breakdown");
    drawHyroxBreakdown(env.ctx, env.hyrox, w, h, hyroxStyleOf(layer.style), {
      ...layer.options,
      progress: env.anim.progress,
    });
  },
};

const hyroxStationsRenderer: LayerRenderer<HyroxStationsLayer> = {
  measure: (layer) => fixed(layer, 880, 520),
  render(layer, env) {
    const { w, h } = fixed(layer, 880, 520);
    if (!env.hyrox) return drawHyroxPlaceholder(env.ctx, w, h, "Station times");
    drawHyroxStations(env.ctx, env.hyrox, w, h, hyroxStyleOf(layer.style), {
      ...layer.options,
      progress: env.anim.progress,
    });
  },
};

const hyroxSplitsRenderer: LayerRenderer<HyroxSplitsLayer> = {
  measure: (layer) => fixed(layer, 760, 900),
  render(layer, env) {
    const { w, h } = fixed(layer, 760, 900);
    if (!env.hyrox) return drawHyroxPlaceholder(env.ctx, w, h, "Splits");
    drawHyroxSplits(env.ctx, env.hyrox, w, h, hyroxStyleOf(layer.style), {
      ...layer.options,
      progress: env.anim.progress,
    });
  },
};

// ---------------------------------------------------------------- registry

export const RENDERERS = {
  text: textRenderer,
  stat: statRenderer,
  statRow: statRowRenderer,
  route: routeRenderer,
  chart: chartRenderer,
  shape: shapeRenderer,
  image: imageRenderer,
  sticker: stickerRenderer,
  hyroxBreakdown: hyroxBreakdownRenderer,
  hyroxStations: hyroxStationsRenderer,
  hyroxSplits: hyroxSplitsRenderer,
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
    case "stat":
      return RENDERERS.stat.measure(layer, env);
    case "statRow":
      return RENDERERS.statRow.measure(layer, env);
    case "route":
      return RENDERERS.route.measure(layer, env);
    case "chart":
      return RENDERERS.chart.measure(layer, env);
    case "hyroxBreakdown":
      return RENDERERS.hyroxBreakdown.measure(layer, env);
    case "hyroxStations":
      return RENDERERS.hyroxStations.measure(layer, env);
    case "hyroxSplits":
      return RENDERERS.hyroxSplits.measure(layer, env);
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
    case "stat":
      RENDERERS.stat.render(layer, env);
      return;
    case "statRow":
      RENDERERS.statRow.render(layer, env);
      return;
    case "route":
      RENDERERS.route.render(layer, env);
      return;
    case "chart":
      RENDERERS.chart.render(layer, env);
      return;
    case "hyroxBreakdown":
      RENDERERS.hyroxBreakdown.render(layer, env);
      return;
    case "hyroxStations":
      RENDERERS.hyroxStations.render(layer, env);
      return;
    case "hyroxSplits":
      RENDERERS.hyroxSplits.render(layer, env);
      return;
  }
}
