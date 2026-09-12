import { describe, expect, it } from "vitest";
import { parseHeartRateZones, zoneOfBands } from "../../src/data/stravaZones";

/**
 * §7.4. Reported as "says everything in Z4 and Z5 for a run mainly in Z2 and Z3", and then:
 * "Strava gives you your zones, it doesn't base them off the latest run."
 *
 * Both halves are right. The app was taking Strava's `max_heartrate` — the peak reached
 * DURING THAT RUN — and using it as the zone ceiling, so an easy run peaking at 170 made 175
 * the assumed maximum and a genuine Z2 effort at 140 bpm computed as 80 % and reported as
 * Z4. Every run came out at the top.
 *
 * The answer is not a better estimate. Strava stores the athlete's real zones and serves
 * them from GET /athlete/zones (scope: profile:read_all). We use those, and when we do not
 * have them we show nothing rather than invent a number — a wrong zone is worse than none.
 *
 * The exact nesting is not pinned down in Strava's published reference, so the parser is
 * written to the documented model and is deliberately tolerant: it verifies what it got
 * rather than trusting a shape.
 */

/** The documented shape: Zones { heart_rate: { custom_zones, zones: [{min,max}] } }. */
const documented = {
  heart_rate: {
    custom_zones: true,
    zones: [
      { min: 0, max: 115 },
      { min: 115, max: 152 },
      { min: 152, max: 171 },
      { min: 171, max: 190 },
      { min: 190, max: -1 },
    ],
  },
  power: { zones: [{ min: 0, max: 180 }] },
};

describe("parseHeartRateZones", () => {
  it("reads the documented shape", () => {
    expect(parseHeartRateZones(documented)).toEqual([
      { min: 0, max: 115 },
      { min: 115, max: 152 },
      { min: 152, max: 171 },
      { min: 171, max: 190 },
      { min: 190, max: Number.POSITIVE_INFINITY },
    ]);
  });

  // Strava marks the open-ended top zone with -1. Treating that as a real ceiling would put
  // every hard effort below it and never register Z5.
  it("treats the top zone's -1 as no upper bound", () => {
    const zones = parseHeartRateZones(documented);
    expect(zones?.[4]?.max).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns null rather than guessing when heart rate zones are absent", () => {
    expect(parseHeartRateZones({ power: { zones: [{ min: 0, max: 180 }] } })).toBeNull();
    expect(parseHeartRateZones({ heart_rate: { zones: [] } })).toBeNull();
    expect(parseHeartRateZones({})).toBeNull();
    expect(parseHeartRateZones(null)).toBeNull();
    expect(parseHeartRateZones("nonsense")).toBeNull();
  });

  it("rejects a payload whose bounds are not numbers", () => {
    expect(parseHeartRateZones({ heart_rate: { zones: [{ min: "a", max: "b" }] } })).toBeNull();
  });

  // Defensive: if Strava ever returns the list unwrapped, or labelled by type, still read it.
  it("also reads a bare list and a type-labelled list", () => {
    const bare = [
      { min: 0, max: 120 },
      { min: 120, max: 200 },
    ];
    expect(parseHeartRateZones(bare)).toHaveLength(2);
    expect(parseHeartRateZones([{ type: "heartrate", zones: bare }])).toHaveLength(2);
  });
});

describe("zoneOfBands", () => {
  const bands = parseHeartRateZones(documented) ?? [];

  it("puts an easy run where it belongs", () => {
    // 140 bpm sits in the second band, 115–152 — Z2, not Z4.
    expect(zoneOfBands(140, bands)).toBe(1);
  });

  it("places every band boundary on the expected side", () => {
    expect(zoneOfBands(0, bands)).toBe(0);
    expect(zoneOfBands(115, bands)).toBe(1);
    expect(zoneOfBands(152, bands)).toBe(2);
    expect(zoneOfBands(171, bands)).toBe(3);
    expect(zoneOfBands(190, bands)).toBe(4);
    expect(zoneOfBands(205, bands)).toBe(4);
  });

  it("has no answer without bands, rather than a wrong one", () => {
    expect(zoneOfBands(140, [])).toBeNull();
  });
});
