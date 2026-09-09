import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/** §7.3 file import, end to end: pick a GPX and the whole design follows the new activity. */

const fixture = (name: string) => resolve(import.meta.dirname, "../fixtures/tracks", name);

test("importing a GPX replaces the activity and redraws the design", async ({ page }) => {
  const errors = await openApp(page);

  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-trace']").click();
  const before = await stageSnapshot(page);

  await tab(page, "Stats");
  await page.setInputFiles("[data-testid='track-input']", fixture("run.gpx"));

  await expect(page.locator(".card strong").first()).toHaveText("Thursday tempo");
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);

  // Distance and pace come from the trackpoints, not from a summary field.
  const summary = page.locator(".card div.muted.small").first();
  await expect(summary).toContainText("5.3");
  await expect(summary).toContainText("/km");

  expect(errors, errors.join("\n")).toEqual([]);
});

test("importing a TCX works too, using its stated distance", async ({ page }) => {
  await openApp(page);
  await tab(page, "Stats");
  await page.setInputFiles("[data-testid='track-input']", fixture("run.tcx"));

  await expect(page.locator(".card strong").first()).toHaveText("Thursday tempo");
  const summary = page.locator(".card div.muted.small").first();
  await expect(summary).toContainText("5.3");
  await expect(summary).toContainText("bpm");
});

test("an imported route and heart rate feed the data layers", async ({ page }) => {
  await openApp(page);
  await tab(page, "Stats");
  await page.setInputFiles("[data-testid='track-input']", fixture("run.gpx"));

  // Route and HR designs become available for the imported activity.
  await tab(page, "Designs");
  await expect(page.locator("[data-testid='newtpl-trace']")).toBeEnabled();
  await expect(page.locator("[data-testid='newtpl-ribbon']")).toBeEnabled();

  const before = await stageSnapshot(page);
  await page.locator("[data-testid='newtpl-ribbon']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("a treadmill export says what it is missing rather than showing zeroes", async ({ page }) => {
  await openApp(page);
  await tab(page, "Stats");
  await page.setInputFiles("[data-testid='track-input']", fixture("no-gps.gpx"));

  const notes = page.locator("[data-testid='import-notes']");
  await expect(notes).toBeVisible();
  await expect(notes).toContainText("heart rate");
  await expect(notes).toContainText("elevation");

  // And the route design is correctly unavailable.
  await tab(page, "Designs");
  await expect(page.locator("[data-testid='newtpl-trace']")).toBeDisabled();
});

test("an unreadable file gives a plain error, not a crash", async ({ page }) => {
  const errors = await openApp(page);
  await tab(page, "Stats");
  await page.setInputFiles("[data-testid='track-input']", fixture("broken.gpx"));

  await expect(page.locator(".error")).toContainText("Could not read");
  await expect(page.locator(".error")).toContainText("FIT is not yet");
  expect(errors, errors.join("\n")).toEqual([]);
});
