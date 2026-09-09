import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * HYROX support, end to end: paste a splits table, get visuals bound to it.
 *
 * The paste path is the whole input story (results.hyrox.com has no public API and 403s
 * automated requests), so these tests exercise it rather than mocking a data source.
 */

const PASTE = `HYROX Manchester 2026
Pro Men 35-39
Running 1 00:04:12
1000m SkiErg 00:03:58
Running 2 00:04:20
50m Sled Push 00:02:20
Running 3 00:04:25
50m Sled Pull 00:03:05
Running 4 00:04:30
80m Burpee Broad Jump 00:04:10
Running 5 00:04:35
1000m Row 00:03:52
Running 6 00:04:33
200m Farmers Carry 00:02:05
Running 7 00:04:40
100m Sandbag Lunges 00:03:40
Running 8 00:04:20
Wall Balls 00:05:50
Roxzone 00:05:05
Overall 01:09:40`;

async function loadHyrox(page: import("@playwright/test").Page, text = PASTE) {
  await tab(page, "HYROX");
  await page.locator("[data-testid='hyrox-paste']").fill(text);
  await page.locator("[data-testid='hyrox-read']").click();
  await expect(page.locator("[data-testid='hyrox-summary']")).toBeVisible();
}

test("pasting a splits table reads the whole race", async ({ page }) => {
  const errors = await openApp(page);
  await loadHyrox(page);

  const summary = page.locator("[data-testid='hyrox-summary']");
  await expect(summary).toContainText("HYROX Manchester 2026");
  await expect(summary).toContainText("Pro");
  await expect(summary).toContainText("35-39");
  await expect(summary).toContainText("1:09:40");
  // Roxzone as a share, which is the comparable form.
  await expect(summary).toContainText("7.3%");

  // A complete read reports no problems.
  await expect(page.locator("[data-testid='hyrox-problems']")).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the sample race lets you try it with no data of your own", async ({ page }) => {
  await openApp(page);
  await tab(page, "HYROX");
  await page.locator("[data-testid='hyrox-sample']").click();
  await expect(page.locator("[data-testid='hyrox-summary']")).toContainText("HYROX London 2026");
});

test("an incomplete paste says what is missing instead of inventing it", async ({ page }) => {
  await openApp(page);
  await tab(page, "HYROX");
  await page.locator("[data-testid='hyrox-paste']").fill("Running 1 4:12\n1000m SkiErg 3:58\nOverall 20:00");
  await page.locator("[data-testid='hyrox-read']").click();

  const problems = page.locator("[data-testid='hyrox-problems']");
  await expect(problems).toBeVisible();
  await expect(problems).toContainText("Missing 7 stations");
  await expect(problems).toContainText("Sled Push");
});

test("each HYROX visual renders onto the design", async ({ page }) => {
  await openApp(page);
  await loadHyrox(page);

  for (const id of ["add-hyrox-breakdown", "add-hyrox-stations", "add-hyrox-splits"]) {
    const before = await stageSnapshot(page);
    await tab(page, "HYROX");
    await page.locator(`[data-testid='${id}']`).click();
    await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
    // Adding selects the new layer, which hands the panel over to the inspector.
    await page.locator("[data-testid='deselect']").click();
  }

  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(3);
});

test("HYROX fields are bindable in text layers", async ({ page }) => {
  await openApp(page);
  await loadHyrox(page);
  await page.locator("[data-testid='add-hyrox-roxzone']").click();

  await tab(page, "Layers");
  await page.locator("[data-testid='layers-list'] .layer-name").first().click();
  await expect(page.locator("[data-testid='layer-text']")).toHaveValue(/\{roxzone\}/);
});

test("the race card lays out a whole design in one tap", async ({ page }) => {
  await openApp(page);
  await loadHyrox(page);
  await page.locator("[data-testid='add-hyrox-card']").click();

  await tab(page, "Layers");
  await expect(page.locator("[data-testid='layers-list'] .layer-row")).toHaveCount(4);
});

test("a HYROX result drives the legacy templates, without a misleading pace", async ({ page }) => {
  await openApp(page);
  await loadHyrox(page);

  await tab(page, "Stats");
  const summary = page.locator(".card div.muted.small").first();

  // The finish time is the duration...
  await expect(summary).toContainText("1:09:40");
  // ...and no distance or pace is claimed, because finish time / 8 km would read ~8:40/km
  // when the athlete actually ran ~4:19/km.
  await expect(summary).not.toContainText("km,");
  await expect(summary).not.toContainText("/km");
});

test("HYROX visuals are included in the export", async ({ page }) => {
  await openApp(page);
  await loadHyrox(page);
  await page.locator("[data-testid='add-hyrox-stations']").click();

  await page.locator("[data-testid='export-image']").click();
  await page.waitForSelector("[data-testid='result-image']");
  const dims = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>("[data-testid='result-image']");
    return img ? [img.naturalWidth, img.naturalHeight] : null;
  });
  expect(dims).toEqual([1080, 1920]);
});
