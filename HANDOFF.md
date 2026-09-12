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
- **Zones need one reconnect.** Existing Strava connections predate `profile:read_all`, so
  `/athlete/zones` 401s for them. The Strava panel now says so and offers a forced-consent
  Reconnect rather than drawing empty charts silently.
- **The golden baseline is recorded.** 354 PNGs, 28 MB, in `test/golden/__snapshots__`,
  committed by the `golden-update` workflow in `778ca91`. A second immediate run reported
  "goldens unchanged — nothing to commit", so the fence is reproducible, not just present.
- **No GitHub Action had ever run on this repo before 12 Sep.** `origin/main` was still at
  `dbbce71` with no `.github/` at all, and GitHub only exposes a `workflow_dispatch` workflow
  if the file exists on the *default* branch — so `golden-update` could not be dispatched and
  `ci.yml` had never fired either. `f0d562c` puts `golden-update.yml` alone on `main` to
  register it. `ci.yml` is deliberately still off `main`: an `on: push` job there would run
  against a tree with no `test/` directory and be red for no useful reason. It does run on
  pull requests, because `pull_request` workflows execute the head branch's copy.
- **The workflow threw away its first recording.** It recorded all 354 goldens and then died
  on `git config` with "fatal: not in a git directory" — the container job's uid does not own
  the workspace, so git refuses to see a repo there. Fixed in `195f390` with an explicit
  `safe.directory`, plus `if: always()` on the artifact upload so a failed commit never costs
  the recording again.

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
| PR-A1 (`src/data/hr.ts`) | **Not done.** Settled 12 Sep: fold `stravaZones.ts` into `hr.ts` and keep its `ZoneBand {min,max}` model; v2's `boundaries[5]` tuple is superseded. Adds the `prefs.hrMax` path and `resolveAthleteHrMax`. |
| §1.2 line numbers | **Corrected 12 Sep.** Every drifted reference in the 13 flagged briefs was re-derived against `HEAD` and annotated. §1.2's own table is still the old numbering — the per-brief notes are the current source of truth. |

`scripts/verify-plan.mjs` now exists — `npm run verify:plan [PR-XX]`. Two bugs in the brief's
own Appendix A listing had to be fixed to make it run: it pointed at the v1 filename, and its
path regex read prose identifiers like `session.athlete` as missing files.

**First run: 56 clean, 13 drifted. Now 69 clean, exit 0.** All thirteen were corrected in the
brief on 12 Sep; each carries a dated note saying what moved and why, so the correction is
auditable rather than silent. Keep running it before every PR.

Both design conflicts are settled, in the briefs themselves:

- **Bands, not boundaries** (settled in PR-A1). `hr.ts` keeps `stravaZones.ts`'s
  `ZoneBand {min, max}` model rather than v2's `boundaries[5]` tuple. A tuple of lower bounds
  cannot express Strava's open-ended top zone, so PR-A2 had to invent Z5's ceiling from the
  drawn trace — a derived number where a real one exists. Under bands, `boundaries[0]` stops
  meaning two things: Z1 starts at 0 because that is what Strava says. User-set zones
  synthesise bands with `Z1.min = 0` and `Z5.max = Infinity` so both sources draw identically.
- **Nothing explanatory is ever painted on the canvas** (settled in PR-A2). The canvas is the
  exported artwork; a chrome message there ships inside someone's Instagram story. `drawZones`
  already returns without drawing when zones are absent — **PR-A2 as written would have added
  the placeholder back**, which is the one place executing the brief verbatim made the code
  worse. The explanation belongs in `CHART_REASON` in the DOM, whose `zones` copy was also
  wrong ("No heart rate in this activity" when the HR stream is present and the zones are what
  is missing).

Three further findings the briefs and this handoff both had wrong:

- **The golden fence only covers `src/render.js`.** `test/golden/harness.html` imports that
  file and the fixtures, and `src/render.js` has *zero* import statements — it is entirely
  self-contained. So all 354 cells measure the legacy switch-case renderer and nothing else.
  `src/engine/**`, `src/model/**`, `src/App.jsx` and `src/looks/**` are outside it. "Zero
  golden diff" is a real check only for PRs touching `render.js`: on the critical path that is
  A0 (additive, so no pixels), A5 and A6. Everywhere else it passes trivially and proves
  nothing. It is not a substitute for a unit test on the code you changed.
- **PR-A10 does not change goldens.** Its brief says they change dramatically. The harness
  never loads `src/looks/index.ts` or App.jsx — it defines its own two look presets inline.
  A10 is a two-line change that can land whenever, which is good news for the light redesign.
- **The zones chart is dead in the data-driven path.** `src/engine/layers.ts:455` is the only
  place a `ChartData` is ever built and it has no `zones` key; the `series` type declares none
  either, so the `zones` that `src/App.jsx:182` supplies is dropped at the type boundary. The
  11 Sep fix landed the parser, the resolver call and the chart-side consumption but not the
  wire between them. Folded into PR-A2's scope.

## Execution order

Phase 0 is **done** — baseline recorded, 13 briefs corrected, both conflicts settled.

Phase A follows §1.3's critical path: A0 → A1 → A2 → A3 → A4 → A5, then A4.5 and A11.
Three corrections to that ordering, established 12 Sep:

- **A2 is three sites, not five.** `:202-203` and `:425` already use bands. What remains is
  `:151`, `:164-165` and `:482`, plus deleting `ChartData.hrMax` and threading `zones` through
  `layers.ts`.
- **A2, A3 and A4 can land in any order** without golden coordination. The "land A2 and A4 the
  same day so the goldens only regenerate once" advice assumed the fence covered the engine.
  It does not.
- **A8 has no real precondition.** Its brief claims PR-A6, but A6 changes canvas pixels in
  `render.js` and A8 changes only `src/styles.css` chrome. Zero overlap — start it in
  parallel with A0.

The light-redesign track (A8 → A9 → A10) has one genuine blocker: **A9 writes a theme toggle
into `src/ui/Settings.tsx`, which PR-A4.5 creates**, and A4.5 currently sits behind A5. Either
pull A4.5 forward — it is self-contained, and A4 needs somewhere to put `prefs.hrMax` anyway —
or split A9 so the `--accent` sync and `contrast.ts` land now and the toggle row follows.
A10 is unblocked either way.

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
