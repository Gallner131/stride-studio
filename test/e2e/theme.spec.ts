import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/**
 * §6.14 — the chrome is built from tokens, and the tokens are light.
 *
 * The app was near-black `#161616` with a neon `#d8ff3a` accent, both hardcoded through
 * every rule in styles.css. Two problems, and the second is the one that lasts: it did not
 * look like the tools it sits next to — Canva is light, Strava is light — and changing a
 * colour meant finding two dozen literals. Everything visual now resolves through a custom
 * property, so a repaint is an edit to one block.
 */

test("the chrome resolves through custom properties on :root", async ({ page }) => {
  await openApp(page);

  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      bg: s.getPropertyValue("--bg").trim(),
      surface: s.getPropertyValue("--surface").trim(),
      text: s.getPropertyValue("--text").trim(),
      accent: s.getPropertyValue("--accent").trim(),
    };
  });

  for (const [name, value] of Object.entries(tokens)) {
    expect(value, `--${name} should be defined`).toMatch(/^#|^rgb/i);
  }
});

test("the page is light, not near-black", async ({ page }) => {
  await openApp(page);

  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r = 0, g = 0, b = 0] = bg.match(/\d+/g)?.map(Number) ?? [];
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  // #161616 scores about 0.09. A warm off-white is up near 0.95.
  expect(luminance).toBeGreaterThan(0.8);
});

test("no hardcoded lime or near-black survives in the stylesheet", async ({ page }) => {
  await openApp(page);

  // The app ships as one inlined file, so the stylesheet is in a <style> tag.
  const css = await page.evaluate(() =>
    Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n")
      .toLowerCase(),
  );

  expect(css).not.toContain("#d8ff3a");
  expect(css).not.toContain("#161616");
});

test("every colour literal lives in a token block", async ({ page }) => {
  await openApp(page);

  const stray = await page.evaluate(() => {
    const css = Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n");
    // Strip the :root and [data-theme] declaration blocks, which are where literals belong.
    const withoutTokens = css.replace(/(:root|\[data-theme[^\]]*\])[^{]*\{[^}]*\}/g, "");
    return [...withoutTokens.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0]);
  });

  // Anything left is a colour that cannot be changed by editing the palette.
  expect(stray, `stray literals: ${stray.join(", ")}`).toEqual([]);
});
