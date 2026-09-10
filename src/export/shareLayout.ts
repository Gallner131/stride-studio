// Share a layout, with no server — §2.7 S16.
//
// Strips the assets and the activity out of a document, compresses what is left into a URL
// fragment, and reads it back on open. A club can hand round its house layout without an
// account, and nothing is uploaded anywhere: a fragment is never sent to the server.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { migrate } from "../model/migrate";
import type { Document, Layer } from "../model/types";

export const SHARE_PREFIX = "#layout=";

/** The shareable part of a document: layout and styling, never content. */
export interface SharedLayout {
  v: 1;
  name: string;
  format: Document["format"];
  lookId?: string;
  templateId: string;
  layers: Layer[];
}

/**
 * Strips a document to a layout.
 *
 * Photos, videos and the activity are deliberately removed: they are the user's own data,
 * they would not fit in a URL, and the recipient wants the LAYOUT with their own run in it.
 */
export function toSharedLayout(doc: Document): SharedLayout {
  return {
    v: 1,
    name: doc.name,
    format: doc.format,
    lookId: doc.lookId,
    templateId: doc.templateId,
    layers: doc.layers.map((layer) => {
      // An image layer's asset lives in IndexedDB on the sender's device, so the reference
      // would dangle. Keep the layer, drop the asset.
      if (layer.type === "image") return { ...layer, assetId: "" };
      return layer;
    }),
  };
}

export function encodeLayout(doc: Document): string {
  return compressToEncodedURIComponent(JSON.stringify(toSharedLayout(doc)));
}

/** Full shareable URL for the current page. */
export function shareUrl(doc: Document, origin: string, pathname: string): string {
  return `${origin}${pathname}${SHARE_PREFIX}${encodeLayout(doc)}`;
}

export interface DecodeResult {
  layout: SharedLayout | null;
  error: string | null;
}

export function decodeLayout(encoded: string): DecodeResult {
  if (!encoded) return { layout: null, error: null };

  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(encoded);
  } catch {
    return { layout: null, error: "That layout link is damaged." };
  }
  if (!json) return { layout: null, error: "That layout link is damaged." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { layout: null, error: "That layout link is damaged." };
  }

  const candidate = parsed as Partial<SharedLayout>;
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.layers)) {
    return { layout: null, error: "That link does not contain a layout." };
  }
  if (candidate.v !== 1) {
    return { layout: null, error: "That layout was shared from a newer version of Stride Studio." };
  }

  return {
    layout: {
      v: 1,
      name: typeof candidate.name === "string" ? candidate.name : "Shared layout",
      format: candidate.format === "post" || candidate.format === "square" ? candidate.format : "story",
      lookId: typeof candidate.lookId === "string" ? candidate.lookId : undefined,
      templateId: typeof candidate.templateId === "string" ? candidate.templateId : "sticker",
      layers: candidate.layers as Layer[],
    },
    error: null,
  };
}

/** Reads a layout out of a URL fragment, if there is one. */
export function layoutFromLocation(hash: string): DecodeResult {
  if (!hash.startsWith(SHARE_PREFIX)) return { layout: null, error: null };
  return decodeLayout(hash.slice(SHARE_PREFIX.length));
}

/**
 * Turns a shared layout into a document, running it through the same migration path as a
 * saved design so an older link still opens.
 */
export function layoutToDocument(layout: SharedLayout, base: Document): Document {
  return migrate({
    ...base,
    name: layout.name,
    format: layout.format,
    lookId: layout.lookId,
    templateId: layout.templateId,
    // Shared layers arrive as template-owned, so applying a template of your own replaces
    // them rather than stacking on top.
    layers: layout.layers.map((l) => ({ ...l, source: "template" as const })),
  });
}
