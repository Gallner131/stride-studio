import React from "react";
import { useEditor } from "../editor/store";
import { hasPrimaryColor, primaryColor, setPrimaryColor } from "../model/colors";
import { CANVAS_W, canvasHeight } from "../model/defaults";
import type { FormatId, Layer, Placed } from "../model/types";
import { PalettePicker } from "./PalettePicker";

/**
 * The toolbar that appears on the thing you have selected — §6.5.
 *
 * Everything here already existed, buried: colour lived behind a tab and a collapsed
 * "Colour" section in the Inspector, and delete lived in the Layers panel or on a keyboard
 * key a phone does not have. Selecting something and then hunting through tabs for the one
 * control you want is the difference between this and Canva, where the controls come to the
 * selection. So they come to the selection.
 *
 * Deliberately short: colour, duplicate, delete, and a way through to everything else. A
 * toolbar with fifteen buttons is another menu.
 */

export interface SelectionBarProps {
  /** Placed boxes for the current selection, in canvas units. */
  placed: Placed[];
  format: FormatId;
  onOpenInspector: () => void;
}

export function SelectionBar({ placed, format, onOpenInspector }: SelectionBarProps) {
  const selection = useEditor((s) => s.selection);
  const layers = useEditor((s) => s.doc.layers);
  const patchLayer = useEditor((s) => s.patchLayer);
  const deleteSelection = useEditor((s) => s.deleteSelection);
  const duplicateSelection = useEditor((s) => s.duplicateSelection);
  const [openColor, setOpenColor] = React.useState(false);

  const selected = layers.filter((l) => selection.includes(l.id));
  if (selected.length === 0 || placed.length === 0) return null;

  // Bounding box of everything selected, so the bar sits over the group as a whole.
  const H = canvasHeight(format);
  const minX = Math.min(...placed.map((p) => p.box.x));
  const maxX = Math.max(...placed.map((p) => p.box.x + p.box.w));
  const minY = Math.min(...placed.map((p) => p.box.y));
  const maxY = Math.max(...placed.map((p) => p.box.y + p.box.h));

  // Above the selection normally; below it when the selection is near the top, so the bar
  // never sits off the design where it cannot be tapped.
  const above = minY > H * 0.18;
  const centreX = (minX + maxX) / 2;

  const style: React.CSSProperties = {
    left: `${(Math.min(Math.max(centreX, CANVAS_W * 0.22), CANVAS_W * 0.78) / CANVAS_W) * 100}%`,
    top: `${((above ? minY : maxY) / H) * 100}%`,
    // 30px clears the rotation handle, which floats 56 canvas units (~19 CSS px) above
    // the box. A bar sitting on top of it would make rotation untappable.
    transform: `translate(-50%, ${above ? "calc(-100% - 30px)" : "30px"})`,
  };

  const colorable = selected.filter(hasPrimaryColor);
  const current = colorable.length > 0 ? primaryColor(colorable[0] as Layer) : null;

  const applyColor = (value: string) => {
    for (const l of colorable) {
      patchLayer(l.id, (draft) => setPrimaryColor(draft, value));
    }
  };

  return (
    <div className="selbar" style={style} data-testid="selection-bar">
      {colorable.length > 0 && (
        <div className="selbar-color">
          <button
            type="button"
            className="selbar-swatch"
            data-testid="selbar-color"
            aria-label="Change colour"
            title="Colour"
            style={{ background: current?.startsWith("#") ? current : undefined }}
            onClick={() => setOpenColor((v) => !v)}
          >
            {current?.startsWith("#") ? "" : "◐"}
          </button>

          {openColor && (
            <div className="selbar-palette" data-testid="selbar-palette">
              <PalettePicker
                value={current}
                onChange={(v) => {
                  applyColor(v);
                }}
              />
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="selbar-btn"
        data-testid="selbar-duplicate"
        title="Duplicate"
        aria-label="Duplicate"
        onClick={duplicateSelection}
      >
        ⧉
      </button>

      <button
        type="button"
        className="selbar-btn"
        data-testid="selbar-edit"
        title="More options"
        aria-label="More options"
        onClick={onOpenInspector}
      >
        ⋯
      </button>

      <button
        type="button"
        className="selbar-btn danger"
        data-testid="selbar-delete"
        title="Delete"
        aria-label="Delete"
        onClick={deleteSelection}
      >
        ✕
      </button>
    </div>
  );
}
