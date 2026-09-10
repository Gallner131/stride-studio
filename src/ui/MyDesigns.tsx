import React from "react";
import { useEditor } from "../editor/store";
import { type DocSummary, deleteDoc, listDocs, loadDoc } from "../storage/db";

export interface MyDesignsProps {
  onOpen: (name: string) => void;
  onToast: (message: string) => void;
}

/**
 * My designs — §8.
 *
 * Phase 1 added autosave, but nothing surfaced it, so a saved design was only reachable by
 * reloading. This is the grid: thumbnail, name, date, format, with open, duplicate, rename
 * and delete.
 */
export function MyDesigns({ onOpen, onToast }: MyDesignsProps) {
  const [designs, setDesigns] = React.useState<DocSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const setDoc = useEditor((s) => s.setDoc);
  const patchDoc = useEditor((s) => s.patchDoc);
  const currentId = useEditor((s) => s.doc.id);

  const refresh = React.useCallback(async () => {
    setDesigns(await listDocs());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = async (id: string) => {
    const doc = await loadDoc(id);
    if (!doc) {
      onToast("That design could not be opened.");
      return;
    }
    setDoc(doc);
    onOpen(doc.name);
  };

  const remove = async (id: string, name: string) => {
    await deleteDoc(id);
    await refresh();
    onToast(`Deleted "${name}"`);
  };

  if (loading) return <p className="muted small">Looking for your designs…</p>;

  if (designs.length === 0) {
    return (
      <p className="muted small">
        Nothing saved yet. Designs save themselves as you work, and will be here when you come back — even if
        the tab reloads.
      </p>
    );
  }

  return (
    <div className="stack">
      <div className="designs">
        {designs.map((design) => (
          <div key={design.id} className={`design ${design.id === currentId ? "on" : ""}`}>
            <button
              type="button"
              className="design-open"
              onClick={() => open(design.id)}
              data-testid={`design-${design.id}`}
            >
              {design.thumb ? (
                <img src={design.thumb} alt="" />
              ) : (
                <span className="design-blank">{design.format}</span>
              )}
            </button>

            <div className="design-meta">
              {renaming === design.id ? (
                <input
                  ref={(el) => el?.focus()}
                  defaultValue={design.name}
                  onBlur={async (e) => {
                    const name = e.target.value.trim() || design.name;
                    if (design.id === currentId)
                      patchDoc((d) => {
                        d.name = name;
                      });
                    setRenaming(null);
                    setTimeout(refresh, 700);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <button
                  type="button"
                  className="design-name"
                  onDoubleClick={() => design.id === currentId && setRenaming(design.id)}
                  onClick={() => open(design.id)}
                >
                  {design.name}
                </button>
              )}
              <span className="muted small">
                {new Date(design.updatedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {design.layerCount} element{design.layerCount === 1 ? "" : "s"}
              </span>
            </div>

            <button
              type="button"
              className="layer-btn danger"
              aria-label={`Delete ${design.name}`}
              onClick={() => remove(design.id, design.name)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <p className="muted small">Stored on this device only. Nothing is uploaded.</p>
    </div>
  );
}
