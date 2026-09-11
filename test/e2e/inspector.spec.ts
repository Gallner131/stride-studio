import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * §6.5. "It is really not clear how to change the colours of anything."
 *
 * Colour existed, three sections down inside a collapsed panel behind a tab. It is now the
 * first control in every element's editor, open by default.
 */

test("colour is the first thing you see after tapping an element", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  await tab(page, "Add");
  await page.locator("[data-testid='add-headline']").click();
  await page.keyboard.press("Escape");

  const inspector = page.locator("[data-testid='inspector']");
  await expect(inspector).toBeVisible();

  // The Colour section is open, and its swatches are reachable without scrolling.
  const colour = inspector.locator("[data-testid='section-colour']");
  await expect(colour).toBeVisible();

  const box = await colour.boundingBox();
  expect(box, "the colour control should be laid out").not.toBeNull();
  if (!box) return;
  expect(box.y, "colour must be above the fold on a 390x844 phone").toBeLessThan(844);
});

test("changing the colour changes the layer", async ({ page }) => {
  await openApp(page);
  await tab(page, "Add");
  await page.locator("[data-testid='add-headline']").click();
  await page.keyboard.press("Escape");

  // Let the entry animation settle, or the canvas would differ on its own.
  await page.waitForTimeout(7000);
  const before = await stageSnapshot(page);

  // Drive it through the UI rather than the store: pick a swatch the way a user would.
  const swatch = page.locator("[data-testid='inspector'] .swatch").nth(2);
  await expect(swatch).toBeVisible();
  await swatch.click();

  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});
