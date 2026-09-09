import { describe, expect, it } from "vitest";
import {
  cumulativeLengths,
  isClosedLoop,
  type LatLng,
  type Point,
  pointAt,
  projectRoute,
  resample,
  simplify,
  smoothSeries,
} from "../../src/engine/geometry";

/** Spec §12.1: geometry — projection keeps aspect, simplify preserves endpoints. */

describe("projectRoute", () => {
  const square: LatLng[] = [
    [51.5, -0.1],
    [51.51, -0.1],
    [51.51, -0.09],
    [51.5, -0.09],
  ];

  it("fits inside the box", () => {
    const pts = projectRoute(square, { x: 0, y: 0, w: 100, h: 100 });
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(-0.001);
      expect(x).toBeLessThanOrEqual(100.001);
      expect(y).toBeGreaterThanOrEqual(-0.001);
      expect(y).toBeLessThanOrEqual(100.001);
    }
  });

  it("scales longitude by cos(latitude), so the shape is not stretched", () => {
    // At 51.5 degrees, 0.01 deg of longitude is about 0.62 of 0.01 deg of latitude on the
    // ground. A naive projection would render this tall rectangle as a square.
    const pts = projectRoute(square, { x: 0, y: 0, w: 200, h: 200 });
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    expect(width / height).toBeGreaterThan(0.5);
    expect(width / height).toBeLessThan(0.72);
  });

  it("returns nothing for no input", () => {
    expect(projectRoute([], { x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
  });

  it("survives a single repeated point without dividing by zero", () => {
    const pts = projectRoute(
      [
        [51.5, -0.1],
        [51.5, -0.1],
      ],
      { x: 0, y: 0, w: 100, h: 100 },
    );
    expect(pts).toHaveLength(2);
    for (const [x, y] of pts) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe("simplify", () => {
  const line: Point[] = [
    [0, 0],
    [1, 0.05],
    [2, -0.05],
    [3, 0.02],
    [4, 0],
  ];

  it("removes points within tolerance of a straight line", () => {
    expect(simplify(line, 0.5)).toEqual([
      [0, 0],
      [4, 0],
    ]);
  });

  it("always keeps both endpoints", () => {
    const out = simplify(line, 100);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([4, 0]);
  });

  it("keeps a genuine corner", () => {
    const corner: Point[] = [
      [0, 0],
      [5, 0],
      [5, 5],
    ];
    expect(simplify(corner, 0.5)).toHaveLength(3);
  });

  it("is a no-op for a tolerance of zero or a tiny path", () => {
    expect(simplify(line, 0)).toHaveLength(5);
    expect(simplify([[0, 0]], 5)).toHaveLength(1);
  });
});

describe("pointAt", () => {
  const path: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
  ];

  it("finds the midpoint by distance, not by index", () => {
    // Total length 20; halfway is (10, 0).
    expect(pointAt(path, 0.5)).toEqual([10, 0]);
  });

  it("clamps outside 0..1", () => {
    expect(pointAt(path, -1)).toEqual([0, 0]);
    expect(pointAt(path, 2)).toEqual([10, 10]);
  });

  it("handles a zero-length path", () => {
    expect(pointAt([[3, 4]], 0.5)).toEqual([3, 4]);
    expect(pointAt([], 0.5)).toBeNull();
  });
});

describe("cumulativeLengths", () => {
  it("starts at zero and accumulates", () => {
    expect(
      cumulativeLengths([
        [0, 0],
        [3, 4],
        [3, 8],
      ]),
    ).toEqual([0, 5, 9]);
  });
});

describe("isClosedLoop", () => {
  it("recognises a loop", () => {
    const loop: Point[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      loop.push([Math.cos(a) * 50, Math.sin(a) * 50]);
    }
    expect(isClosedLoop(loop)).toBe(true);
  });

  it("rejects an out-and-back that does not return", () => {
    const straight: Point[] = Array.from({ length: 20 }, (_, i) => [i * 10, 0] as Point);
    expect(isClosedLoop(straight)).toBe(false);
  });

  it("rejects a path too short to judge", () => {
    expect(
      isClosedLoop([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(false);
  });
});

describe("resample", () => {
  it("keeps the endpoints and interpolates between", () => {
    expect(resample([0, 10], 3)).toEqual([0, 5, 10]);
  });

  it("shrinks a long series", () => {
    expect(resample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3)).toEqual([0, 5, 10]);
  });

  it("handles empty input", () => {
    expect(resample([], 5)).toEqual([]);
  });
});

describe("smoothSeries", () => {
  it("flattens a spike", () => {
    const out = smoothSeries([10, 10, 100, 10, 10], 3);
    expect(out[2]).toBeLessThan(100);
    expect(out[2]).toBeGreaterThan(10);
  });

  it("is a no-op for a window of one", () => {
    expect(smoothSeries([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
});
