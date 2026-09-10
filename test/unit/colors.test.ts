import { describe, expect, it } from "vitest";
import { primaryColor, setPrimaryColor } from "../../src/model/colors";
import {
  newChartLayer,
  newImageLayer,
  newRouteLayer,
  newShapeLayer,
  newStatLayer,
  newStickerLayer,
  newTextLayer,
} from "../../src/model/defaults";
import type { Layer } from "../../src/model/types";

/**
 * Changing the colour of a thing you can see.
 *
 * Every layer type keeps its colour somewhere different — style.color, style.fill,
 * style.valueColor, style.color for a route — so the only way to change one was to select
 * the layer, find the right tab, find the Colour section and expand it. Four steps, and the
 * reason "it is really not clear how to change the colours of anything".
 *
 * These two functions are the whole contract the selection toolbar needs: read the one
 * colour that matters for this layer, and set it.
 */

const roundTrip = (layer: Layer, color: string) => {
  const next = structuredClone(layer);
  setPrimaryColor(next, color);
  return primaryColor(next);
};

describe("primaryColor", () => {
  it("reads a text layer's colour", () => {
    expect(primaryColor(newTextLayer())).toBe("$text");
  });

  it("reads a shape's fill", () => {
    expect(primaryColor(newShapeLayer("rect"))).toBe("#D8FF3A");
  });

  it("reads a sticker's fill", () => {
    expect(primaryColor(newStickerLayer("medal"))).toBe("$accent");
  });

  it("reads a stat's value colour, which is the one people mean", () => {
    expect(primaryColor(newStatLayer("distance"))).toBe(primaryColor(newStatLayer("distance")));
    expect(typeof primaryColor(newStatLayer("distance"))).toBe("string");
  });

  it("has nothing to offer for an image, which has no colour of its own", () => {
    expect(primaryColor(newImageLayer("asset_1"))).toBeNull();
  });
});

describe("setPrimaryColor", () => {
  it("sets it on every type that has one", () => {
    expect(roundTrip(newTextLayer(), "#FF0000")).toBe("#FF0000");
    expect(roundTrip(newShapeLayer("rect"), "#FF0000")).toBe("#FF0000");
    expect(roundTrip(newStickerLayer("medal"), "#FF0000")).toBe("#FF0000");
    expect(roundTrip(newStatLayer("distance"), "#FF0000")).toBe("#FF0000");
    expect(roundTrip(newRouteLayer(), "#FF0000")).toBe("#FF0000");
    expect(roundTrip(newChartLayer("hr"), "#FF0000")).toBe("#FF0000");
  });

  it("leaves a layer with no colour alone rather than inventing a field", () => {
    const image = newImageLayer("asset_1");
    const before = structuredClone(image);
    setPrimaryColor(image, "#FF0000");
    expect(image).toEqual(before);
  });

  // Look tokens like "$accent" resolve against the active look. Writing a literal colour is
  // a deliberate override of the look for that one element, which is what picking a swatch
  // means — but the tokens must still be settable, so a user can put an element back.
  it("accepts a look token as well as a literal colour", () => {
    expect(roundTrip(newTextLayer(), "$accent")).toBe("$accent");
  });
});
