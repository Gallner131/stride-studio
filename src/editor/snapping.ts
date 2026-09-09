// Smart guides and snapping — §6.3.
import { CANVAS_W, canvasHeight, safeZone } from "../model/defaults";
import type { Document, Placed } from "../model/types";

export interface Guide {
  axis: "x" | "y";
  /** Position in canvas units. */
  at: number;
  kind: "canvas" | "safe" | "layer";
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

/** Candidate snap lines: canvas centre and edges, safe-zone edges, other layers. §6.3 */
function candidates(doc: Document, others: Placed[]): { xs: Guide[]; ys: Guide[] } {
  const H = canvasHeight(doc.format);
  const sz = safeZone(doc.format);
  const margin = 40;

  const xs: Guide[] = [
    { axis: "x", at: CANVAS_W / 2, kind: "canvas" },
    { axis: "x", at: margin, kind: "canvas" },
    { axis: "x", at: CANVAS_W - margin, kind: "canvas" },
    { axis: "x", at: sz.side, kind: "safe" },
    { axis: "x", at: CANVAS_W - sz.side, kind: "safe" },
  ];
  const ys: Guide[] = [
    { axis: "y", at: H / 2, kind: "canvas" },
    { axis: "y", at: margin, kind: "canvas" },
    { axis: "y", at: H - margin, kind: "canvas" },
    { axis: "y", at: sz.top, kind: "safe" },
    { axis: "y", at: H - sz.bottom, kind: "safe" },
  ];

  for (const p of others) {
    xs.push(
      { axis: "x", at: p.box.x, kind: "layer" },
      { axis: "x", at: p.box.x + p.box.w / 2, kind: "layer" },
      { axis: "x", at: p.box.x + p.box.w, kind: "layer" },
    );
    ys.push(
      { axis: "y", at: p.box.y, kind: "layer" },
      { axis: "y", at: p.box.y + p.box.h / 2, kind: "layer" },
      { axis: "y", at: p.box.y + p.box.h, kind: "layer" },
    );
  }

  return { xs, ys };
}

/**
 * Given a moving layer's proposed box, returns the delta that snaps it plus the guides to
 * draw. `threshold` is in canvas units (8 screen px converted by the caller).
 */
export function snapBox(
  doc: Document,
  moving: { x: number; y: number; w: number; h: number },
  others: Placed[],
  threshold: number,
): SnapResult {
  const { xs, ys } = candidates(doc, others);

  const movingXs = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const movingYs = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];

  let bestDx = 0;
  let bestDistX = threshold + 1;
  let guideX: Guide | null = null;
  for (const g of xs) {
    for (const mx of movingXs) {
      const d = g.at - mx;
      if (Math.abs(d) < Math.abs(bestDistX)) {
        bestDistX = d;
        bestDx = d;
        guideX = g;
      }
    }
  }

  let bestDy = 0;
  let bestDistY = threshold + 1;
  let guideY: Guide | null = null;
  for (const g of ys) {
    for (const my of movingYs) {
      const d = g.at - my;
      if (Math.abs(d) < Math.abs(bestDistY)) {
        bestDistY = d;
        bestDy = d;
        guideY = g;
      }
    }
  }

  const guides: Guide[] = [];
  const dx = Math.abs(bestDx) <= threshold ? bestDx : 0;
  const dy = Math.abs(bestDy) <= threshold ? bestDy : 0;
  if (dx !== 0 || (guideX && Math.abs(bestDx) <= threshold)) {
    if (guideX) guides.push(guideX);
  }
  if (dy !== 0 || (guideY && Math.abs(bestDy) <= threshold)) {
    if (guideY) guides.push(guideY);
  }

  return { dx, dy, guides };
}
