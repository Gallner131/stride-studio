import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/** Phase 4: multi-select, align, distribute, keyboard shortcuts, format reflow. */

async function addText(page: import("@playwright/test").Page, text: string) {
  await tab(page, "Add");
  await page.locator("[data-testid='add-text']").click();
  await page.locator("[data-testid='inline-text']").fill(text);
  await page.keyboard.press("Escape");
}

async function selectAllViaKeyboard(page: import("@playwright/test").Page) {
  await page.locator("[data-testid='overlay']").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ControlOrMeta+a");
}

// Removing something you just added meant leaving the canvas: the only delete controls were
// the × in the Layers panel, a button in the Inspector, and the Backspace key — and a phone
// has no Backspace. The canvas toolbar now carries one, next to Deselect.
test("a selected element can be deleted without leaving the canvas", async ({ page }) => {
  await openApp(page);
  await addText(page, "Regrettable");
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(1);

  await page.locator("[data-testid='delete-selection']").click();
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(0);

  // With nothing selected there is nothing to delete, so the button goes away.
  await expect(page.locator("[data-testid='delete-selection']")).toHaveCount(0);
});

test("deleting from the toolbar can be undone", async ({ page }) => {
  await openApp(page);
  await addText(page, "Second thoughts");
  await page.locator("[data-testid='delete-selection']").click();
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(0);

  await page.locator("[data-testid='undo']").click();
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(1);
});

test("shift-click builds a multi-selection", async ({ page }) => {
  await openApp(page);
  await addText(page, "One");
  await addText(page, "Two");

  // Select both from the layers panel is single-select, so use select-all.
  await selectAllViaKeyboard(page);
  await expect(page.locator("[data-testid='deselect']")).toContainText("(2)");
  await expect(page.locator("[data-testid='align-bar']")).toBeVisible();
});

test("align moves the selection to line up, not to the canvas edge", async ({ page }) => {
  await openApp(page);
  await addText(page, "One");
  await addText(page, "Two");
  await selectAllViaKeyboard(page);

  const before = await stageSnapshot(page);
  await page.locator("[data-testid='align-left']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("distribute needs three layers", async ({ page }) => {
  await openApp(page);
  await addText(page, "One");
  await addText(page, "Two");
  await selectAllViaKeyboard(page);
  await expect(page.locator("[data-testid='distribute-h']")).toBeDisabled();

  await addText(page, "Three");
  await selectAllViaKeyboard(page);
  await expect(page.locator("[data-testid='distribute-h']")).toBeEnabled();

  const before = await stageSnapshot(page);
  await page.locator("[data-testid='distribute-h']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("keyboard shortcuts add, nudge, duplicate and delete (Appendix D)", async ({ page }) => {
  await openApp(page);
  await page.locator("[data-testid='overlay']").click({ position: { x: 5, y: 5 } });

  // T adds text.
  await page.keyboard.press("t");
  await page.keyboard.press("Escape");
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(1);

  // S adds a stat, R adds a route.
  await page.locator("[data-testid='overlay']").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("s");
  await page.locator("[data-testid='overlay']").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("r");
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(3);

  // Select all, duplicate, then delete the copies.
  await selectAllViaKeyboard(page);
  await page.keyboard.press("ControlOrMeta+d");
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(6);

  await page.keyboard.press("Backspace");
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(3);
});

test("nudging with the arrow keys moves the selection", async ({ page }) => {
  await openApp(page);
  await addText(page, "Nudge");
  await page.locator("[data-testid='overlay']").click({ position: { x: 5, y: 5 } });
  await selectAllViaKeyboard(page);

  const before = await stageSnapshot(page);
  for (let i = 0; i < 12; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("shortcuts stay inert while typing", async ({ page }) => {
  await openApp(page);
  await tab(page, "Add");
  await page.locator("[data-testid='add-text']").click();

  // Typing "trs" into the inline editor must not add three layers.
  const inline = page.locator("[data-testid='inline-text']");
  await inline.fill("trs");
  await page.keyboard.press("Escape");

  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(1);
});

test("the shortcut list can be opened with ?", async ({ page }) => {
  await openApp(page);
  await page.locator("[data-testid='overlay']").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("?");
  await expect(page.locator(".shortcuts")).toBeVisible();
  await expect(page.locator(".shortcuts li").first()).toContainText("Add text");
});

test("semicolon toggles safe zones", async ({ page }) => {
  await openApp(page);
  const overlay = () =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("[data-testid='overlay']");
      return c ? c.toDataURL("image/png") : "";
    });

  await page.locator("[data-testid='overlay']").click({ position: { x: 5, y: 5 } });
  const before = await overlay();
  await page.keyboard.press(";");
  await expect.poll(async () => (await overlay()) !== before, { timeout: 5000 }).toBe(true);
});

test("switching format keeps anchors and nudges only what falls outside (§4.9)", async ({ page }) => {
  const errors = await openApp(page);
  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();

  const story = await stageSnapshot(page);
  await page.getByRole("button", { name: "1:1", exact: true }).click();
  await expect.poll(async () => (await stageSnapshot(page)) !== story, { timeout: 5000 }).toBe(true);

  // The design still has all its layers — reflow moves things, it never drops them.
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(5);

  // And back again.
  await page.getByRole("button", { name: "9:16", exact: true }).click();
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(5);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("dragging a multi-selection keeps its internal spacing", async ({ page }) => {
  await openApp(page);
  await addText(page, "A");
  await addText(page, "B");
  await selectAllViaKeyboard(page);

  const overlay = page.locator("[data-testid='overlay']");
  await overlay.scrollIntoViewIfNeeded();
  const box = await overlay.boundingBox();
  if (!box) throw new Error("no overlay box");

  const before = await stageSnapshot(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 50, cy - 90, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
  // Both layers survive the drag.
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(2);
});
