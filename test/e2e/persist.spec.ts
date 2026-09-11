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

test("documents that the design itself is NOT persisted (§1.1 A8)", async ({ page }) => {
  await openApp(page);

  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();
  await expect(page.locator("[data-testid='tab-layers']")).toContainText("(");

  await page.reload();
  await page.waitForSelector("[data-testid='stage']");

  // Back to an empty design: five minutes of work would be lost on a Safari reload.
  // Phase 1 (§13) adds autosave; when it lands, invert this assertion.
  await expect(page.locator("[data-testid='tab-layers']")).not.toContainText("(");
});
