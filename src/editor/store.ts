// Editor state — §6.1. Zustand + zundo for undo, immer for patches.
import { produce } from "immer";
import { temporal } from "zundo";
import { create } from "zustand";
import { newDocument, placeNewLayer } from "../model/defaults";
import type { Document, Layer, LayerType } from "../model/types";

export type SheetId = "style" | "look" | "add" | "layers" | "inspector" | "data" | "text" | "adjust";

export interface EditorState {
  doc: Document;
  /** Layer ids. Not undoable (§6.1). */
  selection: string[];
  mode: "quick" | "studio";
  editingTextId: string | null;
  safeZones: boolean;

  // --- document
  setDoc: (doc: Document) => void;
  patchDoc: (fn: (doc: Document) => void) => void;
  setFormat: (format: Document["format"]) => void;
  setTemplate: (templateId: string) => void;
  setOpts: (opts: Record<string, unknown>) => void;

  // --- layers
  addLayer: (layer: Layer) => void;
  patchLayer: (id: string, fn: (layer: Layer) => void) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayer: (id: string, toIndex: number) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  toFront: (id: string) => void;
  toBack: (id: string) => void;

  // --- selection
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;

  // --- ui
  setMode: (mode: "quick" | "studio") => void;
  setEditingText: (id: string | null) => void;
  toggleSafeZones: () => void;
}

const touch = (doc: Document): void => {
  doc.updatedAt = Date.now();
};

export const useEditor = create<EditorState>()(
  temporal(
    (set, get) => ({
      doc: newDocument(),
      selection: [],
      mode: "quick",
      editingTextId: null,
      safeZones: false,

      setDoc: (doc) => set({ doc, selection: [] }),

      patchDoc: (fn) =>
        set((s) => ({
          doc: produce(s.doc, (d) => {
            fn(d);
            touch(d);
          }),
        })),

      setFormat: (format) =>
        set((s) => ({
          doc: produce(s.doc, (d) => {
            d.format = format;
            touch(d);
          }),
        })),

      setTemplate: (templateId) =>
        set((s) => ({
          doc: produce(s.doc, (d) => {
            d.templateId = templateId;
            touch(d);
          }),
        })),

      setOpts: (opts) =>
        set((s) => ({
          doc: produce(s.doc, (d) => {
            d.opts = opts;
            touch(d);
          }),
        })),

      addLayer: (layer) => {
        const placed = placeNewLayer(get().doc, layer);
        set((s) => ({
          doc: produce(s.doc, (d) => {
            d.layers.push(placed);
            touch(d);
          }),
          selection: [placed.id],
          mode: "studio",
        }));
      },

      patchLayer: (id, fn) =>
        set((s) => ({
          doc: produce(s.doc, (d) => {
            const layer = d.layers.find((l) => l.id === id);
            if (layer) {
              fn(layer);
              touch(d);
            }
          }),
        })),

      removeLayer: (id) =>
        set((s) => ({
          doc: produce(s.doc, (d) => {
            d.layers = d.layers.filter((l) => l.id !== id);
            touch(d);
          }),
          selection: s.selection.filter((x) => x !== id),
          editingTextId: s.editingTextId === id ? null : s.editingTextId,
        })),

      duplicateLayer: (id) => {
        const source = get().doc.layers.find((l) => l.id === id);
        if (!source) return;
        const copy = JSON.parse(JSON.stringify(source)) as Layer;
        copy.id = `ly_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
        copy.name = `${source.name} copy`;
        copy.offset = { dx: source.offset.dx + 24, dy: source.offset.dy + 24 };
        set((s) => ({
          doc: produce(s.doc, (d) => {
            const i = d.layers.findIndex((l) => l.id === id);
            d.layers.splice(i + 1, 0, copy);
            touch(d);
          }),
          selection: [copy.id],
        }));
      },

      reorderLayer: (id, toIndex) =>
        set((s) => ({
          doc: produce(s.doc, (d) => {
            const from = d.layers.findIndex((l) => l.id === id);
            if (from < 0) return;
            const [moved] = d.layers.splice(from, 1);
            if (moved) d.layers.splice(Math.max(0, Math.min(toIndex, d.layers.length)), 0, moved);
            touch(d);
          }),
        })),

      bringForward: (id) => {
        const i = get().doc.layers.findIndex((l) => l.id === id);
        if (i >= 0 && i < get().doc.layers.length - 1) get().reorderLayer(id, i + 1);
      },
      sendBackward: (id) => {
        const i = get().doc.layers.findIndex((l) => l.id === id);
        if (i > 0) get().reorderLayer(id, i - 1);
      },
      toFront: (id) => get().reorderLayer(id, get().doc.layers.length),
      toBack: (id) => get().reorderLayer(id, 0),

      select: (ids) => set({ selection: ids }),
      toggleSelect: (id) =>
        set((s) => ({
          selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id],
        })),
      clearSelection: () => set({ selection: [], editingTextId: null }),

      setMode: (mode) => set({ mode }),
      setEditingText: (id) => set({ editingTextId: id }),
      toggleSafeZones: () => set((s) => ({ safeZones: !s.safeZones })),
    }),
    {
      limit: 100,
      // Only the document is undoable; selection and sheet state are not (§6.1).
      partialize: (state) => ({ doc: state.doc }),
      equality: (a, b) => a.doc === b.doc,
    },
  ),
);

export const useTemporal = useEditor.temporal;

/** Selected layers, in document order. */
export const selectedLayers = (s: EditorState): Layer[] =>
  s.doc.layers.filter((l) => s.selection.includes(l.id));

export const firstSelected = (s: EditorState): Layer | null =>
  s.doc.layers.find((l) => l.id === s.selection[0]) ?? null;

export const layerCountByType = (s: EditorState): Record<LayerType, number> => {
  const out: Record<LayerType, number> = {
    text: 0,
    shape: 0,
    image: 0,
    sticker: 0,
    hyroxBreakdown: 0,
    hyroxStations: 0,
    hyroxSplits: 0,
  };
  for (const l of s.doc.layers) out[l.type]++;
  return out;
};
