import { describe, expect, it } from "vitest";
import { STAT_FIELDS } from "../../src/engine/dataLayers";
import { STICKER_BY_ID } from "../../src/engine/stickers";
import { tokenTable } from "../../src/engine/tokens";
import { DEFAULT_LOOK_ID, getLook } from "../../src/looks/index";
import { bindingsUsed } from "../../src/model/bindings";
import type { Layer } from "../../src/model/types";
import { buildTemplateLayers, TEMPLATES } from "../../src/templates/index";

/**
 * A design is data, so the things that break one are data mistakes — and every one of them
 * fails quietly rather than loudly:
 *
 *   - An unknown look token is left as-is by resolveTokens, so `"$brand"` reaches the canvas
 *     as a fillStyle string. Canvas ignores an invalid colour and keeps the previous one, so
 *     the layer renders in whatever colour happened to be set last.
 *   - A literal hex where a token belongs renders perfectly — and then ignores every look,
 *     which is the one feature the Looks tab exists for.
 *   - An unknown sticker id draws nothing at all.
 *   - A binding nobody provides prints as an empty string, so the design silently loses a line.
 *   - A `requires` list that understates what a design needs offers that design to an
 *     activity that cannot fill it, and the user gets a blank hole.
 *
 * None of these throw, so none of them show up in the render smoke test. Hence this.
 */

const defaultLook = getLook(DEFAULT_LOOK_ID);
if (!defaultLook) throw new Error("the default look is missing");
const VALID_TOKENS = new Set(Object.keys(tokenTable(defaultLook)));

const VALID_BINDINGS = new Set([
  // Everything buildFields() puts on the table...
  "name",
  "date",
  "distance",
  "unit",
  "time",
  "pace",
  "paceValue",
  "hr",
  "hrMax",
  "calories",
  "elevation",
  "elevUnit",
  "sport",
  "startTime",
  "fastestSplit",
  "splitCount",
  // ...plus what hyroxFields() adds when a HYROX result is loaded.
  "avgRun",
  "fastestRun",
  "fastestStation",
  "hyroxAgeGroup",
  "hyroxDivision",
  "hyroxEvent",
  "hyroxFieldSize",
  "hyroxRank",
  "hyroxTotal",
  "roxzone",
  "roxzonePercent",
  "runDistance",
  "runPace",
  "runTotal",
  "slowestStation",
  "stationTotal",
]);

const VALID_CHART_KINDS = new Set(["hr", "pace", "elevation", "splits", "zones", "rings"]);
const VALID_SHAPES = new Set(["rect", "pill", "ellipse", "line", "tape"]);
// Taken from the app's own list rather than restated, so the two cannot drift.
const VALID_STAT_FIELDS = new Set(STAT_FIELDS.map((f) => f.id));
const VALID_PRESETS = new Set([
  "none",
  "fadeIn",
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "scaleIn",
  "countUp",
  "typewriter",
  "pulse",
]);

/** Every string anywhere in a layer, with the path that reached it. */
function strings(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[value, path]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

/** Keys whose value is a colour, and so must be a token rather than a literal. */
const COLOUR_KEY = /(^|\.)(color|colour|fill|stroke|valueColor|labelColor|bg|background)$/i;

describe.each(TEMPLATES.map((t) => [t.id, t] as const))("template %s", (id, def) => {
  const layers = buildTemplateLayers(def);

  it("has usable metadata", () => {
    expect(def.name.length, `${id} needs a name`).toBeGreaterThan(0);
    expect(def.desc.length, `${id} needs a description`).toBeGreaterThan(0);
    expect(layers.length, `${id} has no layers`).toBeGreaterThan(0);
  });

  it("only uses look tokens that resolve", () => {
    for (const layer of layers) {
      for (const [value, path] of strings(layer)) {
        if (!value.startsWith("$")) continue;
        expect(VALID_TOKENS.has(value.slice(1)), `${id}: unknown token ${value} at ${path}`).toBe(true);
      }
    }
  });

  it("uses tokens rather than literal colours, so looks actually apply", () => {
    for (const layer of layers) {
      for (const [value, path] of strings(layer)) {
        if (!HEX.test(value)) continue;
        expect(COLOUR_KEY.test(path), `${id}: literal colour ${value} at ${path}`).toBe(false);
      }
    }
  });

  it("only references stickers, charts, shapes, fields and presets that exist", () => {
    for (const layer of layers as Layer[]) {
      if (layer.type === "sticker") {
        expect(STICKER_BY_ID.has(layer.svgId), `${id}: no sticker "${layer.svgId}"`).toBe(true);
      }
      if (layer.type === "chart") {
        expect(VALID_CHART_KINDS.has(layer.kind), `${id}: no chart kind "${layer.kind}"`).toBe(true);
      }
      if (layer.type === "shape") {
        expect(VALID_SHAPES.has(layer.shape), `${id}: no shape "${layer.shape}"`).toBe(true);
      }
      if (layer.type === "stat") {
        expect(VALID_STAT_FIELDS.has(layer.field), `${id}: no stat field "${layer.field}"`).toBe(true);
      }
      if (layer.type === "statRow") {
        for (const f of layer.fields) {
          expect(VALID_STAT_FIELDS.has(f), `${id}: no stat field "${f}" in the row`).toBe(true);
        }
      }
      expect(VALID_PRESETS.has(layer.anim.preset), `${id}: no anim preset "${layer.anim.preset}"`).toBe(true);
    }
  });

  it("only interpolates bindings the app provides", () => {
    for (const layer of layers as Layer[]) {
      if (layer.type !== "text") continue;
      for (const binding of bindingsUsed(layer.text)) {
        expect(VALID_BINDINGS.has(binding), `${id}: unknown binding {${binding}}`).toBe(true);
      }
    }
  });

  // An honest `requires` is what stops a design being offered for a run that cannot fill it.
  it("declares everything it depends on", () => {
    const needs = new Set(def.requires);
    for (const layer of layers as Layer[]) {
      if (layer.type === "route") {
        expect(needs.has("route"), `${id}: draws a route but does not require one`).toBe(true);
      }
      if (layer.type === "chart") {
        const need =
          layer.kind === "hr" || layer.kind === "zones" || layer.kind === "rings"
            ? "hr"
            : layer.kind === "splits" || layer.kind === "pace"
              ? "splits"
              : "elevation";
        expect(needs.has(need), `${id}: has a ${layer.kind} chart but does not require ${need}`).toBe(true);
      }
    }
  });
});

describe("the catalogue as a whole", () => {
  it("has no duplicate ids", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(ids.length, `duplicate id in ${ids.join(", ")}`).toBe(new Set(ids).size);
  });

  // A plain run with no GPS, no heart rate and no splits must still find designs to use,
  // or the gallery is empty for exactly the person least likely to forgive it.
  it("offers several designs to an activity with nothing but a distance and a time", () => {
    const plain = TEMPLATES.filter((t) => t.requires.every((r) => r === "distance"));
    expect(plain.length, "too few designs work without GPS or heart rate").toBeGreaterThanOrEqual(6);
  });
});
