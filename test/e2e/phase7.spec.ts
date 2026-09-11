import { expect, test } from "@playwright/test";
import { openApp, tab } from "./helpers";

/** §2.7 S16/S17 and §8: layout links, caption tones, My designs. */

test("a design saves itself and appears in My designs (§8)", async ({ page }) => {
  await openApp(page);

  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();

  // Autosave debounces 500 ms; the gallery reads from IndexedDB.
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForSelector("[data-testid='stage']");
  await tab(page, "Designs");

  await expect(page.locator(".designs .design").first()).toBeVisible();
  await expect(page.locator(".designs")).toContainText("element");
});

test("a layout link round-trips through the URL, with no server (§2.7 S16)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = await openApp(page);

  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-trace']").click();
  await tab(page, "Designs");

  await page.locator("[data-testid='share-layout']").click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("#layout=");

  // Open the link in a clean page: the layout arrives, with no photo or activity attached.
  const fresh = await context.newPage();
  await fresh.goto(url);
  await fresh.waitForSelector("[data-testid='stage']");

  // Assert the outcome, not the toast: a toast clears after a couple of seconds.
  await fresh.locator("[data-testid='tab-layers']").click();
  await expect(fresh.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(3);

  // The fragment is cleared, so a refresh does not re-import.
  expect(await fresh.evaluate(() => window.location.hash)).toBe("");

  expect(errors, errors.join("\n")).toEqual([]);
  await fresh.close();
});

test("a damaged layout link says so rather than failing silently", async ({ page }) => {
  // A fresh navigation, not a hash change: changing only the fragment is a same-document
  // navigation, so the mount effect that reads the link would never run.
  await page.goto("/dist/index.html#layout=this-is-not-compressed");
  await page.waitForSelector("[data-testid='stage']");
  await expect(page.locator(".error")).toContainText("damaged");
});

test("share this layout only appears once there is a layout to share", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");
  await expect(page.locator("[data-testid='share-layout']")).toHaveCount(0);

  await page.locator("[data-testid='newtpl-pb']").click();
  await tab(page, "Designs");
  await expect(page.locator("[data-testid='share-layout']")).toBeVisible();
});
