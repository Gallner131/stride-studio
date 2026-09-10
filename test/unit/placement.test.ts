import { describe, expect, it } from "vitest";
import {
  CANVAS_W,
  canvasHeight,
  newDocument,
  newStickerLayer,
  newTextLayer,
  safeZone,
} from "../../src/model/defaults";
import { layerBox, placeNewLayer } from "../../src/model/placement";
import type { Document, Layer } from "../../src/model/types";

/**
 * §6.4. Reported as "the stickers or new objects don't automatically fit to the mock up".
 *
 * placeNewLayer used to be a fixed vertical cascade: anchor dead centre, offset dy of
 * n * 40 capped at six. Three problems, all visible immediately:
 *   - 40 units is ~13 CSS px on a phone, and a sticker is 180 units tall, so consecutive
 *     stickers overlapped by nearly 80 % and read as one smudge.
 *   - The cap meant the seventh object onwards landed in exactly the same place.
 *   - It counted only `source: "user"` layers, so everything was dropped straight on top of
 *     the template's own hero number, which is what "doesn't fit the mock up" describes.
 *
 * It now measures the object, looks at every existing layer, and puts it in free space
 * inside the safe zone.
 */

const measure = (l: Layer) => ({
  w: typeof l.w === "number" ? l.w : 300,
  h: typeof l.h === "number" ? l.h : 120,
});

/** A document with layers pinned at given centre offsets from the middle of the canvas. */
function docWith(offsets: Array<{ dx: number; dy: number }>, source: Layer["source"] = "user"): Document {
  const doc = newDocument();
  doc.layers = offsets.map((o, i) => ({
    ...newStickerLayer("medal"),
    id: `ly_${i}`,
    source,
    offset: { dx: o.dx, dy: o.dy },
  }));
  return doc;
}

const overlaps = (a: ReturnType<typeof layerBox>, b: ReturnType<typeof layerBox>): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe("placeNewLayer", () => {
  it("puts the first object in the middle, where the eye already is", () => {
    const placed = placeNewLayer(newDocument(), newStickerLayer("medal"), measure);
    expect(placed.offset).toEqual({ dx: 0, dy: 0 });
  });

  it("does not drop the second object on top of the first", () => {
    const doc = docWith([{ dx: 0, dy: 0 }]);
    const placed = placeNewLayer(doc, newStickerLayer("medal"), measure);

    const existing = layerBox(doc.layers[0] as Layer, measure(doc.layers[0] as Layer), doc.format);
    const fresh = layerBox(placed, measure(placed), doc.format);
    expect(overlaps(existing, fresh)).toBe(false);
  });

  // The old version only counted source: "user", so a new object landed straight on the
  // template's hero number. This is the heart of the report.
  it("avoids the template's own elements, not just ones you added", () => {
    const doc = docWith([{ dx: 0, dy: 0 }], "template");
    const placed = placeNewLayer(doc, newStickerLayer("medal"), measure);

    const templateBox = layerBox(doc.layers[0] as Layer, measure(doc.layers[0] as Layer), doc.format);
    const fresh = layerBox(placed, measure(placed), doc.format);
    expect(overlaps(templateBox, fresh)).toBe(false);
  });

  it("keeps what it places inside the safe zone", () => {
    const doc = newDocument();
    const sz = safeZone(doc.format);
    const H = canvasHeight(doc.format);

    // Fill the middle so it has to go looking.
    doc.layers = [{ ...newStickerLayer("medal"), id: "ly_0", offset: { dx: 0, dy: 0 } }];

    const placed = placeNewLayer(doc, newStickerLayer("medal"), measure);
    const box = layerBox(placed, measure(placed), doc.format);

    expect(box.x).toBeGreaterThanOrEqual(sz.side);
    expect(box.y).toBeGreaterThanOrEqual(sz.top);
    expect(box.x + box.w).toBeLessThanOrEqual(CANVAS_W - sz.side);
    expect(box.y + box.h).toBeLessThanOrEqual(H - sz.bottom);
  });

  it("keeps finding new space past the seventh object, which used to stack", () => {
    const doc = newDocument();
    const boxes: Array<ReturnType<typeof layerBox>> = [];

    for (let i = 0; i < 8; i++) {
      const placed = placeNewLayer(doc, { ...newStickerLayer("medal"), id: `ly_new_${i}` }, measure);
      const box = layerBox(placed, measure(placed), doc.format);
      for (const b of boxes) expect(overlaps(b, box)).toBe(false);
      boxes.push(box);
      doc.layers.push(placed);
    }

    // Eight distinct positions, not six and then a pile.
    const seen = new Set(boxes.map((b) => `${Math.round(b.x)},${Math.round(b.y)}`));
    expect(seen.size).toBe(8);
  });

  it("still returns a usable position when there is genuinely no room left", () => {
    const doc = newDocument();
    // One enormous layer covering everything.
    doc.layers = [
      { ...newStickerLayer("medal"), id: "ly_big", w: 4000, h: 4000, offset: { dx: 0, dy: 0 } } as Layer,
    ];

    const placed = placeNewLayer(doc, newStickerLayer("medal"), measure);
    expect(Number.isFinite(placed.offset.dx)).toBe(true);
    expect(Number.isFinite(placed.offset.dy)).toBe(true);
  });

  it("works without a measure function, for callers that have no canvas", () => {
    const placed = placeNewLayer(newDocument(), newTextLayer());
    expect(Number.isFinite(placed.offset.dx)).toBe(true);
    expect(Number.isFinite(placed.offset.dy)).toBe(true);
  });
});
