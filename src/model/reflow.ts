// Format reflow — §4.9.
//
// When the format changes, anchors hold: a bottom-left stat stays bottom-left. That is the
// whole point of anchor + offset positioning (§4.1), and it is why one design works in
// three formats without per-format code.
//
// The four rules, in order:
//   1. Anchors hold.
//   2. Layers with constraints.safeZone are nudged inside the new safe zone, by the minimum
//      distance.
//   3. Layers wider than the canvas minus margins are scaled down uniformly.
//   4. Nothing else moves. If the user has placed something by hand, we do not "improve" it.
import { CANVAS_W, canvasHeight, safeZone } from "./defaults";
import type { Document, FormatId, Layer } from "./types";

export interface MeasuredBox {
  w: number;
  h: number;
}

/** Measurement callback, so reflow stays pure and testable without a canvas. */
export type Measure = (layer: Layer) => MeasuredBox;

const SIDE_MARGIN = 40;

/** Resolves a layer's box top-left for a given format, from its anchor/offset/origin. */
function boxFor(layer: Layer, size: MeasuredBox, format: FormatId): { x: number; y: number } {
  const h = canvasHeight(format);
  const anchorX = layer.anchor.ax * CANVAS_W + layer.offset.dx;
  const anchorY = layer.anchor.ay * h + layer.offset.dy;
  return { x: anchorX - layer.origin.ox * size.w, y: anchorY - layer.origin.oy * size.h };
}

/** Scales a layer's own size fields by `k`. Text scales its font size (§4.9 rule 3). */
function scaleLayer(layer: Layer, k: number): Layer {
  if (k >= 1) return layer;
  const next = { ...layer } as Layer;

  if (typeof next.w === "number") next.w = Math.round(next.w * k);
  if (typeof next.h === "number") next.h = Math.round(next.h * k);

  if (next.type === "text") {
    next.style = {
      ...next.style,
      size: Math.max(12, Math.round(next.style.size * k)),
      maxWidth: Math.round(next.style.maxWidth * k),
    };
  } else if (next.type === "stat") {
    next.style = {
      ...next.style,
      valueSize: Math.max(12, Math.round(next.style.valueSize * k)),
      labelSize: Math.max(9, Math.round(next.style.labelSize * k)),
    };
  } else if (next.type === "statRow") {
    next.style = {
      ...next.style,
      valueSize: Math.max(12, Math.round(next.style.valueSize * k)),
      labelSize: Math.max(9, Math.round(next.style.labelSize * k)),
    };
    next.gap = Math.round(next.gap * k);
  }

  return next;
}

export interface ReflowResult {
  layers: Layer[];
  /** Ids that were nudged or scaled, for a "3 elements moved to fit" toast. */
  adjusted: string[];
}

export function reflowLayers(layers: Layer[], from: FormatId, to: FormatId, measure: Measure): ReflowResult {
  if (from === to) return { layers, adjusted: [] };

  const toHeight = canvasHeight(to);
  const sz = safeZone(to);
  const adjusted: string[] = [];

  const out = layers.map((layer) => {
    let next = layer;
    const size = measure(layer);

    // Rule 3: too wide for the new canvas -> scale down uniformly.
    const maxWidth = CANVAS_W - SIDE_MARGIN * 2;
    if (size.w > maxWidth) {
      const k = maxWidth / size.w;
      next = scaleLayer(next, k);
      adjusted.push(layer.id);
    }

    // Rule 2: nudge back inside the safe zone, by the minimum distance.
    if (next.constraints.safeZone) {
      const resized = measure(next);
      const box = boxFor(next, resized, to);

      let dy = 0;
      if (box.y < sz.top) dy = sz.top - box.y;
      else if (box.y + resized.h > toHeight - sz.bottom) {
        dy = toHeight - sz.bottom - (box.y + resized.h);
      }

      let dx = 0;
      if (box.x < sz.side) dx = sz.side - box.x;
      else if (box.x + resized.w > CANVAS_W - sz.side) {
        dx = CANVAS_W - sz.side - (box.x + resized.w);
      }

      if (dx !== 0 || dy !== 0) {
        next = {
          ...next,
          offset: { dx: Math.round(next.offset.dx + dx), dy: Math.round(next.offset.dy + dy) },
        };
        if (!adjusted.includes(layer.id)) adjusted.push(layer.id);
      }
    }

    return next;
  });

  return { layers: out, adjusted };
}

export function reflowDocument(doc: Document, to: FormatId, measure: Measure): ReflowResult {
  return reflowLayers(doc.layers, doc.format, to, measure);
}

// ---------------------------------------------------------------- align / distribute

export type AlignEdge = "left" | "hcentre" | "right" | "top" | "vcentre" | "bottom";

/**
 * Aligns the given layers to each other — §13 Phase 4.
 *
 * Alignment operates on the SELECTION's bounding box, not the canvas, which is what makes
 * "align left" mean "line these up" rather than "shove them to the edge".
 */
export function alignLayers(
  layers: Layer[],
  ids: string[],
  edge: AlignEdge,
  measure: Measure,
  format: FormatId,
): Layer[] {
  const selected = layers.filter((l) => ids.includes(l.id) && !l.locked);
  if (selected.length < 2) return layers;

  const boxes = new Map(
    selected.map((l) => {
      const size = measure(l);
      return [l.id, { ...boxFor(l, size, format), ...size }];
    }),
  );

  const all = [...boxes.values()];
  const minX = Math.min(...all.map((b) => b.x));
  const maxX = Math.max(...all.map((b) => b.x + b.w));
  const minY = Math.min(...all.map((b) => b.y));
  const maxY = Math.max(...all.map((b) => b.y + b.h));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  return layers.map((layer) => {
    const box = boxes.get(layer.id);
    if (!box) return layer;

    let dx = 0;
    let dy = 0;
    switch (edge) {
      case "left":
        dx = minX - box.x;
        break;
      case "right":
        dx = maxX - (box.x + box.w);
        break;
      case "hcentre":
        dx = midX - (box.x + box.w / 2);
        break;
      case "top":
        dy = minY - box.y;
        break;
      case "bottom":
        dy = maxY - (box.y + box.h);
        break;
      case "vcentre":
        dy = midY - (box.y + box.h / 2);
        break;
    }

    if (dx === 0 && dy === 0) return layer;
    return {
      ...layer,
      offset: { dx: Math.round(layer.offset.dx + dx), dy: Math.round(layer.offset.dy + dy) },
    };
  });
}

/** Even spacing between three or more layers, along the longer axis of the selection. */
export function distributeLayers(
  layers: Layer[],
  ids: string[],
  axis: "horizontal" | "vertical",
  measure: Measure,
  format: FormatId,
): Layer[] {
  const selected = layers.filter((l) => ids.includes(l.id) && !l.locked);
  if (selected.length < 3) return layers;

  const boxes = selected.map((l) => {
    const size = measure(l);
    return { id: l.id, ...boxFor(l, size, format), ...size };
  });

  const horizontal = axis === "horizontal";
  boxes.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));

  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  if (!first || !last) return layers;

  const start = horizontal ? first.x : first.y;
  const end = horizontal ? last.x + last.w : last.y + last.h;
  const totalSize = boxes.reduce((a, b) => a + (horizontal ? b.w : b.h), 0);
  const gap = (end - start - totalSize) / (boxes.length - 1);

  const targets = new Map<string, number>();
  let cursor = start;
  for (const box of boxes) {
    targets.set(box.id, cursor);
    cursor += (horizontal ? box.w : box.h) + gap;
  }

  return layers.map((layer) => {
    const target = targets.get(layer.id);
    if (target === undefined) return layer;
    const box = boxes.find((b) => b.id === layer.id);
    if (!box) return layer;
    const delta = target - (horizontal ? box.x : box.y);
    if (Math.abs(delta) < 0.5) return layer;
    return {
      ...layer,
      offset: {
        dx: Math.round(layer.offset.dx + (horizontal ? delta : 0)),
        dy: Math.round(layer.offset.dy + (horizontal ? 0 : delta)),
      },
    };
  });
}
