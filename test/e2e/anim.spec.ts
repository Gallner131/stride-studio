import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

test("animation can actually be turned off, and stays off", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();

  // With animation on, consecutive frames differ.
  const a = await stageSnapshot(page);
  await page.waitForTimeout(400);
  const b = await stageSnapshot(page);
  expect(a).not.toBe(b);

  // Turn it off from the toolbar.
  await page.locator("[data-testid='toggle-animate']").click();
  await expect(page.locator("[data-testid='toggle-animate']")).toHaveText("Still");
  await page.waitForTimeout(300);

  // Now the canvas is genuinely static.
  const c = await stageSnapshot(page);
  await page.waitForTimeout(500);
  expect(await stageSnapshot(page)).toBe(c);
});

test("a pulsing element does not vanish when animation is off", async ({ page }) => {
  await openApp(page);
  await tab(page, "Add");
  await page.locator("[data-testid='add-headline']").click();
  await page.keyboard.press("Escape");

  // Give it the looping preset, which used to compute a NaN scale at t = Infinity.
  await tab(page, "Style");
  await page.locator("[data-testid='section-animation']").click();
  await page.locator("[data-testid='anim-preset']").selectOption("pulse");

  await page.locator("[data-testid='deselect']").click();
  await page.locator("[data-testid='toggle-animate']").click();
  await page.waitForTimeout(300);

  // The element must still be drawn: compare against a blank-ish canvas by checking the
  // design differs from one with the layer hidden.
  const withLayer = await stageSnapshot(page);
  await tab(page, "Layers");
  await page.locator(".layer-row .layer-btn").first().click(); // hide it
  await page.waitForTimeout(200);
  const withoutLayer = await stageSnapshot(page);
  expect(withLayer).not.toBe(withoutLayer);
});
