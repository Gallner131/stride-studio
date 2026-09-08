import { expect, test } from "@playwright/test";
import type { GoldenCell } from "../types";
import { compareToGolden, isPinnedEnv, PINNED_ENV_HINT } from "./compare";

/**
 * Matrix A (spec §12.2): every template x 3 formats x 2 looks x 2 activities, rendered from
 * the LEGACY switch-case renderer at 540 px wide with the fixture photo, animation at its
 * final state.
 *
 * This is the fence described in §0.3 and §1.4. Once these are recorded, no change to
 * src/render.js can alter a template's pixels without CI saying so — which is precisely the
 * check that was missing when the element-based rewrite (9988ec1) broke 27 templates
 * silently.
 */

test.describe("golden renders — Matrix A", () => {
  test.skip(!isPinnedEnv(), `not the pinned golden environment.\n${PINNED_ENV_HINT}`);

  test("every matrix cell matches its committed golden", async ({ page }) => {
    const failures: string[] = [];
    const missing: string[] = [];

    page.on("pageerror", (err) => failures.push(`page error: ${err.message}`));

    await page.goto("/test/golden/harness.html");
    await page.waitForSelector("body[data-ready='1']");

    const matrix = (await page.evaluate(() => window.__golden.matrix)) as GoldenCell[];
    expect(matrix.length, "matrix should not be empty").toBeGreaterThan(0);

    for (const cell of matrix) {
      const b64 = await page.evaluate((c) => window.__golden.renderCell(c), cell);
      const actual = Buffer.from(b64, "base64");
      const result = compareToGolden(cell.name, actual);

      if (result.missing) {
        missing.push(cell.name);
      } else if (!result.ok) {
        failures.push(
          `${cell.name}: ${
            result.reason ??
            `${result.diffPixels} px differ ` +
              `(${(result.diffRatio * 100).toFixed(3)}% > ${(0.5).toFixed(1)}%)`
          }`,
        );
      }
    }

    const report = [
      missing.length ? `${missing.length} cell(s) have no committed golden:\n  ${missing.join("\n  ")}` : "",
      failures.length ? `${failures.length} cell(s) differ:\n  ${failures.join("\n  ")}` : "",
      missing.length || failures.length
        ? "\nDiffs (golden | actual | diff) written to test/golden/diffs/.\n" +
          "If the pixels SHOULD change, re-record via the golden-update workflow and label the PR `golden-update` (§12.2)."
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    expect(report, report || "all cells matched").toBe("");
    console.log(`golden: ${matrix.length} cells matched`);
  });
});
