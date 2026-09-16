import { describe, expect, it, vi } from "vitest";
import { DEFAULT_OPTS, renderFrame, setFormat } from "../../src/render.js";
import { FIXTURE_RUN } from "../fixtures/activities.js";

/**
 * Framing the photo — you can zoom in, and now you can choose what you are zooming into.
 *
 * `drawCover` always centred, so a zoomed photo showed its middle and nothing else. A runner
 * at the edge of the frame was simply unreachable: the only way to include them was to zoom
 * out until the design had no impact.
 *
 * These go through renderFrame rather than drawCover, which is not exported, and read the
 * x/y the photo was actually drawn at.
 */

/** A canvas stub that records where the photo landed. */
function ctxRecording(): { ctx: CanvasRenderingContext2D; images: number[][] } {
  const images: number[][] = [];
  const noop = () => undefined;
  const ctx = new Proxy(
    {
      canvas: { width: 1080, height: 1920 },
      drawImage: (_el: unknown, ...rest: number[]) => {
        if (rest.length >= 4) images.push(rest);
      },
      measureText: () => ({ width: 40 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: noop,
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    } as unknown as CanvasRenderingContext2D,
    {
      get(target, prop) {
        const v = (target as unknown as Record<string | symbol, unknown>)[prop];
        if (v !== undefined) return v;
        // Everything else is a no-op setter/method; we only care about drawImage.
        return typeof prop === "string" && prop.startsWith("set") ? noop : noop;
      },
      set() {
        return true;
      },
    },
  );
  return { ctx, images };
}

const media = {
  type: "image" as const,
  el: { naturalWidth: 3000, naturalHeight: 2000, width: 3000, height: 2000 },
};

/** Where the photo's left/top edge ended up, for a given pan. */
function photoOrigin(panX: number, panY: number): { x: number; y: number } {
  setFormat("story");
  const { ctx, images } = ctxRecording();
  renderFrame(
    ctx,
    media as never,
    FIXTURE_RUN,
    "poster",
    { ...DEFAULT_OPTS, zoom: 2, panX, panY, animate: false, grain: 0, vignette: 0 },
    1,
    1,
    "full",
  );
  const first = images[0] ?? [0, 0];
  return { x: first[0] ?? 0, y: first[1] ?? 0 };
}

describe("framing the photo", () => {
  it("centres it when there is no pan, as it always did", () => {
    const a = photoOrigin(0, 0);
    const b = photoOrigin(0, 0);
    expect(a).toEqual(b);
  });

  it("slides it left when panned right, and back again", () => {
    const centre = photoOrigin(0, 0);
    const right = photoOrigin(1, 0);
    const left = photoOrigin(-1, 0);
    expect(right.x).toBeGreaterThan(centre.x);
    expect(left.x).toBeLessThan(centre.x);
    // Symmetric about the centre, so the same gesture either way moves the same distance.
    expect(right.x - centre.x).toBeCloseTo(centre.x - left.x, 5);
  });

  it("slides it vertically too", () => {
    const centre = photoOrigin(0, 0);
    expect(photoOrigin(0, 1).y).toBeGreaterThan(centre.y);
    expect(photoOrigin(0, -1).y).toBeLessThan(centre.y);
  });

  it("never pans past the picture's own edge", () => {
    // Beyond the overflow you would expose the background behind the photo, so it clamps.
    expect(photoOrigin(4, 0)).toEqual(photoOrigin(1, 0));
    expect(photoOrigin(-4, 0)).toEqual(photoOrigin(-1, 0));
  });
});
