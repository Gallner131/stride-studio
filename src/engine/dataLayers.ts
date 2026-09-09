// Stat and stat-row rendering — §4.4.3, §4.4.4.
//
// A `stat` is one data value with an optional label; a `statRow` is 2-6 of them laid out
// together. Both read from the field table, so they update when the activity changes — the
// design is a view over the data (§3.1 principle 6).
import type { FieldTable } from "../model/bindings";
import { fontStack } from "./text";

export interface StatFieldDef {
  id: string;
  label: string;
  /** Field key in the table. */
  field: string;
  /** Companion field holding the unit, when the value does not include it. */
  unitField?: string;
}

/** The fields offered in the inspector, in a sensible default order. */
export const STAT_FIELDS: StatFieldDef[] = [
  { id: "distance", label: "Distance", field: "distance", unitField: "unit" },
  { id: "time", label: "Time", field: "time" },
  { id: "pace", label: "Pace", field: "pace" },
  { id: "elevation", label: "Elevation", field: "elevation", unitField: "elevUnit" },
  { id: "hr", label: "Avg heart rate", field: "hr" },
  { id: "hrMax", label: "Max heart rate", field: "hrMax" },
  { id: "calories", label: "Calories", field: "calories" },
  { id: "date", label: "Date", field: "date" },
  { id: "name", label: "Activity name", field: "name" },
  { id: "sport", label: "Sport", field: "sport" },
  { id: "fastestSplit", label: "Fastest split", field: "fastestSplit" },
  // HYROX
  { id: "hyroxTotal", label: "HYROX finish", field: "hyroxTotal" },
  { id: "roxzone", label: "Roxzone", field: "roxzone" },
  { id: "runTotal", label: "Running total", field: "runTotal" },
  { id: "runPace", label: "Run pace", field: "runPace" },
];

export const STAT_FIELD_BY_ID = new Map(STAT_FIELDS.map((f) => [f.id, f]));

const UNIT_SUFFIX: Record<string, string> = {
  hr: "bpm",
  hrMax: "bpm",
  calories: "kcal",
};

export interface StatValue {
  value: string;
  unit: string;
  label: string;
  /** True when the activity has no data for this field (§4.6 missing-data rule). */
  missing: boolean;
}

/**
 * Resolves a stat field to what should be drawn.
 *
 * A field the activity does not have renders NOTHING rather than "0 m" or "--:--" — the
 * missing-data rule in §4.6. The caller decides whether to show a placeholder outline.
 */
export function resolveStat(fieldId: string, fields: FieldTable, countUpProgress = 1): StatValue {
  const def = STAT_FIELD_BY_ID.get(fieldId);
  const key = def?.field ?? fieldId;
  const raw = fields[key];
  const label = def?.label ?? fieldId;

  if (raw === null || raw === undefined || raw === "") {
    return { value: "", unit: "", label, missing: true };
  }

  const unit = def?.unitField ? String(fields[def.unitField] ?? "") : (UNIT_SUFFIX[fieldId] ?? "");

  // Count-up applies to numbers, and to clock strings by scaling their seconds.
  if (countUpProgress < 1) {
    if (typeof raw === "number") {
      const scaled = raw * countUpProgress;
      const decimals = countDecimals(raw);
      return { value: scaled.toFixed(decimals), unit, label, missing: false };
    }
    const asClock = clockToSeconds(String(raw));
    if (asClock !== null) {
      return { value: secondsToClock(asClock * countUpProgress), unit, label, missing: false };
    }
  }

  return { value: String(raw), unit, label, missing: false };
}

const countDecimals = (n: number): number => {
  const s = String(n);
  const i = s.indexOf(".");
  return i === -1 ? 0 : Math.min(2, s.length - i - 1);
};

function clockToSeconds(text: string): number | null {
  const m = text.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = m[3] === undefined ? null : Number(m[3]);
  return c === null ? a * 60 + b : a * 3600 + b * 60 + c;
}

function secondsToClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- stat

export interface StatStyle {
  valueFont: string;
  valueSize: number;
  valueWeight: number;
  valueColor: string;
  labelFont: string;
  labelSize: number;
  labelColor: string;
  /** Unit size as a fraction of the value size. */
  unitSize: number;
  letterSpacing: number;
  shadow: boolean;
}

export type StatLayout = "stacked" | "inline" | "labelAbove";

export interface StatOptions {
  layout: StatLayout;
  showLabel: boolean;
  countUpProgress: number;
}

export interface Measured {
  w: number;
  h: number;
}

function applyShadow(ctx: CanvasRenderingContext2D, on: boolean, size: number): void {
  if (!on) return;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = Math.max(6, size * 0.16);
  ctx.shadowOffsetY = Math.max(1, size * 0.03);
}

export function measureStat(
  ctx: CanvasRenderingContext2D,
  stat: StatValue,
  style: StatStyle,
  options: StatOptions,
): Measured {
  if (stat.missing) return { w: 200, h: style.valueSize * 0.9 };

  ctx.font = `${style.valueWeight} ${Math.round(style.valueSize)}px ${fontStack(style.valueFont)}`;
  const valueW = ctx.measureText(stat.value).width;

  ctx.font = `700 ${Math.round(style.valueSize * style.unitSize)}px ${fontStack(style.valueFont)}`;
  const unitW = stat.unit ? ctx.measureText(` ${stat.unit}`).width : 0;

  ctx.font = `600 ${Math.round(style.labelSize)}px ${fontStack(style.labelFont)}`;
  const labelW = options.showLabel ? ctx.measureText(stat.label.toUpperCase()).width : 0;

  if (options.layout === "inline") {
    return {
      w: valueW + unitW + (options.showLabel ? labelW + style.labelSize : 0),
      h: Math.max(style.valueSize, style.labelSize) * 1.1,
    };
  }

  return {
    w: Math.max(valueW + unitW, labelW),
    h: style.valueSize * 0.98 + (options.showLabel ? style.labelSize * 1.5 : 0),
  };
}

export function drawStat(
  ctx: CanvasRenderingContext2D,
  stat: StatValue,
  style: StatStyle,
  options: StatOptions,
): void {
  if (stat.missing) {
    drawMissing(ctx, stat.label, style);
    return;
  }

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const labelAbove = options.layout === "labelAbove" && options.showLabel;
  let y = labelAbove ? style.labelSize * 1.3 + style.valueSize * 0.82 : style.valueSize * 0.82;

  if (labelAbove) {
    ctx.font = `600 ${Math.round(style.labelSize)}px ${fontStack(style.labelFont)}`;
    ctx.fillStyle = style.labelColor;
    ctx.fillText(stat.label.toUpperCase(), 0, style.labelSize);
  }

  applyShadow(ctx, style.shadow, style.valueSize);
  ctx.font = `${style.valueWeight} ${Math.round(style.valueSize)}px ${fontStack(style.valueFont)}`;
  ctx.fillStyle = style.valueColor;
  ctx.fillText(stat.value, 0, y);
  const valueW = ctx.measureText(stat.value).width;

  if (stat.unit) {
    ctx.font = `700 ${Math.round(style.valueSize * style.unitSize)}px ${fontStack(style.valueFont)}`;
    ctx.fillText(` ${stat.unit}`, valueW, y);
  }

  if (options.showLabel && !labelAbove) {
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.round(style.labelSize)}px ${fontStack(style.labelFont)}`;
    ctx.fillStyle = style.labelColor;
    if (options.layout === "inline") {
      const unitW = stat.unit ? ctx.measureText(` ${stat.unit}`).width * (style.unitSize > 0 ? 1 : 0) : 0;
      ctx.fillText(stat.label.toUpperCase(), valueW + unitW + style.labelSize * 0.6, y);
    } else {
      y += style.labelSize * 1.4;
      ctx.fillText(stat.label.toUpperCase(), 0, y);
    }
  }

  ctx.restore();
}

/** A dashed outline plus a reason, shown only in the editor (§4.6). */
function drawMissing(ctx: CanvasRenderingContext2D, label: string, style: StatStyle): void {
  const w = 200;
  const h = style.valueSize * 0.9;
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 ${Math.round(Math.min(22, h * 0.28))}px ${fontStack(style.labelFont)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`No ${label.toLowerCase()}`, w / 2, h / 2);
  ctx.restore();
}

// ---------------------------------------------------------------- stat row

export type StatRowLayout = "row" | "column" | "grid2";
export type StatRowDivider = "none" | "dot" | "line";

export interface StatRowStyle {
  valueFont: string;
  valueSize: number;
  labelSize: number;
  color: string;
  labelColor: string;
  shadow: boolean;
  /** Optional panel behind the row. */
  panel: { kind: "glass" | "solid"; color: string; pad: number; radius: number } | null;
}

export interface StatRowOptions {
  layout: StatRowLayout;
  gap: number;
  divider: StatRowDivider;
  showLabels: boolean;
  countUpProgress: number;
}

/** Only fields the activity actually has: a stat row silently drops empties (§4.6). */
export function presentStats(fieldIds: string[], fields: FieldTable, progress: number): StatValue[] {
  return fieldIds.map((id) => resolveStat(id, fields, progress)).filter((s) => !s.missing);
}

export function measureStatRow(
  ctx: CanvasRenderingContext2D,
  stats: StatValue[],
  style: StatRowStyle,
  options: StatRowOptions,
): Measured {
  if (stats.length === 0) return { w: 240, h: style.valueSize * 1.6 };

  ctx.font = `700 ${Math.round(style.valueSize)}px ${fontStack(style.valueFont)}`;
  const cellW = stats.map((s) => {
    const valueW = ctx.measureText(`${s.value}${s.unit ? ` ${s.unit}` : ""}`).width;
    ctx.font = `600 ${Math.round(style.labelSize)}px ${fontStack(style.valueFont)}`;
    const labelW = options.showLabels ? ctx.measureText(s.label.toUpperCase()).width : 0;
    ctx.font = `700 ${Math.round(style.valueSize)}px ${fontStack(style.valueFont)}`;
    return Math.max(valueW, labelW);
  });

  const cellH = style.valueSize * 1.05 + (options.showLabels ? style.labelSize * 1.5 : 0);
  const pad = style.panel ? style.panel.pad : 0;

  if (options.layout === "column") {
    return {
      w: Math.max(...cellW) + pad * 2,
      h: stats.length * cellH + (stats.length - 1) * options.gap * 0.5 + pad * 2,
    };
  }
  if (options.layout === "grid2") {
    const rows = Math.ceil(stats.length / 2);
    const colW = Math.max(...cellW);
    return {
      w: colW * 2 + options.gap + pad * 2,
      h: rows * cellH + (rows - 1) * options.gap * 0.5 + pad * 2,
    };
  }
  return {
    w: cellW.reduce((a, b) => a + b, 0) + options.gap * (stats.length - 1) + pad * 2,
    h: cellH + pad * 2,
  };
}

export function drawStatRow(
  ctx: CanvasRenderingContext2D,
  stats: StatValue[],
  style: StatRowStyle,
  options: StatRowOptions,
  measured: Measured,
): void {
  if (stats.length === 0) return;

  const pad = style.panel ? style.panel.pad : 0;

  if (style.panel) {
    ctx.save();
    const r = style.panel.radius;
    ctx.beginPath();
    const { w, h } = measured;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(rr, 0);
    ctx.arcTo(w, 0, w, h, rr);
    ctx.arcTo(w, h, 0, h, rr);
    ctx.arcTo(0, h, 0, 0, rr);
    ctx.arcTo(0, 0, w, 0, rr);
    ctx.closePath();
    ctx.fillStyle = style.panel.color;
    ctx.fill();
    if (style.panel.kind === "glass") {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const cellH = style.valueSize * 1.05 + (options.showLabels ? style.labelSize * 1.5 : 0);

  const drawCell = (s: StatValue, x: number, y: number): number => {
    applyShadow(ctx, style.shadow, style.valueSize);
    ctx.font = `700 ${Math.round(style.valueSize)}px ${fontStack(style.valueFont)}`;
    ctx.fillStyle = style.color;
    const text = `${s.value}${s.unit ? ` ${s.unit}` : ""}`;
    ctx.fillText(text, x, y + style.valueSize * 0.84);
    const w = ctx.measureText(text).width;

    if (options.showLabels) {
      ctx.shadowBlur = 0;
      ctx.font = `600 ${Math.round(style.labelSize)}px ${fontStack(style.valueFont)}`;
      ctx.fillStyle = style.labelColor;
      ctx.fillText(s.label.toUpperCase(), x, y + style.valueSize * 0.84 + style.labelSize * 1.35);
      return Math.max(w, ctx.measureText(s.label.toUpperCase()).width);
    }
    return w;
  };

  if (options.layout === "column") {
    let y = pad;
    for (const s of stats) {
      drawCell(s, pad, y);
      y += cellH + options.gap * 0.5;
    }
  } else if (options.layout === "grid2") {
    const colW = (measured.w - pad * 2 - options.gap) / 2;
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      drawCell(s, pad + col * (colW + options.gap), pad + row * (cellH + options.gap * 0.5));
    });
  } else {
    let x = pad;
    stats.forEach((s, i) => {
      const w = drawCell(s, x, pad);
      x += w;
      if (i < stats.length - 1) {
        if (options.divider === "dot") {
          ctx.shadowBlur = 0;
          ctx.fillStyle = style.labelColor;
          ctx.beginPath();
          ctx.arc(
            x + options.gap / 2,
            pad + style.valueSize * 0.5,
            Math.max(2, style.valueSize * 0.06),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        } else if (options.divider === "line") {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = style.labelColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + options.gap / 2, pad + style.valueSize * 0.1);
          ctx.lineTo(x + options.gap / 2, pad + style.valueSize * 0.95);
          ctx.stroke();
        }
        x += options.gap;
      }
    });
  }

  ctx.restore();
}
