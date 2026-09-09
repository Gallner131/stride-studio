import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  haversine,
  importedToActivity,
  parseGpx,
  parseTcx,
  parseTrackFile,
  sportFromType,
} from "../../src/data/gpx";

/**
 * §7.3 file import. The parsers use DOMParser, which Node does not have, so these run
 * against a minimal shim rather than pulling in jsdom for two DOM APIs.
 */

const read = (name: string) => readFileSync(resolve(import.meta.dirname, "../fixtures/tracks", name), "utf8");

beforeAll(async () => {
  if (typeof globalThis.DOMParser === "undefined") {
    const { JSDOM } = await import("jsdom");
    globalThis.DOMParser = new JSDOM().window.DOMParser as unknown as typeof DOMParser;
  }
});

describe("haversine", () => {
  it("measures a known distance", () => {
    // One degree of latitude is about 111 km.
    expect(haversine([51, 0], [52, 0])).toBeGreaterThan(111_000);
    expect(haversine([51, 0], [52, 0])).toBeLessThan(112_000);
  });

  it("is zero for the same point", () => {
    expect(haversine([51.5, -0.1], [51.5, -0.1])).toBe(0);
  });
});

describe("sportFromType", () => {
  it("maps the strings exporters actually write", () => {
    expect(sportFromType("running")).toBe("run");
    expect(sportFromType("Trail Running")).toBe("trailrun");
    expect(sportFromType("Biking")).toBe("ride");
    expect(sportFromType("cycling")).toBe("ride");
    expect(sportFromType("Open Water Swimming")).toBe("swim");
    expect(sportFromType("Hiking")).toBe("hike");
    expect(sportFromType("Walking")).toBe("walk");
    expect(sportFromType("StrengthTraining")).toBe("workout");
  });

  it("falls back to run rather than 'other', which is the common case", () => {
    expect(sportFromType(null)).toBe("run");
    expect(sportFromType("")).toBe("run");
    expect(sportFromType("something new")).toBe("run");
  });
});

describe("parseGpx", () => {
  const parsed = () => parseGpx(read("run.gpx"));

  it("reads the metadata", () => {
    const a = parsed();
    expect(a).not.toBeNull();
    expect(a?.name).toBe("Thursday tempo");
    expect(a?.sport).toBe("run");
    expect(a?.source).toBe("gpx");
    expect(a?.date).toBe("2026-09-04T06:42:00.000Z");
  });

  it("computes distance from the trackpoints", () => {
    const a = parsed();
    // The fixture is a 5 km out-and-back at about 6:00/km.
    expect(a?.distance).toBeGreaterThan(4500);
    expect(a?.distance).toBeLessThan(5500);
  });

  it("computes moving time, and elapsed separately", () => {
    const a = parsed();
    // 300 points at 6s intervals = 1800s elapsed.
    expect(a?.elapsed).toBe(1800);
    expect(a?.time).toBeGreaterThan(0);
    expect(a?.time).toBeLessThanOrEqual(1800);
  });

  it("reads heart rate out of the Garmin extension namespace", () => {
    const a = parsed();
    expect(a?.hr).toBeGreaterThan(100);
    expect(a?.hrMax).toBeGreaterThan(a?.hr ?? 0);
    expect(a?.hrStream.length).toBeGreaterThan(50);
  });

  it("smooths elevation instead of summing GPS noise", () => {
    const a = parsed();
    // The fixture climbs about 45 m with +/-1.2 m of noise on 300 points. Naive summing of
    // positive deltas would report several hundred metres.
    expect(a?.elevation).toBeGreaterThan(20);
    expect(a?.elevation).toBeLessThan(120);
  });

  it("produces per-kilometre splits", () => {
    const a = parsed();
    expect(a?.splits.length).toBeGreaterThanOrEqual(4);
    for (const s of a?.splits ?? []) {
      // Around 360 s/km for this fixture; the bounds catch a unit or interpolation error.
      expect(s).toBeGreaterThan(200);
      expect(s).toBeLessThan(600);
    }
  });

  it("thins the route so the renderer is not projecting thousands of points", () => {
    const a = parsed();
    expect(a?.route.length).toBeGreaterThan(50);
    expect(a?.route.length).toBeLessThanOrEqual(600);
  });

  it("reports nothing wrong with a complete file", () => {
    expect(parsed()?.problems).toEqual([]);
  });
});

describe("parseTcx", () => {
  it("prefers the file's own cumulative distance", () => {
    const gpx = parseGpx(read("run.gpx"));
    const tcx = parseTcx(read("run.tcx"));
    expect(tcx).not.toBeNull();
    expect(tcx?.source).toBe("tcx");
    // Same track, so the two should agree closely.
    expect(Math.abs((tcx?.distance ?? 0) - (gpx?.distance ?? 0))).toBeLessThan(50);
  });

  it("reads calories and heart rate", () => {
    const a = parseTcx(read("run.tcx"));
    expect(a?.calories).toBe(412);
    expect(a?.hr).toBeGreaterThan(100);
  });
});

describe("problem reporting rather than silent gaps", () => {
  it("says what a treadmill export is missing", () => {
    const a = parseGpx(read("no-gps.gpx"));
    expect(a).not.toBeNull();
    const problems = (a?.problems ?? []).join(" ");
    expect(problems).toContain("elevation");
    expect(problems).toContain("heart rate");
  });

  it("does not report a route for trackpoints pinned at one fix", () => {
    // Indoor exports commonly write 0,0 for every point. Treating that as GPS would offer
    // the Map designs and then draw a dot.
    const a = parseGpx(read("no-gps.gpx"));
    expect(a?.route).toEqual([]);
    expect((a?.problems ?? []).join(" ")).toContain("do not move");
  });

  it("returns null for a file it cannot read at all", () => {
    expect(parseGpx(read("broken.gpx"))).toBeNull();
    expect(parseTrackFile(read("broken.gpx"), "broken.gpx")).toBeNull();
  });
});

describe("parseTrackFile", () => {
  it("dispatches on the extension", () => {
    expect(parseTrackFile(read("run.gpx"), "run.gpx")?.source).toBe("gpx");
    expect(parseTrackFile(read("run.tcx"), "run.tcx")?.source).toBe("tcx");
  });

  it("sniffs the content when the extension is unhelpful", () => {
    expect(parseTrackFile(read("run.tcx"), "export.dat")?.source).toBe("tcx");
    expect(parseTrackFile(read("run.gpx"), "export.dat")?.source).toBe("gpx");
  });
});

describe("importedToActivity", () => {
  it("maps onto the shape the renderer already understands", () => {
    const imported = parseGpx(read("run.gpx"));
    if (!imported) throw new Error("fixture failed to parse");
    const act = importedToActivity(imported);
    expect(act.sport).toBe("run");
    expect(act.name).toBe("Thursday tempo");
    expect(act.route).toBe(imported.route);
    expect(act.splits).toBe(imported.splits);
    // Max HR gets 5 bpm of headroom, so zone maths does not peg the top zone.
    expect(act.hrMax).toBe((imported.hrMax ?? 0) + 5);
  });
});
