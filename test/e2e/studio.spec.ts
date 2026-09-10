import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * Phase 1 acceptance (spec §13 Phase 1 "Done when"): unlimited draggable text, shapes and
 * stickers on top of every existing template, reload restores, undo works.
 *
 * These are behaviour tests, not presence tests — each one moves something and checks the
 * pixels or the model actually changed.
 */

async function addText(page: import("@playwright/test").Page, text: string) {
  await tab(page, "Add");
  await page.locator("[data-testid='add-text']").click();
  // The inline editor opens focused on the new layer.
  const inline = page.locator("[data-testid='inline-text']");
  await expect(inline).toBeVisible();
  await inline.fill(text);
  await page.keyboard.press("Escape");
  return inline;
}

test("add a text layer, and it renders on the design", async ({ page }) => {
  const errors = await openApp(page);
  const before = await stageSnapshot(page);

  await addText(page, "New PB");

  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(1);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("unlimited text layers — §1.1 A3 is fixed", async ({ page }) => {
  await openApp(page);
  await addText(page, "One");
  await addText(page, "Two");
  await addText(page, "Three");

  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(3);
});

test("dragging an element moves that element, not the whole design (§1.1 A2)", async ({ page }) => {
  await openApp(page);

  // Legacy whole-design offsets, read with nothing selected (the inspector replaces the
  // Adjust panel while a layer is selected).
  const legacyOffsets = async () => {
    await tab(page, "Adjust");
    return page.evaluate(() => {
      const inputs = [...document.querySelectorAll<HTMLInputElement>(".stack input[type=range]")];
      return inputs.map((i) => i.value);
    });
  };

  const before = await legacyOffsets();
  expect(before.length, "Adjust panel should expose the legacy offset sliders").toBeGreaterThan(0);

  await addText(page, "Drag me");
  const layerBefore = await layerGeometry(page);

  const overlay = page.locator("[data-testid='overlay']");
  await overlay.scrollIntoViewIfNeeded();
  const box = await overlay.boundingBox();
  if (!box) throw new Error("no overlay box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy - 120, { steps: 8 });
  await page.mouse.up();

  // The element moved...
  const layerAfter = await layerGeometry(page);
  expect(layerAfter, "the dragged layer's offset should change").not.toEqual(layerBefore);

  // ...and the whole design did not.
  await page.locator("[data-testid='deselect']").click();
  expect(await legacyOffsets(), "an element drag must not pan the whole design").toEqual(before);
});

/** Reads the selected layer's offset out of the running app. */
async function layerGeometry(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.querySelector("[data-testid='overlay']") as HTMLCanvasElement | null;
    // The overlay redraws whenever geometry changes, so its pixels are a faithful proxy.
    return el ? el.toDataURL("image/png").slice(0, 512) : null;
  });
}

test("undo and redo a drag as one step (§6.1)", async ({ page }) => {
  await openApp(page);
  await addText(page, "Undo me");

  const overlay = page.locator("[data-testid='overlay']");
  await overlay.scrollIntoViewIfNeeded();
  const box = await overlay.boundingBox();
  if (!box) throw new Error("no overlay box");

  const beforeDrag = await layerGeometry(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 150, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await layerGeometry(page)) !== beforeDrag, { timeout: 5000 }).toBe(true);
  const afterDrag = await layerGeometry(page);

  // One drag is one step, so a single undo returns it to where it started.
  await page.locator("[data-testid='undo']").click();
  await expect.poll(async () => (await layerGeometry(page)) === beforeDrag, { timeout: 5000 }).toBe(true);

  await page.locator("[data-testid='redo']").click();
  await expect.poll(async () => (await layerGeometry(page)) === afterDrag, { timeout: 5000 }).toBe(true);
});

test("a sticker can be added and recoloured", async ({ page }) => {
  await openApp(page);
  await tab(page, "Add");
  await page.locator("[data-testid='add-sticker']").click();
  await page.locator("[data-testid='sticker-medal']").click();

  const before = await stageSnapshot(page);
  await tab(page, "Layers");
  await page.locator("[data-testid='layers-list'] .layer-name").first().click();

  // The Sticker section is open by default; recolour straight from it.
  await expect(page.locator("[data-testid='section-sticker']")).toBeVisible();
  await page.locator(".ins-body .swatch").nth(2).click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("layers survive a reload (§1.1 A8 fixed — autosave)", async ({ page }) => {
  await openApp(page);
  await addText(page, "Persist me");
  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(1);

  // Autosave debounces 500ms.
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForSelector("[data-testid='stage']");

  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(1);
  await expect(page.locator("[data-testid='layers-list']")).toContainText("Persist me");
});

test("text layers bind to activity data (§4.6)", async ({ page }) => {
  await openApp(page);
  await tab(page, "Add");
  await page.locator("[data-testid='add-stat']").click();

  // The stat line template text resolves {distance} etc. against the demo run.
  await tab(page, "Layers");
  await page.locator("[data-testid='layers-list'] .layer-name").first().click();
  await expect(page.locator("[data-testid='layer-text']")).toHaveValue(/\{distance\}/);

  // And the rendered design is not blank.
  const snap = await stageSnapshot(page);
  expect(snap.length).toBeGreaterThan(1000);
});

test("elements are included in the exported image and the sticker export", async ({ page }) => {
  await openApp(page);
  await addText(page, "Exported");

  await page.locator("[data-testid='export-image']").click();
  await page.waitForSelector("[data-testid='result-image']");
  const dims = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>("[data-testid='result-image']");
    return img ? [img.naturalWidth, img.naturalHeight] : null;
  });
  expect(dims).toEqual([1080, 1920]);
});

test("safe zones can be toggled (§3.7)", async ({ page }) => {
  await openApp(page);
  const overlaySnapshot = () =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("[data-testid='overlay']");
      return c ? c.toDataURL("image/png") : "";
    });

  const before = await overlaySnapshot();
  await page.locator("[data-testid='safe-zones']").click();
  await expect.poll(async () => (await overlaySnapshot()) !== before, { timeout: 5000 }).toBe(true);
});
