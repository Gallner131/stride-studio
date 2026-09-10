// Pointer state machine — §3.6. Owns drag, resize and rotate; the store owns the result.
import type { LayoutResult } from "../engine/layout";
import { hitTest, hitTestAll } from "../engine/layout";
import type { Document, Layer, Placed } from "../model/types";
import type { HandleId } from "./overlay";
import { hitHandle } from "./overlay";
import type { Guide } from "./snapping";
import { snapBox } from "./snapping";

export type DragKind = "none" | "move" | "resize" | "rotate";

export interface DragState {
  kind: DragKind;
  layerId: string;
  handle: HandleId | null;
  /** Pointer position at gesture start, canvas units. */
  startX: number;
  startY: number;
  /** Layer state at gesture start. */
  startOffset: { dx: number; dy: number };
  startW: number;
  startH: number;
  startRotation: number;
  startFontSize: number | null;
  /** Live guides for the overlay. */
  guides: Guide[];
  moved: boolean;
}

export interface BeginResult {
  drag: DragState | null;
  /** Layer to select as a result of the press, if any. */
  select: string | null;
  /** Layer to delete as a result of the press — the × handle on the selection frame. */
  remove?: string | null;
}

const SNAP_PX = 8;

/**
 * Press. Handles take priority over layers; pressing an unselected layer selects and moves
 * it in one gesture (Canva behaviour, §3.6). Pressing empty canvas deselects.
 */
export function beginGesture(
  doc: Document,
  layout: LayoutResult,
  selection: string[],
  x: number,
  y: number,
  unitsPerPx: number,
): BeginResult {
  // 1. A handle on the current single selection.
  if (selection.length === 1) {
    const id = selection[0] as string;
    const layer = doc.layers.find((l) => l.id === id);
    const placed = layout.byId.get(id);
    if (layer && placed && !layer.locked) {
      const handle = hitHandle(placed, layer.origin, x, y, unitsPerPx);
      // The × is an action, not a gesture: it removes the layer on press and starts nothing.
      if (handle === "del") return { drag: null, select: null, remove: id };
      if (handle) {
        return {
          drag: startDrag(handle === "rot" ? "rotate" : "resize", layer, placed, x, y, handle),
          select: null,
        };
      }
    }
  }

  // 2. A layer under the pointer.
  const hit = hitTest(doc, layout, x, y, unitsPerPx);
  if (hit) {
    const placed = layout.byId.get(hit.id);
    if (!placed) return { drag: null, select: hit.id };
    return { drag: startDrag("move", hit, placed, x, y, null), select: hit.id };
  }

  return { drag: null, select: null };
}

/** A second press on the same spot cycles to the layer below (§3.6). */
export function cycleAt(
  doc: Document,
  layout: LayoutResult,
  x: number,
  y: number,
  unitsPerPx: number,
  currentId: string | null,
): string | null {
  const stack = hitTestAll(doc, layout, x, y, unitsPerPx);
  if (stack.length === 0) return null;
  if (!currentId) return stack[0]?.id ?? null;
  const i = stack.findIndex((l) => l.id === currentId);
  if (i === -1) return stack[0]?.id ?? null;
  return stack[(i + 1) % stack.length]?.id ?? null;
}

function startDrag(
  kind: DragKind,
  layer: Layer,
  placed: Placed,
  x: number,
  y: number,
  handle: HandleId | null,
): DragState {
  return {
    kind,
    layerId: layer.id,
    handle,
    startX: x,
    startY: y,
    startOffset: { ...layer.offset },
    startW: placed.box.w,
    startH: placed.box.h,
    startRotation: layer.rotation,
    startFontSize: layer.type === "text" ? layer.style.size : null,
    guides: [],
    moved: false,
  };
}

export interface MoveUpdate {
  offset?: { dx: number; dy: number };
  size?: { w: number; h: number };
  fontSize?: number;
  rotation?: number;
  guides: Guide[];
}

/**
 * Pointer move. Returns the patch to apply to the layer plus guides to draw.
 *
 * Resizing a text layer scales its font size rather than stretching a box, because text
 * boxes are `auto` — that is what makes a corner drag feel right on type.
 */
export function updateGesture(
  drag: DragState,
  doc: Document,
  layout: LayoutResult,
  layer: Layer,
  x: number,
  y: number,
  unitsPerPx: number,
  modifiers: { free?: boolean } = {},
): MoveUpdate {
  const dx = x - drag.startX;
  const dy = y - drag.startY;

  if (drag.kind === "move") {
    const placed = layout.byId.get(layer.id);
    const proposed = {
      x: (placed?.box.x ?? 0) + (dx - (layer.offset.dx - drag.startOffset.dx)),
      y: (placed?.box.y ?? 0) + (dy - (layer.offset.dy - drag.startOffset.dy)),
      w: drag.startW,
      h: drag.startH,
    };
    const others = layout.placed.filter((p) => p.id !== layer.id);
    const snap = snapBox(doc, proposed, others, SNAP_PX * unitsPerPx);

    return {
      offset: {
        dx: Math.round(drag.startOffset.dx + dx + snap.dx),
        dy: Math.round(drag.startOffset.dy + dy + snap.dy),
      },
      guides: snap.guides,
    };
  }

  if (drag.kind === "rotate") {
    const placed = layout.byId.get(layer.id);
    if (!placed) return { guides: [] };
    const cx = placed.box.x + layer.origin.ox * placed.box.w;
    const cy = placed.box.y + layer.origin.oy * placed.box.h;
    const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
    // Snap to 0/15/30/45/90 within 3 degrees (§3.6).
    const snapped = [
      0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -15, -30, -45, -60, -75, -90, -135,
    ].find((s) => Math.abs(normalise(angle) - s) < 3);
    return { rotation: Math.round(snapped ?? normalise(angle)), guides: [] };
  }

  if (drag.kind === "resize") {
    // Distance change along the dragged diagonal drives a uniform scale.
    const signX = drag.handle === "nw" || drag.handle === "sw" ? -1 : 1;
    const signY = drag.handle === "nw" || drag.handle === "ne" ? -1 : 1;
    const deltaW = dx * signX;
    const deltaH = dy * signY;

    const keepAspect = layer.constraints.keepAspect !== false && !modifiers.free;
    const minW = layer.constraints.minW ?? 40;

    if (layer.type === "text" && drag.startFontSize) {
      const scale = Math.max(0.2, 1 + (deltaW + deltaH) / (2 * Math.max(40, drag.startW)));
      return { fontSize: Math.max(12, Math.round(drag.startFontSize * scale)), guides: [] };
    }

    let w = Math.max(minW, drag.startW + deltaW);
    let h = Math.max(minW, drag.startH + deltaH);
    if (keepAspect) {
      const ratio = drag.startH / Math.max(1, drag.startW);
      const scale = Math.max(w / drag.startW, h / drag.startH);
      w = Math.max(minW, Math.round(drag.startW * scale));
      h = Math.max(minW, Math.round(w * ratio));
    }
    return { size: { w: Math.round(w), h: Math.round(h) }, guides: [] };
  }

  return { guides: [] };
}

const normalise = (deg: number): number => {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};
