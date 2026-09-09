import { expect, test } from "@playwright/test";
import { addFixturePhoto, openApp, stageSnapshot, tab } from "./helpers";

/**
 * Spec §12.3 items 1, 5, 7, 12 — the paths a first-time user actually walks (§3.2 Quick
 * mode, §3.8 first run).
 */

test("first run: demo activity is loaded and the app looks finished before any input", async ({ page }) => {
  const errors = await openApp(page);

  // Preview canvas is a full-size 9:16 story frame.
  const size = await page.locator("[data-testid='stage']").evaluate((c) => ({
    w: (c as HTMLCanvasElement).width,
    h: (c as HTMLCanvasElement).height,
  }));
  expect(size).toEqual({ w: 1080, h: 1920 });

  // The whole catalogue is browsable straight away.
  await expect(page.locator("[data-testid^='tpl-']")).toHaveCount(27);

  // §10.1: the empty-canvas call to action.
  await expect(page.locator(".dropzone strong")).toHaveText("Add a photo or video");

  // §3.8: the demo run is already loaded, so the app is useful in the first ten seconds.
  await tab(page, "Stats");
  await expect(page.locator(".card strong").first()).toHaveText("Sunday long run");

  expect(errors, errors.join("\n")).toEqual([]);
});

test("picking a template changes the preview", async ({ page }) => {
  await openApp(page);
  await page.locator("[data-testid='tpl-sticker']").click();
  const before = await stageSnapshot(page);

  await page.locator("[data-testid='tpl-receipt']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);

  await expect(page.locator("[data-testid='tpl-receipt']")).toHaveClass(/on/);
});

test("adding a photo replaces the gradient background", async ({ page }) => {
  await openApp(page);
  const before = await stageSnapshot(page);
  await addFixturePhoto(page);
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("format switch resizes the canvas to each Instagram surface (Appendix G)", async ({ page }) => {
  await openApp(page);
  const stage = page.locator("[data-testid='stage']");
  const dims = async () =>
    stage.evaluate((c) => `${(c as HTMLCanvasElement).width}x${(c as HTMLCanvasElement).height}`);

  expect(await dims()).toBe("1080x1920");

  await page.getByRole("button", { name: "4:5", exact: true }).click();
  await expect.poll(dims, { timeout: 5000 }).toBe("1080x1350");

  await page.getByRole("button", { name: "1:1", exact: true }).click();
  await expect.poll(dims, { timeout: 5000 }).toBe("1080x1080");
});

test("a workout with no distance promotes duration to the hero (§4.7)", async ({ page }) => {
  const errors = await openApp(page);

  await tab(page, "Stats");
  await page.locator("[data-testid='demo-workout']").click();

  // The sport label is a <span class="muted small">; the stats line is the <div> after it.
  const summary = page.locator(".card div.muted.small").first();
  await expect(summary).toContainText("45:00");
  // No distance and no pace for a workout.
  await expect(summary).not.toContainText("km");
  await expect(summary).not.toContainText("/km");

  // Every template must still render for this activity rather than throwing.
  for (const id of ["sticker", "poster", "noir", "hrwave", "splits", "elevation"]) {
    await tab(page, "Style");
    await page.locator(`[data-testid='tpl-${id}']`).click();
    const snap = await stageSnapshot(page);
    expect(snap.length, `${id} rendered an empty canvas for a workout`).toBeGreaterThan(1000);
  }

  expect(errors, errors.join("\n")).toEqual([]);
});

test("your own words are a text layer now, not a single field (§1.1 A3)", async ({ page }) => {
  await openApp(page);
  await tab(page, "Text");

  // The old one-text-field control is gone; it points at the Add menu instead.
  await expect(page.locator("[data-testid='tagline']")).toHaveCount(0);
  const before = await stageSnapshot(page);

  await page.locator("[data-testid='go-add-text']").click();
  await page.locator("[data-testid='add-text']").click();
  const inline = page.locator("[data-testid='inline-text']");
  await expect(inline).toBeVisible();
  await inline.fill("New PB. Finally.");
  await page.keyboard.press("Escape");

  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});
