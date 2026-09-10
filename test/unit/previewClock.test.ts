import { describe, expect, it } from "vitest";
import { previewSettled, previewT } from "../../src/editor/previewClock";
import { ANIM_SECONDS } from "../../src/render.js";

// The editing canvas used to run `(elapsed % cycle) / ANIM_SECONDS`, so the hero count-up
// replayed every 8.5 s forever. Screenshots taken seconds apart showed 21.1, then 17.0, then
// 12.3 km for the same activity, which reads as unstable data rather than an animation and
// breaks "what you see is what you export". The preview now plays once and holds.
describe("previewT", () => {
  it("starts at zero", () => {
    expect(previewT(0, ANIM_SECONDS)).toBe(0);
  });

  it("runs linearly through the animation window", () => {
    expect(previewT(3, 6)).toBeCloseTo(0.5);
  });

  it("reaches the settled state exactly at the end of the window", () => {
    expect(previewT(6, 6)).toBe(1);
  });

  it("holds at the settled state past the end of the old replay cycle", () => {
    // The old cycle was ANIM_SECONDS + 2.5 = 8.5 s. This is the regression that mattered.
    expect(previewT(8.5, 6)).toBe(1);
  });

  it("is still settled after thirty seconds of no interaction", () => {
    expect(previewT(30, 6)).toBe(1);
  });

  it("never returns a value outside 0..1, whatever the clock says", () => {
    expect(previewT(-5, 6)).toBe(0);
    expect(previewT(Number.POSITIVE_INFINITY, 6)).toBe(1);
    expect(previewT(Number.NaN, 6)).toBe(1);
    expect(previewT(1, 0)).toBe(1);
  });
});

describe("previewSettled", () => {
  it("is false while the animation is still running", () => {
    expect(previewSettled(0, 6)).toBe(false);
    expect(previewSettled(5.9, 6)).toBe(false);
  });

  // The render loop asks this so it can stop calling requestAnimationFrame once nothing
  // moves. A phone should not burn a core redrawing an identical frame forever.
  it("is true once the animation has finished", () => {
    expect(previewSettled(6, 6)).toBe(true);
    expect(previewSettled(30, 6)).toBe(true);
  });
});
