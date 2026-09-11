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

test("the preview settles and stays settled, with no photo and no interaction", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();

  // ANIM_SECONDS is 6. Give it a second's grace to finish and hold.
  await page.waitForTimeout(7000);
  const settled = await stageSnapshot(page);

  // The old clock replayed every ANIM_SECONDS + 2.5 = 8.5 s, so a frame sampled here landed
  // mid count-up and showed a different distance for the same activity. Crossing that
  // boundary must now change nothing at all.
  await page.waitForTimeout(4500);
  expect(await stageSnapshot(page)).toBe(settled);
});

test("a pulsing element does not vanish when animation is off", async ({ page }) => {
  await openApp(page);
  await tab(page, "Add");
  await page.locator("[data-testid='add-headline']").click();
  await page.keyboard.press("Escape");

  // Give it the looping preset, which used to compute a NaN scale at t = Infinity.
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
