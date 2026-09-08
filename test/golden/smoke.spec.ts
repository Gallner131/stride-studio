import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import type { GoldenCell } from "../types";

/**
 * Structural check over the whole Matrix A cross product, with NO pixel comparison — so it
 * runs identically on macOS, Linux and CI, unlike the goldens (see compare.ts on why those
 * are container-only).
 *
 * It catches the two failure modes the old screenshot-only Python suite could not (§1.2 E10):
 *   - a template that throws for some activity/format combination;
 *   - a template that renders nothing, or renders a single flat colour.
 *
 * Notably this is what would have caught "Map templates break on a treadmill run" and
 * "workout activity has no distance" (§4.7) before a user found them.
 */
test.describe("golden matrix — structural smoke", () => {
  test("every cell renders without error and produces non-blank output", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/test/golden/harness.html");
    await page.waitForSelector("body[data-ready='1']");

    const harness = await page.evaluate(() => ({
      matrix: window.__golden.matrix,
      widths: window.__golden.WIDTHS,
      fixedDate: window.__golden.FIXED_DATE,
      templates: window.__golden.templates,
      photoAnchors: window.__golden.photoAnchors,
    }));

    // Guard the matrix shape itself, so a template silently dropping out of the catalogue
    // (or out of the matrix) fails here rather than quietly shrinking the safety net.
    expect(harness.templates.length, "legacy template count").toBe(27);
    const expectedCells = 27 * 3 * 2 * 2 + harness.photoAnchors.length * 3;
    expect(harness.matrix.length, "matrix cell count").toBe(expectedCells);
    expect(harness.fixedDate).toBe("2026-09-04T06:42:00.000Z");
    for (const anchor of harness.photoAnchors) {
      expect(harness.templates, `photo anchor "${anchor}" must be a real template`).toContain(anchor);
    }

    const blank: string[] = [];
    const tooUniform: string[] = [];
    const wrongSize: string[] = [];

    for (const cell of harness.matrix as GoldenCell[]) {
      const b64 = await page.evaluate((c) => window.__golden.renderCell(c), cell);
      const png = PNG.sync.read(Buffer.from(b64, "base64"));

      const expectedWidth = harness.widths[cell.tier];
      if (png.width !== expectedWidth) {
        wrongSize.push(`${cell.name}: width ${png.width}, expected ${expectedWidth}`);
      }

      // Sample luminance across a grid; a working render has variation.
      //
      // Canvas PNG data is UNPREMULTIPLIED, so an anti-aliased white glyph is (255,255,255,a)
      // — the RGB never varies and only alpha does. Luminance alone therefore sees just two
      // values on a single-colour sticker render, which is why this composites over the
      // transparent ground before bucketing.
      const values = new Set<number>();
      let opaque = 0;
      const step = 7;
      for (let y = 0; y < png.height; y += step) {
        for (let x = 0; x < png.width; x += step) {
          const i = (y * png.width + x) << 2;
          const a = png.data[i + 3] ?? 0;
          if (a > 8) opaque++;
          const lum =
            0.2126 * (png.data[i] ?? 0) + 0.7152 * (png.data[i + 1] ?? 0) + 0.0722 * (png.data[i + 2] ?? 0);
          values.add(Math.round((lum * a) / 255) >> 2);
        }
      }

      if (opaque === 0) blank.push(cell.name);
      else if (values.size < 6) tooUniform.push(`${cell.name}: only ${values.size} distinct tones`);
    }

    const problems = [
      pageErrors.length ? `page errors:\n  ${pageErrors.join("\n  ")}` : "",
      consoleErrors.length ? `console errors:\n  ${consoleErrors.join("\n  ")}` : "",
      wrongSize.length ? `wrong size:\n  ${wrongSize.join("\n  ")}` : "",
      blank.length ? `fully transparent:\n  ${blank.join("\n  ")}` : "",
      tooUniform.length ? `suspiciously flat:\n  ${tooUniform.join("\n  ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    expect(problems, problems || "all cells rendered").toBe("");
    console.log(`smoke: ${harness.matrix.length} cells rendered cleanly`);
  });
});
