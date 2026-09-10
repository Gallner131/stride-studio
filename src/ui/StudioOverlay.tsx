import React from "react";
import type { DragState, Rect } from "../editor/gestures";
import { beginGesture, cycleAt, marqueeSelection, normaliseRect, updateGesture } from "../editor/gestures";
import { drawOverlay } from "../editor/overlay";
import type { Guide } from "../editor/snapping";
import { useEditor } from "../editor/store";
import type { RenderEnv } from "../engine/layers";
import { layoutDoc } from "../engine/layout";
import { cssFont, fontStack } from "../engine/text";
import type { FieldTable } from "../model/bindings";
import { resolveBindings } from "../model/bindings";
import { CANVAS_W, canvasHeight } from "../model/defaults";
import type { Layer, TextLayer } from "../model/types";
import { SelectionBar } from "./SelectionBar";

/** A shared measuring context, so layout does not need the visible canvas. */
function measuringContext(): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d context available");
  return ctx;
}

export interface StudioOverlayProps {
  fields: FieldTable;
  asset: (assetId: string) => CanvasImageSource | null;
  /** Opens the full Inspector, for everything the selection toolbar deliberately omits. */
  onOpenInspector?: () => void;
}

/**
 * The interactive surface — §3.6, §6.2, §6.6.
 *
 * Sits above the design canvas and owns selection, drag, resize, rotate and inline text
 * editing. The render engine never draws handles or guides; they live here (§5.2 step 5).
 */
export function StudioOverlay({ fields, asset, onOpenInspector }: StudioOverlayProps) {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const safeZones = useEditor((s) => s.safeZones);
  const editingTextId = useEditor((s) => s.editingTextId);
  const select = useEditor((s) => s.select);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const clearSelection = useEditor((s) => s.clearSelection);
  const patchLayer = useEditor((s) => s.patchLayer);
  const setMode = useEditor((s) => s.setMode);
  const setEditingText = useEditor((s) => s.setEditingText);
  const dragStartDocRef = React.useRef<typeof doc | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const measureRef = React.useRef<CanvasRenderingContext2D | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const lastTapRef = React.useRef<{ t: number; id: string | null }>({ t: 0, id: null });
  const [guides, setGuides] = React.useState<Guide[]>([]);
  // Drag on empty canvas box-selects. It used to pan the background photo, which is a
  // once-per-design adjustment with its own sliders in the Adjust tab; selecting is
  // constant, so it gets the canvas.
  const marqueeRef = React.useRef<{ x0: number; y0: number } | null>(null);
  // The live rectangle, kept in a ref as well as state. pointerup does not reliably carry
  // the final position — with pointer capture it can report the point the press started at,
  // which yields a zero-size box and selects nothing — so the last move is the truth.
  const marqueeRectRef = React.useRef<Rect | null>(null);
  const [marquee, setMarquee] = React.useState<Rect | null>(null);

  if (!measureRef.current) measureRef.current = measuringContext();

  const env: RenderEnv = React.useMemo(
    () => ({
      ctx: measureRef.current as CanvasRenderingContext2D,
      fields,
      asset,
      anim: { opacity: 1, dx: 0, dy: 0, scale: 1, progress: 1 },
    }),
    [fields, asset],
  );

  const layout = React.useMemo(() => layoutDoc(doc, env), [doc, env]);
  const H = canvasHeight(doc.format);

  /** Canvas units per screen pixel. */
  const unitsPerPx = React.useCallback((): number => {
    const el = canvasRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 ? CANVAS_W / rect.width : 1;
  }, []);

  const toCanvas = React.useCallback((clientX: number, clientY: number): [number, number] => {
    const el = canvasRef.current;
    if (!el) return [0, 0];
    const rect = el.getBoundingClientRect();
    const scale = CANVAS_W / rect.width;
    return [(clientX - rect.left) * scale, (clientY - rect.top) * scale];
  }, []);

  // Draw handles, guides and safe zones.
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    if (el.width !== CANVAS_W || el.height !== Math.round(H)) {
      el.width = CANVAS_W;
      el.height = Math.round(H);
    }
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const selected = layout.placed.filter((p) => selection.includes(p.id));
    const origins = new Map(doc.layers.map((l) => [l.id, l.origin]));

    drawOverlay(ctx, {
      doc,
      selected,
      origins,
      guides,
      showSafeZones: safeZones,
      unitsPerPx: unitsPerPx(),
      marquee,
    });
  }, [doc, layout, selection, guides, safeZones, H, unitsPerPx, marquee]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = toCanvas(e.clientX, e.clientY);
    const upp = unitsPerPx();
    const result = beginGesture(doc, layout, selection, x, y, upp);

    if (!result.drag && result.select === null) {
      // Empty canvas: deselect and begin a marquee.
      clearSelection();
      setGuides([]);
      marqueeRef.current = { x0: x, y0: y };
      marqueeRectRef.current = null;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    // Double-tap on a text layer opens the inline editor (§6.6).
    const now = performance.now();
    const tappedId = result.select ?? selection[0] ?? null;
    if (tappedId && lastTapRef.current.id === tappedId && now - lastTapRef.current.t < 320) {
      const layer = doc.layers.find((l) => l.id === tappedId);
      if (layer?.type === "text") {
        setEditingText(layer.id);
        lastTapRef.current = { t: 0, id: null };
        return;
      }
    }
    lastTapRef.current = { t: now, id: tappedId };

    if (result.select) {
      // Shift or meta adds to the selection; a plain tap replaces it (§6.2).
      if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelect(result.select);
      else if (!selection.includes(result.select)) select([result.select]);
      setMode("studio");
    }
    if (result.drag) {
      // One drag is one undo step (§6.1). zundo's pause() stops tracking, and resume() does
      // NOT record what changed while paused — so pausing alone would make the whole drag
      // un-undoable. Snapshot the document here, then push that single state onto the
      // history on pointer-up.
      dragStartDocRef.current = doc;
      useEditor.temporal.getState().pause();
      dragRef.current = result.drag;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = marqueeRef.current;
    if (m) {
      const [mx, my] = toCanvas(e.clientX, e.clientY);
      const rect = normaliseRect(m.x0, m.y0, mx, my);
      marqueeRectRef.current = rect;
      setMarquee(rect);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    const layer = doc.layers.find((l) => l.id === drag.layerId);
    if (!layer) return;

    const [x, y] = toCanvas(e.clientX, e.clientY);
    const update = updateGesture(drag, doc, layout, layer, x, y, unitsPerPx(), {
      free: e.altKey || e.shiftKey,
    });

    drag.moved = true;
    setGuides(update.guides);

    // With several layers selected, a move applies the same delta to all of them, so a
    // group of elements keeps its internal spacing.
    if (drag.kind === "move" && update.offset && selection.length > 1) {
      const deltaX = update.offset.dx - layer.offset.dx;
      const deltaY = update.offset.dy - layer.offset.dy;
      for (const id of selection) {
        patchLayer(id, (l) => {
          if (l.locked) return;
          l.offset = { dx: Math.round(l.offset.dx + deltaX), dy: Math.round(l.offset.dy + deltaY) };
        });
      }
      return;
    }

    patchLayer(layer.id, (l) => {
      if (update.offset) l.offset = update.offset;
      if (update.rotation !== undefined) l.rotation = update.rotation;
      if (update.size) {
        l.w = update.size.w;
        l.h = update.size.h;
      }
      if (update.fontSize !== undefined && l.type === "text") {
        (l as TextLayer).style.size = update.fontSize;
      }
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = marqueeRef.current;
    if (m) {
      marqueeRef.current = null;
      setMarquee(null);
      const rect = marqueeRectRef.current;
      marqueeRectRef.current = null;
      if (!rect) return;
      // A tap is not a marquee. Below a few pixels of travel this was a press on empty
      // canvas, which has already deselected — selecting nothing again is the right answer.
      const min = 5 * unitsPerPx();
      if (rect.w >= min || rect.h >= min) {
        const caught = marqueeSelection(doc.layers, layout.byId, rect);
        if (caught.length > 0) select(caught);
      }
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      dragRef.current = null;
      setGuides([]);

      const temporal = useEditor.temporal.getState();
      temporal.resume();

      // Collapse the drag into exactly one history entry, and only if it actually moved.
      const before = dragStartDocRef.current;
      dragStartDocRef.current = null;
      if (drag.moved && before) {
        useEditor.temporal.setState((prev) => ({
          pastStates: [...prev.pastStates, { doc: before }],
          futureStates: [],
        }));
      }
    }
  };

  const editingLayer = doc.layers.find((l) => l.id === editingTextId);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="overlay-canvas"
        data-testid="overlay"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          const [x, y] = toCanvas(e.clientX, e.clientY);
          const next = cycleAt(doc, layout, x, y, unitsPerPx(), selection[0] ?? null);
          if (next) select([next]);
        }}
      />
      {/* Controls come to the selection, rather than the user going to find them. Hidden
          while a drag or a marquee is in flight, so it never sits under the thumb. */}
      {!marquee && editingTextId === null && (
        <SelectionBar
          placed={layout.placed.filter((p) => selection.includes(p.id))}
          format={doc.format}
          onOpenInspector={() => onOpenInspector?.()}
        />
      )}
      {editingLayer?.type === "text" && (
        <InlineTextEditor
          layer={editingLayer}
          fields={fields}
          placed={layout.byId.get(editingLayer.id) ?? null}
          onChange={(text) =>
            patchLayer(editingLayer.id, (l) => {
              (l as TextLayer).text = text;
            })
          }
          onCommit={() => setEditingText(null)}
        />
      )}
    </>
  );
}

/**
 * Inline text editing — §6.6. A transparent textarea over the layer's screen box, with
 * matching font, size, colour and alignment, so typing appears in place. The canvas hides
 * the layer underneath while this is open.
 */
function InlineTextEditor({
  layer,
  placed,
  fields,
  onChange,
  onCommit,
}: {
  layer: TextLayer;
  placed: { box: { x: number; y: number; w: number; h: number } } | null;
  fields: FieldTable;
  onChange: (text: string) => void;
  onCommit: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  if (!placed) return null;

  // Percentages, so the editor tracks the stage as it resizes.
  const H = 1; // placeholder to keep the maths readable below
  void H;

  const style: React.CSSProperties = {
    position: "absolute",
    left: `${(placed.box.x / CANVAS_W) * 100}%`,
    top: `${(placed.box.y / CANVAS_W) * 100 * (CANVAS_W / CANVAS_W)}%`,
    width: `${(Math.max(placed.box.w, layer.style.maxWidth) / CANVAS_W) * 100}%`,
    // Font size is expressed relative to the canvas width so it scales with the stage.
    fontSize: `${(layer.style.size / CANVAS_W) * 100}cqw`,
    fontFamily: fontStack(layer.style.font),
    fontWeight: layer.style.weight,
    lineHeight: layer.style.lineHeight,
    color: layer.style.color,
    textAlign: layer.style.align,
    textTransform: layer.style.uppercase ? "uppercase" : "none",
  };

  return (
    <textarea
      ref={ref}
      className="inline-text"
      data-testid="inline-text"
      style={style}
      value={layer.text}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCommit();
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onCommit();
        }
      }}
      title={resolveBindings(layer.text, fields)}
      aria-label="Edit text on the design"
    />
  );
}

/** Exported for the e2e suite: the CSS font a text layer resolves to. */
export const debugFontFor = (layer: Layer): string | null =>
  layer.type === "text" ? cssFont(layer.style) : null;
