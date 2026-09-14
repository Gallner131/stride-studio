import type { Browser } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { APP_URL, tab } from "./helpers";

/**
 * §7.4 — the athlete's maximum reaches the charts, and nothing else stands in for it.
 *
 * Zones used to come from one place only: Strava. An athlete who had not connected, or
 * whose connection predated `profile:read_all`, saw nothing zone-shaped at all — and before
 * that, saw zones derived from whatever peak the run happened to reach. This wires the
 * second honest source: a maximum the athlete typed in themselves.
 *
 * The assertions go through the rendered canvas because that is where the bug was visible.
 * A zone chart that draws and one that does not produce different pixels, and nothing else
 * differs between these runs.
 */

const PREFS_KEY = "stride.prefs";

/** The design at `session` carries a zones chart (src/templates/index.ts:158). */
const ZONES_DESIGN = "newtpl-session";

/** Renders the zones design in a fresh profile with the given stored prefs. */
async function renderWithPrefs(browser: Browser, prefs: Record<string, unknown> | null) {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (prefs) {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key as string, JSON.stringify(value)),
      [PREFS_KEY, prefs] as const,
    );
  }
  await page.goto(APP_URL);
  await page.waitForSelector("[data-testid='stage']");
  await tab(page, "Designs");
  await page.locator(`[data-testid='${ZONES_DESIGN}']`).click();
  // The charts draw in as time advances (§5.8) over ANIM_SECONDS = 6, then hold. Capturing
  // before that returns a frame mid-animation, which differs between page loads for reasons
  // that have nothing to do with zones — and makes every comparison below pass for free.
  // The determinism control at the bottom of this file is what keeps this honest.
  await page.waitForTimeout(7500);
  const png = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-testid='stage']");
    return c ? c.toDataURL("image/png") : "";
  });
  await context.close();
  return png;
}

test("a max HR in prefs is enough to draw zones, with no Strava connection", async ({ browser }) => {
  const withMax = await renderWithPrefs(browser, { hrMax: 190 });
  const withoutMax = await renderWithPrefs(browser, null);

  expect(withMax.length).toBeGreaterThan(1000);
  expect(withoutMax.length).toBeGreaterThan(1000);
  // Same activity, same design, same look. The only difference is whether we know the
  // athlete's maximum. If these match, the maximum is not reaching the chart.
  expect(withMax).not.toBe(withoutMax);
});

test("a different max HR moves the zone bands", async ({ browser }) => {
  // The guard against the original bug returning by another route: if zones were still
  // derived from the activity's own peak, the athlete's own figure would change nothing.
  const at190 = await renderWithPrefs(browser, { hrMax: 190 });
  const at210 = await renderWithPrefs(browser, { hrMax: 210 });

  expect(at190).not.toBe(at210);
});

test("the control: identical prefs render identical pixels", async ({ browser }) => {
  // Without this, the two comparisons above pass whether or not the wiring works, because
  // an unsettled animation makes any two captures differ. This asserts the capture is
  // deterministic, so a difference above means something real.
  const once = await renderWithPrefs(browser, { hrMax: 190 });
  const twice = await renderWithPrefs(browser, { hrMax: 190 });

  expect(once).toBe(twice);
});
