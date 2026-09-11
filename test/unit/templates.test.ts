import { describe, expect, it } from "vitest";
import {
  type ActivityCapabilities,
  buildTemplateLayers,
  TEMPLATE_BY_ID,
  TEMPLATES,
  templateAvailable,
  unavailableReason,
} from "../../src/templates";

/** §4.8: templates are data, and the data must be valid before a user ever sees it. */

const ALL: ActivityCapabilities = {
  route: true,
  hr: true,
  splits: true,
  elevation: true,
  distance: true,
  hyrox: true,
};
const NONE: ActivityCapabilities = {
  route: false,
  hr: false,
  splits: false,
  elevation: false,
  distance: false,
  hyrox: false,
};

describe("template definitions", () => {
  it("all have unique ids", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it("all have a name, description and category", () => {
    for (const t of TEMPLATES) {
      expect(t.name, t.id).toBeTruthy();
      expect(t.desc, t.id).toBeTruthy();
      expect(t.cat, t.id).toBeTruthy();
    }
  });

  it("all have at least one layer", () => {
    for (const t of TEMPLATES) expect(t.layers.length, t.id).toBeGreaterThan(0);
  });
});

describe("buildTemplateLayers", () => {
  it("instantiates every template without throwing", () => {
    for (const t of TEMPLATES) {
      const layers = buildTemplateLayers(t);
      expect(layers.length, t.id).toBe(t.layers.length);
    }
  });

  it("gives every layer a unique id", () => {
    for (const t of TEMPLATES) {
      const ids = buildTemplateLayers(t).map((l) => l.id);
      expect(new Set(ids).size, t.id).toBe(ids.length);
    }
  });

  it("marks layers as template-owned, so a template switch replaces them (§6.8)", () => {
    for (const t of TEMPLATES) {
      for (const l of buildTemplateLayers(t)) expect(l.source, t.id).toBe("template");
    }
  });

  it("produces fresh ids on each call, so applying twice does not collide", () => {
    const def = TEMPLATE_BY_ID.get("pb");
    if (!def) throw new Error("missing fixture template");
    const a = buildTemplateLayers(def).map((l) => l.id);
    const b = buildTemplateLayers(def).map((l) => l.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it("deep-merges overrides onto the layer defaults", () => {
    const def = TEMPLATE_BY_ID.get("trace");
    if (!def) throw new Error("missing fixture template");
    const route = buildTemplateLayers(def).find((l) => l.type === "route");
    expect(route).toBeDefined();
    if (route?.type !== "route") throw new Error("expected a route layer");

    // Overridden...
    expect(route.style.mode).toBe("glow");
    expect(route.style.colorBy).toBe("pace");
    expect(route.style.markers.km).toBe(true);
    // ...while untouched siblings keep their defaults, which is what deep merge buys.
    expect(route.style.markers.arrows).toBe(false);
    expect(route.style.endpoints).toBe("dots");
    expect(route.style.simplify).toBe(2);
  });

  // A layer wider than the canvas is almost always a mistake — except when a design means
  // to bleed off the edge, which is a real technique and how "bleed" gets its name. The
  // difference is declared: bleeding deliberately means opting out of the safe zone, so
  // that opt-out is what this allows, rather than simply raising the ceiling for everyone.
  it("keeps every layer inside the canvas width unless it deliberately bleeds", () => {
    for (const t of TEMPLATES) {
      for (const l of buildTemplateLayers(t)) {
        if (typeof l.w !== "number") continue;
        if (l.constraints.safeZone === false) continue;
        expect(l.w, `${t.id}/${l.name}`).toBeLessThanOrEqual(1000);
      }
    }
  });

  it("only lets a layer past the canvas edge when it has opted out of the safe zone", () => {
    const bleeding = TEMPLATES.flatMap((t) =>
      buildTemplateLayers(t)
        .filter((l) => typeof l.w === "number" && (l.w as number) > 1000)
        .map((l) => `${t.id}/${l.name}`),
    );
    // Kept as an explicit list so a new one is a decision somebody made, not a drift.
    expect(bleeding).toEqual(["bleed/Route"]);
  });
});

describe("availability", () => {
  it("offers everything when the activity has everything", () => {
    for (const t of TEMPLATES) expect(templateAvailable(t, ALL), t.id).toBe(true);
  });

  it("hides data-hungry templates when the activity has nothing", () => {
    const available = TEMPLATES.filter((t) => templateAvailable(t, NONE));
    // Only templates with no requirements survive.
    for (const t of available) expect(t.requires, t.id).toEqual([]);
    expect(available.length).toBeGreaterThan(0);
  });

  it("explains what is missing rather than just refusing", () => {
    const trace = TEMPLATE_BY_ID.get("trace");
    if (!trace) throw new Error("missing fixture template");
    expect(unavailableReason(trace, NONE)).toBe("Needs GPS");
    expect(unavailableReason(trace, ALL)).toBeNull();

    const ribbon = TEMPLATE_BY_ID.get("ribbon");
    if (!ribbon) throw new Error("missing fixture template");
    expect(unavailableReason(ribbon, NONE)).toBe("Needs GPS and elevation");
  });

  it("gates the HYROX designs on a HYROX result", () => {
    const hyroxTemplates = TEMPLATES.filter((t) => t.cat === "HYROX");
    expect(hyroxTemplates.length).toBeGreaterThan(0);
    for (const t of hyroxTemplates) {
      expect(t.requires, t.id).toContain("hyrox");
      expect(templateAvailable(t, { ...ALL, hyrox: false }), t.id).toBe(false);
    }
  });
});
