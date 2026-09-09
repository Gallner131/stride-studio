import { newId } from "./ids";
import type {
  Anim,
  Document,
  FormatId,
  ImageLayer,
  Layer,
  LayerType,
  ShapeKind,
  ShapeLayer,
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
      color: "#FFFFFF",
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
    style: { fill: "#D8FF3A", stroke: null, strokeWidth: 0 },
    constraints: { keepAspect: true, minW: 32, safeZone: true },
    ...over,
  } as StickerLayer;
}

export const LAYER_LABEL: Record<LayerType, string> = {
  text: "Text",
  shape: "Shape",
  image: "Photo / logo",
  sticker: "Sticker",
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
