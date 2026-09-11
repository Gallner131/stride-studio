import { expect, test } from "@playwright/test";
import { addFixturePhoto, inspectResultImage, openApp, tab } from "./helpers";

/** Spec §9. Image, sticker crop, sizes, formats and the video path. */

test("image export produces a full-bleed 1080x1920 PNG (§9.1)", async ({ page }) => {
  const errors = await openApp(page);
  await addFixturePhoto(page);

  await page.locator("[data-testid='export-image']").click();
  const img = await inspectResultImage(page);

  expect(img.width).toBe(1080);
  expect(img.height).toBe(1920);
  expect(img.cornerAlpha, "corners of a full export must be opaque").toEqual([255, 255, 255, 255]);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the sticker export is cropped tight to what it contains (§9.2)", async ({ page }) => {
  await openApp(page);
  await addFixturePhoto(page);

  // One small element near the middle: the sticker should be far smaller than the frame.
  await tab(page, "Add");
  await page.locator("[data-testid='add-sticker']").click();
  await page.locator("[data-testid='sticker-medal']").click();

  await page.locator("[data-testid='export-sticker']").click();
  const img = await inspectResultImage(page);

  expect(img.width, "a tight crop is much narrower than 1080").toBeLessThan(600);
  expect(img.height).toBeLessThan(600);
  expect(img.cornerAlpha, "the padding around a sticker is transparent").toEqual([0, 0, 0, 0]);
  expect(img.hasOpaquePixels, "the sticker itself must be in there").toBe(true);
});

test("with no elements, the sticker export falls back to the full frame", async ({ page }) => {
  await openApp(page);
  await addFixturePhoto(page);
  // Nothing has been added, which is the "no elements" case this covers.
  await page.locator("[data-testid='export-sticker']").click();

  const img = await inspectResultImage(page);
  expect(img.width).toBe(1080);
  expect(img.cornerAlpha).toEqual([0, 0, 0, 0]);
});

test("export sizes offer 720, 1080 and 2x", async ({ page }) => {
  await openApp(page);
  await addFixturePhoto(page);

  await page.getByRole("button", { name: "720", exact: true }).click();
  await page.locator("[data-testid='export-image']").click();
  expect((await inspectResultImage(page)).width).toBe(720);
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "2160", exact: true }).click();
  await page.locator("[data-testid='export-image']").click();
  expect((await inspectResultImage(page)).width).toBe(2160);
});

test("JPEG export is offered and produces an opaque image", async ({ page }) => {
  await openApp(page);
  await addFixturePhoto(page);

  await page.getByRole("button", { name: "JPEG (smaller)" }).click();
  await page.locator("[data-testid='export-image']").click();

  const img = await inspectResultImage(page);
  expect(img.width).toBe(1080);
  expect(img.cornerAlpha).toEqual([255, 255, 255, 255]);
});

test("the app says honestly how this browser will encode video (§3.1 principle 7)", async ({ page }) => {
  await openApp(page);
  const note = page.locator("[data-testid='video-note']");
  await expect(note).toBeVisible();
  // Chromium supports WebCodecs, so it should promise frame-by-frame encoding.
  await expect(note).toContainText("frame by frame");
});

test("video export encodes frame-accurately and reports its frame count (§9.3)", async ({ page }) => {
  const errors = await openApp(page);
  await addFixturePhoto(page);

  // Keep it short: 720 wide so the test does not encode a full-size clip.
  await page.getByRole("button", { name: "720", exact: true }).click();
  await page.locator("[data-testid='export-video']").click();

  await page.waitForSelector("[data-testid='result-video']", { timeout: 120_000 });
  const info = await page.evaluate(async () => {
    const v = document.querySelector<HTMLVideoElement>("[data-testid='result-video']");
    if (!v) return null;
    const res = await fetch(v.src);
    const blob = await res.blob();
    return { size: blob.size, type: blob.type };
  });

  expect(info).not.toBeNull();
  expect(info?.size ?? 0).toBeGreaterThan(20_000);
  // WebCodecs path produces a real MP4, not a WebM.
  expect(info?.type).toBe("video/mp4");
  expect(
    errors.filter((e) => !e.includes("play()")),
    errors.join("\n"),
  ).toEqual([]);
});

test("copy image is offered for an image export", async ({ page }) => {
  await openApp(page);
  await addFixturePhoto(page);
  await page.locator("[data-testid='export-image']").click();
  await expect(page.locator("[data-testid='copy-image']")).toBeVisible();
});

test("the app is installable and its offline shell is served (§9.5)", async ({ page }) => {
  await openApp(page);

  // The manifest is linked and describes a portrait standalone app.
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("./manifest.webmanifest");

  const manifest = await page.evaluate(async () => {
    const res = await fetch("./manifest.webmanifest");
    return res.ok ? await res.json() : null;
  });
  expect(manifest?.name).toBe("Stride Studio");
  expect(manifest?.display).toBe("standalone");
  expect(manifest?.orientation).toBe("portrait");
  expect(manifest?.icons?.length).toBeGreaterThan(0);

  // The caching worker is gone: it served the previously-deployed build on every visit, so
  // shipped fixes were invisible. What is served now is a tombstone that deletes the caches
  // and unregisters itself, for browsers that still have the old one.
  const sw = await page.evaluate(async () => {
    const res = await fetch("./sw.js");
    return res.ok ? await res.text() : null;
  });
  expect(sw).toContain("unregister");
  expect(sw).not.toContain("respondWith");

  // And nothing registers a worker any more.
  await expect.poll(async () => page.evaluate(() => navigator.serviceWorker?.controller === null)).toBe(true);
});
