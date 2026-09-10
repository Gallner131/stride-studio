import { describe, expect, it } from "vitest";
import { marqueeSelection, normaliseRect } from "../../src/editor/gestures";
import { newStickerLayer } from "../../src/model/defaults";
import type { Layer, Placed } from "../../src/model/types";

/**
 * §6.2. Drag on empty canvas to box-select. This gesture used to pan the background photo,
 * which is a once-per-design adjustment that already has "Move left / right" and
 * "Move up / down" sliders in the Adjust tab. Selecting is something you do constantly, so
 * it gets the canvas.
 */

const placed = (id: string, x: number, y: number, w = 100, h = 100): Placed => ({
  id,
  box: { x, y, w, h },
  rotation: 0,
  corners: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ],
});

const layer = (id: string, over: Partial<Layer> = {}): Layer =>
  ({ ...newStickerLayer("medal"), id, ...over }) as Layer;

describe("normaliseRect", () => {
  it("copes with a drag in any direction", () => {
    expect(normaliseRect(300, 400, 100, 200)).toEqual({ x: 100, y: 200, w: 200, h: 200 });
    expect(normaliseRect(100, 200, 300, 400)).toEqual({ x: 100, y: 200, w: 200, h: 200 });
  });
});

describe("marqueeSelection", () => {
  const boxes = new Map<string, Placed>([
    ["a", placed("a", 0, 0)],
    ["b", placed("b", 500, 500)],
  ]);

  it("takes what the box touches", () => {
    const ids = marqueeSelection([layer("a"), layer("b")], boxes, { x: -10, y: -10, w: 200, h: 200 });
    expect(ids).toEqual(["a"]);
  });

  it("takes several at once", () => {
    const ids = marqueeSelection([layer("a"), layer("b")], boxes, { x: 0, y: 0, w: 1000, h: 1000 });
    expect(ids).toEqual(["a", "b"]);
  });

  it("takes nothing when the box touches nothing", () => {
    const ids = marqueeSelection([layer("a"), layer("b")], boxes, { x: 300, y: 300, w: 50, h: 50 });
    expect(ids).toEqual([]);
  });

  // Grazing an edge counts — a selection box that visibly overlaps something but does not
  // select it is the kind of thing people retry three times before giving up.
  it("counts an overlap, not full containment", () => {
    const ids = marqueeSelection([layer("a")], boxes, { x: 50, y: 50, w: 400, h: 400 });
    expect(ids).toEqual(["a"]);
  });

  it("leaves locked and hidden layers alone", () => {
    const ids = marqueeSelection([layer("a", { locked: true }), layer("b", { visible: false })], boxes, {
      x: 0,
      y: 0,
      w: 1000,
      h: 1000,
    });
    expect(ids).toEqual([]);
  });

  it("returns them in layer order, so the selection is predictable", () => {
    const ids = marqueeSelection([layer("b"), layer("a")], boxes, { x: 0, y: 0, w: 1000, h: 1000 });
    expect(ids).toEqual(["b", "a"]);
  });
});
