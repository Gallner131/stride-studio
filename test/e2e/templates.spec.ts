import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * Data-driven templates — §4.8, §6.8. These are whole designs assembled from the element
 * model, so applying one must (a) change the design, (b) leave every part editable, and
 * (c) never be offered for an activity that cannot fill it.
 */

test("applying a template builds a whole design out of editable elements", async ({ page }) => {
  const errors = await openApp(page);
  const before = await stageSnapshot(page);

  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-trace']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);

  // Every part of it is a layer, not a fillText call — which is the whole point of Phase 2.
  await tab(page, "Layers");
  const rows = page.locator("[data-testid='layers-list'] .layer-row");
  await expect(rows).toHaveCount(3);
  await expect(page.locator("[data-testid='layers-list']")).toContainText("Route");

  expect(errors, errors.join("\n")).toEqual([]);
});

test("applying a template keeps the layers you added yourself (§6.8)", async ({ page }) => {
  await openApp(page);

  // Add a text layer of my own.
  await tab(page, "Add");
  await page.locator("[data-testid='add-text']").click();
  await page.locator("[data-testid='inline-text']").fill("Mine");
  await page.keyboard.press("Escape");

  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();

  await tab(page, "Layers");
  // 5 template layers + my 1.
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(6);
  await expect(page.locator("[data-testid='layers-list']")).toContainText("Mine");
});

test("switching templates replaces the previous template's layers", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");

  await page.locator("[data-testid='newtpl-pb']").click();
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(5);

  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-trace']").click();
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(3);
});

test("a template's elements can be edited after applying", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();

  await tab(page, "Layers");
  await page.locator("[data-testid='layers-list'] .layer-name").first().click();

  // The inspector opens for whatever was tapped, and editing it changes the design.
  const before = await stageSnapshot(page);
  await page.locator(".ins-body .swatch").first().click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("category filters narrow the gallery", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");

  const all = await page.locator("[data-testid^='newtpl-']").count();
  await page.locator("[data-testid='tplcat-HYROX']").click();
  const hyroxOnly = await page.locator("[data-testid^='newtpl-']").count();

  expect(hyroxOnly).toBeGreaterThan(0);
  expect(hyroxOnly).toBeLessThan(all);
});
