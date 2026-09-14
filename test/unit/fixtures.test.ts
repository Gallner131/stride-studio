// Fixture contract for the HR zone resolver (§7.4, PR-A0).
//
// These assertions exist to hold one distinction that the codebase spent its whole life
// losing: the peak heart rate reached during a run is not the athlete's maximum. The
// fixtures now carry both, under names that cannot be confused, and the resolver work in
// A1-A5 is built on top of that separation.
import { describe, expect, it } from "vitest";
import { FIXTURE_ATHLETE, FIXTURE_RUN, FIXTURE_SESSION, FIXTURE_WORKOUT } from "../fixtures/activities.js";

describe("fixtures", () => {
  it("FIXTURE_RUN carries the peak this run reached", () => {
    expect(FIXTURE_RUN.activityHrMax).toBe(178);
  });

  it("FIXTURE_WORKOUT carries the peak that workout reached", () => {
    expect(FIXTURE_WORKOUT.activityHrMax).toBe(171);
  });

  it("the deprecated hrMax alias is gone, so nothing can quietly read it again", () => {
    expect("hrMax" in FIXTURE_RUN).toBe(false);
    expect("hrMax" in FIXTURE_WORKOUT).toBe(false);
  });

  it("FIXTURE_ATHLETE carries five Strava-shaped bands", () => {
    // Conflict 1, settled in PR-A1: bands, not a tuple of lower bounds. Z1 starts at 0
    // and Z5 has no ceiling, because that is what GET /athlete/zones actually returns.
    const bands = FIXTURE_ATHLETE.hrZones;
    expect(bands).toHaveLength(5);
    expect(bands.map((b) => b.min)).toEqual([0, 114, 133, 152, 171]);
    expect(bands.map((b) => b.max)).toEqual([114, 133, 152, 171, Number.POSITIVE_INFINITY]);
  });

  it("the athlete's bands are contiguous — no gap for a reading to fall through", () => {
    const bands = FIXTURE_ATHLETE.hrZones;
    expect(bands.slice(1).map((b) => b.min)).toEqual(bands.slice(0, -1).map((b) => b.max));
  });

  it("the athlete's maximum is not any activity's peak", () => {
    // The whole bug in one assertion: 190 is the athlete, 178 is what this run reached.
    expect(FIXTURE_ATHLETE.hrMax).toBe(190);
    expect(FIXTURE_RUN.activityHrMax).toBe(178);
    expect(FIXTURE_ATHLETE.hrMax).toBeGreaterThan(FIXTURE_RUN.activityHrMax);
  });

  it("FIXTURE_SESSION bundles activity + athlete", () => {
    expect(FIXTURE_SESSION.activity).toBe(FIXTURE_RUN);
    expect(FIXTURE_SESSION.athlete).toBe(FIXTURE_ATHLETE);
  });
});
