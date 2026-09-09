// Schema migration — §4.10. `migrate()` runs on load and applies v1→v2, v2→v3… in order.
// Every bump ships with a migration and a unit test holding a fixture from the previous
// version. Unknown future versions are refused rather than guessed at.
import { newDocument, newTextLayer } from "./defaults";
import type { Document, TextLayer } from "./types";

export const CURRENT_SCHEMA = 2;

/** The legacy v1 shape: a flat `opts` bag plus a template id, with no layers. §1.1 A5 */
export interface LegacyLook {
  name?: string;
  template?: string;
  format?: string;
  opts?: Record<string, unknown>;
}

export class UnsupportedSchemaError extends Error {
  constructor(found: number) {
    super(`This design was made in a newer version of Stride Studio (schema ${found}).`);
    this.name = "UnsupportedSchemaError";
  }
}

export function migrate(input: unknown): Document {
  if (!input || typeof input !== "object") return newDocument();

  const raw = input as Partial<Document> & { schema?: number };
  const schema = raw.schema ?? 1;

  if (schema > CURRENT_SCHEMA) throw new UnsupportedSchemaError(schema);

  let doc: Document =
    schema === 1 ? fromLegacy(raw as unknown as LegacyLook) : ({ ...newDocument(), ...raw } as Document);

  // Guarantee the invariants the editor relies on, whatever the file claimed.
  doc = {
    ...doc,
    schema: CURRENT_SCHEMA,
    layers: Array.isArray(doc.layers) ? doc.layers : [],
    opts: doc.opts && typeof doc.opts === "object" ? doc.opts : {},
    prefs: doc.prefs ?? { safeZones: false },
  };

  return doc;
}

/**
 * v1 → v2. A legacy "look" carried tokens and a template id but no layout, so the layout
 * part cannot be recovered and is not attempted (§4.10). The one piece of user CONTENT in
 * the old bag is `opts.tagline`, which becomes a real text layer.
 */
function fromLegacy(look: LegacyLook): Document {
  const opts = { ...(look.opts ?? {}) };
  const format = look.format === "post" || look.format === "square" ? look.format : "story";

  const doc = newDocument({
    name: look.name ?? "Untitled design",
    templateId: typeof look.template === "string" ? look.template : "sticker",
    format,
    opts,
    units: opts.units === "mi" ? "mi" : "km",
  });

  const migrated = taglineToLayer(opts);
  if (migrated) {
    doc.layers.push(migrated);
    delete opts.tagline;
  }

  return doc;
}

/**
 * §13 Phase 1 step 5: the single `opts.tagline` field (one text, three positions, three
 * sizes — §1.1 A3) becomes an ordinary text layer that can be moved, restyled and joined by
 * as many others as the user likes.
 */
export function taglineToLayer(opts: Record<string, unknown>): TextLayer | null {
  const text = typeof opts.tagline === "string" ? opts.tagline.trim() : "";
  if (!text) return null;

  const pos = opts.taglinePos === "middle" || opts.taglinePos === "bottom" ? opts.taglinePos : "top";
  const sizeScale = typeof opts.taglineSize === "number" ? opts.taglineSize : 1;
  const uppercase = opts.uppercase === true;
  const color = typeof opts.textColor === "string" ? opts.textColor : "#FFFFFF";

  // The legacy renderer centred it horizontally and drew it at 56 * size * scale px on a
  // 1080-wide canvas; the document model is 1000 units wide.
  const size = Math.round(56 * sizeScale * (1000 / 1080));

  const anchor =
    pos === "top" ? { ax: 0.5, ay: 0 } : pos === "middle" ? { ax: 0.5, ay: 0.5 } : { ax: 0.5, ay: 1 };
  const origin =
    pos === "top" ? { ox: 0.5, oy: 0 } : pos === "middle" ? { ox: 0.5, oy: 0.5 } : { ox: 0.5, oy: 1 };
  const offset =
    pos === "top" ? { dx: 0, dy: 120 } : pos === "middle" ? { dx: 0, dy: 0 } : { dx: 0, dy: -56 };

  return newTextLayer({
    name: "Your line",
    text,
    anchor,
    origin,
    offset,
    style: {
      ...newTextLayer().style,
      size,
      weight: 800,
      align: "center",
      uppercase,
      color,
      maxWidth: 830,
      font:
        typeof opts.fontHero === "string" && opts.fontHero !== "sans" ? (opts.fontHero as string) : "sans",
    },
  });
}
