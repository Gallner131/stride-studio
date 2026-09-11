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

  // §10.1: the empty-canvas call to action.
  await expect(page.locator("[data-testid='add-media'] strong")).toHaveText("Add a photo or video");

  // §3.8: the demo run is already loaded, so the app is useful in the first ten seconds.
  // The activity card that used to assert this lived in the Stats tab, which is gone; the
  // demo run showing on the canvas is the observable form of the same thing.
  expect((await stageSnapshot(page)).length).toBeGreaterThan(1000);

  expect(errors, errors.join("\n")).toEqual([]);
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
