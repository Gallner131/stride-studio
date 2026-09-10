import { describe, expect, it } from "vitest";
import { handlePoints, hitHandle } from "../../src/editor/overlay";
import type { Placed } from "../../src/model/types";

/**
 * §6.2. Removing an element you just added meant leaving the canvas — the × in the Layers
 * panel, a button in the Inspector, or Backspace, which a phone does not have. Raised twice.
 * The selection frame now carries its own delete handle, next to the resize corners.
 */

const placed = (over: Partial<Placed> = {}): Placed => ({
  id: "ly_one",
  box: { x: 200, y: 400, w: 300, h: 120 },
  rotation: 0,
  corners: [
    [200, 400],
    [500, 400],
    [500, 520],
    [200, 520],
  ],
  ...over,
});

const origin = { ox: 0.5, oy: 0.5 };

describe("the delete handle", () => {
  it("is one of the handles on a selection", () => {
    const ids = handlePoints(placed(), origin.ox, origin.oy).map((h) => h.id);
    expect(ids).toContain("del");
  });

  it("sits clear of the rotation handle, so neither is hit by accident", () => {
    const points = handlePoints(placed(), origin.ox, origin.oy);
    const del = points.find((h) => h.id === "del");
    const rot = points.find((h) => h.id === "rot");
    if (!del || !rot) throw new Error("missing handles");
    // A 44 px hit target at ~3 units/px is 132 units across; keep the centres further apart.
    expect(Math.hypot(del.x - rot.x, del.y - rot.y)).toBeGreaterThan(140);
  });

  it("is found by a press on it", () => {
    const p = placed();
    const del = handlePoints(p, origin.ox, origin.oy).find((h) => h.id === "del");
    if (!del) throw new Error("no delete handle");
    expect(hitHandle(p, origin, del.x, del.y, 3)).toBe("del");
  });

  it("is not found by a press in the middle of the element", () => {
    const p = placed();
    expect(hitHandle(p, origin, p.box.x + p.box.w / 2, p.box.y + p.box.h / 2, 3)).toBeNull();
  });

  it("rotates with the element, like every other handle", () => {
    const upright = handlePoints(placed(), origin.ox, origin.oy).find((h) => h.id === "del");
    const turned = handlePoints(placed({ rotation: 90 }), origin.ox, origin.oy).find((h) => h.id === "del");
    if (!upright || !turned) throw new Error("missing handles");
    expect(Math.hypot(turned.x - upright.x, turned.y - upright.y)).toBeGreaterThan(1);
  });
});
