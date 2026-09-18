// Document render pass — §5.2, step 4.
//
// Phase 1 is the strangler seam: the legacy switch-case renderer still draws the template,
// and this draws doc.layers on top. Phase 2 moves the templates into doc.layers and the
// legacy pass disappears. This function is pure — no module state, no setFormat, no React.
import type { FieldTable } from "../model/bindings";
import { CANVAS_W, canvasHeight } from "../model/defaults";
import type { Document, Layer } from "../model/types";
import { animAt, STATIC_ANIM } from "./anim";
import type { RenderEnv } from "./layers";
import { renderLayer } from "./layers";
import { placeLayer } from "./layout";
import { applyLookType, type Look, resolveLayer } from "./tokens";

export interface DocRenderOptions {
  /** Seconds since animation start. Pass Infinity for a final frame. */
  t: number;
  mode: "full" | "sticker" | "thumb";
  fields: FieldTable;
  asset: (assetId: string) => CanvasImageSource | null;
  hyrox?: RenderEnv["hyrox"];
  series?: RenderEnv["series"];
  /** Resolves "$accent" and friends. Null renders literals only. §4.5 */
  look?: Look | null;
  reducedMotion?: boolean;
  /** Layer currently being edited inline — drawn by the DOM textarea instead. §6.6 */
  hideLayerId?: string | null;
  /**
   * A coarse luminance map of the photo behind the design, measured once by the caller when
   * the photo changes. Absent means no photo, and nothing adapts (§2.7 S4).
   */
  backdrop?: RenderEnv["backdrop"];
  /**
   * Places a coordinate on the canvas, when a map is the background.
   *
   * A route layer otherwise fits itself to its own box, which knows nothing about where the
   * map thinks north is, so the trace ran beside the roads rather than along them. Given
   * this, the trace shares the map's projection and stays a layer you can recolour.
   */
  placeRoute?: RenderEnv["placeRoute"];
}

/**
 * Draws doc.layers into a context already scaled so that one unit == one canvas unit.
 * The caller owns the background and any legacy template pass.
 */
export function renderLayers(ctx: CanvasRenderingContext2D, doc: Document, options: DocRenderOptions): void {
  const {
    t,
    mode,
    fields,
    asset,
    hyrox = null,
    series,
    look = null,
    reducedMotion = false,
    hideLayerId = null,
    backdrop = null,
    placeRoute,
  } = options;
  const isThumb = mode === "thumb";
  const time = isThumb ? Number.POSITIVE_INFINITY : t;

  doc.layers.forEach((raw, index) => {
    if (!raw.visible) return;
    if (raw.id === hideLayerId) return;
    if (mode === "sticker" && !raw.sticker) return;

    // Tokens resolve here, per frame, so swapping the look restyles every layer at once
    // while literal values the user picked survive untouched (§4.3).
    const layer = applyLookType(resolveLayer(raw, look), look);

    const anim = isThumb || reducedMotion ? STATIC_ANIM : animAt(layer, index, time);
    const env: RenderEnv = {
      ctx,
      fields,
      asset,
      anim,
      hyrox,
      series,
      backdrop,
      legibility: look?.legibility,
      placeRoute,
    };
    const placed = placeLayer(layer, env, doc.format);
    // Where this layer sits as a fraction of the canvas, so a text layer can read the
    // backdrop underneath itself rather than the photo as a whole.
    env.origin = { x: placed.box.x, y: placed.box.y };
    env.frame = {
      x: placed.box.x / CANVAS_W,
      y: placed.box.y / canvasHeight(doc.format),
      w: placed.box.w / CANVAS_W,
      h: placed.box.h / canvasHeight(doc.format),
    };

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity * anim.opacity));

    // Rotate and scale about the layer's own origin point.
    const cx = placed.box.x + layer.origin.ox * placed.box.w;
    const cy = placed.box.y + layer.origin.oy * placed.box.h;

    ctx.translate(cx + anim.dx, cy + anim.dy);
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
    if (anim.scale !== 1) ctx.scale(anim.scale, anim.scale);
    ctx.translate(-cx, -cy);

    // Renderers draw from their own top-left.
    ctx.translate(placed.box.x, placed.box.y);

    renderLayer(layer, env);
    ctx.restore();
  });
}

/** Canvas size in units for a document's format. */
export const docSize = (doc: Document): { w: number; h: number } => ({
  w: CANVAS_W,
  h: canvasHeight(doc.format),
});

/** True when a layer would draw nothing — used for the empty-state hint in Studio. */
export function isLayerEmpty(layer: Layer): boolean {
  return layer.type === "text" && layer.text.trim() === "";
}
