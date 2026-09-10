import { describe, expect, it } from "vitest";
import {
  buildCaption,
  type CaptionInput,
  type CaptionTone,
  mentionsStrava,
  TONES,
} from "../../src/export/caption";
import { decodeLayout, encodeLayout, layoutToDocument, toSharedLayout } from "../../src/export/shareLayout";
import { newDocument, newTextLayer } from "../../src/model/defaults";

/** §2.7 S17 caption tones and S16 layout links. */

const RUN: CaptionInput = {
  name: "Thursday tempo",
  sport: "run",
  distance: "12.1 km",
  time: "58:12",
  pace: "4:48 /km",
  elevation: "84 m",
  hr: "158 bpm",
  calories: "812 kcal",
};

const ALL_TONES: CaptionTone[] = TONES.map((t) => t.id);

describe("caption tones", () => {
  it("offers five voices", () => {
    expect(TONES).toHaveLength(5);
  });

  it("produces a different caption per tone", () => {
    const captions = ALL_TONES.map((t) => buildCaption(RUN, t));
    expect(new Set(captions).size).toBe(5);
  });

  it("is deterministic — the same input always gives the same caption", () => {
    for (const tone of ALL_TONES) {
      expect(buildCaption(RUN, tone)).toBe(buildCaption(RUN, tone));
    }
  });

  it("includes the stats in every tone that claims to", () => {
    for (const tone of ALL_TONES) {
      const caption = buildCaption(RUN, tone);
      expect(caption, tone).toContain("58:12");
      expect(caption, tone).toContain("12.1 km");
    }
  });

  it("never says Strava outside a hashtag (§9.4)", () => {
    for (const tone of ALL_TONES) {
      expect(mentionsStrava(buildCaption(RUN, tone)), tone).toBe(false);
    }
  });

  it("drops the figures the activity does not have", () => {
    const workout: CaptionInput = {
      name: "Strength + core",
      sport: "workout",
      distance: null,
      time: "45:00",
      pace: null,
      elevation: null,
      hr: "132 bpm",
      calories: "410 kcal",
    };
    for (const tone of ALL_TONES) {
      const caption = buildCaption(workout, tone);
      expect(caption, tone).not.toContain("km");
      expect(caption, tone).not.toContain("null");
      expect(caption, tone).not.toContain("undefined");
      expect(caption, tone).toContain("45:00");
      expect(caption, tone).toContain("#workout");
    }
  });

  it("switches hashtags by sport", () => {
    expect(buildCaption({ ...RUN, sport: "ride" }, "deadpan")).toContain("#cycling");
    expect(buildCaption({ ...RUN, sport: "trailrun" }, "deadpan")).toContain("#trailrunning");
    expect(buildCaption({ ...RUN, isHyrox: true }, "deadpan")).toContain("#hyrox");
  });

  it("acknowledges a PB when one is marked", () => {
    expect(buildCaption({ ...RUN, isPb: true }, "hype")).toContain("PB");
    expect(buildCaption({ ...RUN, isPb: true }, "deadpan")).toContain("PB");
  });

  it("gives the data tone labelled rows and no prose", () => {
    const caption = buildCaption(RUN, "data");
    expect(caption).toContain("Distance  12.1 km");
    expect(caption).toContain("Avg HR    158 bpm");
    // No prose: every line is a label and a figure, so none of them ends in a full stop.
    // (A decimal point inside "12.1 km" is not a sentence.)
    for (const line of caption.split("\n")) {
      if (line === "" || line.startsWith("#")) continue;
      expect(line.trimEnd().endsWith("."), line).toBe(false);
    }
  });

  it("mentions the HYROX division and roxzone when it has them", () => {
    const caption = buildCaption(
      { ...RUN, isHyrox: true, hyroxDivision: "Pro", roxzone: "5:05", distance: null, pace: null },
      "deadpan",
    );
    expect(caption).toContain("Pro");
  });
});

describe("share a layout (§2.7 S16)", () => {
  const doc = () => {
    const d = newDocument({ name: "Club house style", lookId: "volt", templateId: "trace" });
    d.layers = [newTextLayer({ text: "{distance} {unit}" }), newTextLayer({ text: "{name}" })];
    return d;
  };

  it("round-trips through a URL fragment", () => {
    const encoded = encodeLayout(doc());
    const { layout, error } = decodeLayout(encoded);
    expect(error).toBeNull();
    expect(layout?.name).toBe("Club house style");
    expect(layout?.lookId).toBe("volt");
    expect(layout?.layers).toHaveLength(2);
  });

  it("strips the activity and the assets, keeping only the layout", () => {
    const source = doc();
    const shared = toSharedLayout(source);
    // No activity, no photo, no ids that only exist on the sender's device.
    expect(Object.keys(shared)).toEqual(["v", "name", "format", "lookId", "templateId", "layers"]);
    expect(JSON.stringify(shared)).not.toContain('assetId":"as_');
  });

  it("compresses to something that fits in a link", () => {
    const encoded = encodeLayout(doc());
    // Two text layers should be well under a kilobyte encoded.
    expect(encoded.length).toBeLessThan(1200);
    expect(encoded).toMatch(/^[A-Za-z0-9+\-$_.!~*'()]+$/);
  });

  it("refuses a damaged link with a plain message", () => {
    expect(decodeLayout("not-compressed-at-all").error).toBeTruthy();
    expect(decodeLayout("").layout).toBeNull();
  });

  it("refuses a layout from a newer version rather than guessing", () => {
    const { compressToEncodedURIComponent } = require("lz-string") as typeof import("lz-string");
    const future = compressToEncodedURIComponent(JSON.stringify({ v: 2, layers: [] }));
    expect(decodeLayout(future).error).toContain("newer version");
  });

  it("marks shared layers as template-owned, so your own additions survive", () => {
    const { layout } = decodeLayout(encodeLayout(doc()));
    if (!layout) throw new Error("failed to decode");
    const built = layoutToDocument(layout, newDocument());
    for (const l of built.layers) expect(l.source).toBe("template");
  });
});
