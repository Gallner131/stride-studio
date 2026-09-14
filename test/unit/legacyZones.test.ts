// The legacy renderer's zone maths — §7.4, the last place the original bug was live.
//
// PRs A1-A5 fixed the data-driven engine behind the Designs tab. The Style tab is drawn by
// the switch-case renderer in src/render.js, which kept dividing by the peak of the run
// being drawn — so an easy run still reported as Z4 there, in 27 templates.
//
// src/render.js cannot import src/data/hr.ts: test/golden/harness.html loads it as a raw ES
// module with no bundler in the path, and one import line makes all 354 golden cells time
// out. So the band lookup is duplicated there, deliberately. These tests are what stop the
// duplicate drifting from the original — they run both implementations over the same inputs
// and require identical answers.
import { describe, expect, it } from "vitest";
import { zoneOfBands, zoneSharesFromBands } from "../../src/data/hr";
import { zoneOfBands as legacyZoneOf, zoneSharesFromBands as legacyZoneShares } from "../../src/render.js";
import { FIXTURE_ATHLETE, FIXTURE_RUN } from "../fixtures/activities.js";

const bands = FIXTURE_ATHLETE.hrZones;

describe("the legacy renderer's band lookup matches src/data/hr", () => {
  const samples = [0, 60, 99, 113, 114, 115, 132, 133, 151, 152, 170, 171, 172, 205, 300];

  it("puts every sample in the same zone as the resolver does", () => {
    for (const bpm of samples) {
      expect(legacyZoneOf(bpm, bands), `bpm ${bpm}`).toBe(zoneOfBands(bpm, bands));
    }
  });

  it("computes the same shares over a real stream", () => {
    expect(legacyZoneShares(FIXTURE_RUN.hrStream, bands)).toEqual(
      zoneSharesFromBands(FIXTURE_RUN.hrStream, bands),
    );
  });

  it("has no answer without bands, rather than a wrong one", () => {
    expect(legacyZoneOf(140, [])).toBeNull();
    expect(legacyZoneShares([120, 140], [])).toBeNull();
  });
});

describe("the legacy renderer no longer derives zones from a maximum", () => {
  it("does not export the old max-based helpers", async () => {
    // `zoneOf(bpm, max)` and `zoneShares(stream, max)` were the entry points for the bug.
    // Their absence is the fix; anything still calling them fails to build.
    const render = (await import("../../src/render.js")) as Record<string, unknown>;
    expect(render.zoneOf).toBeUndefined();
    expect(render.zoneShares).toBeUndefined();
  });

  it("puts an easy run in Z2 against the athlete's bands", () => {
    // 120 bpm is Z2 for an athlete whose real maximum is 190. Against this run's own peak
    // of 178 the old code called it Z3, and against a harder run's peak it called it Z4.
    expect(legacyZoneOf(120, bands)).toBe(1);
  });
});
