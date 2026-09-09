// HYROX visuals.
//
// Three layer types, each answering a question the eight-station format actually raises and
// that no existing template can express:
//
//   hyroxBreakdown — where did the time go? Running vs stations vs roxzone, as one bar.
//   hyroxStations  — which station cost you? Eight bars, slowest marked.
//   hyroxSplits    — the full 16-segment table, run and station side by side.
//
// Roxzone is shown as a share as well as a time, because absolute roxzone is not comparable
// between events: transition distances differ by venue.
import type { HyroxResult, HyroxStationId } from "../model/hyrox";
import { deriveHyrox, formatTime, HYROX_STATIONS } from "../model/hyrox";

export interface HyroxStyle {
  /** Running segments. */
  run: string;
  /** Station segments. */
  station: string;
  /** Roxzone / transitions. */
  roxzone: string;
  text: string;
  muted: string;
  font: string;
  monoFont: string;
}

export const DEFAULT_HYROX_STYLE: HyroxStyle = {
  run: "#5AC8FA",
  station: "#D8FF3A",
  roxzone: "#FF5A5F",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.66)",
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  monoFont: '"SF Mono", Menlo, Consolas, "Courier New", monospace',
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

// ---------------------------------------------------------------- breakdown

export interface BreakdownOptions {
  showLegend: boolean;
  showTimes: boolean;
  /** 0..1 draw-on progress. */
  progress: number;
}

/**
 * One stacked bar: running | stations | roxzone. The single most useful HYROX graphic,
 * because the run/station balance is the thing athletes actually argue about.
 */
export function drawHyroxBreakdown(
  ctx: CanvasRenderingContext2D,
  result: HyroxResult,
  w: number,
  h: number,
  style: HyroxStyle,
  options: BreakdownOptions,
): void {
  const d = deriveHyrox(result);
  if (d.totalSeconds <= 0) return;

  const barH = options.showLegend ? Math.min(h * 0.42, 84) : h;
  const p = Math.max(0, Math.min(1, options.progress));

  const parts = [
    { label: "Running", seconds: d.runSeconds, color: style.run },
    { label: "Stations", seconds: d.stationSeconds, color: style.station },
    { label: "Roxzone", seconds: d.roxzoneSeconds, color: style.roxzone },
  ].filter((part) => part.seconds > 0);

  // Bar
  let x = 0;
  ctx.save();
  roundRect(ctx, 0, 0, w, barH, barH / 2);
  ctx.clip();
  for (const part of parts) {
    const width = (part.seconds / d.totalSeconds) * w * p;
    ctx.fillStyle = part.color;
    ctx.fillRect(x, 0, width, barH);
    x += width;
  }
  ctx.restore();

  // In-bar labels, only where the segment is wide enough to hold one.
  if (options.showTimes) {
    let lx = 0;
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(barH * 0.34)}px ${style.font}`;
    for (const part of parts) {
      const width = (part.seconds / d.totalSeconds) * w * p;
      const label = formatTime(part.seconds);
      if (ctx.measureText(label).width + 24 < width) {
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.textAlign = "center";
        ctx.fillText(label, lx + width / 2, barH / 2);
      }
      lx += width;
    }
  }

  if (!options.showLegend) return;

  // Legend: swatch, label, time, share.
  const gap = 16;
  const colW = (w - gap * (parts.length - 1)) / parts.length;
  const top = barH + Math.min(28, h * 0.12);
  ctx.textBaseline = "alphabetic";

  parts.forEach((part, i) => {
    const cx = i * (colW + gap);
    const share = Math.round((part.seconds / d.totalSeconds) * 1000) / 10;

    ctx.fillStyle = part.color;
    roundRect(ctx, cx, top, 22, 22, 6);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = style.muted;
    ctx.font = `600 ${Math.round(barH * 0.26)}px ${style.font}`;
    ctx.fillText(part.label, cx + 30, top + 18);

    ctx.fillStyle = style.text;
    ctx.font = `800 ${Math.round(barH * 0.4)}px ${style.font}`;
    ctx.fillText(formatTime(part.seconds), cx, top + 18 + barH * 0.5);

    ctx.fillStyle = style.muted;
    ctx.font = `600 ${Math.round(barH * 0.24)}px ${style.font}`;
    ctx.fillText(`${share}%`, cx, top + 18 + barH * 0.5 + barH * 0.3);
  });
}

// ---------------------------------------------------------------- stations

export interface StationsOptions {
  /** Highlight the slowest station — usually the point of the graphic. */
  markSlowest: boolean;
  showTimes: boolean;
  /** Optional comparison times per station, e.g. a division median. */
  compare?: Partial<Record<HyroxStationId, number>>;
  compareLabel?: string;
  progress: number;
}

/** Eight horizontal bars, one per station, in race order. */
export function drawHyroxStations(
  ctx: CanvasRenderingContext2D,
  result: HyroxResult,
  w: number,
  h: number,
  style: HyroxStyle,
  options: StationsOptions,
): void {
  const d = deriveHyrox(result);
  const series = d.stationSeries;
  if (series.length === 0) return;

  const rowH = h / series.length;
  const barH = Math.min(rowH * 0.62, 46);
  const labelW = Math.min(w * 0.3, 190);
  const timeW = options.showTimes ? Math.min(w * 0.16, 110) : 0;
  const trackW = Math.max(20, w - labelW - timeW - 20);

  const max = Math.max(
    ...series.map((s) => s.seconds),
    ...(options.compare ? Object.values(options.compare).map((v) => v ?? 0) : [0]),
  );
  const slowest = d.slowestStation?.stationId;
  const p = Math.max(0, Math.min(1, options.progress));

  series.forEach((s, i) => {
    const y = i * rowH + (rowH - barH) / 2;
    const isSlowest = options.markSlowest && s.id === slowest;

    // Label
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isSlowest ? style.text : style.muted;
    ctx.font = `${isSlowest ? 700 : 600} ${Math.round(barH * 0.44)}px ${style.font}`;
    ctx.fillText(s.label, 0, y + barH / 2);

    // Track
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRect(ctx, labelW, y, trackW, barH, barH / 2);
    ctx.fill();

    // Comparison marker, drawn behind the bar.
    const cmp = options.compare?.[s.id];
    if (cmp && max > 0) {
      const cx = labelW + (cmp / max) * trackW;
      ctx.save();
      ctx.strokeStyle = style.muted;
      ctx.lineWidth = Math.max(2, barH * 0.06);
      ctx.setLineDash([barH * 0.18, barH * 0.14]);
      ctx.beginPath();
      ctx.moveTo(cx, y - barH * 0.12);
      ctx.lineTo(cx, y + barH * 1.12);
      ctx.stroke();
      ctx.restore();
    }

    // Bar, staggered so it grows in sequence.
    const reveal = Math.max(0, Math.min(1, p * series.length * 1.25 - i));
    const width = max > 0 ? (s.seconds / max) * trackW * reveal : 0;
    ctx.fillStyle = isSlowest ? style.roxzone : style.station;
    roundRect(ctx, labelW, y, Math.max(barH * 0.6, width), barH, barH / 2);
    ctx.fill();

    if (options.showTimes && reveal >= 1) {
      ctx.textAlign = "right";
      ctx.fillStyle = style.text;
      ctx.font = `700 ${Math.round(barH * 0.46)}px ${style.monoFont}`;
      ctx.fillText(formatTime(s.seconds), w, y + barH / 2);
    }
  });
}

// ---------------------------------------------------------------- splits table

export interface SplitsOptions {
  /** Interleave run and station as they happened, rather than grouping. */
  interleave: boolean;
  showRoxzone: boolean;
  progress: number;
}

/** The full 16-segment table: run then station, in race order. */
export function drawHyroxSplits(
  ctx: CanvasRenderingContext2D,
  result: HyroxResult,
  w: number,
  h: number,
  style: HyroxStyle,
  options: SplitsOptions,
): void {
  const d = deriveHyrox(result);

  interface Row {
    label: string;
    time: string;
    color: string;
  }
  const rows: Row[] = [];

  if (options.interleave) {
    const maxPairs = Math.max(result.runs.length, result.stations.length);
    for (let i = 0; i < maxPairs; i++) {
      const run = result.runs.find((r) => r.order === i + 1);
      const station = result.stations.find((s) => s.order === i + 1);
      if (run) rows.push({ label: `Run ${run.order}`, time: formatTime(run.seconds), color: style.run });
      if (station)
        rows.push({ label: station.label, time: formatTime(station.seconds), color: style.station });
    }
  } else {
    for (const r of [...result.runs].sort((a, b) => a.order - b.order)) {
      rows.push({ label: `Run ${r.order}`, time: formatTime(r.seconds), color: style.run });
    }
    for (const s of d.stationSeries) {
      rows.push({ label: s.label, time: formatTime(s.seconds), color: style.station });
    }
  }

  if (options.showRoxzone && d.roxzoneSeconds > 0) {
    rows.push({ label: "Roxzone", time: formatTime(d.roxzoneSeconds), color: style.roxzone });
  }

  if (rows.length === 0) return;

  const rowH = h / rows.length;
  const fontSize = Math.min(rowH * 0.56, 34);
  const shown = Math.ceil(rows.length * Math.max(0, Math.min(1, options.progress)));

  ctx.textBaseline = "middle";
  rows.slice(0, shown).forEach((row, i) => {
    const y = i * rowH + rowH / 2;

    // Colour tick marks run vs station without needing a legend.
    ctx.fillStyle = row.color;
    roundRect(ctx, 0, y - fontSize * 0.34, fontSize * 0.22, fontSize * 0.68, fontSize * 0.11);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = style.muted;
    ctx.font = `600 ${Math.round(fontSize)}px ${style.font}`;
    ctx.fillText(row.label, fontSize * 0.6, y);

    ctx.textAlign = "right";
    ctx.fillStyle = style.text;
    ctx.font = `700 ${Math.round(fontSize)}px ${style.monoFont}`;
    ctx.fillText(row.time, w, y);
  });
}

/** Station ids in race order, for pickers. */
export const STATION_ORDER: HyroxStationId[] = HYROX_STATIONS.map((s) => s.id);
