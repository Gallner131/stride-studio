import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * §6.5. "It is really not clear how to change the colours of anything", and "I still cannot
 * see how you remove things you have added".
 *
 * Both had the same cause: the controls existed, but behind a tab and a collapsed section.
 * They now come to the selection.
 */

async function addText(page: import("@playwright/test").Page, text: string) {
  await tab(page, "Add");
  await page.locator("[data-testid='add-text']").click();
  await page.locator("[data-testid='inline-text']").fill(text);
  await page.keyboard.press("Escape");
}

test("selecting something shows a toolbar on it", async ({ page }) => {
  await openApp(page);
  await expect(page.locator("[data-testid='selection-bar']")).toHaveCount(0);

  await addText(page, "Hello");
  await expect(page.locator("[data-testid='selection-bar']")).toBeVisible();
});

test("colour can be changed from the selection, without opening a tab", async ({ page }) => {
  await openApp(page);
  await addText(page, "Recolour me");

  const before = await stageSnapshot(page);
  await page.locator("[data-testid='selbar-color']").click();
  await expect(page.locator("[data-testid='selbar-palette']")).toBeVisible();
  await expect(page.locator("[data-testid='palette-picker']")).toBeVisible();
  await page.locator("[data-testid='palette-F4564C']").click();

  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("the toolbar deletes what is selected", async ({ page }) => {
  await openApp(page);
  await addText(page, "Delete me");
  await expect(page.locator("[data-testid='tab-layers']")).toContainText("(1)");

  await page.locator("[data-testid='selbar-delete']").click();
  await expect(page.locator("[data-testid='tab-layers']")).not.toContainText("(");
  await expect(page.locator("[data-testid='selection-bar']")).toHaveCount(0);
});

test("the toolbar duplicates what is selected", async ({ page }) => {
  await openApp(page);
  await addText(page, "Twice");

  await page.locator("[data-testid='selbar-duplicate']").click();
  await expect(page.locator("[data-testid='tab-layers']")).toContainText("(2)");
});

test("a colour applies to everything selected at once", async ({ page }) => {
  await openApp(page);
  await addText(page, "One");
  await addText(page, "Two");
  await page.locator("[data-testid='overlay']").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ControlOrMeta+a");
  await expect(page.locator("[data-testid='deselect']")).toContainText("(2)");

  const before = await stageSnapshot(page);
  await page.locator("[data-testid='selbar-color']").click();
  await page.locator("[data-testid='palette-F4564C']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});
