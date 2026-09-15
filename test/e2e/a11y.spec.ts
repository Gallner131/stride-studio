import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openApp, tab } from "./helpers";

/**
 * Spec §12.3 item 13 — accessibility smoke, zero SERIOUS violations.
 *
 * Scoped to serious and critical on purpose. §1.2 E11 records the known moderate issues
 * (canvas has no description, chips do not expose pressed state, no visible focus ring)
 * and §13 Phase 4 owns the full pass. Failing the build on those today would mean either a
 * red CI or a rewrite of the UI inside Phase 0, and Phase 0's job is to build the fence,
 * not to redecorate.
 */
const scan = (builder: AxeBuilder) => builder.withTags(["wcag2a", "wcag2aa"]).analyze();

/**
 * Known serious violations that exist in production today, enumerated so that CI is green
 * on the current app while any NEW serious violation still fails the build.
 *
 * Each entry is debt with an owner, not an exemption:
 *
 *  - color-contrast on `.strava` — the "Connect Strava" button is #FFFFFF on Strava orange
 *    #FC5200, which is 3.3:1 against a 4.5:1 requirement for 14 px normal text. Present on
 *    every screen. Fixable by using black label text on the orange (about 6.4:1), or by
 *    making the label bold and >= 18.66 px so the 3:1 large-text threshold applies. It is a
 *    UI change rather than a render change, so it belongs to Phase 4's accessibility pass
 *    (§13) — and it lines up with §7.2, which wants the official "Compatible with Strava"
 *    mark here rather than a hand-rolled orange button.
 *
 * Delete an entry when it is fixed; the test then holds the new, better standard.
 */
// Empty, and worth keeping that way. The one entry here was the Connect Strava button,
// white on Strava orange at 3.31:1 against a 4.5:1 requirement, on every screen. Its label
// is black now (6.35:1) and the exemption is gone with it.
const KNOWN_VIOLATIONS: { id: string; target: string }[] = [];

const isKnown = (id: string, target: string) =>
  KNOWN_VIOLATIONS.some((k) => k.id === id && target.includes(k.target));

const serious = (violations: Awaited<ReturnType<typeof scan>>["violations"]) =>
  violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !isKnown(v.id, n.target.join(" "))) }))
    .filter((v) => v.nodes.length > 0);

const report = (violations: Awaited<ReturnType<typeof scan>>["violations"]) =>
  serious(violations)
    .map(
      (v) =>
        `${v.impact} · ${v.id}: ${v.help} (${v.nodes.length} node(s))\n    ${v.nodes[0]?.target.join(" ")}`,
    )
    .join("\n  ");

for (const view of ["Designs", "Look", "Add", "Layers"] as const) {
  test(`no serious accessibility violations on the ${view} tab`, async ({ page }) => {
    await openApp(page);
    await tab(page, view);
    const { violations } = await scan(new AxeBuilder({ page }));
    expect(serious(violations), `\n  ${report(violations)}`).toHaveLength(0);
  });
}

test("no serious accessibility violations in the export result sheet", async ({ page }) => {
  await openApp(page);
  await page.locator("[data-testid='export-image']").click();
  await page.waitForSelector("[data-testid='result-image']");
  const { violations } = await scan(new AxeBuilder({ page }));
  expect(serious(violations), `\n  ${report(violations)}`).toHaveLength(0);
});
