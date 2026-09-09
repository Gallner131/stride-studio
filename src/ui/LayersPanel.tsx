import React from "react";
import { useEditor } from "../editor/store";
import type { Layer } from "../model/types";

const ICON: Record<Layer["type"], string> = {
  text: "T",
  shape: "▭",
  image: "▣",
  sticker: "★",
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
    <ul className="layers" data-testid="layers-list">
      {top.map((layer, i) => {
        const realIndex = layers.length - 1 - i;
        const isSelected = selection.includes(layer.id);
        return (
          <li
            key={layer.id}
            className={`layer-row ${isSelected ? "on" : ""}`}
            data-testid={`layer-${layer.id}`}
          >
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
