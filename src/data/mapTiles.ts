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

// --- Web Mercator ------------------------------------------------------------------------
//
// The trace stays a layer you can style, so it has to land on the map's roads by sharing the
// map's projection rather than by luck. These three functions are that shared projection,
// and they are pure so they can be tested against known values.

/** Web Mercator y for a latitude, in the same units as longitude. */
export const mercatorY = (lat: number): number =>
  Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360)) * (180 / Math.PI);

/** The inverse, for turning a box back into degrees. */
export const mercatorLat = (y: number): number => (Math.atan(Math.sinh((y * Math.PI) / 180)) * 180) / Math.PI;

/**
 * Grows a box so its Mercator aspect matches the image it will be drawn into.
 *
 * Without this Mapbox adjusts the box itself to fit the requested size, by an amount nothing
 * here can predict — and an unpredictable box means an unpredictable projection, which is
 * exactly the misalignment this is here to remove. Growing it first means the box we project
 * against is the box we asked for.
 */
export function fitBoxToAspect(box: MapBox, aspect: number): MapBox {
  const north = mercatorY(box.north);
  const south = mercatorY(box.south);
  const w = box.east - box.west;
  const h = north - south;
  if (w <= 0 || h <= 0) return box;

  if (w / h < aspect) {
    const want = h * aspect;
    const mid = (box.east + box.west) / 2;
    return { ...box, west: mid - want / 2, east: mid + want / 2 };
  }
  const want = w / aspect;
  const mid = (north + south) / 2;
  return { ...box, north: mercatorLat(mid + want / 2), south: mercatorLat(mid - want / 2) };
}

/** How the background image is laid onto the canvas — the cover fit, mirroring drawCover. */
export interface MapPlacement {
  box: MapBox;
  imgW: number;
  imgH: number;
  canvasW: number;
  canvasH: number;
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Turns a coordinate into a point on the canvas.
 *
 * Mirrors `drawCover` exactly — the same cover scale, the same centring, the same pan — so
 * the trace moves with the map when it is zoomed or panned instead of sliding off it.
 */
export function projectToCanvas(p: MapPlacement): (lat: number, lon: number) => [number, number] {
  const northY = mercatorY(p.box.north);
  const southY = mercatorY(p.box.south);
  const spanX = p.box.east - p.box.west || 1;
  const spanY = northY - southY || 1;

  const s = Math.max(p.canvasW / p.imgW, p.canvasH / p.imgH) * (p.zoom || 1);
  const dw = p.imgW * s;
  const dh = p.imgH * s;
  const px = Math.max(-1, Math.min(1, p.panX || 0));
  const py = Math.max(-1, Math.min(1, p.panY || 0));
  const originX = (p.canvasW - dw) / 2 + ((dw - p.canvasW) / 2) * px;
  const originY = (p.canvasH - dh) / 2 + ((dh - p.canvasH) / 2) * py;

  return (lat: number, lon: number) => {
    const u = (lon - p.box.west) / spanX;
    const v = (northY - mercatorY(lat)) / spanY;
    return [originX + u * dw, originY + v * dh];
  };
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
  /** The box actually drawn, which the trace projects against. */
  box: MapBox;
  width: number;
  height: number;
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
  const rawBox = routeBounds(route);
  if (!rawBox) return null;

  // Fitted to the image's aspect BEFORE the request, so the box we project against is the
  // box Mapbox drew. The route is deliberately not baked in: the trace stays a layer you can
  // recolour, and it aligns because it shares this projection.
  const box = fitBoxToAspect(rawBox, width / height);
  const key = mapCacheKey(box, style, width, height);
  const cached = await loadAsset(key);
  if (cached?.blob) {
    return {
      blob: cached.blob,
      url: URL.createObjectURL(cached.blob),
      attribution: MAP_ATTRIBUTION,
      box,
      width,
      height,
    };
  }

  try {
    const res = await fetchImpl(mapRequestUrl(box, style, width, height));
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    await saveAsset(key, { blob, kind: "image", w: width, h: height, name: `map-${style}` });
    return { blob, url: URL.createObjectURL(blob), attribution: MAP_ATTRIBUTION, box, width, height };
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
