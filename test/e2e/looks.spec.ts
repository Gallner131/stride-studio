import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * Looks — §4.5, §6.9. A look is one decision that restyles everything (§3.1 principle 4),
 * so the test that matters is: pick a look, and the whole design changes.
 */

async function applyDesign(page: import("@playwright/test").Page, id = "trace") {
  await tab(page, "Designs");
  await page.locator(`[data-testid='newtpl-${id}']`).click();
}

test("all 24 looks are offered, grouped by family", async ({ page }) => {
  await openApp(page);
  await tab(page, "Look");

  await expect(page.locator("[data-testid^='look-']")).toHaveCount(24);
  // Six families, each with a header.
  await expect(page.locator(".lookstrip")).toHaveCount(6);
});

test("picking a look restyles the whole design in one tap", async ({ page }) => {
  const errors = await openApp(page);
  await applyDesign(page);

  await tab(page, "Look");
  const before = await stageSnapshot(page);
  await page.locator("[data-testid='look-telemetry']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);

  // And a second look changes it again, rather than sticking.
  const afterFirst = await stageSnapshot(page);
  await page.locator("[data-testid='look-broadsheet']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== afterFirst, { timeout: 5000 }).toBe(true);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("every one of the 24 looks renders without error", async ({ page }) => {
  const errors = await openApp(page);
  await applyDesign(page);
  await tab(page, "Look");

  const ids = await page
    .locator("[data-testid^='look-']")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid ?? ""));
  expect(ids.length).toBe(24);

  for (const id of ids) {
    await page.locator(`[data-testid='${id}']`).click();
    const snap = await stageSnapshot(page);
    expect(snap.length, `${id} rendered nothing`).toBeGreaterThan(1000);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("a colour you pick by hand survives a look change (§4.3)", async ({ page }) => {
  await openApp(page);

  // Add text and set an explicit colour — that becomes a literal, not a token.
  await tab(page, "Add");
  await page.locator("[data-testid='add-headline']").click();
  await page.keyboard.press("Escape");
  // Open the Colour section and pick hot pink (index 5 in the swatch list).
  await page.locator("[data-testid='section-colour']").click();
  await page.locator(".ins-body .swatch").nth(5).click();
  const withOverride = await stageSnapshot(page);

  // Swap the look: the design changes elsewhere, but the overridden text keeps its colour,
  // so the frame is not identical to a fresh apply of that look.
  await page.locator("[data-testid='deselect']").click();
  await tab(page, "Look");
  await page.locator("[data-testid='look-telemetry']").click();
  await page.waitForTimeout(200);

  const afterLook = await stageSnapshot(page);
  expect(afterLook).not.toBe(withOverride);

  // The literal is still on the layer: the Text picker shows exactly that swatch selected.
  await tab(page, "Layers");
  await page.locator("[data-testid='layers-list'] .layer-name").first().click();
  await page.locator("[data-testid='section-colour']").click();
  const textPicker = page.locator('.ins-row[aria-label="Text"]');
  await expect(textPicker.locator(".swatch.on")).toHaveCount(1);
  const picked = await textPicker
    .locator(".swatch.on")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  // #FF2D95
  expect(picked).toBe("rgb(255, 45, 149)");
});
