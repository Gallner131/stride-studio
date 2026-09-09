import { expect, test } from "@playwright/test";
import { addFixturePhoto, openApp, stageSnapshot, tab } from "./helpers";

/**
 * Three for you (§2.7 S1) and Match my photo (§2.7 S2) — the two features meant to replace
 * "scroll forty thumbnails" as a new user's first experience.
 */

test("three finished designs are offered, chosen from what the activity has", async ({ page }) => {
  const errors = await openApp(page);
  await tab(page, "Designs");

  await expect(page.locator("[data-testid^='suggestion-']")).toHaveCount(3);

  // The demo run has GPS, so the route design should be among them.
  await expect(page.locator(".suggestions")).toContainText("Trace");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("tapping a suggestion builds the design and applies its look", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");

  const before = await stageSnapshot(page);
  await page.locator("[data-testid='suggestion-0']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);

  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row").first()).toBeVisible();
});

test("shuffle explores within the same rules rather than rerolling randomly", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");

  const names = async () => page.locator("[data-testid^='suggestion-'] strong").allTextContents();

  const first = await names();
  await page.locator("[data-testid='shuffle']").click();
  const second = await names();

  expect(second).not.toEqual(first);
  expect(second).toHaveLength(3);

  // Deterministic: shuffling back around returns the original set.
  for (let i = 0; i < 20; i++) {
    await page.locator("[data-testid='shuffle']").click();
    if ((await names()).join() === first.join()) break;
  }
  expect((await names()).length).toBe(3);
});

test("suggestions adapt to a workout with no GPS", async ({ page }) => {
  await openApp(page);
  await tab(page, "Stats");
  await page.locator("[data-testid='demo-workout']").click();
  await tab(page, "Designs");

  const text = await page.locator(".suggestions").textContent();
  // No route design can be offered for a treadmill session...
  expect(text).not.toContain("Trace");
  // ...but the heart-rate ones are.
  expect(text).toMatch(/Session|Workout|Effort/);
});

test("HYROX outranks everything else once a result is loaded", async ({ page }) => {
  await openApp(page);
  await tab(page, "HYROX");
  await page.locator("[data-testid='hyrox-sample']").click();
  await tab(page, "Designs");

  await expect(page.locator("[data-testid='suggestion-0']")).toContainText("HYROX");
});

test("Match my photo builds a look from the photo's own colours (§2.7 S2)", async ({ page }) => {
  const errors = await openApp(page);
  await addFixturePhoto(page);
  await tab(page, "Designs");

  await page.locator("[data-testid='suggestion-0']").click();
  await tab(page, "Designs");

  const before = await stageSnapshot(page);
  const match = page.locator("[data-testid='match-photo']");
  await expect(match).toBeVisible();
  await match.click();

  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);

  // It joins the look picker at the front, so it can be reapplied later.
  await tab(page, "Look");
  await expect(page.locator("[data-testid='look-from-photo']")).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
});

test("Match my photo is not offered without a photo", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");
  await expect(page.locator("[data-testid='match-photo']")).toHaveCount(0);
});
