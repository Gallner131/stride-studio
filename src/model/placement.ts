// Where a newly added object goes — §6.4.
//
// This used to be a fixed vertical cascade: dead centre, plus n * 40 downwards, capped at
// six. Reported as "the stickers or new objects don't automatically fit to the mock up",
// and all three reasons were visible at a glance:
//
//   - 40 canvas units is about 13 CSS px on a phone. A sticker is 180 units tall, so each
//     one covered nearly 80 % of the last and a handful read as a single smudge.
//   - The cap meant the seventh object onwards landed in exactly the same spot as the sixth.
//   - It counted only `source: "user"` layers, so a new object was dropped straight on top
//     of the template's hero number — the design it was supposed to fit into.
//
// Now it measures the object, looks at every existing layer, and takes the free position
// closest to the middle that sits inside the safe zone.
import { CANVAS_W, canvasHeight, safeZone } from "./defaults";
import type { Measure, MeasuredBox } from "./reflow";
import type { Document, FormatId, Layer } from "./types";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A layer's box in canvas units, from its anchor, offset and origin. */
export function layerBox(layer: Layer, size: MeasuredBox, format: FormatId): Box {
  const h = canvasHeight(format);
  const anchorX = layer.anchor.ax * CANVAS_W + layer.offset.dx;
  const anchorY = layer.anchor.ay * h + layer.offset.dy;
  return {
    x: anchorX - layer.origin.ox * size.w,
    y: anchorY - layer.origin.oy * size.h,
    w: size.w,
    h: size.h,
  };
}

const intersects = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * A rough size for callers with no canvas to measure against — unit tests, and any code
 * path that runs before the first render. Numeric w/h are exact; "auto" gets a plausible
 * text-sized box, which is enough to keep objects apart.
 */
const roughSize = (layer: Layer): MeasuredBox => ({
  w: typeof layer.w === "number" ? layer.w : 300,
  h: typeof layer.h === "number" ? layer.h : 120,
});

/** How finely the search steps across the canvas, in units. ~13 CSS px on a phone. */
const STEP = 40;

/** Breathing room left between objects, so "not overlapping" also looks deliberate. */
const GAP = 16;

export function placeNewLayer(doc: Document, layer: Layer, measure?: Measure): Layer {
  const sizeOf = measure ?? roughSize;
  const size = sizeOf(layer);
  const H = canvasHeight(doc.format);
  const sz = safeZone(doc.format);

  const at = (cx: number, cy: number): Layer => ({
    ...layer,
    anchor: { ax: 0.5, ay: 0.5 },
    offset: { dx: Math.round(cx - CANVAS_W / 2), dy: Math.round(cy - H / 2) },
  });

  // Every existing layer counts, template ones included: the whole point is to fit into the
  // design, not just to avoid the user's own additions. Hidden layers do not.
  const occupied: Box[] = doc.layers
    .filter((l) => l.visible !== false)
    .map((l) => {
      const b = layerBox(l, sizeOf(l), doc.format);
      return { x: b.x - GAP, y: b.y - GAP, w: b.w + GAP * 2, h: b.h + GAP * 2 };
    });

  // The window of centre points that keep the whole object inside the safe zone.
  const minX = sz.side + size.w / 2;
  const maxX = CANVAS_W - sz.side - size.w / 2;
  const minY = sz.top + size.h / 2;
  const maxY = H - sz.bottom - size.h / 2;

  const centreX = CANVAS_W / 2;
  const centreY = H / 2;

  // Too big to fit the safe zone at all — a full-bleed background, say. Centre it and stop:
  // there is no free space to find, and shuffling it around would only look like a mistake.
  if (minX > maxX || minY > maxY) return at(centreX, centreY);

  const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // The exact middle is tried first and explicitly. The grid below steps from minX/minY, so
  // it does not necessarily contain the centre point, and an empty design would otherwise
  // put the very first object a dozen units off-centre for no reason anyone could explain.
  const candidates: Array<{ x: number; y: number }> = [
    { x: clampTo(centreX, minX, maxX), y: clampTo(centreY, minY, maxY) },
  ];
  for (let y = minY; y <= maxY; y += STEP) {
    for (let x = minX; x <= maxX; x += STEP) candidates.push({ x, y });
  }
  // Nearest the middle first, so an empty design still puts the first object dead centre and
  // later ones spread outwards from it rather than starting in a corner.
  // Array.prototype.sort is stable, so the explicit centre stays ahead of any grid point at
  // the same distance from it.
  candidates.sort(
    (a, b) => Math.hypot(a.x - centreX, a.y - centreY) - Math.hypot(b.x - centreX, b.y - centreY),
  );

  for (const c of candidates) {
    const box: Box = { x: c.x - size.w / 2, y: c.y - size.h / 2, w: size.w, h: size.h };
    if (!occupied.some((o) => intersects(o, box))) return at(c.x, c.y);
  }

  // Genuinely full. Cascade from the centre so at least the new object is not hidden exactly
  // behind an old one, and clamp so it stays on the design.
  const n = doc.layers.length;
  return at(clampTo(centreX + n * STEP, minX, maxX), clampTo(centreY + n * STEP, minY, maxY));
}
