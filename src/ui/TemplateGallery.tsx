import React from "react";
import { useEditor } from "../editor/store";
import {
  type ActivityCapabilities,
  buildTemplateLayers,
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  type TemplateCategory,
  templateAvailable,
  unavailableReason,
} from "../templates";

export interface TemplateGalleryProps {
  caps: ActivityCapabilities;
  onApplied: (name: string) => void;
}

/**
 * Data-driven template gallery — §6.8, §4.8.
 *
 * Templates whose requirements the activity cannot meet are shown disabled with the reason
 * ("Needs GPS"), rather than hidden or — worse — offered and then rendering an empty frame.
 *
 * Applying replaces the template's own layers but keeps any the user added themselves
 * (§6.8), which is what `source` on a layer is for.
 */
export function TemplateGallery({ caps, onApplied }: TemplateGalleryProps) {
  const [cat, setCat] = React.useState<TemplateCategory | "All">("All");
  const patchDoc = useEditor((s) => s.patchDoc);
  const select = useEditor((s) => s.select);

  const shown = TEMPLATES.filter((t) => cat === "All" || t.cat === cat);

  const apply = (id: string) => {
    const def = TEMPLATES.find((t) => t.id === id);
    if (!def) return;
    const layers = buildTemplateLayers(def);
    patchDoc((d) => {
      // Keep the user's own layers on top; replace the template's.
      const userLayers = d.layers.filter((l) => l.source === "user");
      d.layers = [...layers, ...userLayers];
      d.templateId = def.id;
      d.name = def.name;
    });
    select([]);
    onApplied(def.name);
  };

  return (
    <div className="stack">
      <div className="chips" style={{ marginBottom: 4 }}>
        {(["All", ...TEMPLATE_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${cat === c ? "on" : ""}`}
            onClick={() => setCat(c as TemplateCategory | "All")}
            data-testid={`tplcat-${c}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="tiles">
        {shown.map((t) => {
          const available = templateAvailable(t, caps);
          const reason = unavailableReason(t, caps);
          return (
            <button
              key={t.id}
              type="button"
              className={`tile ${available ? "" : "disabled"}`}
              disabled={!available}
              title={reason ?? t.desc}
              data-testid={`newtpl-${t.id}`}
              onClick={() => apply(t.id)}
            >
              <span className="tile-icon" aria-hidden="true">
                {ICON[t.cat]}
              </span>
              <strong>{t.name}</strong>
              <em className="muted">{available ? t.desc : reason}</em>
            </button>
          );
        })}
      </div>

      <p className="muted small">
        These are built from the new element model, so every part of them can be tapped and moved. The
        original designs are in the Style tab.
      </p>
    </div>
  );
}

const ICON: Record<TemplateCategory, string> = {
  Stats: "#",
  Map: "◠",
  Health: "♥",
  Workout: "▤",
  Editorial: "¶",
  Fun: "★",
  Video: "▶",
  HYROX: "⬢",
};
