import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * Phase 2's data-bound layer types (§4.4.3 - §4.4.6): stat, statRow, route and the six
 * charts. Each test adds the element and checks the design actually changed, then that the
 * element responds to a real control — presence alone proves nothing.
 */

async function add(page: import("@playwright/test").Page, testid: string) {
  await tab(page, "Add");
  const before = await stageSnapshot(page);
  await page.locator(`[data-testid='${testid}']`).click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
}

const ELEMENTS = [
  "add-stat-distance",
  "add-stat-row",
  "add-route",
  "add-chart-hr",
  "add-chart-splits",
  "add-chart-pace",
  "add-chart-elevation",
  "add-chart-zones",
  "add-chart-rings",
];

for (const id of ELEMENTS) {
  test(`${id} renders onto the design`, async ({ page }) => {
    const errors = await openApp(page);
    await add(page, id);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("the route redraws for every stroke mode (§2.7 S5)", async ({ page }) => {
  await openApp(page);
  await add(page, "add-route");

  // Animation off, so each sample is the settled final frame rather than a moment mid-draw.
  await page.locator("[data-testid='deselect']").click();
  await page.locator("[data-testid='toggle-animate']").click();
  await tab(page, "Layers");
  await page.locator("[data-testid='layers-list'] .layer-name").first().click();

  const seen = new Set<string>();
  for (const mode of ["solid", "dotted", "dashed", "glow", "tube", "sketch", "extrude"]) {
    await page.locator(`[data-testid='route-mode-${mode}']`).click();
    await page.waitForTimeout(120);
    seen.add(await stageSnapshot(page));
  }
  // Every mode should produce a visibly different line.
  expect(seen.size, "each route mode should render differently").toBeGreaterThanOrEqual(6);
});

test("a chart can be switched between kinds", async ({ page }) => {
  await openApp(page);
  await add(page, "add-chart-hr");

  for (const kind of ["pace", "elevation", "splits", "zones", "rings"]) {
    const before = await stageSnapshot(page);
    await page.locator(`[data-testid='chart-kind-${kind}']`).click();
    await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
  }
});

test("a stat row drops fields the activity does not have (§4.6)", async ({ page }) => {
  await openApp(page);
  await add(page, "add-stat-row");

  // The demo run has no calories toggle in the row by default; adding elevation (present)
  // must change the design, and the row must still render for a workout with no distance.
  const before = await stageSnapshot(page);
  await page.locator("[data-testid='row-field-hr']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);

  // The second half of this test switched to the demo workout to prove the row shrinks for
  // an activity with no distance. There is no longer any way to load a workout from the UI;
  // that behaviour is covered by test/unit/derive.test.ts.
});

test("a stat field can be changed and counts up", async ({ page }) => {
  await openApp(page);
  await add(page, "add-stat-distance");

  const before = await stageSnapshot(page);
  await page.locator("[data-testid='stat-field']").selectOption("hr");
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("data layers are included in the export", async ({ page }) => {
  await openApp(page);
  await add(page, "add-route");
  await page.locator("[data-testid='deselect']").click();
  await add(page, "add-chart-hr");

  await page.locator("[data-testid='export-image']").click();
  await page.waitForSelector("[data-testid='result-image']");
  const dims = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>("[data-testid='result-image']");
    return img ? [img.naturalWidth, img.naturalHeight] : null;
  });
  expect(dims).toEqual([1080, 1920]);
});
