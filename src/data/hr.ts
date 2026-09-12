// Central heart-rate zone resolution — §7.4.
//
// Zones come from ONE source of truth, resolved at read time:
//   1. The athlete's own zones, from Strava's GET /athlete/zones
//   2. Bands synthesised from prefs.hrMax, if they typed a maximum into Settings
//   3. undefined — and then nothing zone-dependent is drawn at all
//
// It is a bug to derive zones from an activity's peak heart rate. The app used to, and the
// number it divided by was Strava's `max_heartrate`: the peak reached DURING THAT RUN. So an
// easy run peaking at 170 made 175 the assumed maximum, a genuine Z2 effort at 140 bpm
// computed as 80 %, and it was reported as Z4. Every run came out at the top of the scale.
//
// Strava already stores the athlete's zones — the ones they see in the Strava app — and
// serves them from GET /athlete/zones. Those are the truth, so we use them, and when we do
// not have them we show nothing. A confidently wrong zone is worse than no zone.

// ---------------------------------------------------------------------------------------
// Parsing what Strava sends
//
// Strava's published reference names the models (Zones, HeartRateZoneRanges, ZoneRanges) but
// does not spell out the nesting, so this parser verifies what it actually received instead
// of trusting a shape. Everything it cannot vouch for comes back as null.
// ---------------------------------------------------------------------------------------

export interface ZoneBand {
  min: number;
  /** Infinity for the open-ended top zone, which Strava marks with -1. */
  max: number;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A list of {min, max} pairs, or null if this is not one. */
function readBands(value: unknown): ZoneBand[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const bands: ZoneBand[] = [];
  for (const entry of value) {
    if (!isObject(entry)) return null;
    const { min, max } = entry;
    if (typeof min !== "number" || typeof max !== "number") return null;
    if (!Number.isFinite(min)) return null;
    // -1 is Strava's "no upper bound" for the top zone. Treating it as a real ceiling would
    // put every hard effort below it and never register a Z5 at all.
    bands.push({ min, max: max < 0 ? Number.POSITIVE_INFINITY : max });
  }
  return bands;
}

/**
 * Pulls the heart-rate zones out of whatever GET /athlete/zones returned.
 *
 * Accepts the documented `{ heart_rate: { zones: [...] } }`, and two shapes it might
 * plausibly arrive in instead — a bare list, or a list of typed zone sets — because being
 * wrong here means printing a wrong zone, which is the bug this exists to end.
 */
export function parseHeartRateZones(payload: unknown): ZoneBand[] | null {
  if (isObject(payload)) {
    const hr = payload.heart_rate;
    if (isObject(hr)) return readBands(hr.zones);
    return null;
  }

  if (Array.isArray(payload)) {
    // A bare list of bands.
    const direct = readBands(payload);
    if (direct) return direct;

    // A list of typed zone sets; take the heart-rate one.
    for (const entry of payload) {
      if (!isObject(entry)) continue;
      const type = typeof entry.type === "string" ? entry.type.toLowerCase() : "";
      if (type.includes("heart")) return readBands(entry.zones);
    }
  }

  return null;
}

/** Which zone a reading falls in, 0-indexed. Null when we have no zones to judge against. */
export function zoneOfBands(bpm: number, bands: ZoneBand[]): number | null {
  if (bands.length === 0) return null;
  for (let i = bands.length - 1; i >= 0; i--) {
    const band = bands[i];
    if (band && bpm >= band.min) return i;
  }
  return 0;
}

/** Time spent in each zone as a share of the stream. Null when there are no zones. */
export function zoneSharesFromBands(hr: number[], bands: ZoneBand[]): number[] | null {
  if (bands.length === 0 || hr.length === 0) return null;
  const counts = new Array<number>(bands.length).fill(0);
  for (const bpm of hr) {
    const z = zoneOfBands(bpm, bands);
    if (z !== null) counts[z] = (counts[z] ?? 0) + 1;
  }
  return counts.map((c) => c / hr.length);
}

// ---------------------------------------------------------------------------------------
// Resolving which zones to use
// ---------------------------------------------------------------------------------------

export type ZoneSource = "strava" | "user";

export interface Zones {
  bands: ZoneBand[];
  source: ZoneSource;
}

export interface ZonePrefs {
  hrMax?: number | null;
}

export interface Athlete {
  /** Bands as returned by GET /athlete/zones. */
  hrZones?: ZoneBand[];
  /** The athlete's true maximum, if we know it. Not any activity's peak. */
  hrMax?: number | null;
}

/**
 * The five floors Settings implies when the athlete gives us only a maximum.
 *
 * Z1's floor is 0, not 0.5 x max. Nothing measures a floor at half of maximum, and putting
 * one there would make the first band's height on a chart depend on whether the zones came
 * from Strava or from this fallback — the same value meaning two different things, which is
 * the shape of the bug this module exists to remove.
 */
const USER_ZONE_FLOORS = [0, 0.6, 0.7, 0.8, 0.9];

/**
 * Bands from a single maximum. Z1 starts at 0 and Z5 has no ceiling, matching the shape
 * Strava returns, so a chart drawn from these is identical in geometry to one drawn from
 * the athlete's real zones.
 */
export function bandsFromMax(max: number): ZoneBand[] {
  return USER_ZONE_FLOORS.map((floor, i) => {
    const next = USER_ZONE_FLOORS[i + 1];
    return {
      min: floor * max,
      max: next === undefined ? Number.POSITIVE_INFINITY : next * max,
    };
  });
}

/**
 * The zones to draw with, or undefined. Takes no activity: the signature is the guarantee
 * that a single run's peak cannot become a zone ceiling again by accident.
 */
export function resolveZones(prefs: ZonePrefs, athlete: Athlete | null): Zones | undefined {
  if (athlete?.hrZones?.length) return { bands: athlete.hrZones, source: "strava" };
  if (prefs.hrMax && prefs.hrMax > 0) return { bands: bandsFromMax(prefs.hrMax), source: "user" };
  return undefined;
}

/**
 * The athlete's true maximum, or null.
 *
 * Separate from `resolveZones` on purpose: the rings chart needs a denominator for "how hard
 * was this", and no band carries one, because Strava's top zone is open-ended. A caller that
 * gets null here must leave the ring empty rather than invent a figure.
 */
export function resolveAthleteHrMax(prefs: ZonePrefs, athlete: Athlete | null): number | null {
  return athlete?.hrMax ?? prefs.hrMax ?? null;
}

/**
 * Display metadata per zone. Formerly `ZONES` in render.js, which returned this shape from
 * `zoneOf`; PR-A5's compat shim reads `.c` and `.name` from here. A Look may override the
 * colours via `chart.zoneColors`.
 */
export const ZONE_META: ReadonlyArray<{ n: number; name: string; c: string }> = [
  { n: 1, name: "Recovery", c: "#8FA3B5" },
  { n: 2, name: "Easy", c: "#4FC1E9" },
  { n: 3, name: "Aerobic", c: "#7BE495" },
  { n: 4, name: "Threshold", c: "#FFB347" },
  { n: 5, name: "Max", c: "#FF5A5F" },
] as const;
