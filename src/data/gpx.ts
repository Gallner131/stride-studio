// GPX and TCX import — §7.3.
//
// For Garmin, Coros, Apple Watch, Nike Run Club, Suunto and Polar users who do not use
// Strava. Both formats are XML, so this needs no dependency; FIT is binary and arrives
// separately behind a lazy-loaded decoder.
//
// Everything is computed from the trackpoints rather than trusted from a summary field,
// because exporters disagree about what they put in one — moving time especially.

export interface ImportedActivity {
  source: "gpx" | "tcx";
  name: string;
  sport: string;
  date: string;
  /** Metres. */
  distance: number;
  /** Seconds of moving time. */
  time: number;
  /** Seconds of elapsed time, including pauses. */
  elapsed: number;
  /** Metres of ascent. */
  elevation: number;
  hr: number | null;
  hrMax: number | null;
  calories: number | null;
  /** Decoded route as lat/lng pairs. */
  route: [number, number][];
  /** Per-kilometre pace in seconds. */
  splits: number[];
  /** Altitude series, thinned. */
  elev: number[];
  /** Heart-rate series, thinned. */
  hrStream: number[];
  /** What could not be read, shown to the user rather than hidden. */
  problems: string[];
}

interface TrackPoint {
  lat: number | null;
  lon: number | null;
  ele: number | null;
  time: number | null;
  hr: number | null;
  /** Cumulative distance in metres, when the file states it (TCX does). */
  distance: number | null;
}

const EARTH_RADIUS = 6371000;

/** Great-circle distance in metres. */
export function haversine(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

const num = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const timeOf = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/** Thins a series to at most `max` samples, keeping the shape. */
function thin(values: number[], max = 200): number[] {
  if (values.length <= max) return values;
  const step = values.length / max;
  const out: number[] = [];
  for (let i = 0; i < max; i++) out.push(values[Math.floor(i * step)] ?? 0);
  return out;
}

/**
 * Sport from a GPX/TCX type string. Exporters are inconsistent, so this is deliberately
 * loose and falls back to "run" — the most common case — rather than "other".
 */
export function sportFromType(raw: string | null): string {
  const t = (raw ?? "").toLowerCase();
  if (/trail/.test(t)) return "trailrun";
  if (/bik|cycl|ride/.test(t)) return "ride";
  if (/swim/.test(t)) return "swim";
  if (/hik/.test(t)) return "hike";
  if (/walk/.test(t)) return "walk";
  if (/run|jog/.test(t)) return "run";
  if (/strength|weight|hiit|yoga|cross|other/.test(t)) return "workout";
  return "run";
}

/**
 * Moving time: seconds where speed exceeded 0.5 m/s, per §7.3. Pauses under three seconds
 * are kept, so a stop at traffic lights does not shred the total.
 */
function movingTime(points: TrackPoint[]): { moving: number; elapsed: number } {
  const timed = points.filter((p) => p.time !== null);
  if (timed.length < 2) return { moving: 0, elapsed: 0 };

  const firstTime = timed[0]?.time ?? 0;
  const lastTime = timed[timed.length - 1]?.time ?? 0;
  let moving = 0;

  for (let i = 1; i < timed.length; i++) {
    const prev = timed[i - 1];
    const curr = timed[i];
    if (!prev || !curr || prev.time === null || curr.time === null) continue;
    const dt = (curr.time - prev.time) / 1000;
    if (dt <= 0) continue;

    let metres = 0;
    if (prev.lat !== null && prev.lon !== null && curr.lat !== null && curr.lon !== null) {
      metres = haversine([prev.lat, prev.lon], [curr.lat, curr.lon]);
    } else if (prev.distance !== null && curr.distance !== null) {
      metres = Math.max(0, curr.distance - prev.distance);
    }

    const speed = metres / dt;
    // A short gap counts as moving; a long slow one does not.
    if (speed > 0.5 || dt <= 3) moving += dt;
  }

  return { moving: Math.round(moving), elapsed: Math.round((lastTime - firstTime) / 1000) };
}

/**
 * Ascent with 3-point smoothing and 2 m hysteresis, per §7.3. Raw GPS altitude is noisy
 * enough that summing every positive delta can double the real climb.
 */
function ascent(altitudes: number[]): number {
  if (altitudes.length < 3) return 0;

  const smoothed = altitudes.map((_, i) => {
    const a = altitudes[Math.max(0, i - 1)] ?? 0;
    const b = altitudes[i] ?? 0;
    const c = altitudes[Math.min(altitudes.length - 1, i + 1)] ?? 0;
    return (a + b + c) / 3;
  });

  let total = 0;
  let reference = smoothed[0] ?? 0;
  for (const value of smoothed) {
    const delta = value - reference;
    if (delta > 2) {
      total += delta;
      reference = value;
    } else if (delta < -2) {
      reference = value;
    }
  }
  return Math.round(total);
}

/** Per-kilometre pace in seconds, from cumulative distance and time. */
function kmSplits(points: TrackPoint[], cumulative: number[]): number[] {
  const timed = points.map((p, i) => ({ t: p.time, d: cumulative[i] ?? 0 })).filter((p) => p.t !== null);
  if (timed.length < 2) return [];

  const splits: number[] = [];
  let nextMark = 1000;
  let lastTime = timed[0]?.t ?? 0;

  for (let i = 1; i < timed.length; i++) {
    const curr = timed[i];
    const prev = timed[i - 1];
    if (!curr || !prev || curr.t === null || prev.t === null) continue;

    while (curr.d >= nextMark) {
      // Interpolate the moment the kilometre mark was crossed.
      const span = curr.d - prev.d || 1;
      const fraction = (nextMark - prev.d) / span;
      const crossing = prev.t + (curr.t - prev.t) * fraction;
      splits.push(Math.round((crossing - lastTime) / 1000));
      lastTime = crossing;
      nextMark += 1000;
    }
  }
  return splits;
}

function parseXml(text: string): Document | null {
  try {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) return null;
    return doc;
  } catch {
    return null;
  }
}

/** Reads a GPX file. */
export function parseGpx(text: string): ImportedActivity | null {
  const doc = parseXml(text);
  if (!doc) return null;

  const trkpts = [...doc.getElementsByTagName("trkpt")];
  if (trkpts.length === 0) return null;

  const problems: string[] = [];
  const points: TrackPoint[] = trkpts.map((pt) => {
    // Heart rate lives in an extension whose namespace varies by exporter, so match on the
    // local name instead of the prefix.
    let hr: number | null = null;
    for (const el of [...pt.getElementsByTagName("*")]) {
      const local = el.localName?.toLowerCase();
      if (local === "hr" || local === "heartrate") {
        hr = num(el.textContent);
        break;
      }
    }
    return {
      lat: num(pt.getAttribute("lat")),
      lon: num(pt.getAttribute("lon")),
      ele: num(pt.getElementsByTagName("ele")[0]?.textContent),
      time: timeOf(pt.getElementsByTagName("time")[0]?.textContent),
      hr,
      distance: null,
    };
  });

  const name =
    doc.getElementsByTagName("name")[0]?.textContent?.trim() ||
    doc.getElementsByTagName("trk")[0]?.getElementsByTagName("name")[0]?.textContent?.trim() ||
    "Imported activity";
  const type = doc.getElementsByTagName("type")[0]?.textContent ?? null;

  return finish(points, {
    source: "gpx",
    name,
    sport: sportFromType(type),
    calories: null,
    problems,
  });
}

/** Reads a TCX file. TCX states cumulative distance, which is more accurate than haversine. */
export function parseTcx(text: string): ImportedActivity | null {
  const doc = parseXml(text);
  if (!doc) return null;

  const trackpoints = [...doc.getElementsByTagName("Trackpoint")];
  if (trackpoints.length === 0) return null;

  const points: TrackPoint[] = trackpoints.map((pt) => {
    const pos = pt.getElementsByTagName("Position")[0];
    return {
      lat: num(pos?.getElementsByTagName("LatitudeDegrees")[0]?.textContent),
      lon: num(pos?.getElementsByTagName("LongitudeDegrees")[0]?.textContent),
      ele: num(pt.getElementsByTagName("AltitudeMeters")[0]?.textContent),
      time: timeOf(pt.getElementsByTagName("Time")[0]?.textContent),
      hr: num(pt.getElementsByTagName("HeartRateBpm")[0]?.getElementsByTagName("Value")[0]?.textContent),
      distance: num(pt.getElementsByTagName("DistanceMeters")[0]?.textContent),
    };
  });

  const activity = doc.getElementsByTagName("Activity")[0];
  const sport = activity?.getAttribute("Sport") ?? null;
  const calories = num(doc.getElementsByTagName("Calories")[0]?.textContent);
  const name = doc.getElementsByTagName("Notes")[0]?.textContent?.trim() || "Imported activity";

  return finish(points, {
    source: "tcx",
    name,
    sport: sportFromType(sport),
    calories,
    problems: [],
  });
}

function finish(
  points: TrackPoint[],
  meta: { source: "gpx" | "tcx"; name: string; sport: string; calories: number | null; problems: string[] },
): ImportedActivity {
  const problems = [...meta.problems];

  // Cumulative distance: prefer the file's own figure, fall back to haversine.
  const stated = points.every((p) => p.distance !== null);
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) {
      cumulative.push(cumulative[i - 1] ?? 0);
      continue;
    }
    if (stated && prev.distance !== null && curr.distance !== null) {
      cumulative.push(Math.max(cumulative[i - 1] ?? 0, curr.distance));
    } else if (prev.lat !== null && prev.lon !== null && curr.lat !== null && curr.lon !== null) {
      cumulative.push((cumulative[i - 1] ?? 0) + haversine([prev.lat, prev.lon], [curr.lat, curr.lon]));
    } else {
      cumulative.push(cumulative[i - 1] ?? 0);
    }
  }

  let route = points
    .filter((p): p is TrackPoint & { lat: number; lon: number } => p.lat !== null && p.lon !== null)
    .map((p) => [p.lat, p.lon] as [number, number]);

  // A degenerate track is not a route. Treadmill and indoor exports often carry trackpoints
  // pinned at 0,0 (or at a single repeated fix), which would otherwise be reported as GPS
  // and offered to the Map designs, then render as a dot.
  if (route.length > 0 && !hasSpan(route)) {
    route = [];
    problems.push("The GPS positions in this file do not move, so there is no route.");
  } else if (route.length === 0) {
    problems.push("No GPS positions in this file, so there is no route.");
  }

  const altitudes = points.map((p) => p.ele).filter((e): e is number => e !== null);
  if (altitudes.length === 0) problems.push("No elevation in this file.");

  const hrValues = points.map((p) => p.hr).filter((h): h is number => h !== null && h > 0);
  if (hrValues.length === 0) problems.push("No heart rate in this file.");

  const { moving, elapsed } = movingTime(points);
  if (moving === 0) problems.push("No timestamps in this file, so the duration is unknown.");

  const firstTime = points.find((p) => p.time !== null)?.time ?? Date.now();

  return {
    source: meta.source,
    name: meta.name,
    sport: meta.sport,
    date: new Date(firstTime).toISOString(),
    distance: Math.round(cumulative[cumulative.length - 1] ?? 0),
    time: moving,
    elapsed,
    elevation: ascent(altitudes),
    hr: hrValues.length > 0 ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null,
    hrMax: hrValues.length > 0 ? Math.max(...hrValues) : null,
    calories: meta.calories,
    route: thinRoute(route),
    splits: kmSplits(points, cumulative),
    elev: thin(altitudes),
    hrStream: thin(hrValues),
    problems,
  };
}

/** True when the track actually covers ground, rather than sitting on one fix. */
function hasSpan(route: [number, number][]): boolean {
  const lats = route.map((p) => p[0]);
  const lons = route.map((p) => p[1]);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lonSpan = Math.max(...lons) - Math.min(...lons);
  // About 1 m at the equator — below this there is no shape to draw.
  return latSpan > 1e-5 || lonSpan > 1e-5;
}

/** Keeps route shape while capping the point count the renderer has to project. */
function thinRoute(route: [number, number][], max = 600): [number, number][] {
  if (route.length <= max) return route;
  const step = route.length / max;
  const out: [number, number][] = [];
  for (let i = 0; i < max; i++) out.push(route[Math.floor(i * step)] as [number, number]);
  const last = route[route.length - 1];
  if (last) out[out.length - 1] = last;
  return out;
}

/** Detects the format and parses. Returns null if neither parser recognises it. */
export function parseTrackFile(text: string, filename = ""): ImportedActivity | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tcx")) return parseTcx(text);
  if (lower.endsWith(".gpx")) return parseGpx(text);
  // Unknown extension: sniff the content.
  if (/<TrainingCenterDatabase/i.test(text)) return parseTcx(text);
  if (/<gpx/i.test(text)) return parseGpx(text);
  return null;
}

/** Maps an import onto the legacy activity shape the renderer already understands. */
export function importedToActivity(imported: ImportedActivity): Record<string, unknown> {
  return {
    id: `${imported.source}:${imported.date}`,
    sport: imported.sport,
    name: imported.name,
    date: imported.date,
    distance: imported.distance,
    time: imported.time,
    elevation: imported.elevation,
    hr: imported.hr,
    hrMax: imported.hrMax ? imported.hrMax + 5 : null,
    calories: imported.calories,
    route: imported.route,
    splits: imported.splits,
    elev: imported.elev,
    hrStream: imported.hrStream,
  };
}
