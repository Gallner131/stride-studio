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

/** Fraction of the stage that is near-white — the legacy templates draw white type. */
async function whiteFraction(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-testid='stage']");
    if (!c) throw new Error("no stage");
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let white = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      total++;
      if (r > 225 && g > 225 && b > 225) white++;
    }
    return total === 0 ? 0 : white / total;
  });
}

test("a Design replaces the legacy template rather than sitting on top of it", async ({ page }) => {
  await openApp(page);
  await tab(page, "Designs");
  await page.locator("[data-testid='newtpl-pb']").click();
  await page.waitForTimeout(7000);

  // The Design itself draws plenty of white type.
  expect(await whiteFraction(page)).toBeGreaterThan(0.005);

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
  expect(await whiteFraction(page)).toBeLessThan(0.002);
});
