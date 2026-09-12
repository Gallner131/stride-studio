// Charts and the athlete's zones — §7.4, PR-A2.
//
// Three rules are pinned here, each of which the engine broke in a different way:
//
//   1. A zone band is drawn where the athlete's zones actually are, never at a percentage
//      of a number that happens to be lying around.
//   2. When the zones are unknown, nothing is drawn and nothing is written. The canvas is
//      the exported artwork — an explanation painted onto it ships inside someone's story.
//   3. The rings' "how hard was this" fraction needs the athlete's maximum. There is no
//      nominal 190 to fall back on, so without one the ring stays empty.
import { describe, expect, it, vi } from "vitest";
import type { ChartData, ChartStyle } from "../../src/engine/chartLayers";
import { chartHasData, DEFAULT_CHART_STYLE, drawChart } from "../../src/engine/chartLayers";
import { FIXTURE_ATHLETE } from "../fixtures/activities.js";

const zones = FIXTURE_ATHLETE.hrZones;
const style: ChartStyle = DEFAULT_CHART_STYLE;

/** A rising stream that spans several of the fixture athlete's zones. */
const stream = Array.from({ length: 40 }, (_, i) => 100 + i * 2);

function mockCtx() {
  const arcs: number[][] = [];
  const rects: number[][] = [];
  const texts: string[] = [];
  const ctx = {
    canvas: { width: 400, height: 200 },
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "",
    shadowBlur: 0,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 20 })),
    arc: vi.fn((...a: number[]) => void arcs.push(a)),
    fillRect: vi.fn((...a: number[]) => void rects.push(a)),
    strokeRect: vi.fn(),
    rect: vi.fn(),
    arcTo: vi.fn(),
    fillText: vi.fn((t: string) => void texts.push(t)),
    strokeText: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, arcs, rects, texts };
}

const opts = (extra: Record<string, unknown> = {}) => ({ progress: 1, ...extra }) as never;

describe("chartHasData for zone-dependent charts", () => {
  const withHrStream: ChartData = { hr: stream };

  it("returns false for kind='zones' when zones are absent", () => {
    expect(chartHasData("zones", withHrStream)).toBe(false);
  });

  it("returns true for kind='zones' when zones are present", () => {
    expect(chartHasData("zones", { ...withHrStream, zones })).toBe(true);
  });

  it("still returns true for kind='hr' regardless of zones", () => {
    expect(chartHasData("hr", withHrStream)).toBe(true);
  });
});

describe("drawZones without zones", () => {
  it("paints nothing at all — no bars, no explanatory text", () => {
    // Rule 2. A "set your max HR" message here would be rendered into the PNG export.
    const { ctx, rects, texts } = mockCtx();
    drawChart(ctx, "zones", { hr: stream }, 400, 200, style, opts());
    expect(texts).toEqual([]);
    expect(rects).toEqual([]);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it("draws the bars once the zones are known", () => {
    // The bars are rounded rects, so they arrive as arcTo paths and fills, not fillRect.
    const { ctx } = mockCtx();
    drawChart(ctx, "zones", { hr: stream, zones }, 400, 200, style, opts());
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe("drawHr zone bands", () => {
  it("draws no bands when the zones are unknown, but still draws the trace", () => {
    // The old code derived bands from `max(stream) + 5`, so it always drew five of them,
    // always in the wrong place. Nothing is a better answer than something invented.
    const { ctx, rects, texts } = mockCtx();
    drawChart(ctx, "hr", { hr: stream }, 400, 200, style, opts({ bands: true }));
    expect(rects).toEqual([]);
    expect(texts).toEqual([]);
    expect(ctx.stroke).toHaveBeenCalled(); // the trace itself is still there
  });

  it("draws bands at the athlete's real band edges", () => {
    const { ctx, rects } = mockCtx();
    drawChart(ctx, "hr", { hr: stream, zones }, 400, 200, style, opts({ bands: true }));
    expect(rects.length).toBeGreaterThan(0);

    // The stream spans 100..178. Of the fixture athlete's five bands only those overlapping
    // that range should be painted, and every painted band must lie inside the plot.
    for (const [x, y, rectW, rectH] of rects) {
      expect(x).toBe(0);
      expect(rectW).toBe(400);
      expect(y).toBeGreaterThanOrEqual(0);
      expect((y ?? 0) + (rectH ?? 0)).toBeLessThanOrEqual(200.001);
    }
  });

  it("places the bands differently for two athletes with different zones", () => {
    // The real regression guard: if band geometry still came from the stream's own peak,
    // these two would be identical.
    const shifted = zones.map((b) => ({
      min: b.min === 0 ? 0 : b.min - 20,
      max: Number.isFinite(b.max) ? b.max - 20 : b.max,
    }));
    const a = mockCtx();
    const b = mockCtx();
    drawChart(a.ctx, "hr", { hr: stream, zones }, 400, 200, style, opts({ bands: true }));
    drawChart(b.ctx, "hr", { hr: stream, zones: shifted }, 400, 200, style, opts({ bands: true }));
    expect(a.rects).not.toEqual(b.rects);
  });
});

describe("drawRings avg-HR arc", () => {
  const base: ChartData = { avgHr: 150, effort: 60, durationSeconds: 1800 };

  it("leaves the arc empty when the athlete's maximum is unknown", () => {
    // Rule 3. The old code divided by `data.hrMax ?? 190` — this run's peak, or a number
    // nobody measured. An empty ring says "we know the average, not what fraction it is".
    const { ctx, arcs } = mockCtx();
    drawChart(ctx, "rings", base, 300, 300, style, opts({ metrics: ["hr"] }));
    const swept = arcs.filter((a) => a[3] !== 0 || a[4] !== Math.PI * 2);
    for (const arc of swept) expect(arc[4]).toBe(arc[3]);
  });

  it("sweeps the arc once the athlete's maximum is known", () => {
    const { ctx, arcs } = mockCtx();
    drawChart(ctx, "rings", { ...base, athleteHrMax: 190 }, 300, 300, style, opts({ metrics: ["hr"] }));
    const swept = arcs.filter((a) => a[3] !== 0 || a[4] !== Math.PI * 2);
    expect(swept.some((arc) => arc[4] !== arc[3])).toBe(true);
  });

  it("sweeps by a different amount for a different maximum", () => {
    const a = mockCtx();
    const b = mockCtx();
    drawChart(a.ctx, "rings", { ...base, athleteHrMax: 190 }, 300, 300, style, opts({ metrics: ["hr"] }));
    drawChart(b.ctx, "rings", { ...base, athleteHrMax: 210 }, 300, 300, style, opts({ metrics: ["hr"] }));
    expect(a.arcs).not.toEqual(b.arcs);
  });
});
