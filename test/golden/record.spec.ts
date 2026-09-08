import { expect, test } from "@playwright/test";
import type { GoldenCell } from "../types";
import { isPinnedEnv, PINNED_ENV_HINT, writeSnapshot } from "./compare";

/**
 * Records Matrix A goldens from the legacy renderer (spec §13 Phase 0 step 3).
 *
 * Deliberately gated twice: it only runs when GOLDEN_RECORD=1 (so a normal test run can
 * never overwrite the baseline it is supposed to be checking against), and only inside the
 * pinned container. Drive it through `npm run golden:update`, never directly.
 */
test.describe("golden renders — record baseline", () => {
  test.skip(process.env.GOLDEN_RECORD !== "1", "recording only runs via `npm run golden:update`");
  test.skip(!isPinnedEnv(), `not the pinned golden environment.\n${PINNED_ENV_HINT}`);

  test("record every matrix cell", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`page error: ${err.message}`));

    await page.goto("/test/golden/harness.html");
    await page.waitForSelector("body[data-ready='1']");

    const matrix = (await page.evaluate(() => window.__golden.matrix)) as GoldenCell[];
    expect(matrix.length, "matrix should not be empty").toBeGreaterThan(0);

    for (const cell of matrix) {
      const b64 = await page.evaluate((c) => window.__golden.renderCell(c), cell);
      writeSnapshot(cell.name, Buffer.from(b64, "base64"));
    }

    expect(errors, errors.join("\n")).toEqual([]);
    console.log(`recorded ${matrix.length} goldens`);
  });
});
