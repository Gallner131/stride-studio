import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/**
 * The app is one editor now.
 *
 * It used to open on the Style tab, where the 27 legacy templates are drawn as a flat canvas
 * and nothing can be tapped or moved — so the first thing a new user met was the half of the
 * app that does not work the way the product is meant to. Nine tabs did not help.
 */

test("the app opens on Designs, with four tabs", async ({ page }) => {
  const errors = await openApp(page);

  await expect(page.locator("[data-testid='tab-designs']")).toHaveClass(/on/);
  await expect(page.locator(".tabs button")).toHaveCount(4);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("the legacy tabs are gone", async ({ page }) => {
  await openApp(page);

  for (const id of ["tab-style", "tab-text", "tab-stats", "tab-adjust", "tab-hyrox"]) {
    await expect(page.locator(`[data-testid='${id}']`)).toHaveCount(0);
  }
  // And with them the 27-thumbnail legacy gallery.
  await expect(page.locator("[data-testid^='tpl-']")).toHaveCount(0);
});

test("the inspector is reachable from any tab, not just one", async ({ page }) => {
  await openApp(page);

  // Add something from the Add tab; its editor must appear without hunting for a tab.
  await page.locator("[data-testid='tab-add']").click();
  await page.locator("[data-testid='add-headline']").click();
  await page.keyboard.press("Escape");

  await expect(page.locator("[data-testid='inspector']")).toBeVisible();
});
