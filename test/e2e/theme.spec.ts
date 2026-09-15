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

test.describe("with the OS set to light", () => {
  test.use({ colorScheme: "light" });

  test("the page is light, not near-black", async ({ page }) => {
    await openApp(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r = 0, g = 0, b = 0] = bg.match(/\d+/g)?.map(Number) ?? [];
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    // The old chrome scored about 0.09. A warm off-white is up near 0.95.
    expect(luminance).toBeGreaterThan(0.8);
  });
});

test.describe("with the OS set to dark", () => {
  test.use({ colorScheme: "dark" });

  test("the chrome is light even on a dark-preferring device, until asked otherwise", async ({ page }) => {
    // The default is "light", not "auto". Matching the system sounded right and was wrong:
    // most phones are in dark mode, so the light chrome this whole redesign is about was
    // invisible to the people who asked for it. Dark is a choice in Settings, not a default.
    await openApp(page);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  });

  test("choosing dark in Settings still wins over the default", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("settings-button").click();
    await page.getByTestId("prefs-theme").selectOption("dark");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  });

  test("the accent stays legible against the dark chrome", async ({ page }) => {
    // The bug this is here to stop: the accent effect used to read the theme off the DOM
    // before the theme effect had written it, so a dark chrome got the light neutral —
    // #1a1a1a on #38383a, 1.48:1, which the axe suite caught on the Add tab.
    await openApp(page);
    const { accent, bg } = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return { accent: s.getPropertyValue("--accent").trim(), bg: s.getPropertyValue("--bg").trim() };
    });
    const lum = (hex: string) => {
      const ch = (i: number) => {
        const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
    };
    const [hi, lo] = [lum(accent), lum(bg)].sort((a, b) => b - a) as [number, number];
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(3);
  });
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

  // Walk the CSSOM rule by rule rather than regexing the whole sheet as one string. The
  // string version took 15.9 minutes before failing — catastrophic backtracking on a
  // stylesheet this size — and a test that slow is a test nobody will keep running.
  const stray = await page.evaluate(() => {
    const found: string[] = [];
    const isTokenBlock = (selector: string) =>
      selector.startsWith(":root") || selector.includes("[data-theme");
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSGroupingRule) {
          walk(rule.cssRules);
        } else if (rule instanceof CSSStyleRule) {
          if (isTokenBlock(rule.selectorText)) continue;
          const hits = rule.style.cssText.match(/#[0-9a-f]{3,8}\b/gi);
          if (hits) found.push(...hits.map((h) => `${rule.selectorText}: ${h}`));
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        // A cross-origin sheet cannot be read; there are none in this single-file app.
      }
    }
    return found;
  });

  // Anything left is a colour that cannot be changed by editing the palette.
  expect(stray, `stray literals: ${stray.join(", ")}`).toEqual([]);
});
