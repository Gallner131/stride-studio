import { describe, expect, it } from "vitest";
// Legacy JS module: types are inferred, not declared, until src/ becomes TypeScript in
// Phases 1-2 (tsconfig has allowJs, checkJs: false).
import { fmtClock, fmtDate, fmtDist, fmtPace, fmtTime } from "../../src/render.js";

/**
 * Spec §12.1: formatters, with the edge cases the spec calls out — sub-minute paces,
 * times over 24 h, zero and negative input.
 *
 * These assert what the LEGACY code actually does, not what v2 should do. Where legacy
 * behaviour is wrong or merely arbitrary, the test says so in a comment rather than
 * asserting an aspiration — a regression suite that encodes wishes fails on day one and
 * gets deleted.
 */

describe("fmtTime", () => {
  it("formats under an hour as m:ss", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(9)).toBe("0:09");
    expect(fmtTime(59)).toBe("0:59");
    expect(fmtTime(60)).toBe("1:00");
    expect(fmtTime(3599)).toBe("59:59");
  });

  it("formats an hour and over as h:mm:ss", () => {
    expect(fmtTime(3600)).toBe("1:00:00");
    expect(fmtTime(3661)).toBe("1:01:01");
    expect(fmtTime(6135)).toBe("1:42:15"); // the demo run
  });

  it("does not wrap past 24 hours", () => {
    expect(fmtTime(90061)).toBe("25:01:01");
  });

  it("clamps negatives to zero and rounds", () => {
    expect(fmtTime(-5)).toBe("0:00");
    expect(fmtTime(59.6)).toBe("1:00");
  });
});

describe("fmtPace", () => {
  it("formats seconds per unit as m:ss", () => {
    expect(fmtPace(291)).toBe("4:51");
    expect(fmtPace(300)).toBe("5:00");
    expect(fmtPace(59)).toBe("0:59");
  });

  // BUG (legacy, unfixed in Phase 0): the minute and second components are derived
  // independently — Math.floor(sec / 60) and Math.round(sec % 60) — so any pace whose
  // seconds part rounds to 60 prints an impossible value. fmtTime avoids this by rounding
  // its input first (render.js:15); fmtPace does not (render.js:19-23).
  //
  // User impact: pace is a continuous value, so roughly 0.8 % of activities (any pace with
  // a fractional seconds part in [59.5, 60)) render as e.g. "4:60 /km".
  //
  // Left broken deliberately: Phase 0 ships pixel-identical to production (§13 Phase 0
  // "Done when"). The fix is a one-line change plus a labelled golden update.
  it("documents the 1:60 bug rather than the correct behaviour", () => {
    expect(fmtPace(119.6)).toBe("1:60");
    expect(fmtPace(59.6)).toBe("0:60");
    expect(fmtPace(299.7)).toBe("4:60");
  });

  it.skip("SHOULD roll 59.5s up to the next minute (fix: round before splitting)", () => {
    expect(fmtPace(119.6)).toBe("2:00");
    expect(fmtPace(59.6)).toBe("1:00");
    expect(fmtPace(299.7)).toBe("5:00");
  });

  it("returns the placeholder for non-finite or non-positive input", () => {
    expect(fmtPace(0)).toBe("--:--");
    expect(fmtPace(-1)).toBe("--:--");
    expect(fmtPace(Number.POSITIVE_INFINITY)).toBe("--:--");
    expect(fmtPace(Number.NaN)).toBe("--:--");
  });
});

describe("fmtDist", () => {
  it("uses fewer decimals as the number grows", () => {
    expect(fmtDist(5.234)).toBe("5.23");
    expect(fmtDist(9.999)).toBe("10.00"); // legacy: chooses the branch before rounding
    expect(fmtDist(21.1)).toBe("21.1");
    expect(fmtDist(99.94)).toBe("99.9");
    expect(fmtDist(100)).toBe("100");
    expect(fmtDist(160.9)).toBe("161");
  });

  it("handles zero", () => {
    expect(fmtDist(0)).toBe("0.00");
  });
});

describe("date formatters", () => {
  const iso = "2026-09-04T06:42:00.000Z";

  it("format the pinned fixture date under a pinned timezone", () => {
    // Node's default locale, TZ=UTC (test/unit/setup.ts). Asserted loosely on purpose:
    // the exact locale string is ICU's business, the DATE is ours.
    expect(fmtDate(iso)).toMatch(/4/);
    expect(fmtDate(iso)).toMatch(/Sep/);
    expect(fmtClock(iso)).toMatch(/06:42|6:42/);
  });

  it("are stable across calls", () => {
    expect(fmtDate(iso)).toBe(fmtDate(iso));
  });

  // BUG (legacy, unfixed in Phase 0): the try/catch around these formatters is dead code
  // for the case it was written for. `new Date("rubbish").toLocaleDateString()` RETURNS the
  // string "Invalid Date"; it does not throw. So a malformed date — from a hand-typed
  // activity (§7.6) or a GPX file with a bad timestamp (§7.3) — prints "Invalid Date" onto
  // the user's design instead of falling back to blank.
  //
  // The fix is a Number.isNaN(d.getTime()) guard, and it belongs with the data layer in
  // Phase 5. Recorded here so it is not rediscovered later.
  it("documents that malformed dates print 'Invalid Date'", () => {
    expect(fmtDate("not a date")).toBe("Invalid Date");
    expect(fmtClock("")).toBe("Invalid Date");
  });

  it.skip("SHOULD return an empty string for a malformed date (fix: guard on NaN time)", () => {
    expect(fmtDate("not a date")).toBe("");
    expect(fmtClock("")).toBe("");
  });
});
