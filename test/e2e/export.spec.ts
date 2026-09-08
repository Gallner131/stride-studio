import { expect, test } from "@playwright/test";
import { addFixturePhoto, inspectResultImage, openApp, tab } from "./helpers";

/** Spec §12.3 items 1 and 2 — image and sticker export. */

test("image export produces a full-bleed 1080x1920 PNG (§9.1, Appendix G)", async ({ page }) => {
  const errors = await openApp(page);
  await addFixturePhoto(page);

  await page.locator("[data-testid='export-image']").click();
  const img = await inspectResultImage(page);

  expect(img.width).toBe(1080);
  expect(img.height).toBe(1920);
  // A full export has no transparency anywhere — every corner is opaque.
  expect(img.cornerAlpha, "corners of a full export must be opaque").toEqual([255, 255, 255, 255]);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("sticker export produces a transparent overlay (§9.2)", async ({ page }) => {
  const errors = await openApp(page);
  await addFixturePhoto(page);

  // "Clean stats" keeps its content in the lower third, so the corners stay clear.
  await page.locator("[data-testid='tpl-sticker']").click();
  await page.locator("[data-testid='export-sticker']").click();

  const img = await inspectResultImage(page);
  expect(img.width).toBe(1080);
  expect(img.height).toBe(1920);
  expect(img.cornerAlpha, "sticker corners must be fully transparent").toEqual([0, 0, 0, 0]);
  // But it is not an empty image — the overlay itself is there.
  expect(img.hasOpaquePixels, "sticker must still contain the design").toBe(true);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("export honours the smaller 'faster' size option", async ({ page }) => {
  await openApp(page);
  await addFixturePhoto(page);

  await page.getByRole("button", { name: /faster/ }).click();
  await page.locator("[data-testid='export-image']").click();

  const img = await inspectResultImage(page);
  expect(img.width).toBe(720);
  expect(img.height).toBe(1280);
});

test("export follows the selected format", async ({ page }) => {
  await openApp(page);
  await addFixturePhoto(page);

  await page.getByRole("button", { name: "4:5", exact: true }).click();
  await page.locator("[data-testid='export-image']").click();

  const img = await inspectResultImage(page);
  expect(img.width).toBe(1080);
  expect(img.height).toBe(1350);
});

test("caption copies the headline stats and never mentions Strava (§9.4)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openApp(page);

  await tab(page, "Stats");
  await page.locator("[data-testid='copy-caption']").click();
  await expect(page.locator(".toast")).toHaveText("Caption copied");

  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("Sunday long run");
  expect(clip).toContain("21.1 km");
  expect(clip).toContain("#running");
  expect(clip).not.toContain("Strava");
});
