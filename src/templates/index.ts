// Templates as data — §4.8, §13 Phase 2 step 2.
//
// A template is a list of layer specifications plus metadata. No design lives in code
// (CLAUDE.md rule 7): each entry below is a plain object of overrides merged onto the layer
// defaults, which is why a new template is a data change rather than a new switch case.
//
// The 27 legacy templates are NOT re-authored here yet. CLAUDE.md rule 8: a legacy case
// stays until its JSON replacement passes the goldens, and the goldens only run in the
// pinned container. These are the §4.8 additions plus the HYROX designs, all of which are
// new — so they carry no parity risk and can ship now.

import {
  newChartLayer,
  newHyroxBreakdown,
  newHyroxSplits,
  newHyroxStations,
  newRouteLayer,
  newShapeLayer,
  newStatLayer,
  newStatRowLayer,
  newStickerLayer,
  newTextLayer,
} from "../model/defaults";
import type { Layer, LayerType } from "../model/types";

/** What an activity must have for a template to be offered (§4.8). */
export type Requirement = "route" | "hr" | "splits" | "elevation" | "distance" | "hyrox";

export type TemplateCategory =
  | "Stats"
  | "Map"
  | "Health"
  | "Workout"
  | "Editorial"
  | "Fun"
  | "Video"
  | "HYROX";

/** A layer spec: a type plus a deep-partial of overrides. */
export interface LayerSpec {
  type: LayerType;
  [key: string]: unknown;
}

export interface TemplateDef {
  id: string;
  name: string;
  desc: string;
  cat: TemplateCategory;
  /** Hidden from the gallery when the activity cannot satisfy these. */
  requires: Requirement[];
  layers: LayerSpec[];
}

const CONSTRUCTORS: Record<LayerType, (spec: LayerSpec) => Layer> = {
  text: () => newTextLayer(),
  shape: (s) => newShapeLayer((s.shape as never) ?? "rect"),
  image: () => newTextLayer() as unknown as Layer, // images need an asset; templates never place one
  sticker: (s) => newStickerLayer((s.svgId as string) ?? "star"),
  stat: (s) => newStatLayer((s.field as string) ?? "distance"),
  statRow: (s) => newStatRowLayer((s.fields as string[]) ?? undefined),
  route: () => newRouteLayer(),
  chart: (s) => newChartLayer((s.kind as never) ?? "hr"),
  hyroxBreakdown: () => newHyroxBreakdown(),
  hyroxStations: () => newHyroxStations(),
  hyroxSplits: () => newHyroxSplits(),
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Deep merge, with arrays replaced rather than concatenated. */
function merge<T>(base: T, over: Record<string, unknown>): T {
  const out = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(over)) {
    if (key === "type") continue;
    const existing = out[key];
    out[key] = isPlainObject(value) && isPlainObject(existing) ? merge(existing, value) : value;
  }
  return out as T;
}

/** Instantiates a template's layers, with fresh ids. Layers are marked `template`. */
export function buildTemplateLayers(def: TemplateDef): Layer[] {
  return def.layers.map((spec) => {
    const construct = CONSTRUCTORS[spec.type];
    const base = construct(spec);
    return merge(base, { ...spec, source: "template" });
  });
}

/** Can this activity satisfy the template? Drives gallery filtering (§4.8, §6.8). */
export interface ActivityCapabilities {
  route: boolean;
  hr: boolean;
  splits: boolean;
  elevation: boolean;
  distance: boolean;
  hyrox: boolean;
}

export const templateAvailable = (def: TemplateDef, caps: ActivityCapabilities): boolean =>
  def.requires.every((r) => caps[r]);

/** Human-readable reason a template is unavailable, for the disabled state. */
export function unavailableReason(def: TemplateDef, caps: ActivityCapabilities): string | null {
  const missing = def.requires.filter((r) => !caps[r]);
  if (missing.length === 0) return null;
  const labels: Record<Requirement, string> = {
    route: "GPS",
    hr: "heart rate",
    splits: "split data",
    elevation: "elevation",
    distance: "distance",
    hyrox: "a HYROX result",
  };
  return `Needs ${missing.map((m) => labels[m]).join(" and ")}`;
}

// ---------------------------------------------------------------- the templates

// Templates reference LOOK TOKENS rather than literal colours (§4.3). That is what makes
// swapping a look restyle every design at once; a colour the user picks by hand becomes a
// literal and survives the swap.
const WHITE = "$text";
const MUTED = "$textMuted";
const VOLT = "$accent";

export const TEMPLATES: TemplateDef[] = [
  {
    id: "session",
    name: "Session",
    desc: "Duration hero, heart rate and zones",
    cat: "Workout",
    requires: ["hr"],
    layers: [
      {
        type: "stat",
        field: "time",
        name: "Duration",
        showLabel: true,
        anchor: { ax: 0.06, ay: 0 },
        origin: { ox: 0, oy: 0 },
        offset: { dx: 0, dy: 300 },
        style: { valueSize: 220, valueColor: WHITE, labelColor: MUTED },
      },
      {
        type: "statRow",
        name: "Effort",
        fields: ["hr", "hrMax", "calories"],
        anchor: { ax: 0.06, ay: 0 },
        origin: { ox: 0, oy: 0 },
        offset: { dx: 0, dy: 560 },
        style: { valueSize: 46, color: WHITE, labelColor: MUTED },
        anim: { preset: "slideUp", delay: 0.5, duration: 0.6, ease: "outCubic" },
      },
      {
        type: "chart",
        kind: "zones",
        name: "Zones",
        w: 880,
        h: 420,
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -280 },
        options: { showPercent: true },
      },
      {
        type: "text",
        name: "Meta",
        text: "{name} · {date}",
        anchor: { ax: 0.06, ay: 1 },
        origin: { ox: 0, oy: 1 },
        offset: { dx: 0, dy: -180 },
        style: { size: 30, weight: 600, color: MUTED, align: "left" },
        anim: { preset: "fadeIn", delay: 0.9, duration: 0.5, ease: "outCubic" },
      },
    ],
  },
  {
    id: "workout",
    name: "Workout",
    desc: "Heart rate trace with the time you put in",
    cat: "Workout",
    requires: ["hr"],
    layers: [
      {
        type: "chart",
        kind: "hr",
        name: "Heart rate",
        w: 1000,
        h: 460,
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: 80 },
        options: { zoneColours: true, bands: true, labels: true },
      },
      {
        type: "stat",
        field: "time",
        name: "Duration",
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 330 },
        layout: "labelAbove",
        style: { valueSize: 190, align: "center", labelColor: MUTED },
      },
      {
        type: "statRow",
        name: "Effort",
        fields: ["hr", "calories"],
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -300 },
        divider: "dot",
        style: { valueSize: 44, color: WHITE, labelColor: MUTED },
      },
    ],
  },
  {
    id: "pb",
    name: "Personal best",
    desc: "For the day it finally happened",
    cat: "Stats",
    requires: [],
    layers: [
      {
        type: "shape",
        shape: "pill",
        name: "PB badge",
        w: 300,
        h: 92,
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 300 },
        style: { fill: VOLT, radius: 999 },
        anim: { preset: "scaleIn", delay: 0.1, duration: 0.6, ease: "spring" },
      },
      {
        type: "text",
        name: "PB label",
        text: "NEW PB",
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 322 },
        style: {
          size: 52,
          weight: 800,
          color: "$bg",
          align: "center",
          letterSpacing: 0.08,
          shadow: false,
        },
        anim: { preset: "scaleIn", delay: 0.15, duration: 0.6, ease: "spring" },
      },
      {
        type: "stat",
        field: "time",
        name: "Time",
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 430 },
        showLabel: false,
        style: { valueSize: 230, align: "center" },
      },
      {
        type: "statRow",
        name: "Stats",
        fields: ["distance", "pace"],
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 700 },
        divider: "dot",
        style: { valueSize: 48 },
      },
      {
        type: "sticker",
        svgId: "medal",
        name: "Medal",
        w: 200,
        h: 200,
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -320 },
        style: { fill: VOLT },
        anim: { preset: "scaleIn", delay: 0.8, duration: 0.7, ease: "spring" },
      },
    ],
  },
  {
    id: "splitsTable",
    name: "Splits",
    desc: "Every kilometre, fastest marked",
    cat: "Stats",
    requires: ["splits"],
    layers: [
      {
        type: "stat",
        field: "distance",
        name: "Distance",
        anchor: { ax: 0.06, ay: 0 },
        origin: { ox: 0, oy: 0 },
        offset: { dx: 0, dy: 290 },
        style: { valueSize: 180 },
      },
      {
        type: "chart",
        kind: "splits",
        name: "Splits",
        w: 880,
        h: 520,
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: 120 },
        options: { showValues: true },
      },
      {
        type: "statRow",
        name: "Stats",
        fields: ["time", "pace", "fastestSplit"],
        anchor: { ax: 0.06, ay: 1 },
        origin: { ox: 0, oy: 1 },
        offset: { dx: 0, dy: -220 },
        style: { valueSize: 42 },
      },
    ],
  },
  {
    id: "trace",
    name: "Trace",
    desc: "The route, coloured by pace",
    cat: "Map",
    requires: ["route"],
    layers: [
      {
        type: "route",
        name: "Route",
        w: 900,
        h: 900,
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: -40 },
        style: {
          mode: "glow",
          colorBy: "pace",
          width: 12,
          markers: { km: true, labels: false, arrows: false },
          endpoints: "dots",
        },
      },
      {
        type: "stat",
        field: "distance",
        name: "Distance",
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -300 },
        showLabel: false,
        style: { valueSize: 200, align: "center" },
      },
      {
        type: "statRow",
        name: "Stats",
        fields: ["time", "pace", "elevation"],
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -210 },
        divider: "dot",
        style: { valueSize: 40 },
      },
    ],
  },
  {
    id: "ribbon",
    name: "Ribbon",
    desc: "Route above its climb profile",
    cat: "Map",
    requires: ["route", "elevation"],
    layers: [
      {
        type: "route",
        name: "Route",
        w: 820,
        h: 620,
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 280 },
        style: { mode: "tube", width: 11, endpoints: "flags" },
      },
      {
        type: "chart",
        kind: "elevation",
        name: "Elevation",
        w: 940,
        h: 300,
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -330 },
        options: { fill: true, labels: true },
      },
      {
        type: "statRow",
        name: "Stats",
        fields: ["distance", "elevation", "time"],
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -210 },
        divider: "dot",
        style: { valueSize: 42 },
      },
    ],
  },
  {
    id: "kit",
    name: "Kit",
    desc: "Your distance as a shirt number",
    cat: "Fun",
    requires: ["distance"],
    layers: [
      {
        type: "shape",
        shape: "rect",
        name: "Stripe",
        w: 1000,
        h: 260,
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: -120 },
        style: { fill: "$accent2", radius: 0 },
        anim: { preset: "slideLeft", delay: 0.1, duration: 0.6, ease: "outCubic" },
      },
      {
        type: "text",
        name: "Name",
        text: "{name|upper}",
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: -120 },
        style: {
          size: 62,
          weight: 800,
          color: WHITE,
          align: "center",
          letterSpacing: 0.1,
          maxWidth: 900,
        },
      },
      {
        type: "stat",
        field: "distance",
        name: "Number",
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: 220 },
        showLabel: false,
        style: { valueSize: 400, valueColor: "$accent", align: "center", letterSpacing: -0.04 },
      },
    ],
  },
  {
    id: "effort",
    name: "Effort",
    desc: "Rings, watch-face style",
    cat: "Health",
    requires: ["hr"],
    layers: [
      {
        type: "chart",
        kind: "rings",
        name: "Rings",
        w: 620,
        h: 620,
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: -60 },
        options: { metrics: ["effort", "hr", "duration"] },
      },
      {
        type: "statRow",
        name: "Stats",
        fields: ["time", "hr", "calories"],
        layout: "grid2",
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -290 },
        style: {
          valueSize: 46,
          panel: { kind: "glass", color: "rgba(255,255,255,0.10)", pad: 28, radius: 24 },
        },
      },
    ],
  },
  {
    id: "hyroxCard",
    name: "HYROX card",
    desc: "Finish time, breakdown and every station",
    cat: "HYROX",
    requires: ["hyrox"],
    layers: [
      {
        type: "text",
        name: "Event",
        text: "{hyroxEvent} · {hyroxDivision}",
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 290 },
        style: {
          size: 36,
          weight: 700,
          color: MUTED,
          align: "center",
          uppercase: true,
          letterSpacing: 0.08,
          maxWidth: 920,
        },
      },
      {
        type: "text",
        name: "Finish time",
        text: "{hyroxTotal}",
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 350 },
        style: {
          size: 200,
          weight: 800,
          font: "cond",
          color: WHITE,
          align: "center",
          letterSpacing: -0.03,
        },
        anim: { preset: "scaleIn", delay: 0.15, duration: 0.7, ease: "spring" },
      },
      {
        type: "hyroxBreakdown",
        name: "Breakdown",
        w: 880,
        h: 210,
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 610 },
      },
      {
        type: "hyroxStations",
        name: "Stations",
        w: 880,
        h: 500,
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -360 },
      },
      {
        type: "text",
        name: "Roxzone",
        text: "Roxzone {roxzone} · {roxzonePercent}% of the race",
        anchor: { ax: 0.5, ay: 1 },
        origin: { ox: 0.5, oy: 1 },
        offset: { dx: 0, dy: -270 },
        style: { size: 32, weight: 600, color: MUTED, align: "center", maxWidth: 920 },
      },
    ],
  },
  {
    id: "hyroxStations",
    name: "HYROX stations",
    desc: "Where the time actually went",
    cat: "HYROX",
    requires: ["hyrox"],
    layers: [
      {
        type: "text",
        name: "Title",
        text: "STATIONS",
        anchor: { ax: 0.06, ay: 0 },
        origin: { ox: 0, oy: 0 },
        offset: { dx: 0, dy: 300 },
        style: { size: 44, weight: 800, color: WHITE, letterSpacing: 0.1 },
      },
      {
        type: "hyroxStations",
        name: "Stations",
        w: 880,
        h: 760,
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: 60 },
      },
      {
        type: "text",
        name: "Slowest",
        text: "Slowest: {slowestStation} · fastest: {fastestStation}",
        anchor: { ax: 0.06, ay: 1 },
        origin: { ox: 0, oy: 1 },
        offset: { dx: 0, dy: -230 },
        style: { size: 30, weight: 600, color: MUTED, maxWidth: 900 },
      },
    ],
  },
  {
    id: "hyroxSplits",
    name: "HYROX splits",
    desc: "All sixteen segments",
    cat: "HYROX",
    requires: ["hyrox"],
    layers: [
      {
        type: "text",
        name: "Finish time",
        text: "{hyroxTotal}",
        anchor: { ax: 0.5, ay: 0 },
        origin: { ox: 0.5, oy: 0 },
        offset: { dx: 0, dy: 280 },
        style: { size: 140, weight: 800, font: "cond", align: "center", letterSpacing: -0.03 },
      },
      {
        type: "hyroxSplits",
        name: "Splits",
        w: 800,
        h: 940,
        anchor: { ax: 0.5, ay: 0.5 },
        origin: { ox: 0.5, oy: 0.5 },
        offset: { dx: 0, dy: 130 },
      },
    ],
  },
];

export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["Stats", "Map", "Health", "Workout", "HYROX", "Fun"];
