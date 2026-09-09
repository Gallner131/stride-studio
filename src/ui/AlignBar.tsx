import { useEditor } from "../editor/store";
import type { AlignEdge, Measure } from "../model/reflow";

const EDGES: { edge: AlignEdge; label: string; glyph: string }[] = [
  { edge: "left", label: "Align left", glyph: "⇤" },
  { edge: "hcentre", label: "Align centre", glyph: "↔" },
  { edge: "right", label: "Align right", glyph: "⇥" },
  { edge: "top", label: "Align top", glyph: "⤒" },
  { edge: "vcentre", label: "Align middle", glyph: "↕" },
  { edge: "bottom", label: "Align bottom", glyph: "⤓" },
];

/**
 * Align and distribute for a multi-selection — §13 Phase 4.
 *
 * Only appears when two or more layers are selected, because with one selection there is
 * nothing to align to and the buttons would be a lie.
 */
export function AlignBar({ measure }: { measure: Measure }) {
  const align = useEditor((s) => s.align);
  const distribute = useEditor((s) => s.distribute);
  const count = useEditor((s) => s.selection.length);

  return (
    <div className="btnrow alignbar" data-testid="align-bar">
      {EDGES.map((e) => (
        <button
          key={e.edge}
          type="button"
          className="btn"
          title={e.label}
          aria-label={e.label}
          data-testid={`align-${e.edge}`}
          onClick={() => align(e.edge, measure)}
        >
          {e.glyph}
        </button>
      ))}
      <button
        type="button"
        className="btn"
        title="Space evenly across"
        aria-label="Distribute horizontally"
        disabled={count < 3}
        data-testid="distribute-h"
        onClick={() => distribute("horizontal", measure)}
      >
        ⇹
      </button>
      <button
        type="button"
        className="btn"
        title="Space evenly down"
        aria-label="Distribute vertically"
        disabled={count < 3}
        data-testid="distribute-v"
        onClick={() => distribute("vertical", measure)}
      >
        ⇳
      </button>
    </div>
  );
}
