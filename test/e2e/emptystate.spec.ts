import { expect, test } from "@playwright/test";
import { openApp, tab } from "./helpers";

// Before a photo is added, the stage still draws a full design — that is the point of the
// product, and §3.8's empty state assumes you can see it. The placeholder used to be a
// full-bleed label with a 35 % grey wash painted straight over that design, so the two
// competed and neither was legible. Worse, it sat *under* .overlay-canvas (z-index 2), so
// its own "Tap to choose" instruction did nothing at all: the overlay swallowed the click.

test("the photo prompt does not cover the design", async ({ page }) => {
  await openApp(page);

  const stage = await page.locator(".stage").boundingBox();
  const prompt = await page.locator("[data-testid='add-media']").boundingBox();
  if (!stage || !prompt) throw new Error("stage or prompt missing");

  const coverage = (prompt.width * prompt.height) / (stage.width * stage.height);
  expect(coverage).toBeLessThan(0.2);
});

test("tapping the photo prompt opens the file picker", async ({ page }) => {
  await openApp(page);

  const chooser = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.locator("[data-testid='add-media']").click();
  expect(await chooser).toBeTruthy();
});

test("the design stays editable in the empty state", async ({ page }) => {
  await openApp(page);

  // Add something, deselect, then tap it on the canvas. The prompt must not intercept.
  await tab(page, "Add");
  await page.locator("[data-testid='add-headline']").click();
  await page.keyboard.press("Escape");
  await page.locator("[data-testid='deselect']").click();
  await expect(page.locator("[data-testid='deselect']")).toHaveCount(0);

  // Proportional, not absolute: the stage is much wider on the desktop viewport.
  const overlay = page.locator("[data-testid='overlay']");
  const box = await overlay.boundingBox();
  if (!box) throw new Error("no overlay");
  await overlay.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.locator("[data-testid='deselect']")).toHaveCount(1);
});
