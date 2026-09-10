# Stride Studio — working rules for coding agents

Read `STRIDE_STUDIO_V2_SPEC.md` first. Every task references a section of it.

> The spec lives outside this repo today. Copy it to the repo root before starting a phase,
> or ask for it. Do not work from memory of it.

## Non-negotiable

1. Never rewrite. One phase (§13) at a time, one PR per numbered step, diffs under ~400 lines.
2. `npm test` and `npm run test:golden` must pass before you say a step is done. If a golden fails, you either
   fix your code or explain in the PR why the pixels _should_ change and add the `golden-update` label.
3. Never commit `dist/` or `index.html`. CI builds. Never touch `api/` secrets or `.env`.
4. Never add a dependency without adding a row to §11.1 in the spec.
5. Never change `src/engine/**` and `src/ui/**` in the same PR unless the spec step says so.
6. The engine is pure: no React, no DOM, no module-level mutable state, no `setFormat`.
7. Templates and looks are JSON in `src/templates` and `src/looks`. No design lives in code. A new look must pass `npm run lint:looks`.
8. Don't remove a legacy `case` from the old renderer until the JSON template passes goldens.

## Workflow

- Start: `git checkout -b <phase>-<step>-<slug>` from `main`. Run `npm run dev`, `npm test`.
- Work in small commits with messages that name the spec section: "feat(editor): drag/resize for doc.layers (§6.2, §6.3)".
- Before opening a PR: `npm run typecheck && npm run lint && npm test && npm run build && npm run size && npm run test:e2e`.
  (`npm run verify` runs everything except the browser suites.)
- PR description: spec section, what changed, screenshots/recording, golden diff summary.
- If a step is unclear, stop and ask; don't guess at the model.

## Commands

`npm run dev` · `npm run build` · `npm test` · `npm run test:golden` · `npm run golden:update` · `npm run lint:looks` · `npm run test:e2e` · `npm run size` · `npm run lint` · `npm run typecheck`

---

# Where the work is up to

Phases 0-7 all have substantial work landed. What is NOT done, in priority order:

1. **The 27 legacy templates are not re-authored as data** (§13 Phase 2 step 2). They still
   live in `src/render.js`'s switch. CLAUDE.md rule 8 says a legacy case stays until its
   replacement passes the goldens, and the goldens only run in the pinned container — so
   this belongs in a PR where CI can prove parity, one category at a time. The new
   data-driven designs live in `src/templates/` and appear in a separate **Designs** tab;
   the legacy catalogue is untouched in the **Style** tab.
2. **The golden baseline has never been recorded.** Run the `golden-update` workflow. Until
   then CI's golden job fails by design.
3. **Fonts are still the six system stacks** (§5.6 wants fifteen bundled woff2). Every look
   carries `legacyFonts` mapping to the closest available stack, so looks render correctly
   today and upgrade when the real faces land. Bundling them will change every golden, in
   its own labelled PR.
4. **Adaptive legibility (§2.7 S4)** is not implemented. Looks declare a `legibility`
   mechanism and the linter checks contrast on the look's own background, but nothing yet
   measures the photo under a text box at render time.
5. **The Strava client flow is not wired up.** `api/strava/token.ts` and `refresh.ts` are
   written and reviewed but untested — they need credentials and the stable callback domain
   that §16 decision 1 is waiting on.
6. **FIT import** (needs the lazy `@garmin/fitsdk` chunk), **milestones/deltas/gear/weather**
   (need activity history or the API), **club kit and batch export** (§2.7 S15).

# Phase 0 notes (read before touching the tests)

Things established while building the fence that are not obvious from the spec.

## Goldens only exist inside one container

`npm run test:golden` **skips** unless `GOLDEN_ENV=pinned`, and `npm run golden:update` **refuses**
to run without it. This is not bureaucracy:

The legacy renderer draws with system fonts (§1.2 E3 — `system-ui`, `Impact`, `Georgia`,
`SF Mono`). macOS and Linux rasterise those as _different typefaces at different metrics_, so
goldens recorded on a laptop fail every cell in CI. The tempting fix is to raise the 0.5 %
diff tolerance until it passes, which removes the only thing that would have caught the
silent 27-template regression in `9988ec1` (§1.4).

So the golden environment is exactly `mcr.microsoft.com/playwright:v1.63.0-noble`:

- **CI** runs the `golden` job in that container with `GOLDEN_ENV=pinned`.
- **Re-recording** is the manual `golden-update` workflow (Actions → golden-update → Run
  workflow). It records in the container and commits the PNGs to your branch.
- **Locally with Docker**, if you want it:
  `docker run --rm -it -v "$PWD":/w -w /w -e GOLDEN_ENV=pinned mcr.microsoft.com/playwright:v1.63.0-noble sh -c 'npm ci && npm run test:golden'`

Bumping the Playwright version means bumping that image tag in `playwright.config.ts` is not
enough — both workflows and `scripts/golden-update.mjs` name it too, and the baseline must be
re-recorded in a `golden-update` PR.

`npm run test:golden` still does useful work on a laptop: the **structural smoke** test runs
everywhere. It renders all 354 matrix cells and fails if any throws, renders nothing, or comes
out flat. Use it as the fast local check; the pixel gate is CI's job.

## What the golden matrix actually covers

354 cells in two tiers (`test/golden/harness.html` explains why):

- **composition**, 324 cells at 540 px — every template × 3 formats × 2 looks × 2 activities,
  rendered in **sticker mode** (no background). Protects text positions, sizes, wrapping,
  chart geometry, route projection, tile layout.
- **compositing**, 30 cells at 270 px — 10 anchor templates × 3 formats over the fixture
  photo. Protects `drawCover`, `ctx.filter`, `vignette`, `grain`, `frosted`.

The photo is deliberately absent from the 324: including it produced **165 MB** of PNGs
(and another 165 MB of git history per re-record). The split brings that to ~29 MB and loses
nothing, because the compositing path is one piece of shared code, not 27.

Measured sensitivity: a **1-unit** change to the layout margin (`M`, 1/1080 of canvas width)
fails 50 cells. A 2-unit change fails 87. The fence is tight.

## Determinism rules

Three things will silently rot the goldens if you break them:

1. **Never use `new Date()` in fixture data.** `DEMO.date` in `src/render.js` is
   `new Date().toISOString()`, so `test/fixtures/activities.js` pins it to
   `2026-09-04T06:42:00.000Z`. Without that, every golden containing the meta line starts
   failing the next calendar day. (It rolled over mid-build while this was being written.)
2. **Locale and timezone are pinned** to `en-GB` / `UTC` in `playwright.config.ts`, and `TZ=UTC`
   for unit tests. The legacy date formatters call `toLocaleDateString(undefined, ...)`.
3. **`grain()` reseeds its PRNG** to a constant on entry. Keep it that way.

## Two live bugs, deliberately left broken

Found by the first unit tests. Both are recorded as passing tests that assert the _wrong_
behaviour, each paired with a skipped test showing the fix. Phase 0 ships pixel-identical to
production, so neither is fixed here.

- **`fmtPace` can print `"4:60"`** (`src/render.js:19`). Minutes and seconds are derived
  independently — `Math.floor(sec/60)` and `Math.round(sec%60)` — so any pace whose seconds
  part lands in `[59.5, 60)` renders an impossible value. That is roughly 0.8 % of activities.
  `fmtTime` gets it right by rounding first. Fix: round before splitting. Changes pixels →
  needs a `golden-update` PR.
- **Malformed dates print `"Invalid Date"`** onto the design (`src/render.js:24-26`). The
  `try/catch` is dead code: `new Date("rubbish").toLocaleDateString()` returns that string
  rather than throwing. Reachable from manual entry (§7.6) and GPX import (§7.3). Fix: guard
  on `Number.isNaN(d.getTime())`. Belongs with the data layer in Phase 5.

## Known accessibility debt

`test/e2e/a11y.spec.ts` fails the build on any **new** serious/critical axe violation, with
existing ones enumerated in `KNOWN_VIOLATIONS`. There is one entry: the **"Connect Strava"
button is white on Strava orange `#FC5200` — 3.3:1 against a 4.5:1 requirement**, on every
screen. Fix by using black label text (~6.4:1) or bold ≥18.66 px text, ideally while replacing
the hand-rolled button with the official "Compatible with Strava" mark (§7.2). Owned by
Phase 4's accessibility pass. Delete the entry when it is fixed.

## The build must stay byte-identical (and two ways it leaked)

`npm run build` reproduces `dbbce71`'s `index.html` byte-for-byte. Check it after any
tooling change:

```sh
git show dbbce71:index.html > /tmp/orig.html && npm run build && cmp /tmp/orig.html dist/index.html
```

Two tooling changes silently altered the shipped app during Phase 0. Both are now pinned
shut, with the reasoning at the site of the fix:

1. **`tsconfig.json` `strict: true` implies `alwaysStrict: true`**, and esbuild honours it
   when bundling `src/` — prepending `"use strict"` and flipping the app from sloppy to
   strict mode (`this` binding, implicit globals). Hence `"alwaysStrict": false` in
   `tsconfig.json`. **Turn it on in Phase 1** as its own verified change.
2. **`"type": "module"` in the root `package.json`** makes esbuild emit
   `__toESM(require("react"), 1)` — a CommonJS interop change. Hence the declaration lives in
   `test/package.json` instead. Do not move it back to the root.

The lesson generalises: config that looks like it only affects tooling can reach the bundle.
When a phase claims to change no app behaviour, prove it with `cmp`.

## Things found by the tests that are worth not rediscovering

- **The look linter caught the spec.** Appendix B's Clinic, Retro '78 and Studio accents all
  failed its own §12.7 rule that `accent` must reach 3:1 against `bg` (1.87:1, 2.19:1,
  2.57:1). Corrected in `scripts/make-looks.mjs` by the least hue-preserving darkening that
  clears the bar; the reasoning is recorded there.
- **HYROX must not report distance.** The race contains 8 km of running, but the legacy model
  has one (distance, time) pair, so pairing 8 km with the FINISH time makes every template
  print about 8:40 /km when the athlete ran about 4:19 /km. `hyroxToActivity` sets distance
  to 0 deliberately; the real figures are bindings (`{runPace}`, `{runTotal}`).
- **A degenerate GPS track is not a route.** Indoor exports write trackpoints pinned at 0,0.
  `src/data/gpx.ts` drops a track with no span, otherwise the Map designs are offered and
  draw a dot.
- **zundo's `pause()` does not record what changed while paused.** Pausing around a drag
  makes the whole drag un-undoable. `StudioOverlay` snapshots the document at pointer-down
  and pushes that one state on pointer-up instead.
- **A hash-only navigation does not remount.** Testing the shared-layout link needs a fresh
  `page.goto`, not a hash change.
- **The overlay canvas covers the stage.** Pointer tests must target
  `[data-testid='overlay']`, not `[data-testid='stage']`.

## Linter scope

Biome skips `src/App.jsx`, `src/render.js`, `src/main.jsx` and `src/styles.css`
(see `biome.json`). Reformatting 1,400 lines of legacy code in the same phase that records
goldens from it is exactly the large diff §15 warns about. **Un-skip each file as it is
re-authored** in Phases 1–2; the exclusion list should be empty by the end of Phase 2.

Likewise `tsconfig.json` has `allowJs: true, checkJs: false`. Turn `checkJs` on, then drop
`allowJs`, as `src/` becomes TypeScript.
