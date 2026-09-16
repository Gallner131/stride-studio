import { expect, test } from "@playwright/test";
import { openApp, tab } from "./helpers";

/**
 * A Design from the Designs tab owns the canvas.
 *
 * draw() used to render the legacy template AND the document's layers on top of it, so
 * applying a Design gave you two complete designs stacked: the Design's "NEW PB / 1:42:15"
 * over the legacy template's own "21.1 / KILOMETRES", elements colliding and running off the
 * edges. Reported as "way too much going on" and "looks horrific", and rightly.
 */

/**
 * Fraction of the stage that is not the background colour — i.e. how much ink is on it.
 *
 * This counted near-white pixels, which worked only while the chrome and the default look
 * were both dark. The default look is `paper` now, so the background itself is near-white
 * and "white pixels" stopped meaning "type". Measuring distance from the most common colour
 * says the same thing without caring whether the design is light or dark.
 */
async function inkFraction(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-testid='stage']");
    if (!c) throw new Error("no stage");
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    const { data } = ctx.getImageData(0, 0, c.width, c.height);

    // Coarse histogram to find the background: whatever colour covers the most pixels.
    const bucket = new Map<number, number>();
    const key = (r: number, g: number, b: number) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const px: number[][] = [];
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      px.push([r, g, b]);
      const k = key(r, g, b);
      bucket.set(k, (bucket.get(k) ?? 0) + 1);
    }
    let best = 0;
    let bestK = 0;
    for (const [k, n] of bucket) {
      if (n > best) {
        best = n;
        bestK = k;
      }
    }
    const br = ((bestK >> 8) & 0xf) << 4;
    const bg = ((bestK >> 4) & 0xf) << 4;
    const bb = (bestK & 0xf) << 4;

    let ink = 0;
    for (const [r = 0, g = 0, b = 0] of px) {
      if (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) > 90) ink++;
    }
    return px.length === 0 ? 0 : ink / px.length;
  });
}

test("a Design replaces the legacy template rather than sitting on top of it", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();
  await page.waitForTimeout(7000);

  // The Design itself puts plenty of type on the page.
  expect(await inkFraction(page)).toBeGreaterThan(0.005);

  // Hide every element of it — hiding rather than deleting, because deleting would leave no
  // Design owning the canvas and the legacy template would correctly take over again.
  await tab(page, "Layers");
  const hide = page.locator("[data-testid='layers-list'] [aria-label^='Hide']");
  for (let i = await hide.count(); i > 0; i = await hide.count()) {
    await hide.first().click();
  }
  await page.waitForTimeout(500);

  // Nothing but the background is left. If the legacy template were still drawing its own
  // hero and stats underneath, they would still be there.
  expect(await inkFraction(page)).toBeLessThan(0.01);
});
