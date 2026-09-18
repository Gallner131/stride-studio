// Map backgrounds — §2.12.
//
// A route drawn on a real map, as the background of a design. The route line the app already
// draws says how far and what shape; a map says *where*, which is most of what a runner is
// actually posting about.
//
// The picture comes from `/api/maptiles`, which holds the Mapbox token. Nothing here knows
// it. Each bounding box maps to one immutable image, so a route fetched once is cached in
// IndexedDB and never fetched again — that is what keeps this off the Mapbox bill when
// someone flips between styles and formats while designing.

import { loadAsset, saveAsset } from "../storage/db";

export type MapStyle = "outdoors" | "streets" | "light" | "dark" | "satellite";

export const MAP_STYLES: Array<{ id: MapStyle; name: string }> = [
  { id: "outdoors", name: "Outdoors" },
  { id: "streets", name: "Streets" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "satellite", name: "Satellite" },
];

export interface LatLng {
  lat: number;
  lon: number;
}

export interface MapBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Encodes a track as a Google polyline, so Mapbox can draw it.
 *
 * The route has to be drawn BY the map, not over it. The image is fitted to a bounding box
 * and then cover-cropped to the canvas, while the app projects its own route line into a
 * layer box — two different projections, so the line sat next to the roads it was supposed
 * to be on rather than along them. Handing the track to Mapbox means one projection and
 * exact alignment, at any zoom or pan, for free.
 */
export function encodePolyline(points: LatLng[]): string {
  let out = "";
  let lastLat = 0;
  let lastLon = 0;
  const chunk = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lon = Math.round(p.lon * 1e5);
    chunk(lat - lastLat);
    chunk(lon - lastLon);
    lastLat = lat;
    lastLon = lon;
  }
  return out;
}

/**
 * Thins a track to at most `max` points, keeping the first and last.
 *
 * A Static Images request goes in a URL, and an hour of GPS at one point a second is tens of
 * thousands of them — far past any URL limit. Evenly spaced samples keep the shape.
 */
export function thinRoute(points: LatLng[], max = 240): LatLng[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max; i++) {
    const p = points[Math.round(i * step)];
    if (p) out.push(p);
  }
  return out;
}

/** Mapbox requires this to be visible wherever one of its maps is. */
export const MAP_ATTRIBUTION = "© Mapbox © OpenStreetMap";

/**
 * The bounding box for a route, with room around it.
 *
 * The margin is a fraction of the route's own span rather than a fixed number of degrees:
 * a fixed margin swallows a 400m track and is invisible on a marathon. A floor stops a
 * there-and-back on one street from asking for a box of zero width, which Mapbox rejects.
 */
export function routeBounds(route: LatLng[], margin = 0.18): MapBox | null {
  if (route.length === 0) return null;

  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const p of route) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    west = Math.min(west, p.lon);
    east = Math.max(east, p.lon);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  if (west > east || south > north) return null;

  // An indoor track exported with every point identical has no span and is not a route.
  const MIN_SPAN = 0.0008; // roughly 90 m
  const padX = Math.max((east - west) * margin, MIN_SPAN);
  const padY = Math.max((north - south) * margin, MIN_SPAN);

  return {
    west: Math.max(-180, west - padX),
    east: Math.min(180, east + padX),
    south: Math.max(-85, south - padY),
    north: Math.min(85, north + padY),
  };
}

/**
 * The cache key. Rounded to five decimals — about a metre — so that two renders of the same
 * route hit the same entry while genuinely different routes never collide.
 */
export function mapCacheKey(box: MapBox, style: MapStyle, w: number, h: number): string {
  const r = (v: number) => v.toFixed(5);
  return `map:${style}:${w}x${h}:${r(box.west)},${r(box.south)},${r(box.east)},${r(box.north)}`;
}

export function mapRequestUrl(box: MapBox, style: MapStyle, w: number, h: number, path?: string): string {
  const q = new URLSearchParams({
    style,
    w: String(box.west),
    s: String(box.south),
    e: String(box.east),
    n: String(box.north),
    width: String(w),
    height: String(h),
    retina: "1",
  });
  if (path) q.set("path", path);
  return `/api/maptiles?${q.toString()}`;
}

export interface MapImage {
  blob: Blob;
  url: string;
  attribution: string;
}

/**
 * Fetches the map for a route, from cache when we have it.
 *
 * Returns null rather than throwing when the service is unconfigured or unreachable: a
 * missing map is a background the app simply does not offer, not an error to show someone
 * mid-design.
 */
export async function fetchRouteMap(
  route: LatLng[],
  style: MapStyle,
  width: number,
  height: number,
  fetchImpl: typeof fetch = fetch,
): Promise<MapImage | null> {
  const box = routeBounds(route);
  if (!box) return null;

  const path = encodePolyline(thinRoute(route));
  const key = `${mapCacheKey(box, style, width, height)}:${path.length}`;
  const cached = await loadAsset(key);
  if (cached?.blob) {
    return { blob: cached.blob, url: URL.createObjectURL(cached.blob), attribution: MAP_ATTRIBUTION };
  }

  try {
    const res = await fetchImpl(mapRequestUrl(box, style, width, height, path));
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    await saveAsset(key, { blob, kind: "image", w: width, h: height, name: `map-${style}` });
    return { blob, url: URL.createObjectURL(blob), attribution: MAP_ATTRIBUTION };
  } catch {
    return null;
  }
}

/** Whether the deployment has a Mapbox token, so the UI can hide the option when it does not. */
export async function mapsAvailable(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    // A deliberately tiny box: this is a configuration probe, not a picture we intend to use.
    const res = await fetchImpl(
      mapRequestUrl({ west: -0.001, south: 51.5, east: 0.001, north: 51.502 }, "light", 64, 64),
    );
    return res.ok;
  } catch {
    return false;
  }
}
