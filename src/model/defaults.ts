import { newId } from "./ids";
import type {
  Anim,
  ChartLayer,
  Document,
  FormatId,
  HyroxBreakdownLayer,
  HyroxLayerStyle,
  HyroxSplitsLayer,
  HyroxStationsLayer,
  ImageLayer,
  Layer,
  LayerType,
  RouteLayer,
  ShapeKind,
  ShapeLayer,
  StatLayer,
  StatRowLayer,
  StickerLayer,
  TextLayer,
} from "./types";

/** Logical canvas is always 1000 units wide; height follows the format. §4.1 */
export const CANVAS_W = 1000;

export const FORMAT_RATIO: Record<FormatId, number> = {
  story: 1920 / 1080,
  post: 1350 / 1080,
  square: 1,
};

export const canvasHeight = (format: FormatId): number => CANVAS_W * FORMAT_RATIO[format];

/** Output width in device pixels, for export scaling. §4.1 */
export const OUTPUT_W = 1080;
export const unitsToOutput = OUTPUT_W / CANVAS_W;

/**
 * Instagram safe zone (§3.7). Story: top 250 / bottom 340 of a 1080x1920 frame, expressed
 * in canvas units. Post and square: a 40px margin.
 */
export function safeZone(format: FormatId): { top: number; bottom: number; side: number } {
  const h = canvasHeight(format);
  if (format === "story") {
    return { top: (250 / 1920) * h, bottom: (340 / 1920) * h, side: 40 / unitsToOutput };
  }
  const m = 40 / unitsToOutput;
  return { top: m, bottom: m, side: m };
}

export const DEFAULT_ANIM: Anim = {
  preset: "slideUp",
  delay: "auto",
  duration: 0.6,
  ease: "outCubic",
};

const base = (name: string) => ({
  id: newId("ly"),
  name,
  anchor: { ax: 0.5, ay: 0.5 },
  offset: { dx: 0, dy: 0 },
  origin: { ox: 0.5, oy: 0.5 },
  w: "auto" as const,
  h: "auto" as const,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  sticker: true,
  anim: { ...DEFAULT_ANIM },
  constraints: { safeZone: true, minW: 40 },
  source: "user" as const,
});

export function newTextLayer(over: Partial<TextLayer> = {}): TextLayer {
  return {
    ...base("Text"),
    type: "text",
    text: "Your text",
    style: {
      font: "sans",
      size: 72,
      weight: 700,
      italic: false,
      color: "$text",
      align: "left",
      lineHeight: 1.1,
      letterSpacing: 0,
      uppercase: false,
      maxWidth: 820,
      fill: null,
      stroke: null,
      shadow: true,
      effect: { kind: "none" },
    },
    ...over,
  } as TextLayer;
}

export function newShapeLayer(shape: ShapeKind = "rect", over: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    ...base(shape === "line" ? "Line" : "Shape"),
    type: "shape",
    shape,
    w: shape === "line" ? 400 : 360,
    h: shape === "line" ? 8 : 200,
    style: {
      fill: shape === "line" ? "#FFFFFF" : "#D8FF3A",
      stroke: null,
      radius: shape === "pill" ? 999 : 24,
      dash: null,
    },
    ...over,
  } as ShapeLayer;
}

export function newImageLayer(assetId: string, w = 300, h = 300, over: Partial<ImageLayer> = {}): ImageLayer {
  return {
    ...base("Image"),
    type: "image",
    assetId,
    w,
    h,
    style: { radius: 0, shadow: false },
    constraints: { keepAspect: true, minW: 40, safeZone: true },
    ...over,
  } as ImageLayer;
}

export function newStickerLayer(svgId: string, over: Partial<StickerLayer> = {}): StickerLayer {
  return {
    ...base("Sticker"),
    type: "sticker",
    svgId,
    w: 180,
    h: 180,
    style: { fill: "$accent", stroke: null, strokeWidth: 0 },
    constraints: { keepAspect: true, minW: 32, safeZone: true },
    ...over,
  } as StickerLayer;
}

export function newStatLayer(field = "distance", over: Partial<StatLayer> = {}): StatLayer {
  return {
    ...base("Stat"),
    type: "stat",
    field,
    layout: "stacked",
    showLabel: true,
    countUp: true,
    style: {
      valueFont: "cond",
      valueSize: 200,
      valueWeight: 800,
      valueColor: "$text",
      labelFont: "sans",
      labelSize: 34,
      labelColor: "$textMuted",
      unitSize: 0.38,
      letterSpacing: -0.03,
      shadow: true,
    },
    anim: { preset: "countUp", delay: 0.1, duration: 1.8, ease: "outExpo" },
    ...over,
  } as StatLayer;
}

export function newStatRowLayer(
  fields: string[] = ["time", "pace", "elevation"],
  over: Partial<StatRowLayer> = {},
): StatRowLayer {
  return {
    ...base("Stat row"),
    type: "statRow",
    fields,
    layout: "row",
    gap: 44,
    divider: "dot",
    showLabels: true,
    countUp: false,
    style: {
      valueFont: "sans",
      valueSize: 44,
      labelSize: 22,
      color: "$text",
      labelColor: "$textMuted",
      shadow: true,
      panel: null,
    },
    ...over,
  } as StatRowLayer;
}

export function newRouteLayer(over: Partial<RouteLayer> = {}): RouteLayer {
  return {
    ...base("Route"),
    type: "route",
    w: 620,
    h: 620,
    style: {
      mode: "solid",
      stroke: "$text",
      width: 10,
      colorBy: "none",
      gradient: ["$accent", "$textMuted"],
      zoneColors: "$zoneColors" as unknown as string[],
      markers: { km: false, labels: false, arrows: false },
      endpoints: "dots",
      startColor: "$text",
      endColor: "$accent",
      dotSize: 18,
      silhouette: false,
      simplify: 2,
      runnerDot: false,
    },
    constraints: { keepAspect: true, minW: 120, safeZone: true },
    anim: { preset: "fadeIn", delay: 0.2, duration: 2.5, ease: "outCubic" },
    ...over,
  } as RouteLayer;
}

export function newChartLayer(kind: ChartLayer["kind"] = "hr", over: Partial<ChartLayer> = {}): ChartLayer {
  const isRings = kind === "rings";
  return {
    ...base(
      kind === "hr"
        ? "Heart rate"
        : kind === "pace"
          ? "Pace"
          : kind === "elevation"
            ? "Elevation"
            : kind === "splits"
              ? "Splits"
              : kind === "zones"
                ? "Zones"
                : "Rings",
    ),
    type: "chart",
    kind,
    w: isRings ? 420 : 880,
    h: isRings ? 420 : 280,
    options: {
      zoneColours: true,
      bands: true,
      labels: true,
      smooth: 5,
      mode: "wave",
      highlightFastest: true,
      fill: true,
      showValues: true,
      showPercent: true,
      metrics: ["effort", "hr", "duration"],
    },
    style: {
      color: "$accent",
      muted: "$textMuted",
      text: "$text",
      font: "sans",
      zoneColors: "$zoneColors" as unknown as string[],
    },
    constraints: { minW: 160, safeZone: true, keepAspect: isRings },
    anim: { preset: "fadeIn", delay: 0.3, duration: 2.0, ease: "outCubic" },
    ...over,
  } as ChartLayer;
}

export const HYROX_STYLE: HyroxLayerStyle = {
  run: "#5AC8FA",
  station: "$accent",
  roxzone: "#FF5A5F",
  text: "$text",
  muted: "$textMuted",
};

export function newHyroxBreakdown(over: Partial<HyroxBreakdownLayer> = {}): HyroxBreakdownLayer {
  return {
    ...base("Time breakdown"),
    type: "hyroxBreakdown",
    w: 880,
    h: 220,
    options: { showLegend: true, showTimes: true },
    style: { ...HYROX_STYLE },
    constraints: { minW: 240, safeZone: true },
    anim: { preset: "slideUp", delay: "auto", duration: 0.9, ease: "outCubic" },
    ...over,
  } as HyroxBreakdownLayer;
}

export function newHyroxStations(over: Partial<HyroxStationsLayer> = {}): HyroxStationsLayer {
  return {
    ...base("Stations"),
    type: "hyroxStations",
    w: 880,
    h: 520,
    options: { markSlowest: true, showTimes: true },
    style: { ...HYROX_STYLE },
    constraints: { minW: 300, safeZone: true },
    anim: { preset: "slideUp", delay: "auto", duration: 1.2, ease: "outCubic" },
    ...over,
  } as HyroxStationsLayer;
}

export function newHyroxSplits(over: Partial<HyroxSplitsLayer> = {}): HyroxSplitsLayer {
  return {
    ...base("Splits"),
    type: "hyroxSplits",
    w: 760,
    h: 900,
    options: { interleave: true, showRoxzone: true },
    style: { ...HYROX_STYLE },
    constraints: { minW: 280, safeZone: true },
    anim: { preset: "fadeIn", delay: "auto", duration: 1.0, ease: "outCubic" },
    ...over,
  } as HyroxSplitsLayer;
}

export const LAYER_LABEL: Record<LayerType, string> = {
  text: "Text",
  shape: "Shape",
  image: "Photo / logo",
  sticker: "Sticker",
  stat: "Stat",
  statRow: "Stat row",
  route: "Route",
  chart: "Chart",
  hyroxBreakdown: "Time breakdown",
  hyroxStations: "Stations",
  hyroxSplits: "Splits",
};

export function newDocument(over: Partial<Document> = {}): Document {
  const now = Date.now();
  return {
    schema: 2,
    id: newId("doc"),
    name: "Untitled design",
    createdAt: now,
    updatedAt: now,
    format: "story",
    templateId: "sticker",
    layers: [],
    units: "km",
    prefs: { safeZones: false },
    opts: {},
    ...over,
  };
}

/** Places a newly added layer near the centre, nudged down per existing layer. §6.5 */
export function placeNewLayer(doc: Document, layer: Layer): Layer {
  const n = doc.layers.filter((l) => l.source === "user").length;
  return {
    ...layer,
    anchor: { ax: 0.5, ay: 0.5 },
    offset: { dx: 0, dy: Math.min(n, 6) * 40 },
  };
}
