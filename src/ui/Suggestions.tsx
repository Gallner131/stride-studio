import React from "react";
import { useEditor } from "../editor/store";
import type { PhotoAnalysis } from "../engine/photo";
import type { Look } from "../engine/tokens";
import { lookFromPhoto, MATCHED_LOOK_ID, threeForYou } from "../model/suggest";
import { type ActivityCapabilities, buildTemplateLayers } from "../templates";

export interface SuggestionsProps {
  caps: ActivityCapabilities;
  analysis: PhotoAnalysis | null;
  hasPhoto: boolean;
  onApply: (lookId: string, matched: Look | null, name: string) => void;
}

/**
 * Three for you (§2.7 S1) and Match my photo (§2.7 S2).
 *
 * This replaces "scroll forty thumbnails" as the first thing a new user meets: three
 * finished designs chosen from what their activity actually has, plus a look built from
 * their own photo's colours.
 */
export function Suggestions({ caps, analysis, hasPhoto, onApply }: SuggestionsProps) {
  const [shuffle, setShuffle] = React.useState(0);
  const patchDoc = useEditor((s) => s.patchDoc);
  const select = useEditor((s) => s.select);

  const suggestions = React.useMemo(() => threeForYou(caps, analysis, shuffle), [caps, analysis, shuffle]);

  const apply = (index: number) => {
    const s = suggestions[index];
    if (!s) return;
    const layers = buildTemplateLayers(s.template);
    patchDoc((d) => {
      const mine = d.layers.filter((l) => l.source === "user");
      d.layers = [...layers, ...mine];
      d.templateId = s.template.id;
      d.name = s.template.name;
      d.lookId = s.look.id;
    });
    select([]);
    onApply(s.look.id, null, `${s.template.name} · ${s.look.name}`);
  };

  const matchPhoto = () => {
    if (!analysis) return;
    const look = lookFromPhoto(analysis);
    onApply(MATCHED_LOOK_ID, look, look.name);
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="stack suggestions">
      <div className="row">
        <div className="muted small label" style={{ margin: 0 }}>
          Three for you
        </div>
        <button type="button" className="link" onClick={() => setShuffle((s) => s + 1)} data-testid="shuffle">
          Shuffle
        </button>
      </div>

      <div className="tiles">
        {suggestions.map((s, i) => (
          <button
            key={`${s.template.id}-${s.look.id}`}
            type="button"
            className="tile suggestion"
            style={{ background: s.look.colors.bg, color: s.look.colors.text }}
            onClick={() => apply(i)}
            data-testid={`suggestion-${i}`}
          >
            <span className="suggestion-swatches">
              <i style={{ background: s.look.colors.accent }} />
              <i style={{ background: s.look.colors.accent2 }} />
            </span>
            <strong>{s.template.name}</strong>
            <em style={{ opacity: 0.72 }}>{s.reason}</em>
            <em style={{ opacity: 0.5 }}>{s.look.name}</em>
          </button>
        ))}
      </div>

      {hasPhoto && analysis && (
        <button type="button" className="btn primary" onClick={matchPhoto} data-testid="match-photo">
          Match my photo
        </button>
      )}
      {hasPhoto && !analysis && (
        <p className="muted small" style={{ margin: 0 }}>
          Could not read the colours in that photo, so the curated looks are the way to go.
        </p>
      )}
    </div>
  );
}
