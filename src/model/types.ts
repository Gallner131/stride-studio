// Document model — spec §4. A design is a background, an ordered list of layers, a Look
// and an activity reference. Phase 1 introduces the model and the layer types the editor
// can manipulate (text, shape, image, sticker); Phase 2 moves the 27 templates into it.

export type FormatId = "story" | "post" | "square";

/** Fractions of canvas width/height in [0,1]. §4.1 */
export interface Anchor {
  ax: number;
  ay: number;
}
/** Units from the anchor point. §4.1 */
export interface Offset {
  dx: number;
  dy: number;
}
/** Which point of the layer's own box sits at the anchor. §4.1 */
export interface Origin {
  ox: number;
  oy: number;
}

export type Size = number | "auto";

export type AnimPreset =
  | "none"
  | "fadeIn"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "scaleIn"
  | "countUp"
  | "typewriter"
  | "pulse";

export interface Anim {
  preset: AnimPreset;
  delay: number | "auto";
  duration: number;
  ease: "outCubic" | "outExpo" | "inOutQuad" | "spring" | "linear";
}

export interface Constraints {
  minW?: number;
  keepAspect?: boolean;
  safeZone?: boolean;
}

export interface LayerBase {
  id: string;
  name: string;
  anchor: Anchor;
  offset: Offset;
  origin: Origin;
  w: Size;
  h: Size;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  /** Included in the transparent sticker export. §9.2 */
  sticker: boolean;
  anim: Anim;
  constraints: Constraints;
  /**
   * "user" layers survive a template change (§6.8); "template" layers are replaced.
   * Phase 1 only creates user layers, since templates are still legacy code.
   */
  source: "user" | "template";
}

export type TextEffectKind = "none" | "outline" | "gradient" | "highlight" | "glow" | "longShadow";

export interface TextFill {
  color: string;
  pad: number;
  radius: number;
}

export interface TextStyle {
  font: string;
  size: number;
  weight: number;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
  maxWidth: number;
  fill: TextFill | null;
  stroke: { color: string; width: number } | null;
  shadow: boolean;
  effect: { kind: TextEffectKind; color?: string };
}

export interface TextLayer extends LayerBase {
  type: "text";
  /** May contain {field} bindings — §4.6, Appendix C. */
  text: string;
  style: TextStyle;
}

export type ShapeKind = "rect" | "pill" | "ellipse" | "line" | "tape";

export interface ShapeLayer extends LayerBase {
  type: "shape";
  shape: ShapeKind;
  style: {
    fill: string | null;
    stroke: { color: string; width: number } | null;
    radius: number;
    dash: number[] | null;
  };
}

export interface ImageLayer extends LayerBase {
  type: "image";
  assetId: string;
  style: { radius: number; shadow: boolean };
}

export interface StickerLayer extends LayerBase {
  type: "sticker";
  svgId: string;
  style: { fill: string; stroke: string | null; strokeWidth: number };
}

/** Colour tokens shared by the HYROX visuals. */
export interface HyroxLayerStyle {
  run: string;
  station: string;
  roxzone: string;
  text: string;
  muted: string;
}

/** Running vs stations vs roxzone, as one stacked bar. */
export interface HyroxBreakdownLayer extends LayerBase {
  type: "hyroxBreakdown";
  options: { showLegend: boolean; showTimes: boolean };
  style: HyroxLayerStyle;
}

/** Eight bars, one per station, slowest marked. */
export interface HyroxStationsLayer extends LayerBase {
  type: "hyroxStations";
  options: { markSlowest: boolean; showTimes: boolean };
  style: HyroxLayerStyle;
}

/** The full 16-segment splits table. */
export interface HyroxSplitsLayer extends LayerBase {
  type: "hyroxSplits";
  options: { interleave: boolean; showRoxzone: boolean };
  style: HyroxLayerStyle;
}

export type Layer =
  | TextLayer
  | ShapeLayer
  | ImageLayer
  | StickerLayer
  | HyroxBreakdownLayer
  | HyroxStationsLayer
  | HyroxSplitsLayer;
export type LayerType = Layer["type"];

export interface Document {
  schema: 2;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  format: FormatId;
  /** Legacy template id while templates are still code (§13 Phase 2 makes these data). */
  templateId: string;
  layers: Layer[];
  units: "km" | "mi";
  prefs: { safeZones: boolean };
  /** The legacy `opts` bag, still the source of truth for the template pass in Phase 1. */
  opts: Record<string, unknown>;
  /** Thumbnail data URL, written on save (§8). */
  thumb?: string;
}

/** A layer placed in canvas units, produced by layoutDoc. §5.5 */
export interface Placed {
  id: string;
  box: { x: number; y: number; w: number; h: number };
  rotation: number;
  corners: [number, number][];
}
