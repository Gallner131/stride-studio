import { describe, expect, it } from "vitest";
import { exportFileName, STICKER_PADDING, stickerCrop } from "../../src/export/image";
import type { Placed } from "../../src/model/types";

/** §9.1 file naming and §9.2 sticker cropping — the parts that are pure. */

const placed = (x: number, y: number, w: number, h: number): Placed => ({
  id: `p${x}${y}`,
  box: { x, y, w, h },
  rotation: 0,
  corners: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ],
});

const CANVAS = { w: 1000, h: 1778 };

describe("stickerCrop (§9.2)", () => {
  it("crops to the union of the layers, plus padding", () => {
    const rect = stickerCrop([placed(200, 400, 300, 100), placed(300, 600, 200, 80)], CANVAS, 1);
    expect(rect).not.toBeNull();
    if (!rect) return;
    // Union is x 200-500, y 400-680, then 40 units of padding each way.
    expect(rect.x).toBe(200 - STICKER_PADDING);
    expect(rect.y).toBe(400 - STICKER_PADDING);
    expect(rect.w).toBe(300 + STICKER_PADDING * 2);
    expect(rect.h).toBe(280 + STICKER_PADDING * 2);
  });

  it("clamps to the canvas rather than producing negative coordinates", () => {
    const rect = stickerCrop([placed(0, 0, 1000, 200)], CANVAS, 1);
    expect(rect?.x).toBe(0);
    expect(rect?.y).toBe(0);
    expect(rect?.w).toBe(1000);
  });

  it("scales padding so it stays 40 device pixels at 2x", () => {
    const rect = stickerCrop([placed(300, 300, 100, 100)], CANVAS, 2);
    // At 2x, 40 device px is 20 canvas units.
    expect(rect?.x).toBe(280);
  });

  it("returns null when there is nothing to crop to", () => {
    expect(stickerCrop([], CANVAS, 1)).toBeNull();
    expect(stickerCrop([placed(0, 0, 0, 0)], CANVAS, 1)).toBeNull();
  });

  it("accounts for rotation, because the corners are what matter", () => {
    const rotated: Placed = {
      id: "r",
      box: { x: 400, y: 400, w: 200, h: 100 },
      rotation: 45,
      // A 45-degree rotation pushes the corners outside the axis-aligned box.
      corners: [
        [450, 350],
        [600, 450],
        [550, 550],
        [400, 450],
      ],
    };
    const rect = stickerCrop([rotated], CANVAS, 1);
    expect(rect?.y).toBe(350 - STICKER_PADDING);
    expect(rect?.h).toBe(200 + STICKER_PADDING * 2);
  });
});

describe("exportFileName (§9.1)", () => {
  it("builds the documented shape", () => {
    expect(exportFileName("Thursday tempo", "12.1", "km", "2026-09-04T06:42:00Z", "png")).toBe(
      "stride-thursday-tempo-12.1km-20260904.png",
    );
  });

  it("strips characters that break a share target", () => {
    const name = exportFileName("Café run — 5k!", "5.0", "km", "2026-09-04T06:42:00Z", "png");
    expect(name).toBe("stride-cafe-run-5k-5.0km-20260904.png");
    expect(name).toMatch(/^[\w.-]+$/);
  });

  it("omits the distance for an activity that has none", () => {
    expect(exportFileName("Strength", null, "km", "2026-09-04T06:42:00Z", "mp4")).toBe(
      "stride-strength-20260904.mp4",
    );
  });

  it("survives a missing name and a bad date", () => {
    expect(exportFileName("", null, "km", "not a date", "png")).toBe("stride-activity.png");
  });

  it("truncates an absurdly long name", () => {
    const long = "a".repeat(200);
    const name = exportFileName(long, null, "km", "2026-09-04T06:42:00Z", "png");
    expect(name.length).toBeLessThan(70);
  });
});
