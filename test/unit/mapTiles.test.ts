import { describe, expect, it } from "vitest";
import {
  fitBoxToAspect,
  mapCacheKey,
  mapRequestUrl,
  mercatorLat,
  mercatorY,
  projectToCanvas,
  routeBounds,
} from "../../src/data/mapTiles";
import { FIXTURE_RUN } from "../fixtures/activities.js";

/**
 * §2.12 — a route on a real map.
 *
 * The geometry is the part worth pinning. Everything else is a fetch and a cache; a bounding
 * box that is wrong by a margin turns a marathon into a dot or a lap of a track into a
 * picture of a county.
 */

const asLatLng = (route: number[][]) => route.map(([lat = 0, lon = 0]) => ({ lat, lon }));

describe("routeBounds", () => {
  it("contains every point of a real route", () => {
    const pts = asLatLng(FIXTURE_RUN.route);
    const b = routeBounds(pts);
    expect(b).not.toBeNull();
    if (!b) return;
    for (const p of pts) {
      expect(p.lon).toBeGreaterThanOrEqual(b.west);
      expect(p.lon).toBeLessThanOrEqual(b.east);
      expect(p.lat).toBeGreaterThanOrEqual(b.south);
      expect(p.lat).toBeLessThanOrEqual(b.north);
    }
  });

  it("leaves room around the route rather than cropping to it", () => {
    const pts = [
      { lat: 51.5, lon: -0.1 },
      { lat: 51.6, lon: 0.1 },
    ];
    const b = routeBounds(pts);
    if (!b) throw new Error("no bounds");
    expect(b.west).toBeLessThan(-0.1);
    expect(b.east).toBeGreaterThan(0.1);
    expect(b.south).toBeLessThan(51.5);
    expect(b.north).toBeGreaterThan(51.6);
  });

  it("scales the margin to the route, so a lap and a marathon both look right", () => {
    const lap = routeBounds([
      { lat: 51.5, lon: -0.1 },
      { lat: 51.501, lon: -0.099 },
    ]);
    const marathon = routeBounds([
      { lat: 51.3, lon: -0.4 },
      { lat: 51.7, lon: 0.3 },
    ]);
    if (!lap || !marathon) throw new Error("no bounds");
    expect(marathon.east - marathon.west).toBeGreaterThan(lap.east - lap.west);
  });

  it("gives a usable box for a route that never moves", () => {
    // An indoor export pins every trackpoint at one spot. A zero-width box is rejected by
    // Mapbox outright, so the floor matters.
    const b = routeBounds([
      { lat: 51.5, lon: -0.1 },
      { lat: 51.5, lon: -0.1 },
    ]);
    if (!b) throw new Error("no bounds");
    expect(b.east).toBeGreaterThan(b.west);
    expect(b.north).toBeGreaterThan(b.south);
  });

  it("is null for no route at all", () => {
    expect(routeBounds([])).toBeNull();
  });

  it("stays inside the projection's limits", () => {
    const b = routeBounds([
      { lat: 84.9, lon: 179.9 },
      { lat: 84.95, lon: 179.95 },
    ]);
    if (!b) throw new Error("no bounds");
    expect(b.north).toBeLessThanOrEqual(85);
    expect(b.east).toBeLessThanOrEqual(180);
  });
});

describe("caching", () => {
  const box = { west: -0.12, south: 51.5, east: -0.08, north: 51.53 };

  it("gives the same route the same key, and a different one a different key", () => {
    const a = mapCacheKey(box, "outdoors", 720, 1280);
    expect(mapCacheKey(box, "outdoors", 720, 1280)).toBe(a);
    expect(mapCacheKey(box, "satellite", 720, 1280)).not.toBe(a);
    expect(mapCacheKey(box, "outdoors", 720, 900)).not.toBe(a);
    expect(mapCacheKey({ ...box, north: 51.9 }, "outdoors", 720, 1280)).not.toBe(a);
  });
});

describe("the request", () => {
  it("sends a bounding box and a style, and never a token", () => {
    const url = mapRequestUrl({ west: -0.12, south: 51.5, east: -0.08, north: 51.53 }, "dark", 720, 1280);
    expect(url.startsWith("/api/maptiles?")).toBe(true);
    expect(url).toContain("style=dark");
    expect(url).toContain("width=720");
    // The token lives in the edge function. Anything token-shaped here would be in the
    // bundle, and this app ships as one inlined HTML file.
    expect(url.toLowerCase()).not.toContain("token");
    expect(url).not.toContain("mapbox.com");
  });
});

describe("sharing the map's projection", () => {
  // A square box over London, drawn into a square image on a square canvas: the simplest
  // case where every number can be reasoned about by hand.
  const box = { west: -0.2, south: 51.4, east: 0.0, north: 51.6 };
  const base = { box, imgW: 600, imgH: 600, canvasW: 600, canvasH: 600, zoom: 1, panX: 0, panY: 0 };

  it("puts the box's corners at the canvas corners", () => {
    const p = projectToCanvas({ ...base, box: fitBoxToAspect(box, 1) });
    const fitted = fitBoxToAspect(box, 1);
    const [x0, y0] = p(fitted.north, fitted.west);
    const [x1, y1] = p(fitted.south, fitted.east);
    expect(x0).toBeCloseTo(0, 4);
    expect(y0).toBeCloseTo(0, 4);
    expect(x1).toBeCloseTo(600, 4);
    expect(y1).toBeCloseTo(600, 4);
  });

  it("puts the centre of the box in the centre of the canvas", () => {
    const fitted = fitBoxToAspect(box, 1);
    const p = projectToCanvas({ ...base, box: fitted });
    const midLat = mercatorLat((mercatorY(fitted.north) + mercatorY(fitted.south)) / 2);
    const [x, y] = p(midLat, (fitted.west + fitted.east) / 2);
    expect(x).toBeCloseTo(300, 3);
    expect(y).toBeCloseTo(300, 3);
  });

  it("north is up", () => {
    const p = projectToCanvas(base);
    expect(p(51.55, -0.1)[1]).toBeLessThan(p(51.45, -0.1)[1]);
    expect(p(51.5, -0.15)[0]).toBeLessThan(p(51.5, -0.05)[0]);
  });

  it("moves the trace exactly as zooming the map moves the ground under it", () => {
    // The whole point: if these two disagree by any amount the line slides off the roads.
    //
    // The fixed point of a centred zoom is the box's MERCATOR centre, which is not the mean
    // of the two latitudes — 51.5 is a third of a pixel off it here, and at zoom 2 that
    // shows up as drift. Using the real centre keeps the test about the projection rather
    // than about my arithmetic.
    const midLat = mercatorLat((mercatorY(box.north) + mercatorY(box.south)) / 2);
    const midLon = (box.west + box.east) / 2;
    const centre = projectToCanvas(base)(midLat, midLon);
    const zoomed = projectToCanvas({ ...base, zoom: 2 })(midLat, midLon);
    // A point at the centre of the box stays put under a centred zoom.
    expect(zoomed[0]).toBeCloseTo(centre[0], 3);
    expect(zoomed[1]).toBeCloseTo(centre[1], 3);
    // A point off-centre moves outward by the zoom factor.
    const offCentre = projectToCanvas(base)(51.55, -0.15);
    const offZoomed = projectToCanvas({ ...base, zoom: 2 })(51.55, -0.15);
    expect(offZoomed[0] - centre[0]).toBeCloseTo((offCentre[0] - centre[0]) * 2, 2);
  });

  it("follows a pan", () => {
    const still = projectToCanvas({ ...base, zoom: 2 })(51.5, -0.1);
    const panned = projectToCanvas({ ...base, zoom: 2, panX: 1 })(51.5, -0.1);
    expect(panned[0]).toBeGreaterThan(still[0]);
  });
});

describe("fitBoxToAspect", () => {
  it("grows the box rather than cropping it", () => {
    const box = { west: -0.2, south: 51.4, east: 0.0, north: 51.6 };
    const wide = fitBoxToAspect(box, 2);
    expect(wide.east - wide.west).toBeGreaterThan(box.east - box.west);
    // The original box still fits inside, so no part of the route is cut off.
    expect(wide.west).toBeLessThanOrEqual(box.west);
    expect(wide.east).toBeGreaterThanOrEqual(box.east);
  });

  it("produces a box whose Mercator aspect matches what was asked for", () => {
    const fitted = fitBoxToAspect({ west: -0.2, south: 51.4, east: 0.0, north: 51.6 }, 720 / 1280);
    const aspect = (fitted.east - fitted.west) / (mercatorY(fitted.north) - mercatorY(fitted.south));
    expect(aspect).toBeCloseTo(720 / 1280, 6);
  });
});
