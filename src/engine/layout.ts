// Placement and hit-testing — §5.5.
//
// layoutDoc() resolves every layer's anchor + offset + origin into a box in canvas units,
// plus its four rotated corners. Everything else — selection handles, snapping, hit-tests,
// the sticker crop — reads from this, so there is exactly one definition of where a layer is.
import { CANVAS_W, canvasHeight } from "../model/defaults";
import type { Document, Layer, Placed } from "../model/types";
import type { RenderEnv } from "./layers";
import { measureLayer } from "./layers";

export interface LayoutResult {
  placed: Placed[];
  byId: Map<string, Placed>;
}

function rotatePoint(x: number, y: number, cx: number, cy: number, radians: number): [number, number] {
  if (radians === 0) return [x, y];
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

export function placeLayer(layer: Layer, env: RenderEnv, format: Document["format"]): Placed {
  const H = canvasHeight(format);
  const size = measureLayer(layer, env);

  const w = layer.w === "auto" ? size.w : layer.w;
  const h = layer.h === "auto" ? size.h : layer.h;

  const anchorX = layer.anchor.ax * CANVAS_W + layer.offset.dx;
  const anchorY = layer.anchor.ay * H + layer.offset.dy;

  const x = anchorX - layer.origin.ox * w;
  const y = anchorY - layer.origin.oy * h;

  // Rotation is about the layer's own origin point (§4.1).
  const rad = (layer.rotation * Math.PI) / 180;
  const cx = x + layer.origin.ox * w;
  const cy = y + layer.origin.oy * h;

  const corners: [number, number][] = [
    rotatePoint(x, y, cx, cy, rad),
    rotatePoint(x + w, y, cx, cy, rad),
    rotatePoint(x + w, y + h, cx, cy, rad),
    rotatePoint(x, y + h, cx, cy, rad),
  ];

  return { id: layer.id, box: { x, y, w, h }, rotation: layer.rotation, corners };
}

export function layoutDoc(doc: Document, env: RenderEnv): LayoutResult {
  const placed = doc.layers.map((l) => placeLayer(l, env, doc.format));
  return { placed, byId: new Map(placed.map((p) => [p.id, p])) };
}

/**
 * Hit-test in canvas units. The pointer is inverse-rotated into the layer's own frame, and
 * the box is expanded so that small elements still meet a 44px minimum in SCREEN pixels
 * (§3.6) — hence `screenScale`, the canvas-units-per-screen-pixel factor.
 */
export function hitTest(
  doc: Document,
  layout: LayoutResult,
  x: number,
  y: number,
  screenScale: number,
  opts: { includeLocked?: boolean } = {},
): Layer | null {
  const minTarget = 44 * screenScale;

  // Topmost first.
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const layer = doc.layers[i];
    if (!layer) continue;
    if (!layer.visible) continue;
    if (layer.locked && !opts.includeLocked) continue;

    const p = layout.byId.get(layer.id);
    if (!p) continue;

    const rad = (-layer.rotation * Math.PI) / 180;
    const cx = p.box.x + layer.origin.ox * p.box.w;
    const cy = p.box.y + layer.origin.oy * p.box.h;
    const [lx, ly] = rotatePoint(x, y, cx, cy, rad);

    const padX = Math.max(0, minTarget - p.box.w) / 2;
    const padY = Math.max(0, minTarget - p.box.h) / 2;

    if (
      lx >= p.box.x - padX &&
      lx <= p.box.x + p.box.w + padX &&
      ly >= p.box.y - padY &&
      ly <= p.box.y + p.box.h + padY
    ) {
      return layer;
    }
  }
  return null;
}

/** All layers under a point, topmost first — lets a second tap cycle downward (§3.6). */
export function hitTestAll(
  doc: Document,
  layout: LayoutResult,
  x: number,
  y: number,
  screenScale: number,
): Layer[] {
  const out: Layer[] = [];
  const minTarget = 44 * screenScale;

  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const layer = doc.layers[i];
    if (!layer?.visible || layer.locked) continue;
    const p = layout.byId.get(layer.id);
    if (!p) continue;
    const rad = (-layer.rotation * Math.PI) / 180;
    const cx = p.box.x + layer.origin.ox * p.box.w;
    const cy = p.box.y + layer.origin.oy * p.box.h;
    const [lx, ly] = rotatePoint(x, y, cx, cy, rad);
    const padX = Math.max(0, minTarget - p.box.w) / 2;
    const padY = Math.max(0, minTarget - p.box.h) / 2;
    if (
      lx >= p.box.x - padX &&
      lx <= p.box.x + p.box.w + padX &&
      ly >= p.box.y - padY &&
      ly <= p.box.y + p.box.h + padY
    ) {
      out.push(layer);
    }
  }
  return out;
}

/** Union bounding box of the given placements, for the sticker crop (§9.2). */
export function unionBounds(placements: Placed[]): { x: number; y: number; w: number; h: number } | null {
  if (placements.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of placements) {
    for (const [x, y] of p.corners) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
