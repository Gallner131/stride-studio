import { describe, expect, it } from "vitest";
import { mapCacheKey, mapRequestUrl, routeBounds } from "../../src/data/mapTiles";
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
