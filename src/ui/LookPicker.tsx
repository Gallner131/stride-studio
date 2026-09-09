import React from "react";
import { useEditor } from "../editor/store";
import { groupByFamily, type Look } from "../engine/tokens";
import { LOOKS } from "../looks";

export interface LookPickerProps {
  lookId: string;
  onPick: (id: string) => void;
}

/**
 * Look picker — §6.9. Grouped by family, so it reads as six groups of four rather than a
 * wall of twenty-four. Each card is a real preview: the look's own background, its accent,
 * and a sample set in its display face.
 */
export function LookPicker({ lookId, onPick }: LookPickerProps) {
  const groups = React.useMemo(() => groupByFamily(LOOKS), []);
  const layerCount = useEditor((s) => s.doc.layers.length);

  return (
    <div className="stack">
      {layerCount === 0 && (
        <p className="muted small" style={{ margin: 0 }}>
          A look restyles every element at once. Add a design from the <strong>Designs</strong> tab first,
          then try these.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.family}>
          <div className="muted small label">{group.label}</div>
          <div className="lookstrip">
            {group.looks.map((look) => (
              <LookCard key={look.id} look={look} selected={look.id === lookId} onPick={onPick} />
            ))}
          </div>
        </div>
      ))}

      <p className="muted small">
        Every look passes the contrast and legibility checks in the look linter before it ships, so none of
        these will leave your stats unreadable on a photo.
      </p>
    </div>
  );
}

const LEGACY_STACKS: Record<string, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  cond: 'Impact, "Arial Narrow", "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SF Mono", Menlo, Consolas, "Courier New", monospace',
};

function LookCard({
  look,
  selected,
  onPick,
}: {
  look: Look;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`lookcard ${selected ? "on" : ""}`}
      style={{ background: look.colors.bg, color: look.colors.text }}
      onClick={() => onPick(look.id)}
      data-testid={`look-${look.id}`}
      title={`${look.name} — suits ${look.photo.suits.join(", ")}`}
    >
      <span
        className="lookcard-sample"
        style={{
          fontFamily: LEGACY_STACKS[look.legacyFonts.display] ?? LEGACY_STACKS.sans,
          fontWeight: look.type.displayWeight,
          textTransform: look.type.uppercase ? "uppercase" : "none",
          letterSpacing: `${look.type.letterSpacing}em`,
        }}
      >
        21.1
      </span>
      <span className="lookcard-swatches">
        <i style={{ background: look.colors.accent }} />
        <i style={{ background: look.colors.accent2 }} />
        <i style={{ background: look.colors.textMuted }} />
      </span>
      <span className="lookcard-name">{look.name}</span>
    </button>
  );
}
