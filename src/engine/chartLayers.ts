// Data graphics — §4.4.6.
//
// Charts are live, not static images (§5.8): each one draws in as time advances, so the
// exported video replays the activity rather than fading a picture in.

import type { ZoneBand } from "../data/stravaZones";
import { zoneOfBands, zoneSharesFromBands } from "../data/stravaZones";
import { resample, smoothSeries } from "./geometry";
import { fontStack } from "./text";

export type ChartKind = "hr" | "pace" | "elevation" | "splits" | "zones" | "rings";

export interface ChartStyle {
  color: string;
  muted: string;
  text: string;
  font: string;
  /** Five zone colours, Z1 → Z5. */
  zoneColors: string[];
}

export const DEFAULT_ZONE_COLORS = ["#8FA3B5", "#4FC1E9", "#7BE495", "#FFB347", "#FF5A5F"];

export const DEFAULT_CHART_STYLE: ChartStyle = {
  color: "#D8FF3A",
  muted: "rgba(255,255,255,0.45)",
  text: "#FFFFFF",
  font: "sans",
  zoneColors: DEFAULT_ZONE_COLORS,
};

export interface ChartData {
  /** Heart-rate samples. */
  hr?: number[];
  /**
   * The peak heart rate reached during THIS activity. A number to display — never a zone
   * ceiling. Using it as one is what made every run report as Z4/Z5 (§7.4).
   */
  hrMax?: number;
  /** The athlete's real zones, from Strava. Absent means we do not know them. */
  zones?: ZoneBand[];
  /** Per-km pace in seconds. */
  splits?: number[];
  /** Altitude samples. */
  altitude?: number[];
  /** Effort 0-100, average HR and duration in seconds, for the rings. */
  effort?: number;
  avgHr?: number;
  durationSeconds?: number;
  calories?: number;
}

export interface ChartOptions {
  progress: number;
  /** hr: colour the trace by zone; zones: show percentages. */
  zoneColours?: boolean;
  bands?: boolean;
  labels?: boolean;
  smooth?: number;
  /** pace: wave or bars. */
  mode?: "wave" | "bars";
  highlightFastest?: boolean;
  fill?: boolean;
  showValues?: boolean;
  showPercent?: boolean;
  metrics?: ("effort" | "hr" | "duration")[];
}

const fmtPace = (sec: number): string => {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  // Round first, so 59.6s never renders as ":60".
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const fmtDuration = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Nothing to draw — the caller shows a hint instead of an empty box. */
export function chartHasData(kind: ChartKind, data: ChartData): boolean {
  switch (kind) {
    case "hr":
      return (data.hr?.length ?? 0) > 1;
    case "zones":
      // Without the athlete's real zones there is nothing honest to draw.
      return (data.hr?.length ?? 0) > 1 && (data.zones?.length ?? 0) > 0;
    case "pace":
    case "splits":
      return (data.splits?.length ?? 0) > 1;
    case "elevation":
      return (data.altitude?.length ?? 0) > 1;
    case "rings":
      return data.effort !== undefined || data.avgHr !== undefined || data.durationSeconds !== undefined;
  }
}

export function drawChart(
  ctx: CanvasRenderingContext2D,
  kind: ChartKind,
  data: ChartData,
  w: number,
  h: number,
  style: ChartStyle,
  options: ChartOptions,
): void {
  switch (kind) {
    case "hr":
      drawHr(ctx, data, w, h, style, options);
      return;
    case "pace":
      drawPace(ctx, data, w, h, style, options);
      return;
    case "elevation":
      drawElevation(ctx, data, w, h, style, options);
      return;
    case "splits":
      drawSplits(ctx, data, w, h, style, options);
      return;
    case "zones":
      drawZones(ctx, data, w, h, style, options);
      return;
    case "rings":
      drawRings(ctx, data, w, h, style, options);
      return;
  }
}

// ---------------------------------------------------------------- hr

function drawHr(
  ctx: CanvasRenderingContext2D,
  data: ChartData,
  w: number,
  h: number,
  style: ChartStyle,
  options: ChartOptions,
): void {
  const raw = data.hr ?? [];
  if (raw.length < 2) return;

  const series = smoothSeries(
    resample(raw, Math.min(raw.length, Math.max(60, Math.round(w / 3)))),
    options.smooth ?? 5,
  );
  const hrMax = data.hrMax ?? Math.max(...raw) + 5;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const p = Math.max(0, Math.min(1, options.progress));

  const x = (i: number) => (i / (series.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / span) * h * 0.92 - h * 0.04;

  // Zone bands behind the trace.
  if (options.bands) {
    ctx.save();
    for (let z = 0; z < 5; z++) {
      const lo = (0.5 + z * 0.1) * hrMax;
      const hi = (0.6 + z * 0.1) * hrMax;
      if (hi < min || lo > max) continue;
      const yTop = y(Math.min(max, hi));
      const yBottom = y(Math.max(min, lo));
      ctx.fillStyle = style.zoneColors[z] ?? style.muted;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(0, yTop, w, Math.max(1, yBottom - yTop));
    }
    ctx.restore();
  }

  const shown = Math.max(2, Math.floor(series.length * p));

  // Area under the trace.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < shown; i++) ctx.lineTo(x(i), y(series[i] ?? min));
  ctx.lineTo(x(shown - 1), h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, withAlpha(style.color, 0.45));
  grad.addColorStop(1, withAlpha(style.color, 0));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Trace, coloured by zone where asked.
  ctx.save();
  ctx.lineWidth = Math.max(3, h * 0.022);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (options.zoneColours) {
    for (let i = 1; i < shown; i++) {
      ctx.beginPath();
      ctx.moveTo(x(i - 1), y(series[i - 1] ?? min));
      ctx.lineTo(x(i), y(series[i] ?? min));
      const band = zoneOfBands(series[i] ?? min, data.zones ?? []);
      ctx.strokeStyle = (band === null ? undefined : style.zoneColors[band]) ?? style.color;
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    for (let i = 0; i < shown; i++) {
      if (i === 0) ctx.moveTo(x(i), y(series[i] ?? min));
      else ctx.lineTo(x(i), y(series[i] ?? min));
    }
    ctx.strokeStyle = style.text;
    ctx.stroke();
  }
  ctx.restore();

  if (options.labels) {
    ctx.save();
    ctx.font = `600 ${Math.round(Math.min(28, h * 0.12))}px ${fontStack(style.font)}`;
    ctx.fillStyle = style.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.round(max)} bpm`, 0, 0);
    ctx.textBaseline = "bottom";
    ctx.fillText(`${Math.round(min)}`, 0, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- pace

function drawPace(
  ctx: CanvasRenderingContext2D,
  data: ChartData,
  w: number,
  h: number,
  style: ChartStyle,
  options: ChartOptions,
): void {
  const splits = data.splits ?? [];
  if (splits.length < 2) return;

  const p = Math.max(0, Math.min(1, options.progress));
  const min = Math.min(...splits);
  const max = Math.max(...splits);
  const span = max - min || 1;
  const fastestIndex = splits.indexOf(min);

  if (options.mode === "bars") {
    drawSplits(ctx, data, w, h, style, options);
    return;
  }

  // Wave: faster is higher, so the shape reads the way runners think.
  const x = (i: number) => (i / (splits.length - 1)) * w;
  const y = (v: number) => h * 0.08 + ((v - min) / span) * h * 0.84;
  const shown = Math.max(2, Math.floor(splits.length * p));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < shown; i++) ctx.lineTo(x(i), y(splits[i] ?? min));
  ctx.lineTo(x(shown - 1), h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, withAlpha(style.color, 0.5));
  grad.addColorStop(1, withAlpha(style.color, 0));
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < shown; i++) {
    if (i === 0) ctx.moveTo(x(i), y(splits[i] ?? min));
    else ctx.lineTo(x(i), y(splits[i] ?? min));
  }
  ctx.strokeStyle = style.text;
  ctx.lineWidth = Math.max(3, h * 0.024);
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();

  if (options.highlightFastest && p >= 1 && fastestIndex >= 0) {
    ctx.save();
    const fx = x(fastestIndex);
    const fy = y(min);
    ctx.beginPath();
    ctx.arc(fx, fy, Math.max(5, h * 0.035), 0, Math.PI * 2);
    ctx.fillStyle = style.color;
    ctx.fill();
    ctx.font = `700 ${Math.round(Math.min(26, h * 0.11))}px ${fontStack(style.font)}`;
    ctx.fillStyle = style.text;
    ctx.textAlign = fastestIndex > splits.length / 2 ? "right" : "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `fastest ${fmtPace(min)}`,
      fx + (fastestIndex > splits.length / 2 ? -12 : 12),
      fy - Math.max(8, h * 0.05),
    );
    ctx.restore();
  }
}

// ---------------------------------------------------------------- splits

function drawSplits(
  ctx: CanvasRenderingContext2D,
  data: ChartData,
  w: number,
  h: number,
  style: ChartStyle,
  options: ChartOptions,
): void {
  const splits = data.splits ?? [];
  if (splits.length === 0) return;

  const p = Math.max(0, Math.min(1, options.progress));
  const min = Math.min(...splits);
  const max = Math.max(...splits);
  const span = max - min || 1;

  const gap = Math.max(2, (w / splits.length) * 0.18);
  const barW = (w - gap * (splits.length - 1)) / splits.length;
  const labelH = options.showValues ? Math.min(26, h * 0.16) : 0;
  const chartH = h - labelH;

  splits.forEach((value, i) => {
    // Faster splits are taller.
    const norm = 1 - (value - min) / span;
    const barH = (0.28 + norm * 0.72) * chartH;
    const reveal = Math.max(0, Math.min(1, p * splits.length * 1.3 - i));
    const x = i * (barW + gap);
    const y = chartH - barH * reveal;

    ctx.fillStyle = value === min ? style.color : withAlpha(style.text, 0.75);
    roundRectPath(ctx, x, y, barW, barH * reveal, Math.min(barW / 2, 6));
    ctx.fill();

    if (options.showValues && reveal >= 1 && splits.length <= 14) {
      ctx.font = `600 ${Math.round(Math.min(20, labelH * 0.8))}px ${fontStack(style.font)}`;
      ctx.fillStyle = style.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(fmtPace(value), x + barW / 2, chartH + 4);
    }
  });
}

// ---------------------------------------------------------------- elevation

function drawElevation(
  ctx: CanvasRenderingContext2D,
  data: ChartData,
  w: number,
  h: number,
  style: ChartStyle,
  options: ChartOptions,
): void {
  const raw = data.altitude ?? [];
  if (raw.length < 2) return;

  const series = resample(raw, Math.min(raw.length, Math.max(60, Math.round(w / 3))));
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const p = Math.max(0, Math.min(1, options.progress));
  const shown = Math.max(2, Math.floor(series.length * p));

  const x = (i: number) => (i / (series.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / span) * h * 0.88 - h * 0.06;

  ctx.save();
  if (options.fill !== false) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < shown; i++) ctx.lineTo(x(i), y(series[i] ?? min));
    ctx.lineTo(x(shown - 1), h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, withAlpha(style.color, 0.55));
    grad.addColorStop(1, withAlpha(style.color, 0.02));
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.beginPath();
  for (let i = 0; i < shown; i++) {
    if (i === 0) ctx.moveTo(x(i), y(series[i] ?? min));
    else ctx.lineTo(x(i), y(series[i] ?? min));
  }
  ctx.strokeStyle = style.text;
  ctx.lineWidth = Math.max(3, h * 0.02);
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();

  if (options.labels) {
    ctx.save();
    ctx.font = `600 ${Math.round(Math.min(26, h * 0.13))}px ${fontStack(style.font)}`;
    ctx.fillStyle = style.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.round(max)} m`, w, 0);
    ctx.textBaseline = "bottom";
    ctx.fillText(`${Math.round(min)} m`, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- zones

function drawZones(
  ctx: CanvasRenderingContext2D,
  data: ChartData,
  w: number,
  h: number,
  style: ChartStyle,
  options: ChartOptions,
): void {
  const hr = data.hr ?? [];
  if (hr.length < 2) return;

  // Only the athlete's own zones will do. Deriving them from this run's peak is how an easy
  // run at 140 bpm came out as Z4 (§7.4); with no zones we draw nothing and the caller shows
  // the "needs data" hint, because a confidently wrong zone is worse than no zone.
  const shares = zoneSharesFromBands(hr, data.zones ?? []);
  if (!shares) return;
  const p = Math.max(0, Math.min(1, options.progress));
  const rowH = h / 5;
  const barH = Math.min(rowH * 0.62, 44);
  const labelW = Math.min(w * 0.16, 90);
  const valueW = options.showPercent ? Math.min(w * 0.16, 96) : 0;
  const trackW = Math.max(20, w - labelW - valueW - 16);
  const maxShare = Math.max(...shares, 0.0001);

  shares.forEach((share, z) => {
    const y = z * rowH + (rowH - barH) / 2;
    const reveal = Math.max(0, Math.min(1, p * 5 * 1.4 - z));

    ctx.font = `700 ${Math.round(barH * 0.46)}px ${fontStack(style.font)}`;
    ctx.fillStyle = style.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`Z${z + 1}`, 0, y + barH / 2);

    ctx.fillStyle = withAlpha(style.text, 0.12);
    roundRectPath(ctx, labelW, y, trackW, barH, barH / 2);
    ctx.fill();

    ctx.fillStyle = style.zoneColors[z] ?? style.color;
    roundRectPath(ctx, labelW, y, Math.max(barH * 0.5, (share / maxShare) * trackW * reveal), barH, barH / 2);
    ctx.fill();

    if (options.showPercent && reveal >= 1) {
      ctx.fillStyle = style.text;
      ctx.textAlign = "right";
      ctx.font = `700 ${Math.round(barH * 0.46)}px ${fontStack(style.font)}`;
      const minutes = data.durationSeconds ? Math.round((share * data.durationSeconds) / 60) : null;
      ctx.fillText(minutes !== null ? `${minutes}m` : `${Math.round(share * 100)}%`, w, y + barH / 2);
    }
  });
}

// ---------------------------------------------------------------- rings

function drawRings(
  ctx: CanvasRenderingContext2D,
  data: ChartData,
  w: number,
  h: number,
  style: ChartStyle,
  options: ChartOptions,
): void {
  const metrics = options.metrics ?? ["effort", "hr", "duration"];
  const p = Math.max(0, Math.min(1, options.progress));

  const values: { label: string; value: number; display: string; color: string }[] = metrics.map((m, i) => {
    if (m === "effort") {
      const v = (data.effort ?? 0) / 100;
      return { label: "Effort", value: v, display: String(Math.round(data.effort ?? 0)), color: style.color };
    }
    if (m === "hr") {
      const max = data.hrMax ?? 190;
      const v = (data.avgHr ?? 0) / max;
      return {
        label: "Avg HR",
        value: v,
        display: data.avgHr ? String(Math.round(data.avgHr)) : "",
        color: style.zoneColors[3] ?? style.color,
      };
    }
    // Duration against a nominal hour, which is what a ring implies.
    const v = Math.min(1, (data.durationSeconds ?? 0) / 3600);
    return {
      label: "Time",
      value: v,
      display: data.durationSeconds ? fmtDuration(data.durationSeconds) : "",
      color: style.zoneColors[1] ?? style.color,
      ...(i === -1 ? {} : {}),
    };
  });

  const size = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const stroke = size * 0.075;
  const gapRing = stroke * 1.5;

  values.forEach((m, i) => {
    const radius = size / 2 - stroke / 2 - i * gapRing;
    if (radius <= 0) return;
    const reveal = Math.max(0, Math.min(1, p * values.length * 1.3 - i));

    ctx.save();
    ctx.lineWidth = stroke;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(style.text, 0.12);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, m.value)) * reveal,
    );
    ctx.strokeStyle = m.color;
    ctx.stroke();
    ctx.restore();
  });

  // Centre readout: the first metric.
  const first = values[0];
  if (first?.display) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = style.text;
    ctx.font = `800 ${Math.round(size * 0.17)}px ${fontStack(style.font)}`;
    ctx.fillText(first.display, cx, cy - size * 0.02);
    ctx.font = `600 ${Math.round(size * 0.062)}px ${fontStack(style.font)}`;
    ctx.fillStyle = style.muted;
    ctx.fillText(first.label.toUpperCase(), cx, cy + size * 0.1);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- helpers

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function withAlpha(color: string, alpha: number): string {
  const s = color.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const rgba = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${alpha})`;
  return `rgba(255,255,255,${alpha})`;
}
