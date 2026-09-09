import { describe, expect, it } from "vitest";
import { newStatLayer, newTextLayer } from "../../src/model/defaults";
import { alignLayers, distributeLayers, type Measure, reflowLayers } from "../../src/model/reflow";
import type { Layer } from "../../src/model/types";

/** §4.9 reflow, plus align/distribute. Pure functions, so no canvas is needed. */

/** Every layer is 200 x 100 unless it declares its own size. */
const measure: Measure = (l) => ({
  w: typeof l.w === "number" ? l.w : 200,
  h: typeof l.h === "number" ? l.h : 100,
});

describe("reflowLayers — anchors hold (§4.9 rule 1)", () => {
  it("leaves a bottom-left layer bottom-left, untouched", () => {
    const layer = newTextLayer({
      anchor: { ax: 0.06, ay: 1 },
      origin: { ox: 0, oy: 1 },
      offset: { dx: 0, dy: -400 },
      constraints: { safeZone: false },
    });
    const { layers, adjusted } = reflowLayers([layer], "story", "square", measure);
    expect(layers[0]?.anchor).toEqual({ ax: 0.06, ay: 1 });
    expect(layers[0]?.offset).toEqual({ dx: 0, dy: -400 });
    expect(adjusted).toEqual([]);
  });

  it("does nothing at all when the format has not changed", () => {
    const layer = newTextLayer();
    const { layers, adjusted } = reflowLayers([layer], "story", "story", measure);
    expect(layers[0]).toBe(layer);
    expect(adjusted).toEqual([]);
  });
});

describe("reflowLayers — safe zone (§4.9 rule 2)", () => {
  it("nudges a layer back inside the new safe zone by the minimum distance", () => {
    // Story's safe zone reserves the bottom 340/1920 of the canvas. A layer sitting 100
    // units off the bottom of a square canvas falls inside it once the format changes.
    const layer = newStatLayer("distance", {
      anchor: { ax: 0.5, ay: 1 },
      origin: { ox: 0.5, oy: 1 },
      offset: { dx: 0, dy: -20 },
      w: 400,
      h: 200,
      constraints: { safeZone: true },
    });
    const { layers, adjusted } = reflowLayers([layer], "square", "story", measure);
    expect(adjusted).toContain(layer.id);
    // It moved UP (more negative dy), and only as far as needed.
    expect(layers[0]?.offset.dy).toBeLessThan(-20);
  });

  it("leaves a layer alone when it is already inside", () => {
    const layer = newTextLayer({
      anchor: { ax: 0.5, ay: 0.5 },
      origin: { ox: 0.5, oy: 0.5 },
      offset: { dx: 0, dy: 0 },
      constraints: { safeZone: true },
    });
    const { adjusted } = reflowLayers([layer], "story", "post", measure);
    expect(adjusted).toEqual([]);
  });

  it("respects a layer that opted out of the safe zone", () => {
    const layer = newTextLayer({
      anchor: { ax: 0.5, ay: 1 },
      origin: { ox: 0.5, oy: 1 },
      offset: { dx: 0, dy: 0 },
      constraints: { safeZone: false },
    });
    const { adjusted } = reflowLayers([layer], "square", "story", measure);
    expect(adjusted).toEqual([]);
  });
});

describe("reflowLayers — scale to fit (§4.9 rule 3)", () => {
  it("scales down a layer wider than the canvas, and scales its text with it", () => {
    const layer = newTextLayer({ w: 1400, constraints: { safeZone: false } });
    const before = layer.style.size;
    const { layers, adjusted } = reflowLayers([layer], "story", "square", measure);
    expect(adjusted).toContain(layer.id);
    expect(layers[0]?.w).toBeLessThanOrEqual(920);
    const after = layers[0];
    if (after?.type !== "text") throw new Error("expected text");
    expect(after.style.size).toBeLessThan(before);
  });

  it("never scales a layer up", () => {
    const layer = newTextLayer({ w: 300, constraints: { safeZone: false } });
    const { layers } = reflowLayers([layer], "story", "square", measure);
    expect(layers[0]?.w).toBe(300);
  });
});

describe("alignLayers", () => {
  const make = (dx: number, dy: number): Layer =>
    newTextLayer({
      anchor: { ax: 0, ay: 0 },
      origin: { ox: 0, oy: 0 },
      offset: { dx, dy },
      w: 100,
      h: 50,
    });

  it("aligns to the selection's own bounding box, not the canvas", () => {
    const a = make(100, 100);
    const b = make(300, 200);
    const out = alignLayers([a, b], [a.id, b.id], "left", measure, "story");
    // Both share the leftmost x, which is a's — a did not move to the canvas edge.
    expect(out[0]?.offset.dx).toBe(100);
    expect(out[1]?.offset.dx).toBe(100);
  });

  it("centres horizontally", () => {
    const a = make(0, 0);
    const b = make(200, 0);
    const out = alignLayers([a, b], [a.id, b.id], "hcentre", measure, "story");
    expect(out[0]?.offset.dx).toBe(out[1]?.offset.dx);
  });

  it("aligns bottoms", () => {
    const a = make(0, 0);
    const b = make(0, 200);
    const out = alignLayers([a, b], [a.id, b.id], "bottom", measure, "story");
    expect(out[0]?.offset.dy).toBe(200);
  });

  it("needs at least two layers, and never moves a locked one", () => {
    const a = make(0, 0);
    expect(alignLayers([a], [a.id], "left", measure, "story")[0]?.offset.dx).toBe(0);

    const b = make(300, 0);
    const locked = { ...b, locked: true };
    const out = alignLayers([a, locked], [a.id, locked.id], "left", measure, "story");
    expect(out[1]?.offset.dx).toBe(300);
  });
});

describe("distributeLayers", () => {
  const make = (dx: number): Layer =>
    newTextLayer({
      anchor: { ax: 0, ay: 0 },
      origin: { ox: 0, oy: 0 },
      offset: { dx, dy: 0 },
      w: 100,
      h: 50,
    });

  it("spaces three layers evenly, keeping the outer two fixed", () => {
    const a = make(0);
    const b = make(120);
    const c = make(600);
    const out = distributeLayers([a, b, c], [a.id, b.id, c.id], "horizontal", measure, "story");

    expect(out[0]?.offset.dx).toBe(0);
    expect(out[2]?.offset.dx).toBe(600);
    // Total span 700, three 100-wide boxes -> 200 of gap split in two.
    expect(out[1]?.offset.dx).toBe(300);
  });

  it("needs at least three layers", () => {
    const a = make(0);
    const b = make(400);
    const out = distributeLayers([a, b], [a.id, b.id], "horizontal", measure, "story");
    expect(out[1]?.offset.dx).toBe(400);
  });
});
