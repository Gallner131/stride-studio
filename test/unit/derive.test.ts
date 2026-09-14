import { describe, expect, it } from "vitest";
// Legacy JS modules: types are inferred, not declared, until src/ becomes TypeScript in
// Phases 1-2 (tsconfig has allowJs, checkJs: false).
import {
  captionFor,
  DEFAULT_OPTS,
  decodePolyline,
  derive,
  zoneOfBands,
  zoneSharesFromBands,
} from "../../src/render.js";
import { FIXTURE_ATHLETE, FIXTURE_RUN, FIXTURE_WORKOUT } from "../fixtures/activities.js";

// The legacy zone helpers take the athlete's bands now, not a maximum to divide by — the
// §7.4 fix reaching the switch-case renderer behind the Style tab. Types are inferred from
// plain JS, so narrow them once here rather than at every call.
const zone = zoneOfBands as (bpm: number, bands: { min: number; max: number }[]) => number | null;
const shares = zoneSharesFromBands as (
  stream: number[] | undefined,
  bands: { min: number; max: number }[],
) => number[] | null;
const bands = FIXTURE_ATHLETE.hrZones;

/** Spec §12.1: derive() across sports and units, polyline decoding, HR zones. */

const opts = (over: Record<string, unknown> = {}) => ({ ...structuredClone(DEFAULT_OPTS), ...over });

describe("derive — run, metric", () => {
  const d = derive(FIXTURE_RUN, opts());

  it("reports distance in km with one decimal above 10", () => {
    expect(d.unit).toBe("km");
    expect(d.hasDist).toBe(true);
    expect(d.hero.v).toBe("21.1");
    expect(d.hero.label).toBe("KILOMETRES");
  });

  it("computes pace per km", () => {
    // 6135 s over 21.1 km = 290.8 s/km
    expect(d.paceStr).toBe("4:51 /km");
    expect(d.paceLabel).toBe("Pace");
  });

  it("builds the stat row from the enabled stats", () => {
    expect(d.row).toEqual(["1:42:15", "4:51 /km", "84 m"]);
  });
});

describe("derive — run, imperial", () => {
  const d = derive(FIXTURE_RUN, opts({ units: "mi" }));

  it("converts distance and elevation", () => {
    expect(d.unit).toBe("mi");
    expect(d.hero.v).toBe("13.1");
    expect(d.hero.label).toBe("MILES");
    expect(d.elevU).toBe("ft");
    expect(Math.round(d.elevV)).toBe(276);
  });

  it("reports pace per mile", () => {
    expect(d.paceStr).toBe("7:48 /mi");
  });
});

describe("derive — workout with no distance (§4.7)", () => {
  const d = derive(FIXTURE_WORKOUT, opts());

  it("promotes duration to the hero", () => {
    expect(d.hasDist).toBe(false);
    expect(d.hero.v).toBe("45:00");
    expect(d.hero.label).toBe("MOVING TIME");
    expect(d.hero.u).toBe("");
  });

  it("drops pace and elevation from the row, and does not repeat the hero time", () => {
    expect(d.row).not.toContain("45:00");
    expect(d.row.some((r: string) => r.includes("/km"))).toBe(false);
    expect(d.row.some((r: string) => r.endsWith(" m"))).toBe(false);
  });
});

describe("derive — sport variants", () => {
  it("shows speed for rides", () => {
    const d = derive({ ...FIXTURE_RUN, sport: "ride" }, opts());
    expect(d.paceLabel).toBe("Speed");
    expect(d.paceStr).toBe("12.4 km/h");
  });

  it("shows per-100m for swims", () => {
    const d = derive({ ...FIXTURE_RUN, sport: "swim", distance: 1500, time: 1800 }, opts());
    expect(d.paceStr).toBe("2:00 /100m");
  });
});

describe("derive — progress (video templates)", () => {
  it("scales the hero and time by progress", () => {
    const half = derive(FIXTURE_RUN, opts(), 0.5);
    expect(half.hero.v).toBe("10.6");
    expect(half.row[0]).toBe("51:08"); // 6135 / 2 = 3067.5 s, rounded up
  });
});

describe("derive — display options", () => {
  it("uppercases the meta line when asked", () => {
    const d = derive(FIXTURE_RUN, opts({ uppercase: true }));
    expect(d.meta).toBe(d.meta.toUpperCase());
    expect(d.meta).toContain("SUNDAY LONG RUN");
  });

  it("hides the row and meta when switched off", () => {
    const d = derive(FIXTURE_RUN, opts({ show: { row: false, meta: false, name: false } }));
    expect(d.row).toEqual([]);
    expect(d.meta).toBe("");
  });
});

describe("decodePolyline", () => {
  it("decodes the polyline from Google's own worked example", () => {
    const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(decodePolyline("")).toEqual([]);
    expect(decodePolyline(undefined)).toEqual([]);
  });
});

describe("HR zones", () => {
  // These used to read `zone(90, 180)` — a reading and a maximum to divide by. That was the
  // shape of the §7.4 bug: the 180 came from the peak of the run being drawn, so the same
  // 90 bpm landed in a different zone depending on how hard the rest of the run was. Now
  // the athlete's own bands decide, and the same reading always means the same thing.
  it("maps bpm to a zone against the athlete's bands", () => {
    expect(zone(90, bands)).toBe(0); // below 114, Z1
    expect(zone(120, bands)).toBe(1); // 114-133, Z2
    expect(zone(140, bands)).toBe(2); // 133-152, Z3
    expect(zone(160, bands)).toBe(3); // 152-171, Z4
    expect(zone(175, bands)).toBe(4); // 171+, Z5
  });

  it("puts anything above the top band in zone 5, which has no ceiling", () => {
    expect(zone(200, bands)).toBe(4);
    expect(zone(300, bands)).toBe(4);
  });

  it("has no answer without bands, rather than a wrong one", () => {
    expect(zone(140, [])).toBeNull();
    expect(shares([120, 140], [])).toBeNull();
  });

  it("returns shares that sum to 1", () => {
    const s = shares(FIXTURE_RUN.hrStream, bands);
    expect(s).toHaveLength(5);
    expect(s?.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("returns null for an empty or missing stream", () => {
    expect(shares([], bands)).toBeNull();
    expect(shares(undefined, bands)).toBeNull();
  });

  // NOTE (spec §12.1 asks for time-weighted zone shares; §1.2 E7 flags the same area).
  // The legacy implementation weights by SAMPLE COUNT, which is only equal to time when the
  // stream is evenly sampled. Strava streams are not guaranteed to be. Correct weighting
  // needs streams.time, which arrives with the data layer in Phase 5.
  it("documents that shares are sample-weighted, not time-weighted", () => {
    // Two samples in zone 1, one in zone 5 -> 2/3 and 1/3 regardless of their duration.
    expect(shares([90, 90, 175], bands)).toEqual([2 / 3, 0, 0, 0, 1 / 3]);
  });
});

describe("captionFor", () => {
  it("includes the headline stats and running hashtags", () => {
    const caption = captionFor(FIXTURE_RUN, opts());
    expect(caption).toContain("Sunday long run");
    expect(caption).toContain("21.1 km");
    expect(caption).toContain("1:42:15");
    expect(caption).toContain("#running");
    expect(caption).not.toContain("Strava");
  });

  it("switches hashtags for workouts and omits distance", () => {
    const caption = captionFor(FIXTURE_WORKOUT, opts());
    expect(caption).toContain("#workout");
    expect(caption).not.toContain("km");
  });

  it("switches hashtags for rides", () => {
    expect(captionFor({ ...FIXTURE_RUN, sport: "ride" }, opts())).toContain("#cycling");
  });
});
