// Persistence — §8. IndexedDB via idb-keyval: documents autosave, assets keep their blob,
// so a design survives the tab reload that used to lose five minutes of work (§1.1 A8).
import { clear, del, get, keys, set } from "idb-keyval";
import type { Document } from "../model/types";

const DOC_PREFIX = "doc:";
const ASSET_PREFIX = "asset:";
const MAX_DOCS = 200;

export interface StoredAsset {
  blob: Blob;
  kind: "image" | "video";
  w: number;
  h: number;
  name: string;
}

export interface DocSummary {
  id: string;
  name: string;
  updatedAt: number;
  format: Document["format"];
  thumb?: string;
  layerCount: number;
}

const quotaExceeded = (err: unknown): boolean =>
  err instanceof Error && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED");

/** True when IndexedDB is usable — private mode can make it unavailable (§8). */
export async function storageAvailable(): Promise<boolean> {
  try {
    await set("__probe", 1);
    await del("__probe");
    return true;
  } catch {
    return false;
  }
}

export async function saveDoc(doc: Document): Promise<{ ok: boolean; reason?: string }> {
  try {
    await set(DOC_PREFIX + doc.id, doc);
    await evictOldDocs();
    return { ok: true };
  } catch (err) {
    if (quotaExceeded(err)) {
      return { ok: false, reason: "Storage is full. Delete a design or two to keep saving." };
    }
    return { ok: false, reason: "Could not save this design on this device." };
  }
}

export async function loadDoc(id: string): Promise<Document | null> {
  try {
    return (await get<Document>(DOC_PREFIX + id)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteDoc(id: string): Promise<void> {
  try {
    await del(DOC_PREFIX + id);
  } catch {
    // Nothing useful to do; the list will simply still show it until next load.
  }
}

export async function listDocs(): Promise<DocSummary[]> {
  try {
    const allKeys = (await keys()) as string[];
    const docKeys = allKeys.filter((k) => typeof k === "string" && k.startsWith(DOC_PREFIX));
    const docs = await Promise.all(docKeys.map((k) => get<Document>(k)));
    return docs
      .filter((d): d is Document => !!d)
      .map((d) => ({
        id: d.id,
        name: d.name,
        updatedAt: d.updatedAt,
        format: d.format,
        thumb: d.thumb,
        layerCount: d.layers.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function evictOldDocs(): Promise<void> {
  const summaries = await listDocs();
  if (summaries.length <= MAX_DOCS) return;
  for (const s of summaries.slice(MAX_DOCS)) await deleteDoc(s.id);
}

export async function saveAsset(id: string, asset: StoredAsset): Promise<boolean> {
  try {
    await set(ASSET_PREFIX + id, asset);
    return true;
  } catch {
    return false;
  }
}

export async function loadAsset(id: string): Promise<StoredAsset | null> {
  try {
    return (await get<StoredAsset>(ASSET_PREFIX + id)) ?? null;
  } catch {
    return null;
  }
}

export const clearAll = (): Promise<void> => clear();

// --- localStorage prefs (§8) -------------------------------------------------

const PREFS_KEY = "stride.prefs";

export interface Prefs {
  units: "km" | "mi";
  hrMax: number | null;
  safeZones: boolean;
  lastDocId: string | null;
  /** "auto" follows the OS. Absent means auto, so existing stored prefs need no migration. */
  theme?: "light" | "dark" | "auto";
}

export const DEFAULT_PREFS: Prefs = {
  units: "km",
  hrMax: null,
  safeZones: false,
  lastDocId: null,
  theme: "auto",
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Partial<Prefs>): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...prefs }));
  } catch {
    // Private mode; prefs simply do not persist.
  }
}
