// Route rendering — §4.4.5, §2.7 S5.
//
// The route is the most-shared object in running content, so it gets real range: seven
// stroke modes, four colour-by options, km markers, direction arrows, endpoint styles,
// silhouette fill, and draw-on animation that works with every combination.
import {
  cumulativeLengths,
  isClosedLoop,
  type LatLng,
  type Point,
  pointAt,
  projectRoute,
  simplify,
} from "./geometry";

export type RouteMode = "solid" | "dotted" | "dashed" | "glow" | "tube" | "sketch" | "extrude";
export type RouteColorBy = "none" | "pace" | "hr" | "elevation";
export type RouteEndpoints = "dots" | "pins" | "flags" | "none";

export interface RouteStyle {
  mode: RouteMode;
  stroke: string;
  width: number;
  colorBy: RouteColorBy;
  /** Gradient stops used by colorBy pace/elevation. */
  gradient: [string, string];
  /** Zone colours used by colorBy hr. */
  zoneColors: string[];
  markers: { km: boolean; labels: boolean; arrows: boolean };
  endpoints: RouteEndpoints;
  startColor: string;
  endColor: string;
  dotSize: number;
  silhouette: boolean;
  simplify: number;
  /** Draws a runner dot travelling along the line as it draws (§2.7 S5 runnerDot). */
  runnerDot: boolean;
}

export const DEFAULT_ROUTE_STYLE: RouteStyle = {
  mode: "solid",
  stroke: "#FFFFFF",
  width: 10,
  colorBy: "none",
  gradient: ["#D8FF3A", "rgba(255,255,255,0.45)"],
  zoneColors: ["#8FA3B5", "#4FC1E9", "#7BE495", "#FFB347", "#FF5A5F"],
  markers: { km: false, labels: false, arrows: false },
  endpoints: "dots",
  startColor: "#FFFFFF",
  endColor: "#D8FF3A",
  dotSize: 18,
  silhouette: false,
  simplify: 2,
  runnerDot: false,
};

export interface RouteData {
  points: LatLng[];
  /** Per-point series for colourBy, any length — resampled to the point count. */
  hr?: number[];
  /** Per-km pace in seconds, used by colorBy pace. */
  splits?: number[];
  altitude?: number[];
  /** Total distance in km, for km markers. */
  distanceKm?: number;
}

export interface RouteRenderOptions {
  /** 0..1 draw-on progress. */
  progress: number;
  /**
   * Points already placed, in this layer's own coordinates, instead of fitted to its box.
   *
   * Used when a map is the background: the trace has to sit on the roads it was run on, so
   * it shares the map's projection rather than being scaled to fit a layer box that knows
   * nothing about where north is. Everything else about the layer — colour, width, mode,
   * the draw-on — works exactly the same on these points.
   */
  placed?: Point[];
}

/** Mixes two CSS colours. Handles #rgb, #rrggbb and rgba(). */
function parseColor(c: string): [number, number, number, number] {
  const s = c.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
    return [
      Number.parseInt(h.slice(0, 2), 16),
      Number.parseInt(h.slice(2, 4), 16),
      Number.parseInt(h.slice(4, 6), 16),
      1,
    ];
  }
  const rgba = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  }
  return [255, 255, 255, 1];
}

function mixColor(a: string, b: string, t: number): string {
  const [r1, g1, b1, a1] = parseColor(a);
  const [r2, g2, b2, a2] = parseColor(b);
  const f = Math.max(0, Math.min(1, t));
  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const bl = Math.round(b1 + (b2 - b1) * f);
  const al = a1 + (a2 - a1) * f;
  return `rgba(${r},${g},${bl},${al.toFixed(3)})`;
}

/** Resolves the colour for a segment, per colorBy. */
function segmentColor(style: RouteStyle, data: RouteData, index: number, count: number): string {
  if (style.colorBy === "none") return style.stroke;
  const t = count > 1 ? index / (count - 1) : 0;

  if (style.colorBy === "hr" && data.hr && data.hr.length > 0) {
    const value = data.hr[Math.min(data.hr.length - 1, Math.floor(t * data.hr.length))] ?? 0;
    const max = Math.max(...data.hr);
    const zone = Math.min(4, Math.max(0, Math.floor((value / (max || 1) - 0.5) / 0.1)));
    return style.zoneColors[zone] ?? style.stroke;
  }

  if (style.colorBy === "elevation" && data.altitude && data.altitude.length > 1) {
    const i = Math.min(data.altitude.length - 1, Math.floor(t * data.altitude.length));
    const prev = data.altitude[Math.max(0, i - 1)] ?? 0;
    const curr = data.altitude[i] ?? 0;
    // Steeper up is closer to the far gradient stop.
    const grade = Math.max(-1, Math.min(1, (curr - prev) / 4));
    return mixColor(style.gradient[0], style.gradient[1], (grade + 1) / 2);
  }

  if (style.colorBy === "pace" && data.splits && data.splits.length > 0) {
    const i = Math.min(data.splits.length - 1, Math.floor(t * data.splits.length));
    const value = data.splits[i] ?? 0;
    const min = Math.min(...data.splits);
    const max = Math.max(...data.splits);
    const span = max - min || 1;
    // Fast = first stop, slow = second.
    return mixColor(style.gradient[0], style.gradient[1], (value - min) / span);
  }

  return style.stroke;
}

/**
 * Draws the route into a w x h box, from (0,0).
 *
 * Returns the projected points so callers can place markers without reprojecting.
 */
export function drawRoute(
  ctx: CanvasRenderingContext2D,
  data: RouteData,
  w: number,
  h: number,
  style: RouteStyle,
  options: RouteRenderOptions,
): Point[] {
  if (data.points.length < 2) return [];

  const pad = style.width + (style.mode === "extrude" ? style.width * 1.5 : 0);
  const projected =
    options.placed ??
    projectRoute(data.points, {
      x: pad,
      y: pad,
      w: Math.max(1, w - pad * 2),
      h: Math.max(1, h - pad * 2),
    });

  const points = style.simplify > 0 ? simplify(projected, style.simplify) : projected;
  if (points.length < 2) return points;

  const p = Math.max(0, Math.min(1, options.progress));
  const shown = Math.max(2, Math.floor(points.length * p));
  const visible = points.slice(0, shown);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (style.silhouette && isClosedLoop(points)) {
    ctx.save();
    ctx.beginPath();
    tracePath(ctx, points, style.mode === "sketch");
    ctx.closePath();
    ctx.fillStyle = mixColor(style.stroke, "rgba(0,0,0,0)", 0.78);
    ctx.fill();
    ctx.restore();
  }

  // Ghost of the full route while drawing on, so the shape reads immediately.
  if (p < 1) {
    ctx.save();
    ctx.beginPath();
    tracePath(ctx, points, style.mode === "sketch");
    ctx.strokeStyle = mixColor(style.stroke, "rgba(0,0,0,0)", 0.75);
    ctx.lineWidth = style.width;
    ctx.stroke();
    ctx.restore();
  }

  drawStroke(ctx, visible, style, data, points.length);

  if (style.markers.km) drawKmMarkers(ctx, points, style, data, p);
  if (style.markers.arrows) drawArrows(ctx, visible, style);
  if (style.endpoints !== "none") drawEndpoints(ctx, points, visible, style, p);
  if (style.runnerDot && p < 1) drawRunnerDot(ctx, points, style, p);

  ctx.restore();
  return points;
}

function tracePath(ctx: CanvasRenderingContext2D, points: Point[], wobble: boolean): void {
  points.forEach(([x, y], i) => {
    // A deterministic wobble, so "hand-drawn" does not flicker between frames.
    const jx = wobble ? Math.sin(i * 1.7) * 1.6 : 0;
    const jy = wobble ? Math.cos(i * 2.3) * 1.6 : 0;
    if (i === 0) ctx.moveTo(x + jx, y + jy);
    else ctx.lineTo(x + jx, y + jy);
  });
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  visible: Point[],
  style: RouteStyle,
  data: RouteData,
  total: number,
): void {
  const dash: number[] | null =
    style.mode === "dotted"
      ? [0.1, style.width * 1.9]
      : style.mode === "dashed"
        ? [style.width * 2.2, style.width * 1.6]
        : null;

  // Extrude: an offset copy underneath, for a 3D-ish shadow.
  if (style.mode === "extrude") {
    ctx.save();
    ctx.translate(style.width * 0.7, style.width * 0.9);
    ctx.beginPath();
    tracePath(ctx, visible, false);
    ctx.strokeStyle = mixColor(style.stroke, "#000000", 0.65);
    ctx.lineWidth = style.width;
    ctx.stroke();
    ctx.restore();
  }

  // Tube: a wide dark base with a bright core on top.
  if (style.mode === "tube") {
    ctx.save();
    ctx.beginPath();
    tracePath(ctx, visible, false);
    ctx.strokeStyle = mixColor(style.stroke, "#000000", 0.55);
    ctx.lineWidth = style.width * 1.9;
    ctx.stroke();
    ctx.restore();
  }

  if (style.mode === "glow" || style.mode === "tube") {
    ctx.shadowColor = style.stroke;
    ctx.shadowBlur = style.width * (style.mode === "tube" ? 1.6 : 2.4);
  }

  if (dash) ctx.setLineDash(dash);
  ctx.lineCap = style.mode === "dotted" ? "round" : "round";

  if (style.colorBy === "none") {
    ctx.beginPath();
    tracePath(ctx, visible, style.mode === "sketch");
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.mode === "tube" ? style.width * 0.85 : style.width;
    ctx.stroke();
  } else {
    // Per-segment colour: draw each segment separately so the line carries the data.
    ctx.lineWidth = style.mode === "tube" ? style.width * 0.85 : style.width;
    for (let i = 1; i < visible.length; i++) {
      const a = visible[i - 1];
      const b = visible[i];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = segmentColor(style, data, i, total);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
}

function drawKmMarkers(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  style: RouteStyle,
  data: RouteData,
  progress: number,
): void {
  const km = Math.floor(data.distanceKm ?? 0);
  if (km < 1) return;

  const size = Math.max(4, style.width * 0.62);
  ctx.save();
  for (let i = 1; i <= km; i++) {
    const fraction = i / (data.distanceKm ?? i);
    if (fraction > progress) break;
    const pt = pointAt(points, fraction);
    if (!pt) continue;

    ctx.beginPath();
    ctx.arc(pt[0], pt[1], size, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = Math.max(1, style.width * 0.2);
    ctx.strokeStyle = mixColor(style.stroke, "#000000", 0.35);
    ctx.stroke();

    if (style.markers.labels) {
      ctx.font = `700 ${Math.round(size * 1.7)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#111111";
      ctx.fillText(String(i), pt[0], pt[1] + size * 2.6);
    }
  }
  ctx.restore();
}

function drawArrows(ctx: CanvasRenderingContext2D, visible: Point[], style: RouteStyle): void {
  const lengths = cumulativeLengths(visible);
  const total = lengths[lengths.length - 1] ?? 0;
  if (total <= 0) return;

  const count = Math.max(2, Math.min(8, Math.round(total / 220)));
  const size = Math.max(5, style.width * 0.9);

  ctx.save();
  ctx.fillStyle = style.stroke;
  for (let i = 1; i <= count; i++) {
    const f = i / (count + 1);
    const at = pointAt(visible, f);
    const ahead = pointAt(visible, Math.min(1, f + 0.01));
    if (!at || !ahead) continue;
    const angle = Math.atan2(ahead[1] - at[1], ahead[0] - at[0]);

    ctx.save();
    ctx.translate(at[0], at[1]);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, size * 0.62);
    ctx.lineTo(-size * 0.7, -size * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawEndpoints(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  visible: Point[],
  style: RouteStyle,
  progress: number,
): void {
  const start = points[0];
  const end = progress >= 1 ? points[points.length - 1] : visible[visible.length - 1];
  if (!start || !end) return;

  const r = style.dotSize * 0.5;

  const marker = (pt: Point, color: string, isFinish: boolean) => {
    ctx.save();
    if (style.endpoints === "dots") {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = r * 0.4;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke();
    } else if (style.endpoints === "pins") {
      ctx.beginPath();
      ctx.moveTo(pt[0], pt[1]);
      ctx.lineTo(pt[0] - r * 0.8, pt[1] - r * 2.2);
      ctx.lineTo(pt[0] + r * 0.8, pt[1] - r * 2.2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt[0], pt[1] - r * 2.6, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // flags
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, r * 0.35);
      ctx.beginPath();
      ctx.moveTo(pt[0], pt[1]);
      ctx.lineTo(pt[0], pt[1] - r * 3);
      ctx.stroke();
      ctx.fillStyle = color;
      if (isFinish) {
        // A small chequer for the finish.
        const c = r * 0.7;
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 ? color : "#FFFFFF";
            ctx.fillRect(pt[0] + i * (c / 2), pt[1] - r * 3 + j * (c / 2), c / 2, c / 2);
          }
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(pt[0], pt[1] - r * 3);
        ctx.lineTo(pt[0] + r * 1.8, pt[1] - r * 2.4);
        ctx.lineTo(pt[0], pt[1] - r * 1.8);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  };

  marker(start, style.startColor, false);
  marker(end, style.endColor, true);
}

function drawRunnerDot(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  style: RouteStyle,
  progress: number,
): void {
  const at = pointAt(points, progress);
  if (!at) return;
  ctx.save();
  ctx.shadowColor = style.endColor;
  ctx.shadowBlur = style.width * 2;
  ctx.beginPath();
  ctx.arc(at[0], at[1], style.width * 0.9, 0, Math.PI * 2);
  ctx.fillStyle = style.endColor;
  ctx.fill();
  ctx.restore();
}
