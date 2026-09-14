import { expect, test } from "@playwright/test";
import { openApp, tab } from "./helpers";

/**
 * §6.11 — the Settings sheet. PR-A4 made `prefs.hrMax` a source of zones; until this sheet
 * exists there is no way for anyone to set it, so the feature is unreachable.
 *
 * The second test is the one that matters. Saving a preference and applying it are separate
 * things, and "it saved, but you have to reload" is the failure mode worth catching.
 */

/** The design at `session` carries a zones chart. */
const ZONES_DESIGN = "newtpl-session";

function stageSnapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-testid='stage']");
    return c ? c.toDataURL("image/png") : "";
  });
}

/** The charts draw in over ANIM_SECONDS = 6 and then hold; capture only once they have. */
const SETTLE_MS = 7500;

test("the sheet opens, saves a max heart rate, and remembers it across a reload", async ({ page }) => {
  await openApp(page);

  await page.getByTestId("settings-button").click();
  await expect(page.getByTestId("settings-sheet")).toBeVisible();

  await page.getByTestId("prefs-hrmax").fill("192");
  await page.getByTestId("settings-close").click();
  await expect(page.getByTestId("settings-sheet")).toHaveCount(0);

  await page.reload();
  await page.waitForSelector("[data-testid='stage']");
  await page.getByTestId("settings-button").click();
  await expect(page.getByTestId("prefs-hrmax")).toHaveValue("192");
});

test("all three sections are on the sheet", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("settings-button").click();

  await expect(page.getByTestId("prefs-units")).toBeVisible();
  await expect(page.getByTestId("prefs-hrmax")).toBeVisible();
  await expect(page.getByTestId("prefs-safezones")).toBeVisible();
});

test("setting a max heart rate redraws the zones chart without a reload", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");
  await page.locator(`[data-testid='${ZONES_DESIGN}']`).click();
  await page.waitForTimeout(SETTLE_MS);
  const before = await stageSnapshot(page);

  await page.getByTestId("settings-button").click();
  await page.getByTestId("prefs-hrmax").fill("190");
  await page.getByTestId("settings-close").click();
  await page.waitForTimeout(SETTLE_MS);
  const after = await stageSnapshot(page);

  // Saved AND applied. If the sheet only wrote to storage, these would match until reload.
  expect(before).not.toBe(after);
});
