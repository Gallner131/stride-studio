// Selection overlay — §5.2 step 5, §6.2. Drawn on a SEPARATE canvas above the design, so
// the render engine never draws UI and the goldens never contain handles.
import { CANVAS_W, canvasHeight, safeZone } from "../model/defaults";
import type { Document, Placed } from "../model/types";
import type { Guide } from "./snapping";

/** Accent used for selection, guides and active states (§10). */
export const ACCENT = "#D8FF3A";

export const HANDLE_DRAW_PX = 12;
export const HANDLE_HIT_PX = 44;

export type HandleId = "nw" | "ne" | "se" | "sw" | "rot";

/** How far above the box the rotation handle floats, in canvas units. */
const LIFT = 56;

export interface HandlePoint {
  id: HandleId;
  /** Canvas units. */
  x: number;
  y: number;
}

/** Handle positions for a placement, in canvas units, accounting for rotation. */
export function handlePoints(p: Placed, originOx: number, originOy: number): HandlePoint[] {
  const rad = (p.rotation * Math.PI) / 180;
  const cx = p.box.x + originOx * p.box.w;
  const cy = p.box.y + originOy * p.box.h;

  const rot = (x: number, y: number): [number, number] => {
    if (!rad) return [x, y];
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
  };

  const [nwx, nwy] = rot(p.box.x, p.box.y);
  const [nex, ney] = rot(p.box.x + p.box.w, p.box.y);
  const [sex, sey] = rot(p.box.x + p.box.w, p.box.y + p.box.h);
  const [swx, swy] = rot(p.box.x, p.box.y + p.box.h);
  const [rx, ry] = rot(p.box.x + p.box.w / 2, p.box.y - LIFT);

  return [
    { id: "nw", x: nwx, y: nwy },
    { id: "ne", x: nex, y: ney },
    { id: "se", x: sex, y: sey },
    { id: "sw", x: swx, y: swy },
    { id: "rot", x: rx, y: ry },
  ];
}

export interface OverlayInput {
  doc: Document;
  selected: Placed[];
  /** origin of each selected layer, keyed by id, for handle rotation. */
  origins: Map<string, { ox: number; oy: number }>;
  guides: Guide[];
  showSafeZones: boolean;
  /** Canvas units per screen pixel, so handles stay screen-sized. */
  unitsPerPx: number;
  /** The live box-select rectangle, while one is being dragged. */
  marquee?: { x: number; y: number; w: number; h: number } | null;
}

export function drawOverlay(ctx: CanvasRenderingContext2D, input: OverlayInput): void {
  const { doc, selected, origins, guides, showSafeZones, unitsPerPx, marquee } = input;
  const H = canvasHeight(doc.format);

  ctx.clearRect(0, 0, CANVAS_W, H);

  if (showSafeZones) drawSafeZones(ctx, doc, unitsPerPx);

  // Guides
  if (guides.length) {
    ctx.save();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = unitsPerPx;
    ctx.setLineDash([6 * unitsPerPx, 6 * unitsPerPx]);
    for (const g of guides) {
      ctx.beginPath();
      if (g.axis === "x") {
        ctx.moveTo(g.at, 0);
        ctx.lineTo(g.at, H);
      } else {
        ctx.moveTo(0, g.at);
        ctx.lineTo(CANVAS_W, g.at);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  if (marquee) {
    ctx.save();
    ctx.fillStyle = "rgba(216,255,58,0.12)";
    ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = unitsPerPx;
    ctx.setLineDash([5 * unitsPerPx, 4 * unitsPerPx]);
    ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
    ctx.restore();
  }

  if (selected.length === 0) return;

  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2 * unitsPerPx;
  ctx.setLineDash([]);

  for (const p of selected) {
    ctx.beginPath();
    p.corners.forEach(([x, y], i) => {
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  // Handles only for a single selection; a multi-selection shows one box (§6.2).
  if (selected.length === 1) {
    const p = selected[0];
    if (p) {
      const o = origins.get(p.id) ?? { ox: 0.5, oy: 0.5 };
      const size = HANDLE_DRAW_PX * unitsPerPx;
      for (const h of handlePoints(p, o.ox, o.oy)) {
        if (h.id === "rot") {
          // Stem from the top edge up to the rotation handle.
          const top =
            p.corners[0] && p.corners[1]
              ? [(p.corners[0][0] + p.corners[1][0]) / 2, (p.corners[0][1] + p.corners[1][1]) / 2]
              : [h.x, h.y];
          ctx.beginPath();
          ctx.moveTo(top[0] as number, top[1] as number);
          ctx.lineTo(h.x, h.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(h.x, h.y, size * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = ACCENT;
          ctx.fill();
        } else {
          ctx.fillStyle = "#141414";
          ctx.fillRect(h.x - size / 2, h.y - size / 2, size, size);
          ctx.strokeRect(h.x - size / 2, h.y - size / 2, size, size);
        }
      }
    }
  }

  ctx.restore();
}

function drawSafeZones(ctx: CanvasRenderingContext2D, doc: Document, unitsPerPx: number): void {
  const H = canvasHeight(doc.format);
  const sz = safeZone(doc.format);

  ctx.save();
  ctx.fillStyle = "rgba(255,90,95,0.10)";
  ctx.fillRect(0, 0, CANVAS_W, sz.top);
  ctx.fillRect(0, H - sz.bottom, CANVAS_W, sz.bottom);

  ctx.strokeStyle = "rgba(255,90,95,0.55)";
  ctx.lineWidth = unitsPerPx;
  ctx.setLineDash([8 * unitsPerPx, 8 * unitsPerPx]);
  ctx.beginPath();
  ctx.moveTo(0, sz.top);
  ctx.lineTo(CANVAS_W, sz.top);
  ctx.moveTo(0, H - sz.bottom);
  ctx.lineTo(CANVAS_W, H - sz.bottom);
  ctx.stroke();
  ctx.restore();
}

/** Which handle, if any, is under a pointer in canvas units. */
export function hitHandle(
  p: Placed,
  origin: { ox: number; oy: number },
  x: number,
  y: number,
  unitsPerPx: number,
): HandleId | null {
  const r = (HANDLE_HIT_PX / 2) * unitsPerPx;
  for (const h of handlePoints(p, origin.ox, origin.oy)) {
    if (Math.abs(x - h.x) <= r && Math.abs(y - h.y) <= r) return h.id;
  }
  return null;
}
