import { describe, expect, it } from "vitest";
import {
  deriveHyrox,
  formatTime,
  HYROX_STATIONS,
  hyroxFields,
  hyroxToActivity,
  parseHyroxPaste,
  parseTime,
} from "../../src/model/hyrox";

/**
 * The paste parser is the whole HYROX input path, so it is tested against the shapes a real
 * copy produces — including the messy ones: cumulative columns, localised labels, missing
 * stations, and a table with no finish row.
 */

/** A clean English paste, roughly what the results portal renders. */
const CLEAN = `
HYROX London 2026
Open Men 30-34
Running 1 00:04:52
1000m SkiErg 00:04:21
Running 2 00:05:10
50m Sled Push 00:02:48
Running 3 00:05:22
50m Sled Pull 00:03:41
Running 4 00:05:31
80m Burpee Broad Jump 00:05:02
Running 5 00:05:40
1000m Row 00:04:12
Running 6 00:05:35
200m Farmers Carry 00:02:31
Running 7 00:05:44
100m Sandbag Lunges 00:04:18
Running 8 00:05:12
Wall Balls 00:06:44
Roxzone 00:06:12
Overall 01:22:55
`;

describe("parseTime", () => {
  it("reads mm:ss and hh:mm:ss", () => {
    expect(parseTime("4:52")).toBe(292);
    expect(parseTime("00:04:52")).toBe(292);
    expect(parseTime("1:22:35")).toBe(4955);
  });

  it("takes the first time on a line and ignores the rest", () => {
    expect(parseTime("Running 1 00:04:52 00:04:52 12")).toBe(292);
  });

  it("returns null when there is no time", () => {
    expect(parseTime("Wall Balls")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
});

describe("parseHyroxPaste — a clean paste", () => {
  const { result, problems, segmentsFound } = parseHyroxPaste(CLEAN);

  it("finds all sixteen segments", () => {
    expect(segmentsFound).toBe(16);
    expect(problems).toEqual([]);
    expect(result).not.toBeNull();
    expect(result?.runs).toHaveLength(8);
    expect(result?.stations).toHaveLength(8);
  });

  it("reads the metadata", () => {
    expect(result?.event).toContain("HYROX London");
    expect(result?.division).toBe("open");
    expect(result?.ageGroup).toBe("30-34");
    expect(result?.totalSeconds).toBe(4975);
    expect(result?.roxzoneSeconds).toBe(372);
  });

  it("keeps the stations in race order, not paste order", () => {
    expect(result?.stations.map((s) => s.stationId)).toEqual([
      "skierg",
      "sledPush",
      "sledPull",
      "burpees",
      "row",
      "carry",
      "lunges",
      "wallBalls",
    ]);
  });

  it("does not confuse sled push with sled pull", () => {
    const push = result?.stations.find((s) => s.stationId === "sledPush");
    const pull = result?.stations.find((s) => s.stationId === "sledPull");
    expect(push?.seconds).toBe(168);
    expect(pull?.seconds).toBe(221);
  });
});

describe("parseHyroxPaste — messy pastes", () => {
  it("handles 'Run 1' as well as 'Running 1'", () => {
    const { result } = parseHyroxPaste("Run 1 4:52\nRun 2 5:10\n1000m SkiErg 4:21\nOverall 20:00");
    expect(result?.runs.map((r) => r.order)).toEqual([1, 2]);
  });

  it("handles a leading index, e.g. '3. Running'", () => {
    const { result } = parseHyroxPaste("3. Running 5:22\nWall Balls 6:44\nTotal 20:00");
    expect(result?.runs[0]?.order).toBe(3);
  });

  it("ignores a trailing cumulative column", () => {
    const { result } = parseHyroxPaste(
      "Running 1 00:04:52 00:04:52\n1000m Row 00:04:12 00:09:04\nOverall 20:00",
    );
    expect(result?.runs[0]?.seconds).toBe(292);
    expect(result?.stations[0]?.seconds).toBe(252);
  });

  it("detects the Pro division", () => {
    const { result } = parseHyroxPaste("HYROX Pro Men\nWall Balls 6:44\nOverall 1:10:00");
    expect(result?.division).toBe("pro");
  });

  it("reports which stations are missing rather than inventing them", () => {
    const { result, problems } = parseHyroxPaste("Running 1 4:52\n1000m SkiErg 4:21\nOverall 20:00");
    expect(result?.stations).toHaveLength(1);
    expect(problems.join(" ")).toContain("Missing 7 stations");
    expect(problems.join(" ")).toContain("Sled Push");
  });

  it("adds up a total when the paste has no finish row, and says so", () => {
    const noTotal = CLEAN.replace(/Overall.*\n/, "");
    const { result, problems } = parseHyroxPaste(noTotal);
    // 8 runs + 8 stations + roxzone
    expect(result?.totalSeconds).toBe(4975);
    expect(problems.join(" ")).toContain("added up from the splits");
  });

  it("refuses an empty or irrelevant paste instead of returning a hollow result", () => {
    expect(parseHyroxPaste("").result).toBeNull();
    expect(parseHyroxPaste("just some words\nand more words").result).toBeNull();
  });
});

describe("deriveHyrox", () => {
  const result = parseHyroxPaste(CLEAN).result;
  if (!result) throw new Error("fixture failed to parse");
  const d = deriveHyrox(result);

  it("splits the race into running, stations and roxzone", () => {
    expect(d.runSeconds).toBe(2586); // 43:06
    expect(d.stationSeconds).toBe(2017); // 33:37
    expect(d.roxzoneSeconds).toBe(372);
    expect(d.runSeconds + d.stationSeconds + d.roxzoneSeconds).toBe(d.totalSeconds);
  });

  it("reports roxzone as a share, which is the comparable form", () => {
    // Absolute roxzone is venue-dependent, so the share is what can be compared.
    expect(d.roxzoneShare).toBeCloseTo(372 / 4975, 6);
    expect(Math.round(d.roxzoneShare * 1000) / 10).toBe(7.5);
  });

  it("finds the best and worst segments", () => {
    expect(d.fastestRun?.seconds).toBe(292);
    expect(d.slowestRun?.seconds).toBe(344);
    expect(d.fastestStation?.label).toBe("Farmers");
    expect(d.slowestStation?.label).toBe("Wall Balls");
  });

  it("infers roxzone when the result does not report it", () => {
    const withoutRoxzone = { ...result, roxzoneSeconds: undefined };
    expect(deriveHyrox(withoutRoxzone).roxzoneSeconds).toBe(372);
  });

  it("knows when a result is incomplete", () => {
    expect(d.complete).toBe(true);
    expect(deriveHyrox({ ...result, stations: result.stations.slice(0, 4) }).complete).toBe(false);
  });
});

describe("hyroxFields", () => {
  const result = parseHyroxPaste(CLEAN).result;
  if (!result) throw new Error("fixture failed to parse");
  const f = hyroxFields(result);

  it("exposes bindable fields for text layers", () => {
    expect(f.hyroxTotal).toBe("1:22:55");
    expect(f.roxzone).toBe("6:12");
    expect(f.roxzonePercent).toBe(7.5);
    expect(f.hyroxDivision).toBe("Open");
    expect(f.slowestStation).toBe("Wall Balls");
  });

  it("exposes each station and run individually", () => {
    expect(f["station.wallBalls"]).toBe("6:44");
    expect(f["station.sledPush"]).toBe("2:48");
    expect(f["run.1"]).toBe("4:52");
    expect(f["run.8"]).toBe("5:12");
  });
});

describe("hyroxToActivity", () => {
  const result = parseHyroxPaste(CLEAN).result;
  if (!result) throw new Error("fixture failed to parse");
  const act = hyroxToActivity(result);

  it("maps onto the legacy activity shape so existing templates still work", () => {
    expect(act.sport).toBe("workout");
    expect(act.subtype).toBe("HYROX");
    expect(act.time).toBe(4975);
    expect((act.splits as number[]).length).toBe(8);
  });

  it("reports no distance, so no template can print a misleading pace", () => {
    // The race contains 8 km of running, but pairing that distance with the FINISH time
    // would yield ~8:40/km when the real run pace is ~4:19/km. The legacy model has only
    // one (distance, time) pair, so it gets none rather than a wrong one.
    expect(act.distance).toBe(0);
  });

  it("exposes the true run pace as a binding instead", () => {
    // 2586 s over 8 km = 323.25 s/km.
    expect(hyroxFields(result).runPace).toBe("5:23 /km");
    expect(hyroxFields(result).runDistance).toBe(8);
  });
});

describe("station definitions", () => {
  it("has eight stations in race order with unique ids", () => {
    expect(HYROX_STATIONS).toHaveLength(8);
    expect(HYROX_STATIONS.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(HYROX_STATIONS.map((s) => s.id)).size).toBe(8);
  });
});

describe("formatTime", () => {
  it("drops the hour when there is none", () => {
    expect(formatTime(292)).toBe("4:52");
    expect(formatTime(4955)).toBe("1:22:35");
    expect(formatTime(0)).toBe("0:00");
  });
});
