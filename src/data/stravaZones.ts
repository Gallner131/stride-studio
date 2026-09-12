// The athlete's real heart-rate zones — §7.4.
//
// The app used to derive zones from a max heart rate, and the number it divided by was
// Strava's `max_heartrate`: the peak reached DURING THAT RUN. So an easy run peaking at 170
// made 175 the assumed maximum, a genuine Z2 effort at 140 bpm computed as 80 %, and it was
// reported as Z4. Every run came out at the top of the scale.
//
// Strava already stores the athlete's zones — the ones they see in the Strava app — and
// serves them from GET /athlete/zones. Those are the truth, so we use them, and when we do
// not have them we show nothing. A confidently wrong zone is worse than no zone.
//
// Strava's published reference names the models (Zones, HeartRateZoneRanges, ZoneRanges) but
// does not spell out the nesting, so this parser verifies what it actually received instead
// of trusting a shape. Everything it cannot vouch for comes back as null.

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
