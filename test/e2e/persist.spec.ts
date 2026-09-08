import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * Spec §12.3 item 8 — persistence.
 *
 * Note what this test can and cannot assert about v1. "My looks" (an `opts` blob in
 * localStorage) survives a reload; the DESIGN does not — no document, photo or template
 * choice is persisted (§1.1 A8). The second test pins that gap deliberately, so when
 * Phase 1 adds autosave the test flips from documenting a limitation to asserting a
 * feature, and nobody has to remember it was missing.
 */

test("a saved look survives a reload and re-applies", async ({ page }) => {
  await openApp(page);

  // Make a change worth saving, then save it as a look.
  await tab(page, "Look");
  await page.locator("[aria-label='Volt']").first().click();

  await tab(page, "Adjust");
  await page.locator("[data-testid='look-name']").fill("Club style");
  await page.locator("[data-testid='save-look']").click();
  await expect(page.locator(".toast")).toContainText('Saved "Club style"');

  const stored = await page.evaluate(() => localStorage.getItem("stride.looks"));
  expect(stored).toContain("Club style");

  // Reload: the look is still offered.
  await page.reload();
  await page.waitForSelector("[data-testid='stage']");
  await tab(page, "Adjust");
  await expect(page.locator("[data-testid='look-Club style']")).toBeVisible();

  // And applying it changes the design.
  const before = await stageSnapshot(page);
  await page.locator("[data-testid='look-Club style']").click();
  await expect(page.locator(".toast")).toContainText('Applied "Club style"');
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("documents that the design itself is NOT persisted (§1.1 A8)", async ({ page }) => {
  await openApp(page);

  await page.locator("[data-testid='tpl-receipt']").click();
  await expect(page.locator("[data-testid='tpl-receipt']")).toHaveClass(/on/);

  await page.reload();
  await page.waitForSelector("[data-testid='stage']");

  // Back to the default template: five minutes of work would be lost on a Safari reload.
  // Phase 1 (§13) adds autosave; when it lands, invert this assertion.
  await expect(page.locator("[data-testid='tpl-sticker']")).toHaveClass(/on/);
  await expect(page.locator("[data-testid='tpl-receipt']")).not.toHaveClass(/on/);
});
