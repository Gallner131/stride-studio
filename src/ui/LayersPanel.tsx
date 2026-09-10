import React from "react";
import { useEditor } from "../editor/store";
import type { Layer } from "../model/types";

const ICON: Record<Layer["type"], string> = {
  text: "T",
  shape: "▭",
  image: "▣",
  sticker: "★",
  stat: "#",
  statRow: "≡",
  route: "◠",
  chart: "◫",
  hyroxBreakdown: "▤",
  hyroxStations: "▥",
  hyroxSplits: "☰",
};

/** Layers panel — §6.7. Top layer first; tap to select, drag to reorder. */
export function LayersPanel({ onSelect }: { onSelect: () => void }) {
  const layers = useEditor((s) => s.doc.layers);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const patchLayer = useEditor((s) => s.patchLayer);
  const removeLayer = useEditor((s) => s.removeLayer);
  const reorderLayer = useEditor((s) => s.reorderLayer);
  const [renaming, setRenaming] = React.useState<string | null>(null);

  // Drag to reorder. Pointer events rather than HTML5 drag-and-drop, which does not fire on
  // touch — and this list is used on a phone more than anywhere else.
  const listRef = React.useRef<HTMLUListElement>(null);
  const dragRef = React.useRef<{ id: string; startY: number; realIndex: number } | null>(null);
  const [dragging, setDragging] = React.useState<string | null>(null);

  /** How many rows the pointer has travelled from a start point, positive downwards. */
  const rowsMoved = (startY: number, clientY: number): number => {
    const row = listRef.current?.querySelector<HTMLElement>(".layer-row");
    const h = row?.getBoundingClientRect().height || 44;
    return Math.round((clientY - startY) / h);
  };

  const endDrag = (clientY: number) => {
    const d = dragRef.current;
    // Read the travel BEFORE clearing the drag, or it always measures zero.
    const steps = d ? rowsMoved(d.startY, clientY) : 0;
    dragRef.current = null;
    setDragging(null);
    if (!d || steps === 0) return;
    // The list is drawn top-layer first, so moving DOWN the list means a LOWER array index.
    const next = Math.max(0, Math.min(layers.length - 1, d.realIndex - steps));
    if (next !== d.realIndex) reorderLayer(d.id, next);
  };

  if (layers.length === 0) {
    return (
      <p className="muted small">
        Nothing added yet. Use <strong>Add</strong> to put text, shapes or stickers on the design — they sit
        on top of the template and you can move them anywhere.
      </p>
    );
  }

  // Displayed top-first, so index maths inverts.
  const top = [...layers].reverse();

  return (
    <ul className="layers" data-testid="layers-list" ref={listRef}>
      {top.map((layer, i) => {
        const realIndex = layers.length - 1 - i;
        const isSelected = selection.includes(layer.id);
        return (
          <li
            key={layer.id}
            className={`layer-row ${isSelected ? "on" : ""} ${dragging === layer.id ? "dragging" : ""}`}
            data-testid={`layer-${layer.id}`}
          >
            <button
              type="button"
              className="layer-grip"
              data-testid="layer-grip"
              aria-label={`Reorder ${layer.name}`}
              title="Drag to reorder"
              onPointerDown={(e) => {
                // Stop the press becoming a scroll or a text selection on touch.
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = { id: layer.id, startY: e.clientY, realIndex };
                setDragging(layer.id);
              }}
              onPointerUp={(e) => endDrag(e.clientY)}
              onPointerCancel={(e) => endDrag(e.clientY)}
            >
              ⠿
            </button>

            <span className="layer-icon" aria-hidden="true">
              {ICON[layer.type]}
            </span>

            {renaming === layer.id ? (
              <input
                value={layer.name}
                onChange={(e) =>
                  patchLayer(layer.id, (l) => {
                    l.name = e.target.value;
                  })
                }
                onBlur={() => setRenaming(null)}
                onKeyDown={(e) => e.key === "Enter" && setRenaming(null)}
              />
            ) : (
              <button
                type="button"
                className="layer-name"
                onClick={() => {
                  select([layer.id]);
                  onSelect();
                }}
                onDoubleClick={() => setRenaming(layer.id)}
              >
                {layer.name}
                {layer.type === "text" && <em className="muted"> {truncate(layer.text)}</em>}
              </button>
            )}

            <button
              type="button"
              className="layer-btn"
              aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              title={layer.visible ? "Hide" : "Show"}
              onClick={() =>
                patchLayer(layer.id, (l) => {
                  l.visible = !l.visible;
                })
              }
            >
              {layer.visible ? "◉" : "◌"}
            </button>
            <button
              type="button"
              className="layer-btn"
              aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
              title={layer.locked ? "Unlock" : "Lock"}
              onClick={() =>
                patchLayer(layer.id, (l) => {
                  l.locked = !l.locked;
                })
              }
            >
              {layer.locked ? "🔒" : "🔓"}
            </button>
            <button
              type="button"
              className="layer-btn"
              aria-label={`Move ${layer.name} up`}
              title="Move up"
              disabled={realIndex === layers.length - 1}
              onClick={() => reorderLayer(layer.id, realIndex + 1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="layer-btn"
              aria-label={`Move ${layer.name} down`}
              title="Move down"
              disabled={realIndex === 0}
              onClick={() => reorderLayer(layer.id, realIndex - 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="layer-btn danger"
              aria-label={`Delete ${layer.name}`}
              title="Delete"
              onClick={() => removeLayer(layer.id)}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const truncate = (s: string): string => (s.length > 18 ? `${s.slice(0, 18)}…` : s);
