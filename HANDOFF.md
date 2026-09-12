# Handoff — read this, then `STRIDE_STUDIO_CLAUDE_CODE_BRIEFS_V2.md`

The repo is now driven by **`STRIDE_STUDIO_CLAUDE_CODE_BRIEFS_V2.md`** (repo root, 7,259
lines): ~70 PRs across Phase A → D plus Path B. Read its §0 (how to use) and §1 (reference
tables) before touching anything. Each brief carries preconditions, a test-first spec, exact
line references, acceptance criteria and a paste-in prompt. `CLAUDE.md` still governs.

---

## State as of this handoff

- Branch `phase0-stabilise`, pushed. **Vercel is git-connected**, and production is deployed
  with `vercel deploy --prod`. Live: https://stride-studio-sooty.vercel.app
- **The header carries a build stamp** (e.g. `09/12 10:36`). It exists because "I refreshed
  and nothing is different" and "it is deployed" were both true for days. Check it first,
  always, before debugging anything the user reports.
- **The caching service worker is gone**, deliberately. It served the previously-deployed
  build on every visit, so shipped fixes were invisible. `src/pwa/register.ts` now unregisters
  anything still installed; `sw.js` is a tombstone. Offline support went with it and should
  come back only when the app is worth keeping offline.
- Suite: 423 unit, 200 e2e per run, 354-cell golden smoke. Bundle ~136 KB gzipped.
- **The golden pixel baseline has still never been recorded.** Run the `golden-update`
  workflow. Until then CI's golden job fails by design.

## The one thing that will bite you

**The v2 brief is pinned to `phase0-stabilise @ 8b345fb`, and HEAD has moved past it.**

Work on 11–12 Sep 2026 (the Strava HR-zone fix) changed four files the brief's §1.2
line-number inventory cites, and completed one brief outright. Before executing any PR,
reconcile:

| Brief | Real state |
|---|---|
| PR-C1 (Strava `profile:read_all` + `/athlete/zones`) | **Already done.** Scope is live; `src/data/stravaZones.ts` parses the response. |
| PR-A2 (chartLayers) | **Partially done.** `zoneOf`/`zoneShares` deleted from the engine and the zones chart migrated — but `:151`, `:164-165` and `:482` still derive zones from a max-HR number, exactly as §1.2 says. |
| PR-A3 (fields.ts) | **Partially done.** Uses real bands; still needs the central resolver. |
| PR-A16 (smart placement) | **Partially done.** `addLayer` places new objects in free space; the brief's photo-busyness version is complementary and still worth doing. |
| PR-A1 (`src/data/hr.ts`) | **Not done.** `stravaZones.ts` overlaps it with a different model (`ZoneBand {min,max}` vs `Zones {boundaries[5], source}`) and has no `prefs.hrMax` path. Fold the parser into `hr.ts` rather than keeping two modules. |
| §1.2 line numbers | Stale for `chartLayers.ts`, `fields.ts`, `App.jsx`. Re-derive before citing. |

`scripts/verify-plan.mjs` now exists — `npm run verify:plan [PR-XX]`. Two bugs in the brief's
own Appendix A listing had to be fixed to make it run: it pointed at the v1 filename, and its
path regex read prose identifiers like `session.athlete` as missing files.

**First run: 56 briefs clean, 13 drifted.** Run it before every PR. Known real drift beyond
the table above:

- PR-A0's `src/render.js:61` claim ("`DEMO.hrMax = 178`") was never right — `hrMax` is inline
  in the object literal, not a statement.
- PR-C1 cites `src/ui/StravaModal.tsx`, which does not exist; that UI is inline in App.jsx.
- PR-D8 and PR-D11 cite files that Phase B/D create later — expected, not a bug.

Two design conflicts the briefs do not notice, both worth settling before A2:

- **`boundaries[0]` means two different things.** PR-A1's fixture sets it to 95 (50 % of max);
  PR-C1 maps Strava with `zones.map(z => z.min)`, where Z1's min is **0**. `zoneOf` ignores
  index 0, so zone assignment is safe — but PR-A2 draws the Z1 *band* from `bounds[0]`, so the
  chart's first band differs by source.
- **PR-A2 draws "Set your max HR in Settings to see zones" onto the canvas.** That is inside
  the design, so it would ship inside an exported Instagram story. It should draw nothing in
  export mode, and the copy is wrong for anyone whose zones come from Strava.

**The golden baseline has still never been recorded**, yet dozens of briefs use
"`npm run test:golden` — zero diff" as acceptance criteria. That check is currently
decorative. Recording it is the highest-value first action.

## Execution order

Phase 0 — reconcile, before any Phase A brief:

1. Write `scripts/verify-plan.mjs` and run it across Phase A. Record which briefs are stale.
2. Finish the HR fix properly by adopting the brief's architecture: create `src/data/hr.ts`
   per PR-A1, absorb `stravaZones.ts` into it, migrate **all five** chartLayers call sites,
   and mark PR-C1 done.

Then Phase A in the order of §1.3's critical path: A0 → A1 → A2 → A3 → A4 → A5, with A4.5 and
A11 after. A6 (fmtPace `4:60` + Invalid Date), A7 (splits tail note) and A8 (CSS variables)
have no dependencies and can go in parallel.

## What the user cares about, in his order

1. **Correct data.** The HR-zone bug is the reason. Anywhere a number is derived or estimated
   when the real value is available, or one field is doing two jobs, treat it as the same bug.
2. **It looks wrong.** Near-black `#161616` with a neon `#d8ff3a` accent, hardcoded through
   `src/styles.css`. Canva is light; Strava is light. PR-A8/A9/A10 are this work and matter
   more than their position in the queue suggests.
3. **Changing a colour must be trivial.** PR-B15→B17 (the PalettePicker programme) is the
   real answer; Colour being first in the Inspector was only a start.

## Practical notes

- `npm run dev` builds and serves on `http://127.0.0.1:4173/dist/index.html`.
- `npm run verify` runs typecheck, lint, unit, build, size. Browser suites are
  `npm run test:e2e` and `npm run test:golden`.
- **`scripts/serve.mjs` does not build.** `npm run test:e2e` has a `pretest:e2e` that does,
  but invoking Playwright directly tests whatever `dist/` happens to hold. Build first.
- `.stage` has an 18px `border-radius` and clips, so a point a few pixels inside the overlay's
  bounding box is not over the canvas and never delivers a `pointerdown`.
- `pointerup` does not reliably carry the final pointer position under pointer capture; track
  the live value on `pointermove` instead.
- Pointer tests target `[data-testid='overlay']`, not `[data-testid='stage']`.
- Opening a tab clears the selection, so tests that act on a selection read the layer count
  from the Layers tab badge rather than opening the panel.
