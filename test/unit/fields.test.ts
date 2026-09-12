// The §4.6 field table — PR-A3.
//
// Two things are pinned here. First, the zone bindings come from the athlete's own zones or
// they do not exist: a design binding {zonePercent.2} renders empty rather than confidently
// wrong. Second, the `hrMax` *binding* survives the rename underneath it — two shipped
// templates print {hrMax} and they mean "the peak this run reached", which is exactly what
// activityHrMax now holds.
import { describe, expect, it } from "vitest";
import { parseHeartRateZones } from "../../src/data/hr";
import { buildFields } from "../../src/model/fields";
import { DEFAULT_OPTS } from "../../src/render.js";
import { FIXTURE_ATHLETE, FIXTURE_RUN } from "../fixtures/activities.js";

const bands = FIXTURE_ATHLETE.hrZones;
const opts = DEFAULT_OPTS as Record<string, unknown>;

/**
 * An easy run: an hour with the whole stream at 120 bpm. Against this athlete's real bands
 * (Z2 is 114-133) that is Z2. Against the peak the demo run happened to reach, 178, it would
 * have been 67 % of "maximum" and reported a zone too high — the §7.4 complaint exactly.
 */
const easyRun = {
  ...FIXTURE_RUN,
  hr: 120,
  hrStream: Array.from({ length: 100 }, () => 120),
  time: 3600,
};

describe("buildFields zone bindings", () => {
  it("leaves every zone binding unset when the athlete's zones are unknown", () => {
    const fields = buildFields(easyRun, opts, null);
    expect(fields["zonePercent.1"]).toBeUndefined();
    expect(fields["zonePercent.2"]).toBeUndefined();
    expect(fields["zoneMinutes.2"]).toBeUndefined();
  });

  it("puts an easy run in Z2, where the athlete's own bands put it", () => {
    const fields = buildFields(easyRun, opts, bands);
    expect(fields["zonePercent.2"]).toBe(100);
    expect(fields["zonePercent.4"]).toBe(0);
    expect(fields["zonePercent.5"]).toBe(0);
  });

  it("reports zone minutes against the activity's duration", () => {
    const fields = buildFields(easyRun, opts, bands);
    expect(fields["zoneMinutes.2"]).toBe(60); // the whole hour, all of it in Z2
  });

  it("splits a mixed stream across the bands it actually spans", () => {
    // 100 -> Z1, 140 -> Z3 (133-152), 160 -> Z4, 175 -> Z5. Nothing in Z2.
    const mixed = { ...easyRun, hrStream: [100, 100, 140, 140, 160, 175] };
    const fields = buildFields(mixed, opts, bands);
    const shares = [1, 2, 3, 4, 5].map((z) => fields[`zonePercent.${z}`]);
    expect(shares).toEqual([33, 0, 33, 17, 17]);
  });

  it("does not derive zones from the activity's own peak", () => {
    // The guard that matters: the activity's peak must make no difference to any zone
    // binding. Only the bands decide. (The {hrMax} display field does differ, and should —
    // that one is the peak, which is the whole point of keeping the two apart.)
    const zoneKeys = (a: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(a).filter(([k]) => k.startsWith("zone")));
    const withPeak = buildFields({ ...easyRun, activityHrMax: 178 }, opts, bands);
    const withoutPeak = buildFields({ ...easyRun, activityHrMax: null }, opts, bands);
    expect(zoneKeys(withPeak)).toEqual(zoneKeys(withoutPeak));
    expect(Object.keys(zoneKeys(withPeak)).length).toBe(10);
    expect(withPeak.hrMax).toBe(178);
    expect(withoutPeak.hrMax).toBeNull();
  });

  it("agrees with the parser on a payload straight from Strava", () => {
    const fromStrava = parseHeartRateZones({
      heart_rate: {
        zones: [
          { min: 0, max: 114 },
          { min: 114, max: 133 },
          { min: 133, max: 152 },
          { min: 152, max: 171 },
          { min: 171, max: -1 },
        ],
      },
    });
    expect(buildFields(easyRun, opts, fromStrava)).toEqual(buildFields(easyRun, opts, bands));
  });
});

describe("buildFields hrMax binding", () => {
  it("binds {hrMax} to the activity's peak, under its new name", () => {
    // The field KEY stays `hrMax` — src/templates/index.ts prints {hrMax} in two designs,
    // and they mean the peak reached on this run. Only the source field was renamed.
    const fields = buildFields({ ...FIXTURE_RUN, activityHrMax: 178 }, opts, bands);
    expect(fields.hrMax).toBe(178);
  });

  it("is null when the activity recorded no peak", () => {
    const fields = buildFields({ ...FIXTURE_RUN, activityHrMax: null }, opts, bands);
    expect(fields.hrMax).toBeNull();
  });
});
