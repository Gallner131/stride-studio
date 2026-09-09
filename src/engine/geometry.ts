// Route geometry — §11.1 (simplify), §5.5 (bounds).
//
// Pure functions over lat/lng pairs. No canvas, no module state, so these are unit-testable
// without a browser.

export type LatLng = [number, number];
export type Point = [number, number];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Projects lat/lng into a box, preserving aspect ratio.
 *
 * Longitude is scaled by cos(latitude) so a route does not look stretched east-west — the
 * error at UK latitudes is otherwise about 40 %.
 */
export function projectRoute(points: LatLng[], box: Box, northUp = false): Point[] {
  if (points.length === 0) return [];

  const lat0 = points.reduce((a, p) => a + p[0], 0) / points.length;
  const k = Math.cos((lat0 * Math.PI) / 180);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const xy: Point[] = points.map(([la, lo]) => {
    const x = lo * k;
    const y = -la; // screen y grows downward
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    return [x, y];
  });

  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;

  // "north-up" keeps true orientation; "fit" is the same projection here, since we never
  // rotate the route — the distinction exists for a future rotate-to-fit mode.
  void northUp;

  const scale = Math.min(box.w / spanX, box.h / spanY);
  const offsetX = box.x + (box.w - spanX * scale) / 2;
  const offsetY = box.y + (box.h - spanY * scale) / 2;

  return xy.map(([x, y]) => [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale]);
}

/** Perpendicular distance from p to the line ab. */
function perpDistance(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Douglas-Peucker simplification. Endpoints are always preserved, which matters because the
 * start and finish dots are drawn on them.
 */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points.slice();

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) break;
    const [first, last] = range;
    let maxDist = 0;
    let index = -1;

    const a = points[first];
    const b = points[last];
    if (!a || !b) continue;

    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      if (!p) continue;
      const dist = perpDistance(p, a, b);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > tolerance && index > 0) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

/** Cumulative length along a polyline, same length as the input. */
export function cumulativeLengths(points: Point[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    out.push((out[i - 1] ?? 0) + (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0));
  }
  return out;
}

/** Point at a fraction along the polyline, for the runner dot and km markers. */
export function pointAt(points: Point[], fraction: number): Point | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0] ?? null;

  const lengths = cumulativeLengths(points);
  const total = lengths[lengths.length - 1] ?? 0;
  if (total === 0) return points[0] ?? null;

  const target = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 1; i < points.length; i++) {
    const prev = lengths[i - 1] ?? 0;
    const curr = lengths[i] ?? 0;
    if (curr >= target) {
      const a = points[i - 1];
      const b = points[i];
      if (!a || !b) return null;
      const seg = curr - prev || 1;
      const t = (target - prev) / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  return points[points.length - 1] ?? null;
}

/** Is the route a loop? Used by the silhouette fill. */
export function isClosedLoop(points: Point[], threshold = 0.08): boolean {
  if (points.length < 8) return false;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return false;

  const lengths = cumulativeLengths(points);
  const total = lengths[lengths.length - 1] ?? 0;
  if (total === 0) return false;

  return Math.hypot(last[0] - first[0], last[1] - first[1]) / total < threshold;
}

/** Resamples a series to n points, for charts narrower than their data. */
export function resample(values: number[], n: number): number[] {
  if (values.length === 0 || n <= 0) return [];
  if (values.length === n) return values.slice();

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n - 1)) * (values.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(values.length - 1, lo + 1);
    const frac = t - lo;
    const a = values[lo] ?? 0;
    const b = values[hi] ?? a;
    out.push(a + (b - a) * frac);
  }
  return out;
}

/** Moving average, for HR smoothing (§4.4.6 `smooth`). */
export function smoothSeries(values: number[], window: number): number[] {
  if (window <= 1 || values.length === 0) return values.slice();
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j] ?? 0;
      count++;
    }
    return count > 0 ? sum / count : 0;
  });
}
