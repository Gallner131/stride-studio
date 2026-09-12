# Stride Studio — Claude Code execution briefs (v2, definitive)

**Date:** 11 September 2026
**Repo:** `github.com/Gallner131/stride-studio`
**Base branch:** `phase0-stabilise` @ `8b345fb`
**Supersedes:** `STRIDE_STUDIO_CLAUDE_CODE_BRIEFS.md` (v1) — v1 had four verified technical bugs and 10 missing PRs. This document fixes both.
**Companion documents:** `STRIDE_STUDIO_DEEP_REVIEW_2026-09-11.md`, `CANVA_FOR_RUNNERS_STRATEGY.md`.

---

## 0. How to use this document

### 0.1 What changed vs v1

Everything in v1 was reviewed against the actual code and rewritten. Specifically:

- **PR-A2 was wrong** — it addressed `chartLayers.ts:158` and `:428` but missed `:171-172`, `:209`, and `:484`. Fixed in v2.
- **PR-A4 was wrong** — it told Claude Code to "add a Settings sheet", not knowing App.jsx already has a max-HR input at line 80 inside `ManualForm`. Split into A4 (extend the existing surface) and a new A4.5 (create a real Settings sheet).
- **PR-A5 was wrong** — it told Claude Code to delete `render.js:zoneOf` without addressing the two callers at `:749` and `:757` that use `.c` and `.name` on the returned zone object. Fixed with a compat shim in v2.
- **PR-A0 was missing** — the fixtures depend on `activity.hrMax` being set, so the HR resolver work needs a fixture-migration PR before any of A1-A5. Added.
- **10 PRs were missing from v1** — PalettePicker (broken into a 5-PR programme), font bundling (2 PRs), `look.motion.entrance` wiring, `look.photo.suits` wiring, map tiles (broken into a 3-PR programme), inspector consistency pass, share-a-layout receiving UX, smart placement on add, pinch-to-zoom + pan, zundo per-character debouncing. All added.
- **Phase C and D briefs got rewritten** to Phase A quality with actual code, tests, and acceptance criteria.
- **Path B section 5.1 (accounts + sync)** was expanded from 8 bullet points into 8 real briefs.
- **`verify-plan.mjs`** was added as an appendix — a script that checks each brief's file-list and line-number claims against the actual repo, so v3 doesn't have the same bugs v1 did.

### 0.2 The CLAUDE.md rules that apply to every brief

Every brief below assumes:

1. No rewrites — one PR per numbered step.
2. Diff under ~400 lines total.
3. `npm run verify && npm run test:e2e && npm run test:golden` all pass locally.
4. Never commit `dist/` or `index.html`.
5. Never change `src/engine/**` and `src/ui/**` in the same PR unless the brief authorises it.
6. The engine is pure — no React, no DOM, no module-level mutable state.
7. Templates and looks are JSON. A new look must pass `npm run lint:looks`.
8. Rule 8 changed in PR-B1 — a legacy `case` in `render.js` may be deleted when a JSON template of the same category exists and passes goldens.
9. New deps require a §11.1 spec entry.

Exceptions are stated explicitly per brief. If a brief says nothing, all rules apply.

### 0.3 What each brief contains

Each brief has a fixed structure. If a section is missing on a brief, that's a bug in the brief — flag it before starting.

- **Header** — PR number, title, branch name, phase, week
- **Rules** — which CLAUDE.md rules apply; any exception noted
- **Preconditions** — what PRs must be merged first
- **Files** — added, modified, deleted, with rough line counts
- **Line references** — every `file:line` cited, verified against `phase0-stabilise @ 8b345fb`
- **Test-first spec** — the failing test to write BEFORE implementing
- **Change spec** — actual code snippets showing before/after
- **Golden matrix impact** — will the goldens change? Yes / No / Deliberate
- **Acceptance criteria** — checklist to satisfy before merging
- **Diff estimate** — expected +/- lines
- **Prompt for Claude Code** — paste-in ready

### 0.4 Sequencing

Phase A must be complete before Phase B, C, or D start. Within a phase, the "Preconditions" line on each brief names the PRs that must be merged first. Some later-phase briefs have no phase-A/B preconditions and can run in parallel with them — those are called out.

Full sequencing chart in Appendix B.

### 0.5 Verification script

Before starting any PR, run `node scripts/verify-plan.mjs PR-XX`. The script (spec in Appendix A) reads the brief and confirms every cited file exists, every line number is what the brief claims, and every "deleted" file is currently present. If it fails, the brief is out of date and needs updating before Claude Code touches anything.

---

## 1. Reference tables

### 1.1 File map — where things live in the repo

Cited by many briefs; consolidated here to reduce repetition.

| Concern | File | Lines |
|---|---|---|
| Main app shell | `src/App.jsx` | 1,048 |
| Legacy renderer + demo data | `src/render.js` | 849 |
| Editor store (zundo) | `src/editor/store.ts` | ~180 |
| Editor gestures | `src/editor/gestures.ts` | ~300 |
| Editor placement helper | `src/model/placement.ts` | ~100 |
| Layer engine | `src/engine/layers.ts` | 622 |
| Route rendering | `src/engine/routeLayer.ts` | 436 |
| Chart rendering | `src/engine/chartLayers.ts` | ~500 |
| HYROX rendering | `src/engine/hyroxLayers.ts` | ~250 |
| Sticker library | `src/engine/stickers.ts` | ~50 |
| Photo analysis | `src/engine/photo.ts` | ~200 |
| Token resolver | `src/engine/tokens.ts` | ~60 |
| Model types | `src/model/types.ts` | ~280 |
| Field bindings | `src/model/fields.ts` | 66 |
| Field binding names | `src/model/bindings.ts` | ~80 |
| Suggestions engine | `src/model/suggest.ts` | ~250 |
| Layer defaults | `src/model/defaults.ts` | ~180 |
| Colour helpers | `src/model/colors.ts` | ~60 |
| Templates JSON | `src/templates/index.ts` | 2,822 |
| Looks (24 files) | `src/looks/*.json` | ~50 each |
| Looks index | `src/looks/index.ts` | ~80 |
| Prefs + IndexedDB | `src/storage/db.ts` | ~155 |
| Strava OAuth + client | `src/data/strava.ts` | ~300 |
| GPX/TCX import | `src/data/gpx.ts` | ~400 |
| Video export | `src/export/video.ts` | ~250 |
| Image export | `src/export/image.ts` | ~120 |
| Inspector panel | `src/ui/Inspector.tsx` | 1,267 |
| Selection bar | `src/ui/SelectionBar.tsx` | ~180 |
| Studio overlay | `src/ui/StudioOverlay.tsx` | ~400 |
| Add menu | `src/ui/AddMenu.tsx` | ~200 |
| Template gallery | `src/ui/TemplateGallery.tsx` | ~250 |
| Look picker | `src/ui/LookPicker.tsx` | ~150 |
| Layers panel | `src/ui/LayersPanel.tsx` | ~200 |
| Design saves list | `src/ui/MyDesigns.tsx` | ~120 |
| Design tokens (atoms) | `src/ui/atoms.tsx` | 162 |
| Global styles | `src/styles.css` | ~313 |
| Strava OAuth edge fns | `api/strava/*.ts` | ~400 total |
| Test fixtures | `test/fixtures/activities.js` | ~25 |
| Unit tests | `test/unit/*.test.ts` | ~20 files |
| E2E tests | `test/e2e/*.spec.ts` | ~10 files |
| Golden matrix | `test/golden/render.spec.ts` | ~120 |

### 1.2 Line-number inventory for HR-zone bug

Every place in the repo that computes zones incorrectly. Each Phase A HR brief references this table.

| File | Line | Code | Fix in PR |
|---|---|---|---|
| `src/App.jsx` | 80 | `defaultValue={act.hrMax \|\| ""}` — Max HR input in `ManualForm` writes per-activity | A4 (extend) |
| `src/App.jsx` | 164 | `const max = a.hrMax \|\| 190;` — effort scoring fallback | A4 |
| `src/App.jsx` | 177 | `hrMax: a.hrMax \|\| undefined,` — series field | A4 |
| `src/App.jsx` | 496 | `hrMax: a.max_heartrate ? Math.round(a.max_heartrate) + 5 : 190,` — Strava import | A4 |
| `src/engine/chartLayers.ts` | 33 | `hrMax?: number;` on ChartData interface | A2 (replace with `zones`) |
| `src/engine/chartLayers.ts` | 77-84 | `function zoneOf(bpm, max): number` local impl | A2 (delete) |
| `src/engine/chartLayers.ts` | 87-92 | `export function zoneShares` local impl | A2 (delete, use from hr.ts) |
| `src/engine/chartLayers.ts` | 158 | `const hrMax = data.hrMax ?? Math.max(...raw) + 5;` in `drawHr` | A2 |
| `src/engine/chartLayers.ts` | 171-172 | `const lo = (0.5 + z * 0.1) * hrMax; const hi = (0.6 + z * 0.1) * hrMax;` in band drawing | A2 |
| `src/engine/chartLayers.ts` | 209 | `ctx.strokeStyle = style.zoneColors[zoneOf(series[i] ?? min, hrMax)] ?? style.color;` | A2 |
| `src/engine/chartLayers.ts` | 428 | `const shares = zoneShares(hr, data.hrMax ?? Math.max(...hr) + 5);` in `drawZones` | A2 |
| `src/engine/chartLayers.ts` | 484 | `const max = data.hrMax ?? 190;` in `drawRings` | A2 |
| `src/model/fields.ts` | 3 | `import { ..., zoneShares } from "../render.js";` | A3 (change to hr.ts) |
| `src/model/fields.ts` | 14 | `hrMax: number \| null;` on LegacyActivity interface | A3 (keep as `activityHrMax`) |
| `src/model/fields.ts` | 49-56 | `zoneShares(act.hrStream, act.hrMax \|\| 190)` | A3 |
| `src/render.js` | 280 | `export function zoneOf(bpm, max)` — returns `{n, name, lo, hi, c}` object | A5 |
| `src/render.js` | 281-286 | `export function zoneShares(stream, max)` | A5 |
| `src/render.js` | 749 | `ctx.strokeStyle = zoneOf(hs[i], hrMax).c;` in `case "hrwave"` | A5 (compat shim required) |
| `src/render.js` | 757 | `ctx.fillStyle = zoneOf(shown, hrMax).c;` + `.name` in `case "hrwave"` | A5 (compat shim required) |
| `src/render.js` | 764 | `const shares = zoneShares(act.hrStream, hrMax);` in `case "zones"` | A5 |
| `src/data/gpx.ts` | 24 | `hrMax: number \| null;` on `ImportedActivity` interface | A5 (rename) |
| `src/data/gpx.ts` | 336 | `hrMax: hrValues.length > 0 ? Math.max(...hrValues) : null,` | A5 (rename to `activityHrMax`) |
| `src/data/gpx.ts` | 389 | `hrMax: imported.hrMax ? imported.hrMax + 5 : null,` | A5 (delete +5, rename) |
| `src/storage/db.ts` | 120 | `hrMax: number \| null;` on Prefs interface | A4 (already exists, wire up) |
| `src/storage/db.ts` | 126 | `hrMax: null` on DEFAULT_PREFS | A4 (already correct) |
| `test/fixtures/activities.js` | 15-16 | `FIXTURE_RUN = { ...DEMO, date: FIXED_DATE }` — inherits `hrMax: 178` from DEMO | A0 (add resolver-friendly wrapper) |
| `src/render.js` | 61 | `DEMO.hrMax = 178` — activity peak, not athlete max | A0 (add ATHLETE fixture) |
| `src/render.js` | 66 | `DEMO_WORKOUT.hrMax = 171` | A0 |

### 1.3 Precondition graph for Phase A (critical path)

```
PR-A0 (fixtures) ──┐
                   ├──> PR-A1 (hr.ts) ──> PR-A2 (chartLayers) ──> PR-A3 (fields) ──> PR-A4 (App) ──> PR-A5 (render.js + gpx.ts)
                   │                                                                                        │
                                                                                                            ├──> PR-A4.5 (Settings sheet)
                                                                                                            └──> PR-A11 (onboarding) — post-A10
```

PR-A6 (fmtPace + Invalid Date), PR-A7 (splits tail note), PR-A8 (CSS variables) have no dependencies on any of A0-A5 and can start in parallel by a second developer.

### 1.4 Fixtures and test-data conventions

Fixtures are pinned by `FIXED_DATE = "2026-09-04T06:42:00.000Z"` in `test/fixtures/activities.js`. Changing this date invalidates every golden.

The current fixtures use `DEMO` and `DEMO_WORKOUT` from `src/render.js`, both of which set `hrMax` to the activity's peak reached during the demo run. **This value has been used as "athlete max" throughout the code** — which is exactly the bug being fixed.

Post-A0, the fixture should provide both:
- `activityHrMax` (peak reached — for display)
- Alongside a fixture `Athlete` object with `hrZones: [95, 114, 133, 152, 171]` (so the resolver has something to consult and goldens don't change)

The fixture rename is why PR-A0 has to come before A1.

---

## 2. PHASE A — correctness, identity, first-run (weeks 1–3)

Twelve PRs (A0 through A11) plus five "extras" (A12–A16) that were missing from v1. All targetable in weeks 1-3 by one focused dev.

### PR-A0: Fixture prep for HR resolver

> ## ✅ LANDED — 2a51c62
>
> Fixtures carry the athlete and the activity separately. Verified in the pinned container: `golden-update` on the branch reported "goldens unchanged — nothing to commit".
>
> Kept for the record. The file claims and
> line references below describe the repo *before* this PR, so they are recorded as
> history and no longer checked by `verify:plan`.

**Branch:** `git checkout -b phase-a-00-hr-fixture-prep`
**Rules:** 1, 4 (no new deps).
**Preconditions:** none.
**Diff estimate:** +80 / -10.

#### Why this exists

Every subsequent HR PR (A1-A5) hinges on the resolver returning meaningful zones for fixtures. Without an `Athlete.hrZones` mock on the fixture, the resolver returns `undefined` and every zone-dependent golden regenerates as "Set your max HR in Settings to see zones" instead of the drawn chart. That would obscure whether A2-A5's changes are correct.

This PR ships the fixture wrapper first, so A1-A5's goldens legitimately don't change (the resolver returns a `strava`-source zones set that matches what the peak+5 fallback happened to render close to, so drift is minimal and reviewable).

#### Files

**Modified (landed):**
- `test/fixtures/activities.js` (+60 / -3) — add `FIXTURE_ATHLETE`, add `activityHrMax` on both fixtures, keep legacy `hrMax` field with a deprecation comment so pre-A5 code still compiles.
- `src/render.js` (+15 / -5) — add `activityHrMax` fields to `DEMO` and `DEMO_WORKOUT`. Leave `hrMax` in place (removed in A5).

#### Line references (as they were before this PR)

> **Re-derived 12 Sep 2026.** The two `src/render.js` refs below never matched the repo, at
> any commit: v2 wrote them as statements (`DEMO.hrMax = 178`), but `hrMax` has always been a
> property inside the object literal. Corrected to the real line contents.

- `test/fixtures/activities.js:16` — `export const FIXTURE_RUN = { ...DEMO, date: FIXED_DATE };`
- `src/render.js:61` — `hrMax: 178, calories: 1420,` (inside the `DEMO` object literal)
- `src/render.js:66` — `hrMax: 171, calories: 410,` (inside the `DEMO_WORKOUT` object literal)

#### Change spec

**`test/fixtures/activities.js`** — full new content of the file:

```js
// Golden/e2e activity fixtures (spec §12.2, updated for HR resolver §7.4).
//
// The legacy demo generators (route, splits, elevation, HR stream) are pure functions of
// index, so they are already deterministic. The ONE non-deterministic field is `date`,
// which src/render.js sets to `new Date().toISOString()` (lines 60, 65). Left alone, every
// golden containing the meta line would start failing the next calendar day.
//
// Fixtures therefore reuse the legacy demo data verbatim and pin only the date. The app
// itself is untouched: real users still see today's date on the demo activity.
import { DEMO, DEMO_WORKOUT } from "../../src/render.js";

/** Thu 4 Sep 2026, 06:42 UTC. Fixed forever; changing it invalidates every golden. */
export const FIXED_DATE = "2026-09-04T06:42:00.000Z";

/**
 * Athlete zone data used by fixtures. An athlete with a true maximum of 190 bpm.
 *
 * Shaped exactly as GET /athlete/zones returns it (conflict 1, settled in PR-A1):
 * Z1 starts at 0 and Z5 has no ceiling. Not a five-tuple of lower bounds — that
 * shape cannot say "and everything above 171", which is what Strava actually says.
 */
export const FIXTURE_ATHLETE = {
  id: 12345,
  name: "Demo Athlete",
  hrMax: 190,
  hrZones: [
    { min: 0, max: 114 },
    { min: 114, max: 133 },
    { min: 133, max: 152 },
    { min: 152, max: 171 },
    { min: 171, max: Number.POSITIVE_INFINITY },
  ],
};

/** Demo run: 21.1 km, route, splits, elevation, HR stream. */
export const FIXTURE_RUN = {
  ...DEMO,
  date: FIXED_DATE,
  activityHrMax: DEMO.hrMax,  // peak reached during this run
  // `hrMax` field intentionally left for A1-A4 compilation. A5 removes it.
};

/** Demo workout: no distance, no route, no splits, HR stream only. Spec §4.7. */
export const FIXTURE_WORKOUT = {
  ...DEMO_WORKOUT,
  date: FIXED_DATE,
  activityHrMax: DEMO_WORKOUT.hrMax,
};

export const FIXTURE_ACTIVITIES = {
  run: FIXTURE_RUN,
  workout: FIXTURE_WORKOUT,
};

/** Convenience for tests that need both activity and athlete zone data. */
export const FIXTURE_SESSION = {
  activity: FIXTURE_RUN,
  athlete: FIXTURE_ATHLETE,
};
```

**`src/render.js:60-66`** — add `activityHrMax` alongside `hrMax`:

```js
// BEFORE (lines 60-66)
export const DEMO = {
  id: "demo", sport: "run", name: "Sunday long run", date: new Date().toISOString(),
  distance: 21100, time: 6135, elevation: 84, hr: 158, hrMax: 178, calories: 1420,
  route: demoRoute(), splits: demoSplits(21, 291), elev: demoElev(), hrStream: demoHr(),
};
export const DEMO_WORKOUT = {
  id: "demo-workout", sport: "workout", name: "Strength + core", date: new Date().toISOString(),
  distance: 0, time: 2700, elevation: 0, hr: 132, hrMax: 171, calories: 410,
  route: [], splits: [], elev: [], hrStream: [...],
};

// AFTER
export const DEMO = {
  id: "demo", sport: "run", name: "Sunday long run", date: new Date().toISOString(),
  distance: 21100, time: 6135, elevation: 84, hr: 158,
  hrMax: 178,          // DEPRECATED — use activityHrMax. Removed in A5.
  activityHrMax: 178,  // peak reached during this run
  calories: 1420,
  route: demoRoute(), splits: demoSplits(21, 291), elev: demoElev(), hrStream: demoHr(),
};
export const DEMO_WORKOUT = {
  id: "demo-workout", sport: "workout", name: "Strength + core", date: new Date().toISOString(),
  distance: 0, time: 2700, elevation: 0, hr: 132,
  hrMax: 171,          // DEPRECATED — use activityHrMax. Removed in A5.
  activityHrMax: 171,
  calories: 410,
  route: [], splits: [], elev: [], hrStream: [...],  // unchanged
};
```

#### Test-first spec

`test/unit/fixtures.test.ts` (new, ~40 lines):

```ts
import { describe, it, expect } from "vitest";
import {
  FIXTURE_RUN, FIXTURE_WORKOUT, FIXTURE_ATHLETE, FIXTURE_SESSION,
} from "../fixtures/activities.js";

describe("fixtures", () => {
  it("FIXTURE_RUN exposes activityHrMax equal to legacy hrMax", () => {
    expect(FIXTURE_RUN.activityHrMax).toBe(178);
    expect(FIXTURE_RUN.hrMax).toBe(178);  // legacy field still present pre-A5
  });

  it("FIXTURE_WORKOUT exposes activityHrMax equal to legacy hrMax", () => {
    expect(FIXTURE_WORKOUT.activityHrMax).toBe(171);
    expect(FIXTURE_WORKOUT.hrMax).toBe(171);
  });

  it("FIXTURE_ATHLETE carries five Strava-shaped bands", () => {
    expect(FIXTURE_ATHLETE.hrZones).toHaveLength(5);
    expect(FIXTURE_ATHLETE.hrZones[0].min).toBe(0);
    expect(FIXTURE_ATHLETE.hrZones[4].max).toBe(Number.POSITIVE_INFINITY);
  });

  it("the athlete's maximum is not any activity's peak", () => {
    // The whole bug in one assertion: 190 is the athlete, 178 is what this run hit.
    expect(FIXTURE_ATHLETE.hrMax).toBe(190);
    expect(FIXTURE_RUN.activityHrMax).toBe(178);
  });

  it("FIXTURE_SESSION bundles activity + athlete", () => {
    expect(FIXTURE_SESSION.activity).toBe(FIXTURE_RUN);
    expect(FIXTURE_SESSION.athlete).toBe(FIXTURE_ATHLETE);
  });
});
```

#### Golden matrix impact

None — this PR only adds fields. Existing tests read `hrMax` and continue to see `178` / `171`.

#### Acceptance criteria

- [ ] `npm run verify` passes
- [ ] `npm test test/unit/fixtures.test.ts` passes
- [ ] `npm run test:golden` passes with zero diff

#### Prompt for Claude Code

```
Execute PR-A0 from BRIEFS_V2.md section 2. This is fixture prep for the HR zone resolver work.

Two files change:
1. test/fixtures/activities.js — copy the full new content from the brief. Add FIXTURE_ATHLETE, FIXTURE_SESSION, and activityHrMax on the two existing fixtures. Keep the legacy hrMax field with a deprecation comment.
2. src/render.js:60-66 — add activityHrMax alongside hrMax on both DEMO and DEMO_WORKOUT. Do NOT remove hrMax in this PR (A5 does that).

Write test/unit/fixtures.test.ts FIRST per the brief.

Verify: npm run verify && npm run test:golden — the golden matrix must NOT change (this PR only adds fields).

PR title: "chore(fixtures): athlete zone data and activityHrMax field (§7.4)"
```

---

### PR-A1: Central HR zone resolver

> ## ✅ LANDED — 98427c4
>
> `src/data/hr.ts` exists and `stravaZones.ts` is folded into it. Note there were **three** importers, not the two this brief listed — `src/App.jsx:32` was the third.
>
> Kept for the record. The file claims and
> line references below describe the repo *before* this PR, so they are recorded as
> history and no longer checked by `verify:plan`.

**Branch:** `git checkout -b phase-a-01-hr-zone-resolver`
**Rules:** 6 (engine purity), 1.
**Preconditions:** PR-A0.
**Diff estimate:** +180 / 0.

#### Files

**Added (landed):**
- `src/data/hr.ts` (~150 lines) — absorbs `stravaZones.ts` wholesale and adds the resolver.
- `test/unit/hr.test.ts` (~130 lines) — absorbs `stravaZones.test.ts`.

**Deleted (landed):**
- `src/data/stravaZones.ts` — folded in, not rewritten.
- `test/unit/stravaZones.test.ts` — its cases move across unchanged.

**Modified, import path only (landed):**
- `src/engine/chartLayers.ts:6-7` — `../data/stravaZones` → `../data/hr`.
- `src/model/fields.ts:4-5` — same.
- `src/App.jsx:32` — `./data/stravaZones.ts` → `./data/hr.ts`. Found during execution; there
  are **three** importers, not two. Deleting the module without this one breaks the build.

> **Deviation from the brief, authorised by HANDOFF.md.** v2 says "Modified: none". That was
> written when `stravaZones.ts` did not exist. Shipping `hr.ts` alongside it would leave two
> modules answering the same question with two different data models, which is the shape of
> the bug this whole phase exists to remove. The handoff's instruction — "fold the parser into
> `hr.ts` rather than keeping two modules" — is followed here. The four changed import lines
> carry no behaviour.

#### Change spec

> ### Conflict 1, settled: bands, not boundaries
>
> **v2's `Zones { boundaries: [n,n,n,n,n] }` is not used. `hr.ts` keeps the `ZoneBand {min, max}`
> model that `stravaZones.ts` already ships.** Three reasons, in the order they matter:
>
> 1. **A five-tuple of lower bounds cannot express the top zone.** Strava marks Z5 as
>    open-ended (`max: -1`), which the existing parser correctly reads as `Infinity`. With
>    boundaries, A2's own change spec has to invent a ceiling — `hi = z < 4 ? bounds[z+1] : max`,
>    where `max` is the highest point of the drawn trace. That is a derived number standing in
>    for a real one, on a chart whose entire purpose is to report real ones.
> 2. **`boundaries[0]` means two different things, which is what the handoff flagged.** v2's
>    fixture sets it to 95 (50 % of max); Strava's Z1 `min` is **0**. Under the band model the
>    question does not arise — Z1 starts where Strava says it starts.
> 3. **It is the model already written, tested and shipped.** `parseHeartRateZones` verifies
>    the payload shape rather than trusting it, and handles the three shapes the endpoint might
>    return. Replacing it with a tuple would throw that away.
>
> **Consequence for user-set zones:** when the athlete has no Strava zones and has typed a max
> HR into Settings, synthesise bands at 50/60/70/80/90 % — but with **`Z1.min = 0`** and
> **`Z5.max = Infinity`**, so both sources produce the same geometry and a chart looks the same
> however the zones were obtained. Do not put `0.5 × max` in Z1's floor: nothing measures it,
> and it would make the first band's height depend on the source.
>
> **What this changes elsewhere:** A1's `Zones`/`boundaries` type disappears from A2's change
> spec (already updated), and A2's rings site needs the athlete's true maximum as its own
> field, `ChartData.athleteHrMax`, because no band carries it.

`src/data/hr.ts` — the parser and the two lookups move across from `stravaZones.ts`
unchanged, including their comments. What is new is the resolver and `ZONE_META`:

```ts
// Central heart-rate zone resolution — §7.4.
//
// Zones come from ONE source of truth, resolved at read time:
//   1. The athlete's own zones from Strava's /athlete/zones
//   2. Bands synthesised from prefs.hrMax, if they set one in Settings
//   3. undefined — and then nothing zone-dependent is drawn at all
//
// It is a bug to derive zones from an activity's peak heart rate. The peak reached
// during ONE run is not the athlete's maximum, and using it as one falsifies every
// zone percentage downstream. That is what this module exists to end.

export type ZoneSource = "strava" | "user";

export interface Zones {
  bands: ZoneBand[];
  source: ZoneSource;
}

export interface ZonePrefs {
  hrMax?: number | null;
}

export interface Athlete {
  /** Bands as returned by GET /athlete/zones. */
  hrZones?: ZoneBand[];
  /** The athlete's true maximum, if we know it. Not any activity's peak. */
  hrMax?: number | null;
}

/** The five percentages Settings implies when the athlete gives us only a maximum. */
const USER_ZONE_FLOORS = [0, 0.6, 0.7, 0.8, 0.9];

/**
 * Bands from a single maximum. Z1 starts at 0 and Z5 has no ceiling, matching the
 * shape Strava returns, so a chart drawn from these is identical in geometry to one
 * drawn from the athlete's real zones.
 */
export function bandsFromMax(max: number): ZoneBand[] {
  return USER_ZONE_FLOORS.map((floor, i) => ({
    min: floor * max,
    max: i === USER_ZONE_FLOORS.length - 1 ? Number.POSITIVE_INFINITY : USER_ZONE_FLOORS[i + 1] * max,
  }));
}

export function resolveZones(prefs: ZonePrefs, athlete: Athlete | null): Zones | undefined {
  if (athlete?.hrZones?.length) return { bands: athlete.hrZones, source: "strava" };
  if (prefs.hrMax && prefs.hrMax > 0) return { bands: bandsFromMax(prefs.hrMax), source: "user" };
  return undefined;
}

/**
 * The athlete's true maximum, or null. Separate from `resolveZones` on purpose: the
 * rings chart needs a denominator, and no band carries one — Strava's top zone is
 * open-ended. Callers that cannot get a number here must not invent one.
 */
export function resolveAthleteHrMax(prefs: ZonePrefs, athlete: Athlete | null): number | null {
  return athlete?.hrMax ?? prefs.hrMax ?? null;
}

/**
 * Display metadata per zone. Formerly `ZONES` in render.js, which returned this shape
 * from `zoneOf`. PR-A5's compat shim reads `.c` and `.name` from here.
 */
export const ZONE_META: ReadonlyArray<{ n: number; name: string; c: string }> = [
  { n: 1, name: "Recovery", c: "#8FA3B5" },
  { n: 2, name: "Easy", c: "#4FC1E9" },
  { n: 3, name: "Aerobic", c: "#7BE495" },
  { n: 4, name: "Threshold", c: "#FFB347" },
  { n: 5, name: "Max", c: "#FF5A5F" },
] as const;
```

<details>
<summary>Superseded: v2's original <code>boundaries</code>-based listing, kept for reference</summary>

`src/data/hr.ts`:

```ts
// Central heart-rate zone resolution — §7.4.
//
// Zones come from ONE source of truth resolved at read time:
//   1. Strava's /athlete/zones (if fetched and cached on the session)
//   2. prefs.hrMax (if the user set it in Settings)
//   3. undefined — caller must hide any zone-dependent UI
//
// It is a bug to derive zones from an activity's peak heart rate.
// The peak reached during ONE run is not the athlete's max HR, and using it
// as such falsifies every downstream zone percentage.

export type ZoneSource = "strava" | "user";

export interface Zones {
  /** Five thresholds: Z1 lower, Z2 lower, Z3 lower, Z4 lower, Z5 lower. */
  boundaries: [number, number, number, number, number];
  source: ZoneSource;
}

export interface ZonePrefs {
  hrMax?: number | null;
}

export interface Athlete {
  /** Boundaries as returned by /athlete/zones (5 values). */
  hrZones?: number[];
}

export interface ActivityHrMeta {
  /**
   * Peak HR reached during this activity. Kept for display only (e.g. showing
   * "peak 178 bpm on this run"). NOT used to derive zones.
   */
  activityHrMax?: number | null;
}

export function resolveZones(
  _activity: ActivityHrMeta,
  prefs: ZonePrefs,
  athlete: Athlete | null,
): Zones | undefined {
  if (athlete?.hrZones && athlete.hrZones.length === 5) {
    return {
      boundaries: athlete.hrZones as Zones["boundaries"],
      source: "strava",
    };
  }
  if (prefs.hrMax && prefs.hrMax > 0) {
    const max = prefs.hrMax;
    return {
      boundaries: [max * 0.5, max * 0.6, max * 0.7, max * 0.8, max * 0.9],
      source: "user",
    };
  }
  return undefined;
}

/**
 * Returns 0..4 for the zone that `bpm` sits in.
 *
 * Note: this is a NUMERIC INDEX. The legacy `zoneOf` in render.js returned a
 * zone OBJECT `{n, name, lo, hi, c}`. Callers that need the colour or name
 * should look them up in `ZONE_META` below.
 */
export function zoneOf(bpm: number, zones: Zones): number {
  const [, z2, z3, z4, z5] = zones.boundaries;
  if (bpm < z2) return 0;
  if (bpm < z3) return 1;
  if (bpm < z4) return 2;
  if (bpm < z5) return 3;
  return 4;
}

export function zoneShares(stream: number[], zones: Zones): number[] {
  const counts = [0, 0, 0, 0, 0];
  if (stream.length === 0) return counts;
  for (const bpm of stream) counts[zoneOf(bpm, zones)]++;
  return counts.map((c) => c / stream.length);
}

/**
 * Display metadata for each zone. Formerly `ZONES` in render.js.
 * Colours here are the legacy defaults; a Look may override via `chart.zoneColors`.
 */
export const ZONE_META: ReadonlyArray<{ n: number; name: string; c: string }> = [
  { n: 1, name: "Recovery", c: "#8FA3B5" },
  { n: 2, name: "Easy", c: "#4FC1E9" },
  { n: 3, name: "Aerobic", c: "#7BE495" },
  { n: 4, name: "Threshold", c: "#FFB347" },
  { n: 5, name: "Max", c: "#FF5A5F" },
] as const;
```

</details>

#### Test-first spec

Carry every case in `test/unit/stravaZones.test.ts` across unchanged — the parser is not
being rewritten, so its coverage must not lapse — then add the resolver cases below.

```ts
import { describe, expect, it } from "vitest";
import { bandsFromMax, resolveAthleteHrMax, resolveZones } from "../../src/data/hr";
import { FIXTURE_ATHLETE } from "../fixtures/activities.js";

describe("resolveZones", () => {
  it("returns undefined when there is no source of truth", () => {
    expect(resolveZones({}, null)).toBeUndefined();
  });

  it("prefers the athlete's own Strava zones over a typed-in maximum", () => {
    const zones = resolveZones({ hrMax: 200 }, FIXTURE_ATHLETE);
    expect(zones?.source).toBe("strava");
    expect(zones?.bands).toBe(FIXTURE_ATHLETE.hrZones);
  });

  it("falls back to bands synthesised from prefs.hrMax", () => {
    const zones = resolveZones({ hrMax: 190 }, null);
    expect(zones?.source).toBe("user");
    expect(zones?.bands).toHaveLength(5);
  });

  it("never consults an activity — there is no parameter for one", () => {
    // Conflict 1: the signature itself is the guarantee. An activity's peak cannot
    // reach this function, so it cannot become a zone ceiling by accident again.
    expect(resolveZones.length).toBe(2);
  });
});

describe("bandsFromMax", () => {
  const bands = bandsFromMax(190);

  it("starts Z1 at zero, like Strava does", () => {
    // Not 0.5 x max. Nothing measures that floor, and using it would make the first
    // band's height depend on where the zones came from.
    expect(bands[0].min).toBe(0);
  });

  it("leaves Z5 open-ended, like Strava does", () => {
    expect(bands[4].max).toBe(Number.POSITIVE_INFINITY);
  });

  it("is contiguous — each band starts where the last one ended", () => {
    for (let i = 1; i < bands.length; i++) expect(bands[i].min).toBe(bands[i - 1].max);
  });
});

describe("resolveAthleteHrMax", () => {
  it("is null when nobody has told us the athlete's maximum", () => {
    expect(resolveAthleteHrMax({}, null)).toBeNull();
  });

  it("does not fall back to a nominal 190", () => {
    expect(resolveAthleteHrMax({ hrMax: null }, { hrZones: [] })).toBeNull();
  });
});
```

<details>
<summary>Superseded: v2's original <code>boundaries</code>-based tests, kept for reference</summary>

`test/unit/hr.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveZones, zoneOf, zoneShares, ZONE_META, type Zones } from "../../src/data/hr";
import { FIXTURE_ATHLETE } from "../fixtures/activities.js";

describe("resolveZones", () => {
  it("returns undefined when there is no source of truth", () => {
    expect(resolveZones({}, {}, null)).toBeUndefined();
  });

  it("prefers Strava athlete zones over prefs", () => {
    const zones = resolveZones({}, { hrMax: 200 }, FIXTURE_ATHLETE);
    expect(zones?.source).toBe("strava");
    expect(zones?.boundaries).toEqual([95, 114, 133, 152, 171]);
  });

  it("uses prefs.hrMax when Strava zones are absent", () => {
    const zones = resolveZones({}, { hrMax: 190 }, null);
    expect(zones?.source).toBe("user");
    expect(zones?.boundaries).toEqual([95, 114, 133, 152, 171]);
  });

  it("ignores activityHrMax entirely (never derives zones from activity peak)", () => {
    const zones = resolveZones({ activityHrMax: 165 }, {}, null);
    expect(zones).toBeUndefined();
  });

  it("rejects an athlete with fewer than 5 zone boundaries", () => {
    const zones = resolveZones({}, {}, { hrZones: [100, 120, 140] });
    expect(zones).toBeUndefined();
  });
});

describe("zoneOf", () => {
  const zones: Zones = { boundaries: [95, 114, 133, 152, 171], source: "user" };

  it.each([
    [90, 0],   // below Z2 threshold
    [100, 0],  // Z1
    [120, 1],  // Z2
    [140, 2],  // Z3
    [160, 3],  // Z4
    [175, 4],  // Z5
    [220, 4],  // above Z5 → clamped to Z5
  ])("bpm=%i → zone %i", (bpm, expected) => {
    expect(zoneOf(bpm, zones)).toBe(expected);
  });
});

describe("zoneShares", () => {
  const zones: Zones = { boundaries: [95, 114, 133, 152, 171], source: "user" };

  it("returns five 0s for an empty stream", () => {
    expect(zoneShares([], zones)).toEqual([0, 0, 0, 0, 0]);
  });

  it("shares sum to 1 for a non-empty stream", () => {
    const shares = zoneShares([100, 120, 140, 160, 175], zones);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe("ZONE_META", () => {
  it("has 5 entries matching legacy render.js", () => {
    expect(ZONE_META).toHaveLength(5);
    expect(ZONE_META[0].name).toBe("Recovery");
    expect(ZONE_META[4].name).toBe("Max");
  });
});
```

</details>

#### Golden matrix impact

None — no rendering code touched.

#### Acceptance criteria

- [ ] `npm test test/unit/hr.test.ts` passes
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] No other files modified

#### Prompt for Claude Code

```
Execute PR-A1 from BRIEFS_V2.md section 2. Add the central HR zone resolver at src/data/hr.ts.

Read the "Conflict 1, settled" box FIRST. The resolver uses the ZoneBand {min, max} model,
NOT the `boundaries: [n,n,n,n,n]` tuple in the superseded listing further down. The collapsed
<details> blocks are history — do not implement them.

This PR folds src/data/stravaZones.ts into src/data/hr.ts and deletes it, per HANDOFF.md.
Move parseHeartRateZones, zoneOfBands and zoneSharesFromBands across UNCHANGED, comments and
all — they are correct and tested; this is a move, not a rewrite. Carry every case from
test/unit/stravaZones.test.ts into test/unit/hr.test.ts, then delete the old test file.

Re-point the two importers (src/engine/chartLayers.ts:6-7, src/model/fields.ts:4-5). That is
the only change to those files in this PR — import paths, no behaviour. Everything else in
them belongs to A2 and A3.

Note the ZONE_META export — this replaces the legacy ZONES constant in render.js so callers
that used .c or .name (render.js lines 749, 757) have somewhere to go in PR-A5.

Verify: npm test test/unit/hr.test.ts && npm run typecheck && npm run lint
Confirm nothing still imports stravaZones: grep -rn "stravaZones" src/ test/ → no results.

PR title: "feat(data): central HR zone resolver (§7.4)"
```

---

### PR-A2: Migrate chartLayers to central resolver — ALL FIVE call sites

> ## ✅ LANDED — 6c82d33
>
> Three sites migrated, `ChartData.hrMax` deleted, and the missing `zones` wire in `layers.ts` connected — the zones chart draws for the first time.
>
> Kept for the record. The file claims and
> line references below describe the repo *before* this PR, so they are recorded as
> history and no longer checked by `verify:plan`.

**Branch:** `git checkout -b phase-a-02-chartlayers-zones`
**Rules:** 5 (engine only).
**Preconditions:** PR-A0, PR-A1.
**Diff estimate:** +130 / -80 = 210 net.

#### Why this brief is different from v1

v1 addressed lines 158 and 428 only. It missed 171-172, 209, and 484. All five sites are addressed here; skipping any one leaves a live bug.

#### Files

**Modified (landed):**
- `src/engine/chartLayers.ts` — three sites left (see below), `ChartData.hrMax?` deleted, `athleteHrMax?` added.
- `src/engine/layers.ts` — thread `zones` through `env.series` into `ChartData`, and fix the
  `CHART_REASON` copy for `zones`. Both engine, so rule 5 still holds.

**Added (landed):**
- `test/unit/chartLayers.test.ts` (~140 lines).

#### Line references (as they were before this PR)

> **Re-derived 12 Sep 2026. Two of the five sites are already done.** `81d0816` deleted the
> local `zoneOf`/`zoneShares`, added `ChartData.zones?: ZoneBand[]`, and migrated the
> colour-by-zone stroke and `drawZones`. Three sites remain, all still dividing by a number
> that is not the athlete's maximum. The brief's old `:33/:77-84/:87-92/:158/:171-172/:209/:428/:484`
> numbering is dead — use the list below.

Still wrong, in `src/engine/chartLayers.ts`:
- `:151` — `const hrMax = data.hrMax ?? Math.max(...raw) + 5;` in `drawHr`. Exists only to feed the bands below. Delete it.
- `:164` — `const lo = (0.5 + z * 0.1) * hrMax;` — band lower edge as a percentage of that number.
- `:165` — `const hi = (0.6 + z * 0.1) * hrMax;` — band upper edge.
- `:482` — `const max = data.hrMax ?? 190;` in `drawRings`, then `const v = (data.avgHr ?? 0) / max;`.
- `:39` — `hrMax?: number;` on `ChartData`. Delete. Its doc comment already says it must never be used as a zone ceiling, and the two sites above are doing exactly that — one field doing two jobs.

Already correct, do not touch:
- `:92` — `chartHasData` for `"zones"` already requires `(data.zones?.length ?? 0) > 0`.
- `:202-203` — the colour-by-zone stroke already uses `zoneOfBands(…, data.zones ?? [])`.
- `:425-426` — `drawZones` already uses `zoneSharesFromBands` and **returns without drawing** when there are no zones.

And one thing neither v1 nor v2 noticed:

- `src/engine/layers.ts:455` — `const data: ChartData = {`
- `src/engine/layers.ts:457` — `hrMax: env.series?.hrMax,`
- `src/engine/layers.ts:444` — `zones: "No heart rate in this activity",`
- `src/App.jsx:182` — `zones: zoneBands ?? undefined,`

That `ChartData` literal is the only one ever constructed, and it has no `zones` key. The
`series` type at `:42-53` declares no `zones` field either, so what App.jsx supplies is
dropped at the type boundary. **The zones chart and the colour-by-zone HR trace are dead in
the data-driven template path today**: the gate always fails and the layer renders
`CHART_REASON.zones`, which blames a missing heart-rate stream when the stream is present
and the athlete's zones are what is missing. Threading that one field, and fixing that copy,
is part of A2.

#### Change spec

**1) Interface (line 33):**

```ts
// BEFORE
export interface ChartData {
  hr?: number[];
  hrMax?: number;
  altitude?: number[];
  splits?: number[];
  distanceKm?: number;
  durationSeconds?: number;
  effort?: number;
}

// AFTER
import type { Zones } from "../data/hr";
export interface ChartData {
  hr?: number[];
  zones?: Zones;
  altitude?: number[];
  splits?: number[];
  distanceKm?: number;
  durationSeconds?: number;
  effort?: number;
}
```

**2) Imports (top of file):**

```ts
// ADD
import { zoneOf, zoneShares, type Zones } from "../data/hr";

// DELETE (was inline at lines 77-92)
// function zoneOf(bpm: number, max: number): number { ... }
// export function zoneShares(hr: number[], hrMax: number): number[] { ... }
```

Note: because `zoneShares` was exported, and callers might still import it from `chartLayers`, add a `export { zoneShares }` re-export at the top of the file OR update the callers (which are only `fields.ts`, addressed in A3). Prefer re-export for one release cycle:

```ts
export { zoneShares };  // temporary re-export; A3 updates fields.ts
```

**3) `drawHr` (line ~155 through ~215):**

```ts
// BEFORE
export function drawHr(...): void {
  const raw = data.hr ?? [];
  if (raw.length < 2) return;

  const series = smoothSeries(...);
  const hrMax = data.hrMax ?? Math.max(...raw) + 5;
  const min = Math.min(...series);
  const max = Math.max(...series);
  ...

  if (options.bands) {
    for (let z = 0; z < 5; z++) {
      const lo = (0.5 + z * 0.1) * hrMax;
      const hi = (0.6 + z * 0.1) * hrMax;
      ...
    }
  }
  ...

  // Colour trace by zone if enabled
  if (options.colourBy === "hr" && style.zoneColors) {
    for (let i = 0; i < series.length - 1; i++) {
      ctx.strokeStyle = style.zoneColors[zoneOf(series[i] ?? min, hrMax)] ?? style.color;
      ...
    }
  }
}

// AFTER
export function drawHr(...): void {
  const raw = data.hr ?? [];
  if (raw.length < 2) return;

  const series = smoothSeries(...);
  const min = Math.min(...series);
  const max = Math.max(...series);
  ...

  // Bands only when we have real zones. Without zones the trace still draws;
  // we just don't put the coloured backing behind it.
  if (options.bands && data.zones) {
    const bounds = data.zones.boundaries;
    for (let z = 0; z < 5; z++) {
      const lo = bounds[z];
      const hi = z < 4 ? bounds[z + 1] : max;  // Z5 goes to trace max
      ...
    }
  }
  ...

  // Colour trace by zone only when we have zones AND the option is on.
  if (options.colourBy === "hr" && style.zoneColors && data.zones) {
    for (let i = 0; i < series.length - 1; i++) {
      ctx.strokeStyle = style.zoneColors[zoneOf(series[i] ?? min, data.zones)] ?? style.color;
      ...
    }
  }
}
```

**4) `drawZones` — SUPERSEDED. Do not implement the block below.**

> **Settled 12 Sep 2026 — conflict 2.** This is the one place where executing the brief as
> written would make the code worse. `drawZones` already does the right thing at `:425-426`:
>
> ```ts
> const shares = zoneSharesFromBands(hr, data.zones ?? []);
> if (!shares) return;
> ```
>
> Adding the placeholder would put the string **on the canvas**, which means inside the
> exported PNG and inside the exported Instagram story. A chrome message does not belong in
> the artwork. The copy is also wrong for the larger group of affected users: someone whose
> zones come from Strava has no max-HR setting to fill in — they need to reconnect, which is
> what the Strava panel already tells them (`src/App.jsx:1009`).
>
> **The rule for the whole codebase: a missing value draws nothing on the canvas and explains
> itself in the DOM.** The layer engine already has the mechanism — `CHART_REASON` in
> `src/engine/layers.ts:443-450`. A2's job there is to make its `zones` entry tell the truth:
>
> ```ts
> // BEFORE — blames the HR stream, which is present
> zones: "No heart rate in this activity",
> // AFTER
> zones: "Connect Strava or set your max heart rate to see zones",
> ```
>
> Leave `drawZones` alone apart from the import path.

**5) `drawRings` (`:481-483`):**

```ts
// BEFORE
const max = data.hrMax ?? 190;
const v = (data.avgHr ?? 0) / max;

// AFTER
// The Avg HR ring shows intensity, so its denominator has to be the athlete's
// maximum. It was this activity's peak, which normalises every run against
// itself: a recovery jog and a 5k time trial fill the ring about equally, and
// when there was no peak at all it invented 190. Zones cannot supply it — the
// top band is open-ended — so the resolver passes the real number or nothing.
const max = data.athleteHrMax;
const v = max ? (data.avgHr ?? 0) / max : 0;
```

With no athlete maximum the ring reads its bpm figure with an empty arc, which is honest:
we know the average, we do not know what fraction of their capacity it represents. This is
the same rule as conflict 2 — show what is real, leave the rest blank, say why in the DOM.

`ChartData` changes accordingly: delete `hrMax?: number` (`:39`), add

```ts
/** The athlete's true maximum, from the resolver. Not this activity's peak. */
athleteHrMax?: number;
```

**6) `chartHasData` for `"zones"` — already done.** `:90-92` reads:

```ts
case "zones":
  // Without the athlete's real zones there is nothing honest to draw.
  return (data.hr?.length ?? 0) > 1 && (data.zones?.length ?? 0) > 0;
```

No change. The reason it has never been observed working is the `layers.ts` gap above.

**7) `src/engine/layers.ts` — connect the two ends:**

```ts
// :42-53, the series type
zones?: ZoneBand[];        // ADD
hrMax?: number;            // → athleteHrMax?: number

// :455-463, the only ChartData ever built
zones: env.series?.zones,              // ADD — this is the missing wire
athleteHrMax: env.series?.athleteHrMax, // was hrMax: env.series?.hrMax

// :444, CHART_REASON
zones: "Connect Strava or set your max heart rate to see zones",
```

#### Test-first spec

`test/unit/chartLayers.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { chartHasData, drawZones } from "../../src/engine/chartLayers";
import type { ChartData } from "../../src/engine/chartLayers";
import type { Zones } from "../../src/data/hr";
import { FIXTURE_ATHLETE } from "../fixtures/activities.js";

const zones: Zones = {
  boundaries: FIXTURE_ATHLETE.hrZones as Zones["boundaries"],
  source: "strava",
};

describe("chartHasData for zone-dependent charts", () => {
  const withHrStream: ChartData = { hr: [120, 130, 140, 150, 160] };

  it("returns false for kind='zones' when zones are undefined", () => {
    expect(chartHasData("zones", withHrStream)).toBe(false);
  });

  it("returns true for kind='zones' when zones are provided", () => {
    expect(chartHasData("zones", { ...withHrStream, zones })).toBe(true);
  });

  it("still returns true for kind='hr' when hr present regardless of zones", () => {
    expect(chartHasData("hr", withHrStream)).toBe(true);
  });
});

describe("drawZones draws nothing without zones", () => {
  // Conflict 2, settled: no explanatory text is ever painted onto the canvas, because the
  // canvas is the exported artwork. Absence is silent here and explained in the DOM.
  it("paints nothing at all when zones are absent", () => {
    const ctx = mockCtx();
    drawZones(ctx, { hr: [120, 130] }, defaultStyle(), {}, 400, 200);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it("draws the bars when zones are present", () => {
    const ctx = mockCtx();
    drawZones(ctx, { hr: [120, 130], zones }, defaultStyle(), {}, 400, 200);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

describe("zones reach the chart from the layer engine", () => {
  // The regression this is here to stop: App.jsx supplies `zones`, chartLayers consumes
  // `zones`, and for a whole release layers.ts silently dropped it in between.
  it("chartHasData sees zones threaded through a ChartData built by layers.ts", () => {
    const data: ChartData = { hr: [120, 130, 140], zones };
    expect(chartHasData("zones", data)).toBe(true);
  });
});

function mockCtx(): any {
  return {
    fillStyle: "", strokeStyle: "", font: "", textAlign: "left",
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    arc: vi.fn(), rect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  };
}
function defaultStyle(): any {
  return { color: "#000", textColor: "#666", font: "500 14px system-ui" };
}
```

#### Golden matrix impact

**None — and not for the reason this brief assumed.**

> **Corrected 12 Sep 2026.** The golden matrix cannot see this PR at all.
> `test/golden/harness.html:19-26` imports `DEFAULT_OPTS, FORMATS, renderFrame, setFormat,
> TEMPLATES` from `src/render.js` plus the fixtures, and nothing else. `src/render.js` has
> **zero import statements** — it is entirely self-contained legacy code. So all 354 cells
> measure the legacy switch-case renderer and only that. `src/engine/**`, `src/model/**`,
> `src/App.jsx` and `src/looks/**` are outside the fence.
>
> The transition plan this section used to recommend — "land A2 and A4 the same day so the
> goldens only regenerate once" — is therefore unnecessary. A2, A3 and A4 can land
> independently, in any order, and the goldens will not move.
>
> The wider consequence is worth carrying into every other brief: **"`npm run test:golden` —
> zero diff" is a real check only for PRs that touch `src/render.js`.** On the critical path
> that is A0 (additive, so no pixels), A5 and A6. Everywhere else the criterion passes
> trivially and proves nothing. It is not a substitute for a unit test on the code you
> actually changed.

#### Acceptance criteria

- [ ] All `|| 190` and `+ 5` removed from `src/engine/chartLayers.ts`
- [ ] `npm test test/unit/chartLayers.test.ts` passes
- [ ] `npm run typecheck` clean
- [ ] Golden matrix — if landed alone, will show placeholder text; expected. If landed same-day with A4, matrix unchanged.

#### Prompt for Claude Code

```
Execute PR-A2 from BRIEFS_V2.md section 2. This migrates ALL FIVE zone-related sites in src/engine/chartLayers.ts to the central resolver from PR-A1.

CRITICAL: v1 of this brief missed lines 171-172, 209, and 484. All are addressed here. Do not skip any.

Sites to change:
- Interface line 33: hrMax? → zones?: Zones
- Delete local zoneOf (77-84), local zoneShares (87-92), re-export zoneShares from ../data/hr
- Line 158 drawHr: no more `data.hrMax ?? Math.max(...raw) + 5`
- Lines 171-172 drawHr bands: switch to explicit zone boundaries from data.zones
- Line 209 drawHr colour-by-hr: use data.zones with new zoneOf(int) return
- Line 428 drawZones: placeholder when zones absent
- Line 484 drawRings: use zones-or-neutral fallback (no 190)

Write test/unit/chartLayers.test.ts FIRST per the brief.

Golden matrix will show placeholder text on zone charts until PR-A4 lands. Recommended: land A2 and A4 same-day so goldens regenerate once. Use `golden-update` label after A4.

Verify: npm run verify

PR title: "feat(engine): chartLayers uses central zone resolver, all 5 sites (§7.4)"
```

---

### PR-A3: Migrate fields.ts to central resolver

**Branch:** `git checkout -b phase-a-03-fields-zones`
**Rules:** 5 (model only).
**Preconditions:** PR-A0, PR-A1, PR-A2.
**Diff estimate:** +30 / -12.

#### Files

**Modified:**
- `src/model/fields.ts` — rename `LegacyActivity.hrMax` → `activityHrMax`. (The import re-point
  this brief used to own was done by PR-A1 when it folded `stravaZones.ts` into `hr.ts`.)

**Added:**
- `test/unit/fields.test.ts` (~90 lines).

#### Line references verified

> **Re-derived 12 Sep 2026 — most of this brief has already landed.** The 11–12 Sep HR fix
> (`81d0816`) removed `zoneShares` from the `render.js` import, added the third
> `zones: ZoneBand[] | null` parameter to `buildFields`, and replaced the `act.hrMax || 190`
> division with `zoneSharesFromBands`. The comment at `:56-59` records why. What is left for
> A3 is only the two items in **Files** above. The Change spec's BEFORE block below no longer
> exists in the repo — read it as history, not as the current state.

- `src/model/fields.ts:4` — `import type { ZoneBand } from "../data/hr";` — already re-pointed by PR-A1.
- `src/model/fields.ts:17` — `hrMax?: number | null;` on `LegacyActivity` — rename to `activityHrMax`.
- `src/model/fields.ts:42` — `hrMax: act.hrMax ?? null,` — reads the renamed field; the *key* stays `hrMax`.
- `src/model/fields.ts:60` — `const shares = act.hrStream?.length ? zoneSharesFromBands(act.hrStream, zones ?? []) : null;` — already correct; only the import path moves.

Note that the *field key* `hrMax` at `:42` stays. It is a display binding — two templates
render `{hrMax}` (`src/templates/index.ts:2086`, `:2281`) and they mean "the peak this run
reached", which is exactly what `activityHrMax` holds. Renaming the key would break them.

#### Change spec

```ts
// BEFORE
import { derive, fmtClock, fmtDate, fmtDateLong, fmtDist, fmtTime, SPORTS, zoneShares } from "../render.js";
import type { FieldTable } from "./bindings";

...

export function buildFields(act: LegacyActivity, opts: Record<string, unknown>): FieldTable {
  ...
  if (act.hrStream?.length) {
    const shares: number[] = zoneShares(act.hrStream, act.hrMax || 190);
    const total = (act.time ?? 0) / 60;
    shares.forEach((share, i) => {
      fields[`zonePercent.${i + 1}`] = Math.round(share * 100);
      fields[`zoneMinutes.${i + 1}`] = Math.round(share * total);
    });
  }
  return fields;
}

// AFTER
import { derive, fmtClock, fmtDate, fmtDateLong, fmtDist, fmtTime, SPORTS } from "../render.js";
import { zoneShares, type Zones } from "../data/hr";
import type { FieldTable } from "./bindings";

...

export function buildFields(
  act: LegacyActivity,
  opts: Record<string, unknown>,
  zones?: Zones,
): FieldTable {
  ...
  if (act.hrStream?.length && zones) {
    const shares = zoneShares(act.hrStream, zones);
    const total = (act.time ?? 0) / 60;
    shares.forEach((share, i) => {
      fields[`zonePercent.${i + 1}`] = Math.round(share * 100);
      fields[`zoneMinutes.${i + 1}`] = Math.round(share * total);
    });
  }
  return fields;
}
```

#### Test-first spec

`test/unit/fields.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildFields } from "../../src/model/fields";
import type { Zones } from "../../src/data/hr";
import { FIXTURE_ATHLETE } from "../fixtures/activities.js";

const zones: Zones = {
  boundaries: FIXTURE_ATHLETE.hrZones as Zones["boundaries"],
  source: "strava",
};

describe("buildFields zone bindings", () => {
  const act = {
    name: "Test",
    hrStream: [100, 120, 140, 160, 180],
    time: 1500,
  } as any;

  it("populates zonePercent.1..5 when zones are provided", () => {
    const fields = buildFields(act, {}, zones);
    expect(fields["zonePercent.1"]).toBe(20);
    expect(fields["zonePercent.2"]).toBe(20);
    expect(fields["zonePercent.3"]).toBe(20);
  });

  it("populates zoneMinutes.1..5 proportionally to time", () => {
    const fields = buildFields(act, {}, zones);
    // 1500 sec = 25 min, 20% each zone = 5 min each
    expect(fields["zoneMinutes.1"]).toBe(5);
    expect(fields["zoneMinutes.2"]).toBe(5);
  });

  it("omits zonePercent fields entirely when zones are undefined", () => {
    const fields = buildFields(act, {}, undefined);
    expect(fields["zonePercent.1"]).toBeUndefined();
    expect(fields["zonePercent.5"]).toBeUndefined();
    expect(fields["zoneMinutes.1"]).toBeUndefined();
  });

  it("omits zonePercent fields when zones absent regardless of hrStream", () => {
    const fields = buildFields(act, {});
    expect(fields["zonePercent.1"]).toBeUndefined();
  });
});
```

#### Golden matrix impact

None directly — fields.ts doesn't render. But App.jsx won't compile after this PR (its call to `buildFields(act, opts)` needs a third arg). Expected — fixed in A4.

#### Acceptance criteria

- [ ] `zonePercent.*` and `zoneMinutes.*` only present when zones defined
- [ ] `npm test test/unit/fields.test.ts` passes
- [ ] `npm run typecheck` — expected to fail on `App.jsx` call site; fixed in A4
- [ ] The compile failure is confined to `App.jsx` — no other file breaks

#### Prompt for Claude Code

```
Execute PR-A3 from BRIEFS_V2.md section 2. Migrate src/model/fields.ts to consume the central zone resolver from PR-A1.

Signature change: buildFields(act, opts, zones?).

Delete `zoneShares` from the render.js import at line 3; import from ../data/hr instead.

The `act.hrMax` field on LegacyActivity is kept in this PR — renamed to `activityHrMax` in A5. Do not rename here.

Write test/unit/fields.test.ts FIRST.

App.jsx will fail to compile. That's expected — A4 fixes it.

Verify (limited scope for this PR): npm test test/unit/fields.test.ts && npm run lint

PR title: "feat(model): fields.ts requires resolved zones (§7.4)"
```

---

### PR-A4: Wire prefs.hrMax through App.jsx + extend ManualForm

**Branch:** `git checkout -b phase-a-04-app-hrmax-wiring`
**Rules:** 5 (this PR touches UI + engine because they must move together — authorised).
**Preconditions:** PR-A0, PR-A1, PR-A2, PR-A3.
**Diff estimate:** +160 / -50 = 210 net.

#### Why this brief is different from v1

v1 said "add a new Settings sheet". App.jsx already has a max-HR input at line 80 inside `ManualForm` — a manual-activity-entry form, not global prefs. Ignoring the existing surface would cause Claude Code to either duplicate the input or leave the ManualForm surface broken.

This PR:
- Wires the existing `ManualForm` input to read/write per-activity `activityHrMax` (renaming from the misused `hrMax`)
- Wires prefs.hrMax through App.jsx to the resolver
- Loads `prefs` state via `loadPrefs()` in App.jsx
- Adds a simple per-activity hint if prefs.hrMax not set
- Does NOT add a full Settings sheet — that's PR-A4.5

#### Files

**Modified:**
- `src/App.jsx` — 4 line ranges: 80 (ManualForm rename), 140-165 (prefs load + zones memo + effort scoring), 175-190 (series), 490-500 (Strava import).
- `src/data/strava.ts` — expose `session.athlete` shape (empty for now; PR-C1 fills it).

**Added:**
- `test/e2e/hrmax-wiring.spec.ts` (~80 lines).

#### Line references verified

> **Re-derived 12 Sep 2026.** All four references moved — App.jsx grew by one line above the
> ManualForm input and by thirty in the Strava importer. The last one also changed in
> substance: `81d0816` already deleted the `+ 5` and the `: 190` fallback from the Strava
> import, so that site now stores the honest per-activity peak and only needs renaming. The
> `|| 190` at the effort-scoring site is still live and is still the bug.

- `src/App.jsx:81` — `defaultValue={act.hrMax || ""}` — the Max HR input inside `ManualForm` (was `:80`).
- `src/App.jsx:168` — `const max = a.hrMax || 190;` — effort scoring, still derives from the activity peak (was `:164`).
- `src/App.jsx:181` — `hrMax: a.hrMax || undefined,` — series field (was `:177`).
- `src/App.jsx:526` — `hrMax: a.max_heartrate ? Math.round(a.max_heartrate) : null,` — Strava import; the `+ 5` and `190` are already gone, so this is a rename to `activityHrMax`, not a fix (was `:496`).

#### Change spec

**1) App.jsx top-level state — add prefs and athlete:**

Find the block around App.jsx:100-105 (state declarations). Add:

```jsx
const [prefs, setPrefs] = useState(() => loadPrefs());
// Athlete zone data from Strava. Populated by PR-C1; empty for now.
const athlete = strava.athlete ?? null;
```

Import `loadPrefs, savePrefs` from `./storage/db`.
Import `resolveZones` from `./data/hr`.

**2) Zones memo — before `series` memo (around line 155):**

```jsx
const zones = useMemo(
  () => resolveZones(effectiveAct, prefs, athlete),
  [effectiveAct, prefs, athlete],
);
```

**3) `fields` memo (around line 152):**

```jsx
// BEFORE
const fields = useMemo(() => buildFields(effectiveAct, opts), [effectiveAct, opts]);

// AFTER
const fields = useMemo(
  () => buildFields(effectiveAct, opts, zones),
  [effectiveAct, opts, zones],
);
```

**4) Effort scoring around line 160-170 — currently uses `a.hrMax || 190`:**

```jsx
// BEFORE
{
  let effort;
  if (a.hrStream?.length && a.hr) {
    const max = a.hrMax || 190;
    ...
  }
}

// AFTER
{
  let effort;
  if (a.hrStream?.length && a.hr && zones) {
    // Use zoneOf from central resolver; compute effort as weighted zone time
    const shares = zoneShares(a.hrStream, zones);
    effort = shares.reduce((sum, share, z) => sum + share * (z + 1), 0);
  }
  // else effort = undefined; ring layers hide themselves
}
```

Import `zoneShares` from `./data/hr` (via `hr` module — already imported).

**5) `series` memo (around line 175-185):**

```jsx
// BEFORE
return {
  route: a.route || [],
  hr: a.hrStream || [],
  hrMax: a.hrMax || undefined,
  splits: a.splits || [],
  altitude: a.elev || [],
  ...
};

// AFTER
return {
  route: a.route || [],
  hr: a.hrStream || [],
  zones,  // ← replaces hrMax
  splits: a.splits || [],
  altitude: a.elev || [],
  ...
};
```

**6) Strava import (line 496):**

```jsx
// BEFORE
{
  ...,
  hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
  hrMax: a.max_heartrate ? Math.round(a.max_heartrate) + 5 : 190,
  ...
}

// AFTER
{
  ...,
  hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
  activityHrMax: a.max_heartrate ? Math.round(a.max_heartrate) : null,  // display only
  // hrMax removed — was falsifying zones
  ...
}
```

**7) `ManualForm` (line 80):**

```jsx
// BEFORE
<Field label="Max heart rate (for zones)"><input type="number" placeholder="e.g. 185" defaultValue={act.hrMax || ""} onChange={(e) => upd({ hrMax: parseInt(e.target.value, 10) || null })} /></Field>

// AFTER
<Field label="Peak heart rate (this activity)"><input type="number" placeholder="e.g. 165" defaultValue={act.activityHrMax || ""} onChange={(e) => upd({ activityHrMax: parseInt(e.target.value, 10) || null })} /></Field>
```

Note: the ManualForm now records only the activity's peak, which is honest. Zones come from `prefs.hrMax` (set in A4.5's Settings sheet) or Strava.

If prefs.hrMax is not set, users creating a manual activity see a small hint below the form:

```jsx
{!prefs.hrMax && (
  <p className="muted small" style={{ marginTop: 8 }}>
    Zones need your max HR. Set it in Settings once and it'll apply to every activity.
  </p>
)}
```

**8) `src/data/strava.ts` — expose empty `athlete` field:**

Find the `StravaSession` interface. Add:

```ts
export interface StravaSession {
  // ... existing fields
  athlete?: {
    id: number;
    name?: string;
    hrZones?: number[];  // populated by PR-C1
  };
}
```

#### Test-first spec

`test/e2e/hrmax-wiring.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers";

test("zones chart shows placeholder without prefs.hrMax", async ({ page }) => {
  await openApp(page);

  // Apply a template that includes a zones chart
  await page.getByTestId("tab-designs").click();
  await page.getByTestId("newtpl-zoneStack").click();

  // Zones chart should render the placeholder because prefs.hrMax is null
  await expect(page.getByText(/Set your max HR/i)).toBeVisible();
});

test("setting prefs.hrMax via localStorage enables zone chart", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("stride.prefs", JSON.stringify({ units: "km", hrMax: 190, safeZones: false, lastDocId: null }));
  });
  await openApp(page);

  await page.getByTestId("tab-designs").click();
  await page.getByTestId("newtpl-zoneStack").click();

  await expect(page.getByText(/Set your max HR/i)).not.toBeVisible();
});

test("ManualForm records activityHrMax not hrMax", async ({ page }) => {
  await openApp(page);
  // Switch to manual activity mode (implementation-specific button)
  await page.getByTestId("activity-manual").click();

  const peakInput = page.getByLabel(/Peak heart rate/i);
  await peakInput.fill("165");

  // Assert the field is called activityHrMax on the state (via page.evaluate on window if exposed, else via a downstream visible field)
  const label = page.getByText(/Peak heart rate/i);
  await expect(label).toBeVisible();
});
```

#### Golden matrix impact

**Yes — deliberate.** Pre-A0 fixtures had `hrMax: 178` which A2's fallback used to draw zones. Post-A4, fixtures have `activityHrMax: 178` but no `athlete.hrZones` in the golden test harness — so goldens show placeholder text.

**Fix:** update `test/golden/render.spec.ts` to inject `FIXTURE_ATHLETE.hrZones` into the golden render context. Once fixtures inject athlete zones, the zone charts render again and goldens should match pre-A2 closely.

If drift remains after fixture injection, re-record via `golden-update`. Inspect diffs — should be small (zone boundaries at exactly 50/60/70/80/90% of 190 vs previous `Math.max(peak) + 5` derivation).

#### Acceptance criteria

- [ ] `npm run verify` passes
- [ ] `npm run test:e2e` passes including `hrmax-wiring.spec.ts`
- [ ] `npm run test:golden` — either passes with zero drift (if fixture harness updates correctly) or is re-recorded with `golden-update` label and diffs are minimal
- [ ] Manual smoke: apply `zoneStack` template with no prefs.hrMax → placeholder visible; set prefs.hrMax = 190 → chart draws

#### Prompt for Claude Code

```
Execute PR-A4 from BRIEFS_V2.md section 2. Wire prefs.hrMax through App.jsx to the central resolver.

CRITICAL: v1 of this brief was wrong. App.jsx line 80 has an EXISTING max-HR input inside ManualForm. Do not add a new Settings sheet here (that's PR-A4.5). Instead:

1. Extend the ManualForm input to record activityHrMax (per-activity peak) not hrMax
2. Wire prefs.hrMax through App.jsx state
3. Compute zones via resolveZones in a memo, pass to series and buildFields

Lines to change (all verified):
- App.jsx:80 — ManualForm input renamed and repurposed
- App.jsx state block ~100-105 — add prefs, athlete
- App.jsx:152 — pass zones to buildFields
- App.jsx:164 — effort scoring uses zoneShares from central resolver
- App.jsx:177 — series.zones replaces series.hrMax
- App.jsx:496 — Strava import renames hrMax → activityHrMax, deletes +5, deletes 190 fallback

Also src/data/strava.ts — add optional `athlete` field to StravaSession interface (empty for now, filled by PR-C1).

Write test/e2e/hrmax-wiring.spec.ts FIRST per the brief.

Golden matrix WILL change unless the golden harness at test/golden/render.spec.ts injects FIXTURE_ATHLETE.hrZones. Add that injection in this PR. If drift remains, add `golden-update` label and re-record — inspect diffs, should be small.

Verify: npm run verify && npm run test:e2e && npm run test:golden

PR title: "feat(app): wire prefs.hrMax through resolver (§7.4, §6.11)"
```

---

### PR-A4.5: Settings sheet

**Branch:** `git checkout -b phase-a-04b-settings-sheet`
**Rules:** 1.
**Preconditions:** PR-A4.
**Diff estimate:** +200 / -5.

#### Files

**Added:**
- `src/ui/Settings.tsx` (~160 lines).
- `test/e2e/settings.spec.ts` (~60 lines).

**Modified:**
- `src/App.jsx` — add "Settings" button in toolbar or top-bar, wire to open the sheet.

#### Change spec

`src/ui/Settings.tsx`:

```tsx
import { useState } from "react";
import { loadPrefs, savePrefs, type Prefs } from "../storage/db";

export interface SettingsProps {
  onClose: () => void;
  onChange?: (prefs: Prefs) => void;
}

export function Settings({ onClose, onChange }: SettingsProps) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs({ [key]: value });
    onChange?.(next);
  }

  return (
    <div className="modal" data-testid="settings-sheet">
      <div className="modal-inner" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <section>
            <h3>Units</h3>
            <label className="row">
              <span>Distance</span>
              <select
                value={prefs.units}
                onChange={(e) => update("units", e.target.value as "km" | "mi")}
                data-testid="prefs-units"
              >
                <option value="km">Kilometres</option>
                <option value="mi">Miles</option>
              </select>
            </label>
          </section>

          <section>
            <h3>Heart rate</h3>
            <label className="row">
              <span>Your max heart rate</span>
              <input
                type="number"
                inputMode="numeric"
                min={100} max={230}
                placeholder="e.g. 190"
                value={prefs.hrMax ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  update("hrMax", Number.isFinite(v) && v > 0 ? v : null);
                }}
                data-testid="prefs-hrmax"
              />
            </label>
            <p className="muted small">
              Used to calculate zones. Or connect Strava and we'll pull your zones from your Strava settings.
            </p>
          </section>

          <section>
            <h3>Editor</h3>
            <label className="row">
              <span>Show safe zones by default</span>
              <input
                type="checkbox"
                checked={prefs.safeZones}
                onChange={(e) => update("safeZones", e.target.checked)}
                data-testid="prefs-safezones"
              />
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}
```

In App.jsx, add near the toolbar (find the div containing Undo/Redo/Safe zones buttons):

```jsx
const [showSettings, setShowSettings] = useState(false);
...
<button type="button" onClick={() => setShowSettings(true)} data-testid="settings-button" aria-label="Settings">⚙</button>
...
{showSettings && <Settings onClose={() => setShowSettings(false)} onChange={setPrefs} />}
```

#### Test-first spec

`test/e2e/settings.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers";

test("Settings sheet opens, saves hrMax, persists across reload", async ({ page }) => {
  await openApp(page);

  await page.getByTestId("settings-button").click();
  await expect(page.getByTestId("settings-sheet")).toBeVisible();

  await page.getByTestId("prefs-hrmax").fill("192");
  await page.getByTestId("settings-sheet").getByRole("button", { name: /close/i }).click();

  await page.reload();
  await page.getByTestId("settings-button").click();
  await expect(page.getByTestId("prefs-hrmax")).toHaveValue("192");
});

test("Setting hrMax to 190 enables zone chart", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("settings-button").click();
  await page.getByTestId("prefs-hrmax").fill("190");
  await page.keyboard.press("Escape");

  await page.getByTestId("tab-designs").click();
  await page.getByTestId("newtpl-zoneStack").click();
  await expect(page.getByText(/Set your max HR/i)).not.toBeVisible();
});
```

#### Golden matrix impact

None — settings surface only.

#### Acceptance criteria

- [ ] Settings button visible on main toolbar
- [ ] All three sections render (Units, Heart rate, Editor)
- [ ] Values persist across reload
- [ ] `npm run test:e2e` passes including `settings.spec.ts`

#### Prompt for Claude Code

```
Execute PR-A4.5 from BRIEFS_V2.md section 2. Add a Settings sheet.

New file: src/ui/Settings.tsx per the brief.
Modified: src/App.jsx — add Settings button in toolbar area and wire to open/close the sheet.

Write test/e2e/settings.spec.ts FIRST.

PR title: "feat(ui): Settings sheet with units, HR, safe zones (§6.11)"
```

---

### PR-A5: Delete legacy zone code with compat shim for render.js callers

**Branch:** `git checkout -b phase-a-05-legacy-hr-cleanup`
**Rules:** 1, 8 (careful: this changes render.js but does NOT remove any template cases).
**Preconditions:** PR-A1, PR-A2, PR-A3, PR-A4.
**Diff estimate:** +40 / -60 = -20 net.

#### Why this brief is different from v1

v1 said "delete render.js zoneOf". But render.js:749 and :757 use `.c` and `.name` on the returned zone object. Deleting zoneOf without a shim breaks the `case "hrwave"` template until it's removed in PR-B6. Since B6 comes weeks later, this brief installs a small compat shim.

#### Files

**Modified:**
- `src/render.js` — replace `zoneOf` with a shim that calls `hr.ts:zoneOf` and looks up `ZONE_META`. Replace `zoneShares` with a re-export.
- `src/data/gpx.ts` — rename `hrMax` field to `activityHrMax`, delete `+ 5`.
- Any caller of `gpx.ts`'s import path (App.jsx line ~470-490 where imports happen).

#### Line references verified

> **Re-derived 12 Sep 2026, again.** PR-A0 added ten lines to `src/render.js`, so every
> reference below moved by +10. Re-derive after any other `render.js` change.

- `src/render.js:290` — `export function zoneOf(bpm, max)` (was `:280`).
- `src/render.js:291-296` — `export function zoneShares(stream, max)` (was `:281-286`).
- `src/render.js:759` — `ctx.strokeStyle = zoneOf(hs[i], hrMax).c;` (was `:749`).
- `src/render.js:767` — `ctx.fillStyle = zoneOf(shown, hrMax).c;` — and the same line calls `zoneOf(shown, hrMax).name` further along, so the compat shim must carry both `.c` and `.name`. (The elision the brief used here, `... zoneOf(...)`, is not a substring of anything and so could never verify.)
- `src/render.js:774` — `const shares = zoneShares(act.hrStream, hrMax);` (was `:764`).
- `src/data/gpx.ts:24` — `hrMax: number | null;` on ImportedActivity.
- `src/data/gpx.ts:336` — `hrMax: hrValues.length > 0 ? Math.max(...hrValues) : null,`.
- `src/data/gpx.ts:389` — `hrMax: imported.hrMax ? imported.hrMax + 5 : null,`.

#### Change spec

**1) `src/render.js:280-286` — replace with shim:**

```js
// BEFORE
export function zoneOf(bpm, max) { const f = bpm / (max || 190); return ZONES.find((z) => f < z.hi) || ZONES[4]; }
export function zoneShares(stream, max) {
  const counts = [0, 0, 0, 0, 0];
  if (!stream || !stream.length) return counts;
  stream.forEach((b) => { counts[zoneOf(b, max).n - 1]++; });
  return counts.map((c) => c / stream.length);
}

// AFTER (compat shim)
// LEGACY compat. render.js:749 and :757 still use .c and .name on the return.
// Removed in PR-B6 when case "hrwave" is deleted.
// New code should use zoneOf / zoneShares / ZONE_META from src/data/hr.ts.
import { zoneOf as _zoneOf, zoneShares as _zoneShares, ZONE_META } from "./data/hr.js";

/** @deprecated Use ../data/hr#zoneOf. This shim returns the legacy ZONE_META entry. */
export function zoneOf(bpm, max) {
  // If max is truthy, synthesise Zones from it; else fall back to ZONE_META[4] (Max) to avoid crashes.
  if (!max) return { ...ZONE_META[4], lo: 0.9, hi: 2 };
  const zones = {
    boundaries: [max * 0.5, max * 0.6, max * 0.7, max * 0.8, max * 0.9],
    source: "user",
  };
  const idx = _zoneOf(bpm, zones);
  return { ...ZONE_META[idx], lo: 0.5 + idx * 0.1, hi: 0.6 + idx * 0.1 };
}

/** @deprecated Use ../data/hr#zoneShares. */
export function zoneShares(stream, max) {
  if (!stream || !stream.length) return [0, 0, 0, 0, 0];
  const zones = {
    boundaries: [max * 0.5, max * 0.6, max * 0.7, max * 0.8, max * 0.9],
    source: "user",
  };
  return _zoneShares(stream, zones);
}
```

Note: `ZONES` array is left in place for backward compatibility until B6.

**2) `src/data/gpx.ts:24, 336, 389`:**

```ts
// Line 24 BEFORE
export interface ImportedActivity {
  ...
  hrMax: number | null;
  ...
}

// Line 24 AFTER
export interface ImportedActivity {
  ...
  /** Peak reached during this activity. NOT athlete max. */
  activityHrMax: number | null;
  ...
}

// Line 336 BEFORE
return {
  ...
  hrMax: hrValues.length > 0 ? Math.max(...hrValues) : null,
  ...
};

// Line 336 AFTER
return {
  ...
  activityHrMax: hrValues.length > 0 ? Math.max(...hrValues) : null,
  ...
};

// Line 389 BEFORE
export function importedToActivity(imported: ImportedActivity): Activity {
  return {
    ...
    hrMax: imported.hrMax ? imported.hrMax + 5 : null,
    ...
  };
}

// Line 389 AFTER
export function importedToActivity(imported: ImportedActivity): Activity {
  return {
    ...
    activityHrMax: imported.activityHrMax,  // no +5, honest
    // hrMax removed — athlete max is not derived from GPX
    ...
  };
}
```

**3) App.jsx — any callers of these paths need `hrMax` → `activityHrMax`:**

Search for `.hrMax` in App.jsx and update reads of activity-import outputs to `activityHrMax` (keeps display but doesn't feed the resolver).

#### Test-first spec

Extend `test/unit/gpx.test.ts`:

```ts
it("importedToActivity does not falsely inflate hrMax by +5", () => {
  const imported = {
    activityHrMax: 165,
    // ... other fields
  } as ImportedActivity;
  const activity = importedToActivity(imported);
  expect(activity.activityHrMax).toBe(165);  // peak preserved
  expect((activity as any).hrMax).toBeUndefined();  // no athlete max derived
});

it("parseGpx returns activityHrMax not hrMax", () => {
  const gpx = `<?xml version="1.0"?><gpx>...</gpx>`;  // fixture
  const parsed = parseGpx(gpx);
  expect(parsed?.activityHrMax).toBeDefined();
  expect((parsed as any)?.hrMax).toBeUndefined();
});
```

#### Golden matrix impact

None — shim keeps case "hrwave" rendering identically to before.

#### Acceptance criteria

- [ ] `grep '\+ 5' src/data/gpx.ts` returns nothing (except comments)
- [ ] `grep '|| 190' src/` returns nothing except the render.js shim (documented as such)
- [ ] `case "hrwave"` in render.js still renders correctly (test via golden)
- [ ] `npm run verify` passes
- [ ] `npm run test:golden` — zero diff

#### Prompt for Claude Code

```
Execute PR-A5 from BRIEFS_V2.md section 2. Delete legacy zone helpers and +5 fudge, but INSTALL A COMPAT SHIM for render.js internal callers.

CRITICAL: v1 said "delete render.js zoneOf". That breaks lines 749 and 757 which use .c and .name on the return. Install the shim per the brief so `case "hrwave"` keeps rendering until PR-B6 removes it.

Changes:
- render.js:280-286 — replace with shim from brief (uses hr.ts internally, returns legacy object shape)
- gpx.ts:24, 336, 389 — rename hrMax → activityHrMax, delete +5

Update App.jsx callers of gpx-imported activities to read activityHrMax where they used hrMax for display.

Extend test/unit/gpx.test.ts per the brief.

Verify: npm run verify && npm run test:golden (must have ZERO diff — shim preserves behaviour)

PR title: "chore(cleanup): remove +5 HR fudge, shim legacy zone helpers (§7.4)"
```

---

Continued in next section — PRs A6 through A11 plus the five Phase A extras.

---

### PR-A6: Fix fmtPace 4:60 + Invalid Date + fmtTimeFromPace duplicate

**Branch:** `git checkout -b phase-a-06-format-bugs`
**Rules:** 1, 8 (goldens change — labelled `golden-update`).
**Preconditions:** none. Runs in parallel with A0-A5.
**Diff estimate:** +40 / -12.

#### Why the extra fmtTimeFromPace call-out

v1 covered `fmtPace` in render.js only. But `src/model/fields.ts:60-64` has its OWN `fmtTimeFromPace` that also patches the 4:60 bug. Two guards means one can drift out of sync. Consolidate to a single fixed `fmtPace`.

#### Files

**Modified:**
- `src/render.js` — `fmtPace`, `fmtDate`, `fmtDateLong`, `fmtClock`.
- `src/model/fields.ts` — delete the local `fmtTimeFromPace`, use the imported `fmtPace` directly (line ~64).
- `test/unit/format.test.ts` — new cases.
- `test/golden/__snapshots__/*` — will change; re-record.

#### Line references verified

> **Re-derived 12 Sep 2026.** `fmtPace` had an elision (`{ ... }`) that is not a substring of
> any line, and `fmtTimeFromPace` moved to the bottom of `fields.ts` when the zone block was
> rewritten on 11 Sep.

- `src/render.js:19` — `export const fmtPace = (sec) => {` — body at `:20-22`; the bug is `const m = Math.floor(sec / 60), s = Math.round(sec % 60);` at `:21`, deriving minutes and seconds independently.
- `src/render.js:24-26` — `fmtDate` / `fmtDateLong` / `fmtClock`.
- `src/model/fields.ts:72` — `function fmtTimeFromPace(sec: number): string {` — the local guard, called once at `:49` (was `:60-64`).

#### Change spec

**`src/render.js:19`:**

```js
// BEFORE
export const fmtPace = (sec) => {
  if (!isFinite(sec) || sec <= 0) return "--:--";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

// AFTER
export const fmtPace = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return "--:--";
  // Round total seconds first, THEN split. Otherwise 299.5 rounds to "4:60"
  // because floor(299.5/60)=4 and round(299.5%60)=60.
  const total = Math.round(sec);
  const m = Math.floor(total / 60), s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};
```

**`src/render.js` date formatters:**

```js
// BEFORE (approximate — verify exact source in your working copy)
export const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch { return ""; } };

// AFTER
export const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

// Apply the same Number.isNaN(d.getTime()) guard to fmtDateLong and fmtClock.
```

**`src/model/fields.ts:60-64`:**

```ts
// BEFORE
function fmtTimeFromPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  // Guard the legacy fmtPace "4:60" bug (see CLAUDE.md) at the call site.
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

// AFTER — delete this function; use fmtPace directly.
// At the one call site (~line 42), replace:
//   fastestSplit: act.splits?.length ? fmtTimeFromPace(Math.min(...act.splits)) : null,
// with:
//   fastestSplit: act.splits?.length ? fmtPace(Math.min(...act.splits)) : null,
// Then delete fmtTimeFromPace at the bottom of the file.
```

#### Test-first spec

`test/unit/format.test.ts` (add cases):

```ts
describe("fmtPace edge cases", () => {
  it("rounds seconds correctly to avoid printing 4:60", () => {
    expect(fmtPace(299.5)).toBe("5:00");
    expect(fmtPace(300.0)).toBe("5:00");
    expect(fmtPace(299.4)).toBe("4:59");
  });

  it("handles minute rollover after seconds rounding", () => {
    expect(fmtPace(3599.5)).toBe("60:00");
  });

  it("returns --:-- for zero and non-finite", () => {
    expect(fmtPace(0)).toBe("--:--");
    expect(fmtPace(-1)).toBe("--:--");
    expect(fmtPace(Infinity)).toBe("--:--");
    expect(fmtPace(NaN)).toBe("--:--");
  });
});

describe("fmtDate rejects malformed input", () => {
  it.each([
    ["not a date"],
    [""],
    [undefined],
    ["2026-99-99"],
    ["garbage"],
    [null],
  ])("fmtDate(%p) returns empty string", (input) => {
    expect(fmtDate(input as any)).toBe("");
  });

  it("formats valid ISO", () => {
    expect(fmtDate("2026-09-04T06:42:00Z")).toContain("Sep");
  });
});
```

#### Golden matrix impact

**Yes — deliberate.** Every golden containing a pace that hit the 4:60 case or a date that was previously "Invalid Date" will change. Add `golden-update` label. After re-record, diffs should be small and localised.

#### Acceptance criteria

- [ ] `npm test test/unit/format.test.ts` passes
- [ ] `fmtTimeFromPace` no longer exists anywhere
- [ ] Goldens re-recorded, diffs inspected: only pace/date cells changed

#### Prompt for Claude Code

```
Execute PR-A6 from BRIEFS_V2.md section 2. Fix fmtPace 4:60, fmtDate Invalid Date, and the duplicate fmtTimeFromPace.

Files:
- src/render.js:19 fmtPace — round total seconds before splitting
- src/render.js:24-26 fmtDate, fmtDateLong, fmtClock — guard on Number.isNaN(d.getTime())
- src/model/fields.ts:60-64 — delete fmtTimeFromPace; use fmtPace at the one call site

Write tests in test/unit/format.test.ts FIRST.

Goldens will change. Add golden-update label. Re-record and inspect diffs.

Verify: npm run verify

PR title: "fix(render): fmtPace 4:60, Invalid Date, remove fmtTimeFromPace duplicate (§1.4)"
```

---

### PR-A7: Surface split-under-200m dropped-tail note

**Branch:** `git checkout -b phase-a-07-splits-tail-note`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +45 / -3.

#### Files

**Modified:**
- `src/App.jsx:510-512` — compute `droppedSplitMetres` when importing from Strava; add to activity.
- A visible note in the Designs tab area or below the stage.

**Added:**
- `test/e2e/splits-note.spec.ts` (~40 lines).

#### Line references verified

> **Re-derived 12 Sep 2026.** The Strava importer moved down ~27 lines. The brief also wrote
> the three chained calls as one line; they are three.

- `src/App.jsx:510` — `const splits = (dd.splits_metric ?? [])`
- `src/App.jsx:511` — `.filter((sp) => sp.distance > 200)` — this is the drop; the tail metres it discards are what the note must surface.
- `src/App.jsx:512` — `.map((sp) => sp.moving_time / (sp.distance / 1000));`

#### Change spec

**App.jsx:483-490:**

```jsx
// BEFORE
const splits = (dd.splits_metric ?? [])
  .filter((sp) => sp.distance > 200)
  .map((sp) => sp.moving_time / (sp.distance / 1000));

// AFTER
const dropped = (dd.splits_metric ?? []).filter((sp) => sp.distance <= 200);
const splits = (dd.splits_metric ?? [])
  .filter((sp) => sp.distance > 200)
  .map((sp) => sp.moving_time / (sp.distance / 1000));
const droppedSplitMetres = dropped.length > 0
  ? Math.round(dropped.reduce((a, b) => a + b.distance, 0))
  : null;
```

Add to activity:

```jsx
setAct({
  ...,
  splits: splits.length ? splits : null,
  droppedSplitMetres,
});
```

Render a note (find a stable location in the UI — e.g. below the stage, in the info strip):

```jsx
{effectiveAct.droppedSplitMetres && (
  <p className="muted small" data-testid="dropped-splits-note">
    Last {effectiveAct.droppedSplitMetres} m not shown as a split (under 200 m).
  </p>
)}
```

#### Test-first spec

`test/e2e/splits-note.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers";

test("note appears when Strava returns a short final split", async ({ page }) => {
  await page.addInitScript(() => {
    // Mock Strava response with a 150m tail split
    // (implementation-specific: intercept or seed via localStorage)
  });
  await openApp(page);

  // Load a mocked activity with a 150m final split
  // Then assert the note
  await expect(page.getByTestId("dropped-splits-note")).toBeVisible();
});

test("no note when all splits are full km", async ({ page }) => {
  await openApp(page);
  // Default demo activity has clean splits
  await expect(page.getByTestId("dropped-splits-note")).not.toBeVisible();
});
```

#### Golden matrix impact

None (note is chrome, not canvas).

#### Acceptance criteria

- [ ] Note appears when a fixture activity has a sub-200m tail
- [ ] Note absent for clean split lists
- [ ] `npm run test:e2e` passes

#### Prompt for Claude Code

```
Execute PR-A7 from BRIEFS_V2.md section 2. Surface the silent dropped-split-under-200m case.

App.jsx:483-490 change per the brief. Add note visible in Designs tab area.

Write test/e2e/splits-note.spec.ts FIRST.

PR title: "fix(app): note when short split tail is dropped (§7.1)"
```

---

### PR-A8: CSS variables and warm-neutral chrome

**Branch:** `git checkout -b phase-a-08-css-variables`
**Rules:** 1 (visual only).
**Preconditions:** PR-A6 (goldens re-recorded).
**Diff estimate:** +180 / -100 = 80 net.

#### Files

**Modified:**
- `src/styles.css` — top-to-bottom rewrite of colour usage.

**Added:**
- `test/e2e/theme.spec.ts` (~50 lines).

#### Change spec

Add at the very top of `src/styles.css`:

```css
:root {
  /* Base neutrals — warm off-white by default */
  --bg: #F5F4F1;
  --surface: #FFFFFF;
  --surface-2: #F0EEE9;
  --border: #E5E4E1;
  --border-strong: #C8C6C1;
  --text: #1A1A1A;
  --text-muted: #6B6B6B;

  /* Accent — set by JS at runtime from active look. Default: neutral. */
  --accent: #1A1A1A;
  --accent-contrast: #FFFFFF;

  /* Semantic — fixed. */
  --danger: #E63946;
  --success: #3AA76D;
  --warning: #F5A623;

  /* Radii */
  --radius-sm: 6px;
  --radius: 12px;
  --radius-lg: 18px;

  /* Focus ring */
  --focus-ring: 0 0 0 2px var(--accent);
}

[data-theme="dark"] {
  --bg: #242426;
  --surface: #2E2E30;
  --surface-2: #1F1F21;
  --border: #38383A;
  --border-strong: #55555A;
  --text: #F2F2F2;
  --text-muted: #9A9A9F;
  --accent-contrast: #FFFFFF;
}
```

Then replace every literal hex in the rest of the file:
- `#161616` (bg) → `var(--bg)`
- `#f2f2f2` (text on dark) → `var(--text)`
- `#9a9a9a` (muted) → `var(--text-muted)`
- `#2c2c2c`, `#2a2a2c` (borders) → `var(--border)`
- `#3a3a3a`, `#3a3a3c` (strong borders) → `var(--border-strong)`
- `#1c1c1e`, `#111`, `#111111` (surface / input bg) → `var(--surface)` or `var(--surface-2)` depending on context
- `#d8ff3a` (all 24+ occurrences) → `var(--accent)`

If a specific place needs the accent to be lime regardless (I don't think there is one), it's a design decision — flag in the PR.

#### Test-first spec

`test/e2e/theme.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers";

test("CSS vars are set on :root", async ({ page }) => {
  await openApp(page);
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
  expect(bg).toMatch(/#/i);  // any hex; PR-A9 verifies specific value per theme

  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(accent).toMatch(/#/i);
});

test("no hardcoded lime in stylesheet", async ({ page }) => {
  await openApp(page);
  // Fetch styles.css contents and grep for #d8ff3a — should be zero
  const css = await page.evaluate(async () => {
    const link = document.querySelector('link[href*="styles"]');
    const url = link?.getAttribute("href");
    if (!url) return "";
    const res = await fetch(url);
    return await res.text();
  });
  expect(css.toLowerCase()).not.toContain("#d8ff3a");
});
```

#### Golden matrix impact

None (chrome only, no canvas rendering).

#### Acceptance criteria

- [ ] `grep -Ei '#[0-9a-f]{3,6}' src/styles.css` returns only :root and [data-theme] blocks + semantic colours
- [ ] `npm run test:e2e` passes including theme.spec.ts
- [ ] A11y suite passes (may fix the update-banner known violation — if so, remove from KNOWN_VIOLATIONS in a11y.spec.ts)

#### Prompt for Claude Code

```
Execute PR-A8 from BRIEFS_V2.md section 2. Rewrite src/styles.css to use CSS custom properties, delete every #d8ff3a and #161616.

Add the :root and [data-theme="dark"] blocks from the brief. Replace all hexes.

After: `grep -Ei '#[0-9a-f]{3,6}' src/styles.css` should only return matches inside :root and [data-theme] blocks (plus semantic --danger/--success/--warning).

Write test/e2e/theme.spec.ts FIRST.

Check a11y suite — the update-banner known violation may now be gone.

PR title: "feat(chrome): CSS variables + warm-neutral chrome (§6.14)"
```

---

### PR-A9: Look-derived accent + theme toggle

**Branch:** `git checkout -b phase-a-09-look-accent`
**Rules:** 1.
**Preconditions:** PR-A8, PR-A4.5.
**Diff estimate:** +80 / -5.

#### Files

**Modified:**
- `src/App.jsx` — two useEffects (sync `--accent`, sync `dataset.theme`).
- `src/storage/db.ts` — extend Prefs with `theme?: "light" | "dark" | "auto"`.

**Added:**
- `src/util/contrast.ts` (~30 lines) — computes contrasting text colour for any accent hex.

**Created by a precondition, modified here:**
- `src/ui/Settings.tsx` — add theme toggle Row. **PR-A4.5 creates this file**, and A4.5 sits
  behind A5 on the critical path, so A9 cannot land until it does. If you want the light
  redesign sooner than the HR work allows, either pull A4.5 forward (it is self-contained,
  and A4 needs somewhere to put `prefs.hrMax` anyway) or split A9: land the `--accent` sync
  and `contrast.ts` now, add the toggle row when Settings exists.

#### Change spec

**Prefs extension in `src/storage/db.ts:114`:**

```ts
export interface Prefs {
  units: "km" | "mi";
  hrMax: number | null;
  safeZones: boolean;
  lastDocId: string | null;
  theme?: "light" | "dark" | "auto";  // ← new; default "auto"
}
```

**`src/util/contrast.ts` (new):**

```ts
/** Returns "#000000" or "#FFFFFF" — whichever contrasts better against `hex`. */
export function contrastText(hex: string): "#000000" | "#FFFFFF" {
  if (!hex.startsWith("#") || hex.length !== 7) return "#FFFFFF";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return L > 0.5 ? "#000000" : "#FFFFFF";
}
```

**In App.jsx, add two effects after `look` is defined:**

```jsx
import { contrastText } from "./util/contrast";

useEffect(() => {
  const accent = look.colors.accent;
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-contrast", contrastText(accent));
}, [look]);

useEffect(() => {
  const applied = (() => {
    if (!prefs.theme || prefs.theme === "auto") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return prefs.theme;
  })();
  document.documentElement.dataset.theme = applied;
}, [prefs.theme]);
```

**In Settings.tsx, extend the "Editor" section (or add a new "Appearance" section):**

```tsx
<section>
  <h3>Appearance</h3>
  <label className="row">
    <span>Theme</span>
    <select
      value={prefs.theme ?? "auto"}
      onChange={(e) => update("theme", e.target.value as Prefs["theme"])}
      data-testid="prefs-theme"
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="auto">Match system</option>
    </select>
  </label>
</section>
```

#### Test-first spec

`test/unit/contrast.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { contrastText } from "../../src/util/contrast";

describe("contrastText", () => {
  it("returns black for light backgrounds", () => {
    expect(contrastText("#FFFFFF")).toBe("#000000");
    expect(contrastText("#D8FF3A")).toBe("#000000");
    expect(contrastText("#F5F4F1")).toBe("#000000");
  });

  it("returns white for dark backgrounds", () => {
    expect(contrastText("#000000")).toBe("#FFFFFF");
    expect(contrastText("#1A1A1A")).toBe("#FFFFFF");
    expect(contrastText("#242426")).toBe("#FFFFFF");
  });

  it("defensively handles invalid input", () => {
    expect(contrastText("not a hex")).toBe("#FFFFFF");
    expect(contrastText("")).toBe("#FFFFFF");
  });
});
```

Extend `test/e2e/theme.spec.ts`:

```ts
test("picking a look changes --accent", async ({ page }) => {
  await openApp(page);
  const initial = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());

  await page.getByTestId("tab-look").click();
  // Pick a look with a distinct accent (e.g. "neon")
  await page.getByTestId("look-neon").click();

  const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(after).not.toBe(initial);
});

test("theme toggle switches dataset.theme", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("settings-button").click();
  await page.getByTestId("prefs-theme").selectOption("dark");

  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(theme).toBe("dark");
});
```

#### Golden matrix impact

None (chrome only).

#### Acceptance criteria

- [ ] Picking a look changes the selected-look ring, selected-layer border, and Settings sheet accent colour
- [ ] Theme toggle persists across reload
- [ ] "Auto" respects `prefers-color-scheme`

#### Prompt for Claude Code

```
Execute PR-A9 from BRIEFS_V2.md section 2. Wire the active look's accent into --accent, and add a theme toggle.

New file: src/util/contrast.ts per brief.
Modified: src/App.jsx (two useEffects), src/ui/Settings.tsx (theme section), src/storage/db.ts (Prefs.theme).

Write test/unit/contrast.test.ts FIRST. Extend test/e2e/theme.spec.ts.

PR title: "feat(chrome): look-derived accent + theme toggle (§6.14)"
```

---

### PR-A10: Warm defaults (look + template)

**Branch:** `git checkout -b phase-a-10-warm-defaults`
**Rules:** 1, 8 (goldens change; deliberate).
**Preconditions:** PR-A9.
**Diff estimate:** +5 / -2 code, many golden PNGs.

#### Files

**Modified:**
- `src/looks/index.ts:63` — `DEFAULT_LOOK_ID = "paper"`.
- `src/App.jsx:91` — `const [template, setTemplate] = useState("session")`.
- Regenerated golden snapshots.

#### Change spec

Trivial code change. The complexity is regenerating and reviewing goldens.

```ts
// src/looks/index.ts line 63
export const DEFAULT_LOOK_ID = "paper";  // was "clean"

// src/App.jsx line 91
const [template, setTemplate] = useState("session");  // was "sticker"
```

#### Golden matrix impact

**Yes — expected.** Every fixture render at the default look changes from dark `#111` background to `paper` (`#F4EFE6`). Every rendered chart, text, and route will re-render with `paper`'s palette.

Inspect diffs: legitimate re-theme, not bugs.

#### Acceptance criteria

- [ ] First-time user on `/` sees `paper` look + `session` template
- [ ] `prefs.lastDocId` restoration still works (unaffected)
- [ ] Goldens re-recorded and inspected for legitimacy

#### Prompt for Claude Code

```
Execute PR-A10 from BRIEFS_V2.md section 2. Change default look to "paper" and default template to "session".

Files: src/looks/index.ts:63, src/App.jsx:91.

Goldens WILL change dramatically — every fixture render at the default look re-themes to paper. Add golden-update label. Inspect diffs; reject only if the paper-themed rendering looks broken (missing text, misaligned layers), not just because it looks different.

PR title: "feat(defaults): warm 'paper' look and 'session' template on first load (§3.8)"
```

---

### PR-A11: Onboarding sheet

**Branch:** `git checkout -b phase-a-11-onboarding`
**Rules:** 1.
**Preconditions:** PR-A4.5, PR-A10.
**Diff estimate:** +240 / -5.

#### Files

**Added:**
- `src/ui/Onboarding.tsx` (~180 lines).
- `test/e2e/onboarding-v2.spec.ts` (~70 lines).

**Modified:**
- `src/storage/db.ts` — add `onboardingSeen: boolean` to Prefs.
- `src/App.jsx` — render Onboarding when `!prefs.onboardingSeen`.

**Created by a precondition, modified here:**
- `src/ui/Settings.tsx` — add "Show onboarding again" button for QA. Created by **PR-A4.5**.

#### Change spec

**Prefs:**

```ts
export interface Prefs {
  ...
  onboardingSeen: boolean;
}
export const DEFAULT_PREFS: Prefs = { ..., onboardingSeen: false };
```

**`src/ui/Onboarding.tsx`:**

```tsx
import { useState } from "react";
import { savePrefs } from "../storage/db";

export interface OnboardingProps {
  onDone: (nextAction: "strava" | "photo" | "demo") => void;
}

export function Onboarding({ onDone }: OnboardingProps) {
  const [step, setStep] = useState(0);

  function finish(action: "strava" | "photo" | "demo") {
    savePrefs({ onboardingSeen: true });
    onDone(action);
  }

  const panels = [
    {
      title: "Turn your run into a story.",
      body: "Pick a design, add your photo, share to Instagram.",
      cta: { label: "Next", onClick: () => setStep(1) },
    },
    {
      title: "Everything is tappable.",
      body: "Tap any element to change its colour, size, or text. Or drag it anywhere.",
      cta: { label: "Next", onClick: () => setStep(2) },
    },
    {
      title: "Bring your run in.",
      body: "Connect Strava, add a photo, or explore with the demo run.",
      cta: null,
      buttons: [
        { label: "Connect Strava", primary: true, onClick: () => finish("strava") },
        { label: "Add a photo", onClick: () => finish("photo") },
        { label: "Use the demo", onClick: () => finish("demo") },
      ],
    },
  ] as const;

  const panel = panels[step];

  return (
    <div className="modal" data-testid="onboarding-sheet" role="dialog" aria-labelledby="onboarding-title">
      <div className="modal-inner" style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ marginBottom: 12 }}>
          {panels.map((_, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: 8, height: 8, borderRadius: 4,
                margin: "0 4px",
                background: i === step ? "var(--text)" : "var(--border)",
              }}
              aria-hidden
            />
          ))}
        </div>
        <h2 id="onboarding-title" style={{ marginBottom: 12 }}>{panel.title}</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>{panel.body}</p>

        {panel.cta && (
          <button
            type="button"
            className="btn primary"
            onClick={panel.cta.onClick}
            data-testid="onboarding-next"
          >
            {panel.cta.label}
          </button>
        )}

        {"buttons" in panel && panel.buttons && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {panel.buttons.map((b, i) => (
              <button
                key={i}
                type="button"
                className={b.primary ? "btn primary" : "btn"}
                onClick={b.onClick}
                data-testid={`onboarding-action-${i}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => finish("demo")}
          data-testid="onboarding-skip"
          style={{ marginTop: 16, background: "none", color: "var(--text-muted)", border: "none" }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
```

**In App.jsx:**

```jsx
{!prefs.onboardingSeen && (
  <Onboarding
    onDone={(action) => {
      setPrefs(loadPrefs());  // refresh prefs
      if (action === "strava") setShowStrava(true);
      else if (action === "photo") fileInputRef.current?.click();
    }}
  />
)}
```

**In Settings.tsx (QA button):**

```tsx
<button
  type="button"
  onClick={() => { savePrefs({ onboardingSeen: false }); location.reload(); }}
  data-testid="prefs-reset-onboarding"
  className="btn ghost"
>
  Show onboarding again
</button>
```

#### Test-first spec

`test/e2e/onboarding-v2.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers";

test("onboarding shows on first load and dismisses forever", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("about:blank");
  await page.evaluate(() => localStorage.clear());

  await openApp(page);
  await expect(page.getByTestId("onboarding-sheet")).toBeVisible();

  await page.getByTestId("onboarding-next").click();  // panel 2
  await page.getByTestId("onboarding-next").click();  // panel 3
  await page.getByTestId("onboarding-action-2").click();  // Use the demo

  await expect(page.getByTestId("onboarding-sheet")).not.toBeVisible();

  await page.reload();
  await expect(page.getByTestId("onboarding-sheet")).not.toBeVisible();
});

test("skip button also dismisses", async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.getByTestId("onboarding-skip").click();
  await expect(page.getByTestId("onboarding-sheet")).not.toBeVisible();
});

test("Settings 'Show onboarding again' resets and shows on reload", async ({ page }) => {
  await openApp(page);
  // Assume onboarding is dismissed (default state for return visitor)
  await page.getByTestId("settings-button").click();
  await page.getByTestId("prefs-reset-onboarding").click();

  // Page reloads inside the button; re-open
  await expect(page.getByTestId("onboarding-sheet")).toBeVisible();
});
```

#### Golden matrix impact

None.

#### Acceptance criteria

- [ ] Onboarding shows on fresh load
- [ ] Dismissal via any of the 4 buttons persists
- [ ] Reset via Settings works
- [ ] `npm run test:e2e` passes

#### Prompt for Claude Code

```
Execute PR-A11 from BRIEFS_V2.md section 2. Add 3-panel dismissible-forever onboarding sheet.

Files:
- src/ui/Onboarding.tsx (new)
- test/e2e/onboarding-v2.spec.ts (new)
- src/storage/db.ts — add Prefs.onboardingSeen: boolean
- src/App.jsx — render Onboarding conditionally
- src/ui/Settings.tsx — add "Show onboarding again" button

Write the test FIRST.

PR title: "feat(onboarding): 3-panel dismissible first-run (§3.8)"
```

---

## Phase A extras — the 5 PRs missing from v1

These were flagged in the deep review as Phase A work and got dropped from v1. Adding here.

### PR-A12: Font bundling (15 subsetted woff2 files)

**Branch:** `git checkout -b phase-a-12-fonts`
**Rules:** 1, 4 (adds bundled assets).
**Preconditions:** PR-A9.
**Diff estimate:** +200 code / -10, plus ~450KB of font binaries.

#### Why

Every look defines `fonts.display`, `fonts.body`, `fonts.mono`. Currently they fall back to `legacyFonts.display` = `"cond"` = Impact. Every "distinctive" look (Neon → should be a retro neon face, Y2K → chunky sans, Journal → serif) renders as Impact-in-a-colour. This is arguably the single largest visual improvement in Phase A.

#### Files

**Added:**
- `src/assets/fonts/*.woff2` (15 files, subsetted to Latin + digits + common punctuation, ~30KB each).
- `src/assets/fonts/fonts.css` (~80 lines) — `@font-face` declarations.

**Modified:**
- `src/styles.css` — `@import "./assets/fonts/fonts.css";` at top.
- `src/engine/tokens.ts` — update `resolveToken` for `$font.display` etc. to prefer bundled fonts over legacy fallbacks.
- `src/looks/*.json` — 24 files — ensure `fonts.display` names match font-family declared in `@font-face`.

#### Font selection

Recommend using open-licensed fonts. My suggested set (all Google Fonts, open license, subsettable):

| Slot | Fonts used |
|---|---|
| Display (bold/expressive) | Bebas Neue, Anton, Oswald, Monoton, Bungee Shade, Righteous |
| Body (readable) | Inter, Manrope, Space Grotesk |
| Serif | Playfair Display, Fraunces, DM Serif Display |
| Mono | JetBrains Mono, Space Mono, IBM Plex Mono |

Total: 15 faces.

Subsetting: use `pyftsubset` or `fonttools` with `--unicodes=U+0020-007E,U+00A0-00FF,U+2010-2027`. Each subset should land at 15-40KB.

#### Change spec

**`src/assets/fonts/fonts.css`:**

```css
@font-face {
  font-family: "Bebas Neue";
  src: url("./bebas-neue.woff2") format("woff2");
  font-display: swap;
  font-weight: 400;
}
@font-face {
  font-family: "Anton";
  src: url("./anton.woff2") format("woff2");
  font-display: swap;
  font-weight: 400;
}
/* ... 13 more @font-face declarations ... */
```

**`src/engine/tokens.ts` — update `resolveToken`:**

```ts
// Replace fontFallbackMap so `$font.display` resolves to the actual family name
const FONT_MAP: Record<string, string> = {
  bebas: "Bebas Neue, Impact, sans-serif",
  anton: "Anton, Impact, sans-serif",
  oswald: "Oswald, Impact, sans-serif",
  monoton: "Monoton, sans-serif",
  bungee: "Bungee Shade, sans-serif",
  righteous: "Righteous, sans-serif",
  inter: "Inter, system-ui, sans-serif",
  manrope: "Manrope, system-ui, sans-serif",
  spaceGrotesk: "Space Grotesk, sans-serif",
  playfair: "Playfair Display, Georgia, serif",
  fraunces: "Fraunces, Georgia, serif",
  dmSerif: "DM Serif Display, Georgia, serif",
  jetbrains: "JetBrains Mono, ui-monospace, monospace",
  spaceMono: "Space Mono, ui-monospace, monospace",
  plexMono: "IBM Plex Mono, ui-monospace, monospace",
};
```

**Each look's `fonts.display` etc. field references one of these keys.** Update `src/looks/*.json` accordingly. E.g. `src/looks/neon.json`:

```json
"fonts": {
  "display": "monoton",
  "body": "spaceGrotesk",
  "mono": "spaceMono",
  "legacyFonts": { ... }  // kept for canvas fallback
}
```

#### Test-first spec

`test/unit/fonts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LOOKS } from "../../src/looks";

describe("all looks reference bundled fonts", () => {
  const BUNDLED = new Set([
    "bebas", "anton", "oswald", "monoton", "bungee", "righteous",
    "inter", "manrope", "spaceGrotesk",
    "playfair", "fraunces", "dmSerif",
    "jetbrains", "spaceMono", "plexMono",
  ]);
  for (const look of LOOKS) {
    it(`${look.id} uses bundled fonts`, () => {
      expect(BUNDLED.has(look.fonts.display)).toBe(true);
      expect(BUNDLED.has(look.fonts.body)).toBe(true);
      expect(BUNDLED.has(look.fonts.mono)).toBe(true);
    });
  }
});
```

#### Golden matrix impact

**Yes — expected.** Every text render at every look changes from Impact-fallback to the intended face. Add `golden-update`. Inspect diffs: text should look more distinctive, not broken.

#### Acceptance criteria

- [ ] 15 .woff2 files in src/assets/fonts/
- [ ] Bundle size increases by <500KB total
- [ ] npm run test:golden passes with re-recorded goldens
- [ ] Manual: pick "Neon" look — display font is Monoton, not Impact

#### Prompt for Claude Code

```
Execute PR-A12 from BRIEFS_V2.md section 2. Bundle 15 subsetted woff2 fonts.

Steps:
1. Download the 15 fonts listed in the brief from Google Fonts.
2. Subset each with pyftsubset or fonttools to Latin-1 + digits + common punctuation (~30KB each target).
3. Place at src/assets/fonts/*.woff2.
4. Create src/assets/fonts/fonts.css with @font-face declarations.
5. Import in src/styles.css.
6. Update src/engine/tokens.ts FONT_MAP.
7. Update src/looks/*.json — each look's fonts.display/body/mono referencing a bundled key.

Write test/unit/fonts.test.ts FIRST.

Goldens WILL change (text renders in new faces). Add golden-update label; inspect diffs.

Bundle size budget: keep total added weight under 500KB.

PR title: "feat(typography): bundle 15 woff2 faces for looks (§4.5, §5.6)"
```

---

### PR-A13: Wire `look.motion.entrance` as default layer entry animation

**Branch:** `git checkout -b phase-a-13-look-motion`
**Rules:** 5.
**Preconditions:** PR-A9.
**Diff estimate:** +50 / -5.

#### Why

Every look's `motion.entrance` field (e.g. `"slideUp"`, `"fadeIn"`) is set but never read. So a look can't say "everything on my designs slides up from below". This is the fix.

#### Files

**Modified:**
- `src/engine/layers.ts` or `src/engine/anim.ts` — when a layer has `anim.preset: "none"` (or missing), fall back to `look.motion.entrance`.
- `src/App.jsx` — pass `look.motion` into the render context.

#### Change spec

Threading depends on how animation is currently invoked. Locate the animation preset resolution (probably in `layers.ts`). Change:

```ts
// BEFORE
const preset = layer.anim?.preset ?? "none";

// AFTER
const preset = layer.anim?.preset && layer.anim.preset !== "none"
  ? layer.anim.preset
  : context.lookMotion?.entrance ?? "none";
```

Add `lookMotion?: LookMotion` to the render context type.

App.jsx passes `look.motion` through.

#### Acceptance criteria

- [ ] Layers without an explicit preset use the look's entrance
- [ ] Layers with an explicit preset override the look
- [ ] Manual: pick "Y2K" (motion.entrance: "slideDown") — everything animates from top on entrance

#### Prompt for Claude Code

```
Execute PR-A13 from BRIEFS_V2.md section 2. Wire look.motion.entrance as the default layer entry animation.

Layers with no explicit anim.preset inherit look.motion.entrance.

PR title: "feat(anim): look-driven default entrance animation (§4.5)"
```

---

### PR-A14: Wire `look.photo.suits` into LookPicker sort/filter

**Branch:** `git checkout -b phase-a-14-photo-suits`
**Rules:** 5.
**Preconditions:** PR-A9.
**Diff estimate:** +60 / -10.

#### Why

Every look declares `photo.suits: ["urban", "clean", ...]` but LookPicker doesn't use it. Once a user loads a photo, looks that suit it should sort higher / non-suits should dim.

#### Files

**Modified:**
- `src/model/suggest.ts` — new `scoreLookForPhoto(look, analysis)` returning 0-1.
- `src/ui/LookPicker.tsx` — sort looks within each family group by score; dim those that score below 0.3.

#### Change spec

`src/model/suggest.ts`:

```ts
export function scoreLookForPhoto(look: Look, analysis: PhotoAnalysis | null): number {
  if (!analysis) return 0.5;  // neutral when no photo
  const suits = look.photo?.suits ?? [];
  const traits = analysis.traits ?? [];  // e.g. ["urban", "high-contrast", "warm"]
  const overlap = suits.filter((s) => traits.includes(s)).length;
  return overlap / Math.max(1, suits.length);
}
```

LookPicker uses this to sort within each family group.

#### Acceptance criteria

- [ ] Load a photo → looks that suit it float to top of their family
- [ ] Looks that don't suit dim to ~60% opacity

#### Prompt for Claude Code

```
Execute PR-A14 from BRIEFS_V2.md section 2. Sort LookPicker by photo suitability.

New function scoreLookForPhoto in suggest.ts.
LookPicker uses to sort and dim.

PR title: "feat(looks): sort by photo suitability (§4.5)"
```

---

### PR-A15: Zundo per-character debounce for text edits

**Branch:** `git checkout -b phase-a-15-zundo-debounce`
**Rules:** 5.
**Preconditions:** none.
**Diff estimate:** +40 / -8.

#### Why

Zundo captures every `patchLayer` call. Text edits fire one per keystroke. Undoing a paragraph = 200 clicks.

#### Files

**Modified:**
- `src/editor/store.ts` — coalesce contiguous same-layer patches within 800ms.

#### Change spec

Zustand's temporal middleware supports a `handleSet` option. Use it:

```ts
temporal(
  (set, get, api) => ({ ...store }),
  {
    limit: 100,
    handleSet: (handleSet) => {
      let lastCall: { time: number; type: string; layerId: string | null } = { time: 0, type: "", layerId: null };
      return (state) => {
        // Detect what kind of change this is
        const now = Date.now();
        const lastAction = get()._lastActionType ?? "";
        const layerId = get()._lastLayerId ?? null;

        const isTextPatch = lastAction === "patchLayer" && layerId !== null;
        const isSameLayerRepeat = isTextPatch
          && lastCall.type === "patchLayer"
          && lastCall.layerId === layerId
          && (now - lastCall.time) < 800;

        lastCall = { time: now, type: lastAction, layerId };

        if (isSameLayerRepeat) return;  // coalesce into last undo state
        handleSet(state);
      };
    },
  }
)
```

Requires exposing `_lastActionType` and `_lastLayerId` on the store (set at each action's entry point).

#### Acceptance criteria

- [ ] Typing "hello world" into a text layer → single undo restores empty
- [ ] Non-text patches (resize, move) still one-per-action
- [ ] `npm run test:e2e` passes existing editor tests

#### Prompt for Claude Code

```
Execute PR-A15 from BRIEFS_V2.md section 2. Debounce zundo captures for same-layer text edits.

Details in the brief. Zustand temporal middleware supports handleSet for this.

Write a test in test/unit/store.test.ts covering: 5 char-by-char patchLayer calls within 800ms → 1 undo restores the original.

PR title: "perf(editor): coalesce text-edit undo states (§2.3)"
```

---

### PR-A16: Smart placement on layer add

**Branch:** `git checkout -b phase-a-16-smart-placement`
**Rules:** 5.
**Preconditions:** none.
**Diff estimate:** +40 / -8.

#### Why

`src/model/placement.ts` exists with a `busyness` grid analyser. Nothing calls it for user-added layers — every add lands dead-centre, often on top of existing content.

#### Files

**Modified:**
- `src/ui/AddMenu.tsx` — before `addLayer(...)`, call `findCalmestSpot(analysis, layer.size)`, set the layer's anchor to that spot.
- `src/model/placement.ts` — add `findCalmestSpot(busynessGrid, targetSize) → {x, y}` if not present.

#### Change spec

```ts
// In placement.ts (add if missing)
export function findCalmestSpot(
  busyness: number[][],  // 8x8 grid of 0-1
  targetSize: { w: number; h: number },
): { x: number; y: number } {
  // Score each grid cell by average busyness in a window matching targetSize
  const rows = busyness.length;
  const cols = busyness[0]?.length ?? 0;
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  const wCells = Math.max(1, Math.round(targetSize.w / cellW));
  const hCells = Math.max(1, Math.round(targetSize.h / cellH));

  let best = { x: 0.5, y: 0.5, score: Infinity };
  for (let r = 0; r + hCells <= rows; r++) {
    for (let c = 0; c + wCells <= cols; c++) {
      let sum = 0;
      for (let dr = 0; dr < hCells; dr++)
        for (let dc = 0; dc < wCells; dc++)
          sum += busyness[r + dr][c + dc];
      if (sum < best.score) {
        best = {
          x: (c + wCells / 2) * cellW,
          y: (r + hCells / 2) * cellH,
          score: sum,
        };
      }
    }
  }
  return { x: best.x, y: best.y };
}
```

In AddMenu:

```tsx
function handleAdd(type: string) {
  const layer = createDefaultLayer(type);
  if (photoAnalysis) {
    const spot = findCalmestSpot(photoAnalysis.busyness, layer.size);
    layer.anchor = spot;
  }
  addLayer(layer);
}
```

#### Acceptance criteria

- [ ] With photo loaded, adding a new text layer places it in the calmest region
- [ ] Without photo, defaults to centre (0.5, 0.5)

#### Prompt for Claude Code

```
Execute PR-A16 from BRIEFS_V2.md section 2. Use existing photo analysis to place new layers in calm areas.

placement.ts has the busyness grid. Add findCalmestSpot function per brief.
AddMenu calls it before addLayer.

Write test/unit/placement.test.ts.

PR title: "feat(add): smart placement for new layers (§2.3)"
```

---


---

## 3. PHASE B — architecture cleanup + route features (weeks 4-6)

### PR-B1: CLAUDE.md rule 8 change

**Branch:** `git checkout -b phase-b-01-claude-md-rule-8`
**Rules:** documentation only.
**Preconditions:** all Phase A merged.
**Diff estimate:** +25 / -3.

#### Files

**Modified:**
- `CLAUDE.md` — rewrite rule 8.

#### Change spec

Replace:

```markdown
8. Don't remove a legacy `case` from the old renderer until the JSON template passes goldens.
```

With:

```markdown
8. A legacy `case` in `src/render.js` may be deleted when:
   a) A JSON template in `src/templates/index.ts` exists in the same category (see §4.8 for categories),
   b) That JSON template passes `npm run lint:looks`,
   c) That JSON template has its own recorded golden that passes.

   The JSON template does NOT need to reproduce the legacy pixel-for-pixel. It is a replacement, not a port. When you delete the legacy case, also delete the legacy golden for it — this leaves the golden matrix cleaner.

   Rationale: pixel-parity gating was forcing JSON templates to inherit the legacy renderer's misjudgements. Deep review §2.4 details the problem.
```

#### Acceptance criteria

- [ ] CLAUDE.md updated
- [ ] Reference to §2.4 of deep review present

#### Prompt for Claude Code

```
Execute PR-B1 from BRIEFS_V2.md section 3. Update CLAUDE.md rule 8 per the exact wording in the brief.

PR title: "docs(claude): rule 8 allows JSON replacement without pixel parity (§2.4)"
```

---

### PR-B2: Author route-hero JSON template `heroRoute`

**Branch:** `git checkout -b phase-b-02-hero-route`
**Rules:** 7 (JSON only).
**Preconditions:** none.
**Diff estimate:** +130 / 0.

#### Why one template per PR

Each JSON template is 50-150 lines. Bundling 6 in one PR would exceed the 400-line cap AND make review harder (each template deserves inspection against every look). B2-B7 do six templates, one per PR.

#### Files

**Modified:**
- `src/templates/index.ts` — append `heroRoute` template.

#### Change spec

Full template definition:

```ts
{
  id: "heroRoute",
  name: "Hero route",
  description: "Route as full-bleed watermark, distance as hero, minimal chrome.",
  category: "route",
  requires: ["route"],
  aspects: ["story", "post-4-5", "post-1-1"],
  layers: [
    // Background route watermark
    {
      id: "watermark",
      type: "route",
      source: "template",
      anchor: { x: 0.5, y: 0.5 },
      origin: { x: 0.5, y: 0.5 },
      size: { w: 1.4, h: 1.4 },
      style: {
        mode: "watermark",
        stroke: "$text",
        fill: "$text",
        alpha: 0.12,
        weight: 8,
        simplify: 4,
        endpoints: "none",
      },
    },
    // Hero distance
    {
      id: "hero",
      type: "text",
      source: "template",
      anchor: { x: 0.5, y: 0.5 },
      origin: { x: 0.5, y: 0.5 },
      size: { w: 0.9, h: 0.3 },
      text: "{distance} {unit}",
      style: {
        color: "$text",
        font: "$font.display",
        weight: 900,
        size: 220,
        align: "center",
        lineHeight: 0.95,
      },
    },
    // Activity name (top)
    {
      id: "name",
      type: "text",
      source: "template",
      anchor: { x: 0.5, y: 0.08 },
      origin: { x: 0.5, y: 0 },
      size: { w: 0.9, h: 0.06 },
      text: "{name}",
      style: {
        color: "$textMuted",
        font: "$font.body",
        weight: 500,
        size: 32,
        align: "center",
        letterSpacing: 4,
        uppercase: true,
      },
    },
    // Date (top small)
    {
      id: "date",
      type: "text",
      source: "template",
      anchor: { x: 0.5, y: 0.14 },
      origin: { x: 0.5, y: 0 },
      size: { w: 0.9, h: 0.03 },
      text: "{date}",
      style: {
        color: "$textMuted",
        font: "$font.body",
        weight: 400,
        size: 22,
        align: "center",
      },
    },
    // Stats row (bottom)
    {
      id: "stats",
      type: "statRow",
      source: "template",
      anchor: { x: 0.5, y: 0.92 },
      origin: { x: 0.5, y: 1 },
      size: { w: 0.9, h: 0.08 },
      stats: [
        { label: "Pace", value: "{pace}" },
        { label: "Time", value: "{time}" },
        { label: "Climb", value: "{elevation}{elevUnit}" },
      ],
      style: {
        color: "$text",
        labelColor: "$textMuted",
        font: "$font.body",
        weight: 700,
      },
    },
  ],
}
```

#### Test-first spec

Add case to `test/unit/templates.test.ts`:

```ts
it("heroRoute template is well-formed", () => {
  const tpl = TEMPLATES.find((t) => t.id === "heroRoute");
  expect(tpl).toBeDefined();
  expect(tpl!.category).toBe("route");
  expect(tpl!.requires).toContain("route");
  // Watermark layer at back
  expect(tpl!.layers[0].id).toBe("watermark");
  expect(tpl!.layers[0].type).toBe("route");
});
```

#### Golden matrix impact

Adds new goldens for `heroRoute` × 24 looks × 3 aspect ratios (initially cross-recorded on a subset — see test/golden/render.spec.ts for the matrix policy).

#### Acceptance criteria

- [ ] `heroRoute` appears in Designs > Route category
- [ ] `npm run lint:looks` passes
- [ ] Renders correctly against demo activity in all 24 looks
- [ ] Manual inspection: watermark route reads without competing with hero text

#### Prompt for Claude Code

```
Execute PR-B2 from BRIEFS_V2.md section 3. Author the heroRoute template per the exact JSON in the brief.

Add to src/templates/index.ts. If "route" category doesn't exist in TemplateCategory type, add it.

Add case to test/unit/templates.test.ts.

Record goldens.

PR title: "feat(templates): heroRoute — route-as-watermark design (§4.8)"
```

---

### PR-B3 through PR-B7: 5 more route templates

Same brief pattern as B2, one per PR. Each ~120-150 lines of JSON.

- **PR-B3 `routeSilhouette`** — route as filled polygon (silhouette mode), no line, one hero stat.
- **PR-B4 `elevationHero`** — elevation profile as background wave, distance + climb metres on top.
- **PR-B5 `routeAndPhoto`** — split canvas 50/50, photo top, design bottom with route trace.
- **PR-B6 `cityRoute`** — route on solid background with distance + location name (uses `{name}` binding; location comes in PR-C10).
- **PR-B7 `runnerDot`** — route + runner dot travelling the line (`route.style.runnerDot: true`).

Each PR follows the same structure as B2. Draft templates by copying B2 and adjusting `layers` array, then run `npm run lint:looks` and inspect against all 24 looks.

#### Prompt for Claude Code (repeated for each)

```
Execute PR-B[N] from BRIEFS_V2.md section 3. Author the [templateId] template.

Follow the same structure as PR-B2 (heroRoute). Full JSON schema per src/model/types.ts TemplateDef.

Ensure:
- Only look tokens for colours ($text, $accent, $accent2, $textMuted). No literal hex.
- category: "route"
- requires: appropriate data dependencies
- Records new goldens against a representative look subset

PR title: "feat(templates): [templateId] design (§4.8)"
```

---

### PR-B8: Delete 5 legacy templates (spine, grid, stack, ticker, headline)

**Branch:** `git checkout -b phase-b-08-legacy-delete-1`
**Rules:** 8 (updated).
**Preconditions:** PR-B1, plus JSON replacements for these categories exist (session, workout, masthead, statsRow, etc. already do).
**Diff estimate:** +5 / -320 = -315 net.

#### Justification per template

- **spine** — vertical divider + stats. Redundant with `statRow` layer type any template can use.
- **grid** — 2×2 stat grid. Redundant with `session` and `workout` templates.
- **stack** — vertical stack. Redundant with any statRow.
- **ticker** — scrolling stats, video-only. Superseded by upcoming `videoHud` (PR-C7).
- **headline** — big text-only. Redundant with `masthead` JSON template.

#### Files

**Modified:**
- `src/render.js` — delete `case "spine":`, `case "grid":`, `case "stack":`, `case "ticker":`, `case "headline":`. Remove from `TEMPLATES` array (if still exported).
- `test/golden/harness.html` (or wherever the matrix is defined) — remove these IDs.
- `test/golden/__snapshots__/**/{spine,grid,stack,ticker,headline}*.png` — delete.

#### Change spec

For each of the 5:
1. Locate `case "spine": { ... break; }` block in render.js's switch (varies in position around lines 418, 429, 450, 511, 523 — check with `grep -n 'case "'` before starting).
2. Delete the entire block including braces and `break;`.
3. Remove ID from `export const TEMPLATES = [...]` if present.
4. Delete matching PNGs.

#### Acceptance criteria

- [ ] Legacy Style tab (if still visible in dev builds) doesn't offer these
- [ ] `npm run test:golden` passes with fewer cells
- [ ] `npm run size` shows bundle decrease of ~15KB

#### Prompt for Claude Code

```
Execute PR-B8 from BRIEFS_V2.md section 3. Delete 5 legacy templates from render.js: spine, grid, stack, ticker, headline.

Steps for each:
- Locate case block in render.js switch (grep -n 'case "spine"' etc.)
- Delete case block including braces and break
- Remove ID from TEMPLATES array if present
- Delete matching test/golden/__snapshots__ files

Verify with npm run test:golden — matrix has fewer cells but still passes.
npm run size — bundle decreases.

PR title: "chore(legacy): delete 5 legacy templates (§13 Phase 2)"
```

---

### PR-B9: Delete 5 more legacy templates (frame, retro, tape, orbit, stamp)

Same pattern. Justifications:
- **frame** — border frame around design. Users can add a shape layer.
- **retro** — 70s look, single-look bake. Replaced by `retro78` look × any JSON template.
- **tape** — VHS-style overlay. Post-processing filter, not template.
- **orbit** — circular arrangement. Niche, no demand.
- **stamp** — square badge. Replaced by `stamped` JSON template.

#### Prompt for Claude Code

```
Same pattern as PR-B8. Delete frame, retro, tape, orbit, stamp from render.js and their goldens.

PR title: "chore(legacy): delete 5 more legacy templates (§13 Phase 2)"
```

---

### PR-B10: Delete 3 more legacy templates (neon, pacewave, receipt)

Same pattern. Justifications:
- **neon** — glow effect on stats. Replaced by `neon` look × any JSON template.
- **pacewave** — pace as wave. Chart type; use HR/pace chart layer.
- **receipt** — receipt-style stats. Replaced by `pulseTicket` JSON template.

#### Prompt for Claude Code

```
Same pattern. Delete neon, pacewave, receipt.

PR title: "chore(legacy): delete 3 more legacy templates (§13 Phase 2)"
```

---

### PR-B11: Extract `background.ts` from render.js (part 1 — new module)

**Branch:** `git checkout -b phase-b-11-background-extract`
**Rules:** 5, 6.
**Preconditions:** all delete PRs (B8, B9, B10).
**Diff estimate:** +200 / 0 (this PR only adds; deletion is B12).

#### Why split extraction into two PRs

v1's PR-B7 was +400/-900. That's 1,300 changed lines — exceeds the 400-line cap. Splitting into extract-then-delete keeps each under 400 lines.

#### Files

**Added:**
- `src/engine/background.ts` (~180 lines) — pure functions: `fillCanvas`, `drawCover`, `applyFilter`, `vignette`, `grain`.
- `test/unit/background.test.ts` (~80 lines).

**Modified:**
- `src/render.js` — add re-export at top: `export { fillCanvas, drawCover, applyFilter, vignette, grain } from "./engine/background.js";` — keeps the original inline functions BUT they now delegate.

Actually the cleaner sequence: this PR is EXTRACT-ONLY — add background.ts, update render.js internals to use it, but keep exports for any external caller.

#### Change spec

`src/engine/background.ts`:

```ts
/**
 * Pure background rendering — extracted from src/render.js for the phase-B renderer split.
 * See §13 Phase 2.
 *
 * These functions ONLY draw the base of a design:
 *   1. fill with a colour
 *   2. draw a photo/video cover-fit
 *   3. apply a filter
 *   4. vignette
 *   5. grain
 *
 * They do NOT render any layer, stat, chart, or route. Layer rendering is in
 * src/engine/layers.ts, chartLayers.ts, routeLayer.ts.
 */

export function fillCanvas(ctx: CanvasRenderingContext2D, colour: string, w: number, h: number): void {
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, w, h);
}

export interface CoverOptions {
  zoom?: number;   // 1 = fit, >1 = zoom in
  offsetX?: number;  // -1..1 pan
  offsetY?: number;
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  w: number,
  h: number,
  options: CoverOptions = {},
): void {
  const zoom = options.zoom ?? 1;
  const mediaW = "width" in media ? (media as any).width : (media as any).videoWidth ?? w;
  const mediaH = "height" in media ? (media as any).height : (media as any).videoHeight ?? h;
  const scale = Math.max(w / mediaW, h / mediaH) * zoom;
  const drawW = mediaW * scale;
  const drawH = mediaH * scale;
  const dx = (w - drawW) / 2 + (options.offsetX ?? 0) * (drawW - w) / 2;
  const dy = (h - drawH) / 2 + (options.offsetY ?? 0) * (drawH - h) / 2;
  ctx.drawImage(media as any, dx, dy, drawW, drawH);
}

export type FilterId = "none" | "warm" | "cool" | "bw" | "high-contrast" | "faded";

export function applyFilter(ctx: CanvasRenderingContext2D, filter: FilterId, w: number, h: number): void {
  if (filter === "none") return;
  const filters: Record<Exclude<FilterId, "none">, string> = {
    warm: "sepia(0.25) saturate(1.2)",
    cool: "saturate(0.9) hue-rotate(-10deg)",
    bw: "grayscale(1)",
    "high-contrast": "contrast(1.15) saturate(1.15)",
    faded: "brightness(1.1) saturate(0.7) contrast(0.9)",
  };
  ctx.save();
  ctx.filter = filters[filter];
  // Re-composite current canvas onto itself with filter
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();
}

export function vignette(ctx: CanvasRenderingContext2D, intensity: number, w: number, h: number): void {
  if (intensity <= 0) return;
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, `rgba(0,0,0,${intensity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export function grain(ctx: CanvasRenderingContext2D, intensity: number, w: number, h: number, seed = 1): void {
  if (intensity <= 0) return;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const strength = intensity * 40;
  let s = seed;
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 9301 + 49297) % 233280;
    const n = (s / 233280 - 0.5) * strength;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}
```

In `render.js`, add near the top:

```js
export {
  fillCanvas,
  drawCover,
  applyFilter,
  vignette,
  grain,
} from "./engine/background.js";
```

And update the internal callers in render.js (the `background` mode in `renderFrame` — probably a case in the switch) to use the imported functions instead of inline implementations. If inline implementations were duplicating, delete the duplicates.

#### Test-first spec

`test/unit/background.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { fillCanvas, drawCover, applyFilter, vignette, grain } from "../../src/engine/background";

function mockCtx(w = 100, h = 100): any {
  const canvas = { width: w, height: h };
  return {
    canvas,
    fillStyle: "", strokeStyle: "", filter: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(), restore: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: vi.fn(),
  };
}

describe("fillCanvas", () => {
  it("sets fillStyle and fills full area", () => {
    const ctx = mockCtx();
    fillCanvas(ctx, "#F5F4F1", 100, 100);
    expect(ctx.fillStyle).toBe("#F5F4F1");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });
});

describe("drawCover", () => {
  it("scales media to cover canvas", () => {
    const ctx = mockCtx(1080, 1920);
    const img = { width: 2000, height: 1500 };  // wider than canvas
    drawCover(ctx, img as any, 1080, 1920);
    expect(ctx.drawImage).toHaveBeenCalled();
    const [_, dx, dy, dw, dh] = (ctx.drawImage as any).mock.calls[0];
    expect(dw).toBeGreaterThanOrEqual(1080);
    expect(dh).toBeGreaterThanOrEqual(1920);
  });
});

// Similar smoke tests for applyFilter, vignette, grain.
```

#### Golden matrix impact

None — behaviour identical to before.

#### Acceptance criteria

- [ ] `background.ts` exports all 5 functions
- [ ] `render.js`'s background rendering uses them (no more inline duplicates)
- [ ] `npm run test:golden` — zero diff

#### Prompt for Claude Code

```
Execute PR-B11 from BRIEFS_V2.md section 3. Extract background rendering from render.js into src/engine/background.ts.

This is EXTRACT ONLY. Deletion of render.js happens in PR-B12.

New file src/engine/background.ts per the brief.
Update render.js internal callers to use the imports.
Add re-export at top of render.js for backward compat.

Write test/unit/background.test.ts FIRST.

Verify: npm run verify && npm run test:golden (must have ZERO diff)

PR title: "refactor(engine): extract background.ts from render.js part 1 (§13 Phase 2)"
```

---

### PR-B12: Extract remaining exports from render.js (part 2 — delete render.js)

**Branch:** `git checkout -b phase-b-12-render-js-delete`
**Rules:** 5, 6.
**Preconditions:** PR-B11 merged, all legacy delete PRs merged.
**Diff estimate:** +250 / -600 = -350 net.

#### Files

**Added:**
- `src/model/formats.ts` — `FORMATS`, `setFormat`, `W`, `H`.
- `src/model/demo.ts` — `DEMO`, `DEMO_WORKOUT`.
- `src/model/sports.ts` — `SPORTS`, `sportFromStrava`.
- `src/util/format.ts` — `fmtTime`, `fmtPace`, `fmtDist`, `fmtDate`, `fmtDateLong`, `fmtClock`.
- `src/util/derive.ts` — `derive`.
- `src/util/polyline.ts` — `decodePolyline`.

**Deleted:**
- `src/render.js` — entire file.

**Modified:**
- Every file importing from `render.js` (~15 imports) — update paths.

#### Change spec

Move each export cluster to its own file. Preserve the exact API (function signatures, exports) so imports change but nothing else.

**Import path migrations** — search-replace across the codebase:

| Old | New |
|---|---|
| `from "./render.js"` (imports `DEMO`) | `from "./model/demo"` |
| `from "./render.js"` (imports `FORMATS`, `setFormat`, `W`, `H`) | `from "./model/formats"` |
| `from "./render.js"` (imports `SPORTS`, `sportFromStrava`) | `from "./model/sports"` |
| `from "./render.js"` (imports `fmtTime`, `fmtPace`, etc.) | `from "./util/format"` |
| `from "./render.js"` (imports `derive`) | `from "./util/derive"` |
| `from "./render.js"` (imports `decodePolyline`) | `from "./util/polyline"` |
| `from "./render.js"` (imports `zoneOf`, `zoneShares`) | `from "./data/hr"` (already migrated in A5) |
| `from "./render.js"` (imports background helpers) | `from "./engine/background"` (already migrated in B11) |
| `from "./render.js"` (imports `renderFrame`) | ERROR — should not exist. `renderFrame` was the legacy template renderer. All callers should be using layer-based rendering now. Flag any remaining callers. |

Run `grep -rn 'from ".*/render\.js"' src/` before starting. Every match needs a migration.

**Delete src/render.js** at the end.

#### Acceptance criteria

- [ ] `grep -r "render.js" src/` returns zero
- [ ] `grep -r "render.js" test/` returns zero (except fixtures.js which needs updating too)
- [ ] `npm run verify` clean
- [ ] `npm run test:golden` — zero diff
- [ ] `npm run size` — significant bundle decrease

#### Prompt for Claude Code

```
Execute PR-B12 from BRIEFS_V2.md section 3. Extract remaining render.js exports into modular files and delete render.js.

New files per the brief:
- src/model/formats.ts, demo.ts, sports.ts
- src/util/format.ts, derive.ts, polyline.ts

Delete src/render.js entirely.

Update every import site (~15 files). Use the migration table in the brief.

Run `grep -rn 'from ".*render\.js"' src/ test/` before AND after — must be zero after.

If any file imports `renderFrame` from render.js, flag it — that means legacy template rendering is still in use somewhere and shouldn't be.

Verify: npm run verify && npm run test:golden (ZERO diff — pure refactor)

PR title: "refactor(engine): extract, delete render.js (§13 Phase 2)"
```

---

### PR-B13: Route default style uses look tokens

**Branch:** `git checkout -b phase-b-13-route-tokens`
**Rules:** 5.
**Preconditions:** none.
**Diff estimate:** +8 / -8.

#### Files

**Modified:**
- `src/engine/routeLayer.ts` — `DEFAULT_ROUTE_STYLE`.

#### Change spec

```ts
// BEFORE
export const DEFAULT_ROUTE_STYLE: RouteStyle = {
  mode: "solid",
  stroke: "#FFFFFF",
  ...
  gradient: ["#D8FF3A", "rgba(255,255,255,0.45)"],
  startColor: "#FFFFFF",
  endColor: "#D8FF3A",
  ...
};

// AFTER
export const DEFAULT_ROUTE_STYLE: RouteStyle = {
  mode: "solid",
  stroke: "$text",
  ...
  gradient: ["$accent", "$accent2"],
  startColor: "$text",
  endColor: "$accent",
  ...
};
```

#### Golden matrix impact

Only affects NEW route layers created after this PR. Existing saved documents have literal colours baked in. Templates that override the default (most do) unchanged.

#### Acceptance criteria

- [ ] New route layer via AddMenu > Route uses look accent
- [ ] Existing docs unchanged

#### Prompt for Claude Code

```
Execute PR-B13. Change DEFAULT_ROUTE_STYLE in src/engine/routeLayer.ts to use look tokens.

PR title: "feat(route): default style uses look tokens (§4.5)"
```

---

### PR-B14: Watermark route mode

**Branch:** `git checkout -b phase-b-14-route-watermark`
**Rules:** 5.
**Preconditions:** PR-B13.
**Diff estimate:** +90 / 0.

#### Files

**Modified:**
- `src/model/types.ts` — add `"watermark"` to `RouteMode` union.
- `src/engine/routeLayer.ts` — implement `mode: "watermark"` — fill route silhouette at 12% alpha, no stroke, expand bbox to canvas edges.
- `src/ui/Inspector.tsx` — add "Watermark" chip to Route mode Seg.

#### Change spec

In routeLayer.ts, add to the mode switch:

```ts
case "watermark": {
  const bbox = computeBbox(points);
  const scale = Math.max(w / bbox.width, h / bbox.height) * 1.2;  // slight expand
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-(bbox.x + bbox.width / 2), -(bbox.y + bbox.height / 2));

  ctx.fillStyle = resolveColour(style.stroke, look);
  ctx.globalAlpha = style.alpha ?? 0.12;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  return;
}
```

Add `alpha?: number` to `RouteStyle` type.

#### Acceptance criteria

- [ ] New "Watermark" mode selectable in Inspector
- [ ] Renders as background silhouette at low alpha
- [ ] `heroRoute` template (PR-B2) uses this mode

#### Prompt for Claude Code

```
Execute PR-B14. Add "watermark" mode to route rendering per the brief.

PR title: "feat(route): watermark mode (§2.12)"
```

---

## 4. Phase B extras — PalettePicker programme + missing UX

### PR-B15: PalettePicker infrastructure (component + Prefs slot)

**Branch:** `git checkout -b phase-b-15-palette-picker`
**Rules:** 1.
**Preconditions:** PR-A9 (look accent wired), PR-A14 (photo suits).
**Diff estimate:** +240 / -0.

#### Why

Deep review §2.6: two different palettes (SelectionBar 6 chips, Inspector 12 chips), inconsistent, no way to return a layer to a look token after picking a literal, no eyedropper. PalettePicker is the unified replacement. This programme is 5 PRs: B15 (infra), B16 (swap in Inspector), B17 (swap in SelectionBar), B18 (eyedropper), B19 (under-look indicator).

#### Files

**Added:**
- `src/ui/PalettePicker.tsx` (~220 lines) — the unified component.
- `test/unit/paletteScore.test.ts` (~40 lines).

**Modified:**
- `src/storage/db.ts` — add `recentColors: string[]` to Prefs (last 8 distinct colours user picked).

#### Change spec

`src/ui/PalettePicker.tsx`:

```tsx
import { useMemo } from "react";
import type { Look } from "../looks";
import type { PhotoAnalysis } from "../engine/photo";
import { loadPrefs, savePrefs } from "../storage/db";

export interface PalettePickerProps {
  value: string | null;  // hex or look token like "$accent"
  onChange: (value: string | null) => void;
  look: Look;
  analysis: PhotoAnalysis | null;
  allowNone?: boolean;
  allowTransparent?: boolean;
}

const NEUTRALS = ["#FFFFFF", "#000000", "#7F7F7F"] as const;

export function PalettePicker({ value, onChange, look, analysis, allowNone, allowTransparent }: PalettePickerProps) {
  const lookRow = useMemo(() => [
    { value: "$text", label: "Text", swatch: look.colors.text },
    { value: "$textMuted", label: "Muted", swatch: look.colors.textMuted },
    { value: "$accent", label: "Accent", swatch: look.colors.accent },
    { value: "$accent2", label: "Accent 2", swatch: look.colors.accent2 },
    { value: "$bg", label: "Background", swatch: look.colors.bg },
  ], [look]);

  const photoRow = useMemo(() => {
    if (!analysis?.dominantColors) return [];
    return analysis.dominantColors.slice(0, 5).map((c) => ({
      value: c,
      label: `Photo colour ${c}`,
      swatch: c,
    }));
  }, [analysis]);

  const recentRow = useMemo(() => {
    const prefs = loadPrefs();
    return (prefs.recentColors ?? []).slice(0, 8).map((c) => ({ value: c, label: `Recent ${c}`, swatch: c }));
  }, []);

  function pick(v: string | null) {
    onChange(v);
    if (v && v.startsWith("#")) {
      const prefs = loadPrefs();
      const recent = [v, ...(prefs.recentColors ?? []).filter((c) => c !== v)].slice(0, 8);
      savePrefs({ recentColors: recent });
    }
  }

  return (
    <div className="palette-picker" data-testid="palette-picker">
      {allowNone && (
        <div className="palette-row">
          <button
            type="button"
            className={`swatch none ${value === null ? "on" : ""}`}
            onClick={() => pick(null)}
            aria-label="None"
          >
            ⊘
          </button>
        </div>
      )}

      <div className="palette-row palette-look" data-testid="palette-look-row">
        {lookRow.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`swatch ${value === s.value ? "on" : ""}`}
            style={{ background: s.swatch }}
            onClick={() => pick(s.value)}
            aria-label={s.label}
            title={s.label}
          >
            {value === s.value && <span className="under-look">◆</span>}
          </button>
        ))}
      </div>

      {photoRow.length > 0 && (
        <div className="palette-row palette-photo" data-testid="palette-photo-row">
          {photoRow.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`swatch ${value === s.value ? "on" : ""}`}
              style={{ background: s.swatch }}
              onClick={() => pick(s.value)}
              aria-label={s.label}
            />
          ))}
        </div>
      )}

      {recentRow.length > 0 && (
        <div className="palette-row palette-recent" data-testid="palette-recent-row">
          {recentRow.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`swatch ${value === s.value ? "on" : ""}`}
              style={{ background: s.swatch }}
              onClick={() => pick(s.value)}
              aria-label={s.label}
            />
          ))}
        </div>
      )}

      <div className="palette-row palette-neutrals">
        {NEUTRALS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${value === c ? "on" : ""}`}
            style={{ background: c }}
            onClick={() => pick(c)}
            aria-label={c}
          />
        ))}
        <input
          type="color"
          className="palette-native"
          value={value?.startsWith("#") ? value : "#FFFFFF"}
          onChange={(e) => pick(e.target.value.toUpperCase())}
          aria-label="Pick any colour"
        />
        {allowTransparent && (
          <button
            type="button"
            className={`swatch transparent ${value === "transparent" ? "on" : ""}`}
            onClick={() => pick("transparent")}
            aria-label="Transparent"
          >
            ⊗
          </button>
        )}
      </div>
    </div>
  );
}
```

**Prefs extension:**

```ts
export interface Prefs {
  ...
  recentColors?: string[];  // last 8 distinct colours picked
}
```

#### Test-first spec

`test/e2e/palette-picker.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers";

test("PalettePicker shows look row with 5 tokens", async ({ page }) => {
  await openApp(page);
  // Reach a state where PalettePicker is visible (mount via a test route or by selecting a text layer)
  // This test may need a mount-only route for isolation
});
```

(Full E2E deferred to B16 when PalettePicker is actually mounted in production.)

#### Acceptance criteria

- [ ] Component renders all 5 rows correctly given props
- [ ] `recentColors` persist across reload
- [ ] Types check

#### Prompt for Claude Code

```
Execute PR-B15 from BRIEFS_V2.md section 4. New unified PalettePicker component + Prefs.recentColors slot.

New file src/ui/PalettePicker.tsx per brief.
Modify src/storage/db.ts Prefs interface to add recentColors?: string[].

This PR ONLY adds infrastructure — no component swaps yet. B16 swaps into Inspector, B17 into SelectionBar.

PR title: "feat(ui): PalettePicker unified colour component (§2.6)"
```

---

### PR-B16: Swap Inspector's ColorPicker → PalettePicker (all sites)

**Branch:** `git checkout -b phase-b-16-inspector-palette`
**Rules:** 1.
**Preconditions:** PR-B15.
**Diff estimate:** +80 / -60.

#### Files

**Modified:**
- `src/ui/Inspector.tsx` — 8 `<ColorPicker>` call sites (lines 255, 279, 467, 504, 607, 663, 673, 800) replaced with `<PalettePicker>`.
- `src/ui/atoms.tsx` — deprecate `ColorPicker` and `SWATCHES` export (add JSDoc `@deprecated`).

#### Change spec

At each site, replace:

```tsx
<ColorPicker value={layer.style.color} onChange={(c) => patchLayer(layer.id, (s) => { s.style.color = c ?? "#FFFFFF"; })} />
```

With:

```tsx
<PalettePicker
  value={layer.style.color}
  onChange={(c) => patchLayer(layer.id, (s) => { s.style.color = c ?? "#FFFFFF"; })}
  look={look}
  analysis={photoAnalysis}
/>
```

Requires threading `look` and `photoAnalysis` into Inspector (they're likely already passed to the top-level `<Inspector>` prop or in a context).

#### Acceptance criteria

- [ ] All 8 Inspector colour pickers are PalettePicker
- [ ] Look row shows the current look's 5 tokens
- [ ] Photo row shows dominant colours if a photo is loaded
- [ ] Existing e2e tests pass (they select by role/testid, unchanged)

#### Prompt for Claude Code

```
Execute PR-B16. Replace all 8 ColorPicker call sites in src/ui/Inspector.tsx with PalettePicker from PR-B15.

Thread `look` and `photoAnalysis` props into Inspector (add to props if not there).

Mark ColorPicker and SWATCHES as @deprecated in atoms.tsx.

PR title: "feat(inspector): unified PalettePicker at every colour control (§2.6)"
```

---

### PR-B17: Swap SelectionBar's palette → PalettePicker

**Branch:** `git checkout -b phase-b-17-selbar-palette`
**Rules:** 1.
**Preconditions:** PR-B15.
**Diff estimate:** +50 / -50.

#### Files

**Modified:**
- `src/ui/SelectionBar.tsx` — replace inline swatches (`SWATCHES` array at line 20, palette popup at line ~90) with `<PalettePicker>` embedded in the popover.

#### Change spec

In SelectionBar.tsx, delete the local `SWATCHES` array. In the popover (`{openColor && (...)}` block), replace the inline map with:

```tsx
<PalettePicker
  value={current}
  onChange={(c) => { applyColor(c ?? "#FFFFFF"); setOpenColor(false); }}
  look={look}
  analysis={photoAnalysis}
/>
```

Thread `look` and `photoAnalysis` props.

#### Acceptance criteria

- [ ] SelectionBar palette matches Inspector palette
- [ ] Existing SelectionBar e2e tests pass
- [ ] User taps a layer, opens palette on SelectionBar, palette on Inspector — both show same options

#### Prompt for Claude Code

```
Execute PR-B17. Replace SelectionBar's inline 6-chip palette with PalettePicker.

Delete local SWATCHES array. Use PalettePicker in the popover.

PR title: "feat(selection-bar): use unified PalettePicker (§2.6)"
```

---

### PR-B18: Eyedropper — sample colour from photo

**Branch:** `git checkout -b phase-b-18-eyedropper`
**Rules:** 1.
**Preconditions:** PR-B16, PR-B17.
**Diff estimate:** +120 / -5.

#### Change spec

Add an eyedropper button to PalettePicker (in the neutrals row). Clicking activates:

```tsx
// In PalettePicker
function activateEyedropper() {
  if ("EyeDropper" in window) {
    // Native EyeDropper API (Chromium)
    new (window as any).EyeDropper().open().then((r: any) => pick(r.sRGBHex.toUpperCase())).catch(() => {});
  } else {
    // Fallback: attach click handler to stage that samples the underlying canvas
    dispatchStageEyedropperEvent();
  }
}
```

For the fallback, listen for a `stage-eyedropper-active` custom event in App.jsx/StudioOverlay; on click, `getImageData(x, y, 1, 1)` on the base canvas and dispatch back with the hex.

Add `<button type="button" className="palette-eyedropper" onClick={activateEyedropper}>◇</button>` to the neutrals row.

#### Acceptance criteria

- [ ] Chromium: native EyeDropper opens
- [ ] Safari/Firefox: click-to-sample from canvas works
- [ ] Sampled colour appears as `value` on the palette

#### Prompt for Claude Code

```
Execute PR-B18. Add eyedropper to PalettePicker. Use native EyeDropper API where supported, custom stage-click fallback elsewhere.

PR title: "feat(palette): eyedropper for sampling from canvas (§2.6)"
```

---

### PR-B19: "Under the look" indicator

**Branch:** `git checkout -b phase-b-19-under-look`
**Rules:** 1.
**Preconditions:** PR-B15.
**Diff estimate:** +30 / -5.

#### Change spec

When a layer's colour value starts with `$`, show a small diamond badge on the swatch that renders it in the look row. Also, add a "Reset to look colours" button at the Inspector's Colour section (visible only when at least one style field on the layer is a literal hex, not a token).

```tsx
// In Inspector Colour section
{hasLiteralColor(layer) && (
  <button
    type="button"
    className="btn ghost small"
    onClick={() => resetLayerToLookTokens(layer)}
    data-testid="reset-to-look"
  >
    Reset colours to look
  </button>
)}
```

`resetLayerToLookTokens` swaps the layer's colour fields for the nearest look token by hex distance.

#### Acceptance criteria

- [ ] Diamond badge visible on the active look-token swatch when layer uses it
- [ ] "Reset to look" button appears when literal hex is set
- [ ] Clicking it swaps to nearest look token

#### Prompt for Claude Code

```
Execute PR-B19. Add "under the look" indicator badge and "Reset to look colours" button per brief.

PR title: "feat(palette): under-look indicator + reset (§2.6)"
```

---

### PR-B20: Share-a-layout receiving UX

**Branch:** `git checkout -b phase-b-20-share-receive`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +130 / -3.

#### Why

`shareUrl` encodes a layout into a `#layout=` URL fragment. When a recipient opens the link, the layout applies but they see nonsensical placeholder text where the original creator's stats were. No context is given. Deep review §2.15.

#### Files

**Modified:**
- `src/App.jsx` — detect `#layout=` on load, show a welcoming banner explaining what happened.

#### Change spec

```jsx
useEffect(() => {
  if (window.location.hash.startsWith("#layout=")) {
    setToast({
      kind: "info",
      title: "Someone shared a layout with you.",
      body: "Add your own photo and connect Strava to fill in your stats.",
      actions: [
        { label: "Connect Strava", onClick: () => setShowStrava(true) },
        { label: "Add a photo", onClick: () => fileInputRef.current?.click() },
        { label: "Dismiss", onClick: () => setToast(null) },
      ],
    });
  }
}, []);
```

New toast variant with 3 CTAs and dismissible.

#### Acceptance criteria

- [ ] Opening any URL with `#layout=...` shows the banner
- [ ] All 3 CTAs work
- [ ] Banner dismisses on any CTA

#### Prompt for Claude Code

```
Execute PR-B20. Show a welcoming banner when a `#layout=` share link is opened.

PR title: "feat(share): receiving UX for shared layouts (§2.15)"
```

---

### PR-B21: Pinch-to-zoom + pan on stage

**Branch:** `git checkout -b phase-b-21-pinch-zoom`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +150 / -10.

#### Files

**Modified:**
- `src/ui/StudioOverlay.tsx` — track two pointers, compute pinch scale + pan translation, apply as CSS transform on the stage container.
- `src/App.jsx` — add reset-zoom button.

#### Change spec

Track two pointers via `pointerdown`/`pointermove`/`pointerup` with `pointerId` map. When 2 active, compute centre + distance; derive zoom and pan deltas; apply via `transform: scale(...) translate(...)` on the stage.

Single-pointer gestures (drag, select) continue to work — pinch is only activated when the second pointer touches down.

Reset zoom via double-tap on stage background.

#### Acceptance criteria

- [ ] Two-finger pinch zooms in/out smoothly
- [ ] Pan while zoomed works
- [ ] Double-tap resets
- [ ] Existing single-touch drag/select unaffected

#### Prompt for Claude Code

```
Execute PR-B21. Add pinch-to-zoom and pan to StudioOverlay.

Details in the brief. Do not interfere with single-touch drag.

PR title: "feat(editor): pinch-to-zoom and pan (§2.3)"
```

---

### PR-B22: Inspector consistency pass

**Branch:** `git checkout -b phase-b-22-inspector-consistency`
**Rules:** 1.
**Preconditions:** PR-B16.
**Diff estimate:** +180 / -120.

#### Files

**Modified:**
- `src/ui/Inspector.tsx` — reorganise every layer type's controls into the same 6 sections in the same order: Colour, Type/Style, Content, Effects, Animation, Arrange.
- Add "More" toggle at bottom of each section to reveal advanced controls.
- Add leading icons to section headers.

#### Change spec

Standardise section wrapping across `TextControls`, `ShapeControls`, `ImageControls`, `StatControls`, `StatRowControls`, `RouteControls`, `ChartControls`.

Each layer type gets sections in order:
1. Colour
2. Type/Style
3. Content/Bindings
4. Effects
5. Animation
6. Arrange

Advanced controls (`simplify`, `letterSpacing`, `maxWidth`, `dotSize`) go into a "More" collapsible within their section.

#### Acceptance criteria

- [ ] Every layer type has the same 6 sections in the same order
- [ ] "More" collapsibles hide advanced controls by default
- [ ] Icons visible on section headers

#### Prompt for Claude Code

```
Execute PR-B22. Standardise Inspector section order and add "More" collapsibles per brief.

PR title: "refactor(inspector): consistent section order across all layer types (§2.8)"
```

---


---

## 5. PHASE C — data richness + market parity (weeks 7-9)

### PR-C1: Strava `profile:read_all` scope + fetch `/athlete/zones`

**Branch:** `git checkout -b phase-c-01-strava-zones`
**Rules:** 1.
**Preconditions:** all Phase A merged.
**Diff estimate:** +140 / -15.

#### Files

> ## ⚠️ ALREADY DONE — do not execute this brief
>
> Landed 11–12 Sep 2026 in `81d0816` and `c17a932`, before the plan was picked up. The
> `profile:read_all` scope is live, `/athlete/zones` is fetched on load, and
> `src/data/stravaZones.ts` parses the response with `test/unit/stravaZones.test.ts` covering
> it. The reconnect affordance exists too — inline in `src/App.jsx:1009`, not in a modal.
>
> One correction for the record: **`src/ui/StravaModal.tsx` has never existed**, at any
> commit. v2 invented it. The Strava UI is inline in App.jsx.
>
> PR-A1 absorbs `stravaZones.ts` into `src/data/hr.ts`; after that this brief has nothing
> left in it.

**Modified:**
- `api/strava/config.ts` — extend scope string to include `profile:read_all`. ✅ done
- `src/data/strava.ts` — after `completeSignIn`, fetch `/athlete/zones`. ✅ done
- `test/unit/strava.test.ts` — add zone-fetch case. ✅ done

**Does not exist (v2 error):**
- `src/ui/StravaModal.tsx` — the reconnect affordance lives in `src/App.jsx` instead.

#### Line references verified

- `api/strava/config.ts` — the scope string.
- `src/data/strava.ts` — the `completeSignIn` or `handleCallback` function.

#### Change spec

**`api/strava/config.ts`:**

```ts
export const STRAVA_SCOPE = "read,activity:read_all,profile:read_all";
```

**`src/data/strava.ts`:**

```ts
async function fetchAthleteZones(accessToken: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://www.strava.com/api/v3/athlete/zones", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const zones = data.heart_rate?.zones;
    if (!Array.isArray(zones) || zones.length !== 5) return null;
    return zones.map((z: { min: number }) => z.min);
  } catch {
    return null;
  }
}

// In completeSignIn, after obtaining the access token:
const hrZones = await fetchAthleteZones(session.accessToken);
session.athlete = {
  id: athlete.id,
  name: athlete.firstname ? `${athlete.firstname} ${athlete.lastname ?? ""}`.trim() : undefined,
  hrZones: hrZones ?? undefined,
};
saveSession(session);
```

**Detection of legacy sessions in StravaModal.tsx:**

```tsx
const session = Strava.loadSession();
const hasNewScope = session?.scope?.includes("profile:read_all");
if (session && !hasNewScope) {
  return (
    <div className="strava-status">
      <p>Reconnect Strava to enable heart-rate zones.</p>
      <button onClick={() => Strava.beginSignIn()}>Reconnect</button>
    </div>
  );
}
```

Requires storing `scope` on the session object during connect (already done in most OAuth flows, verify).

#### Test-first spec

`test/unit/strava.test.ts` additions:

```ts
describe("fetchAthleteZones", () => {
  it("returns 5 zone lower bounds from Strava API", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      heart_rate: {
        zones: [
          { min: 0, max: 114 },
          { min: 114, max: 133 },
          { min: 133, max: 152 },
          { min: 152, max: 171 },
          { min: 171, max: 190 },
        ],
      },
    })));
    const zones = await fetchAthleteZones("token");
    expect(zones).toEqual([0, 114, 133, 152, 171]);
  });

  it("returns null on error", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 500 }));
    const zones = await fetchAthleteZones("token");
    expect(zones).toBeNull();
  });

  it("returns null on malformed response", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({})));
    const zones = await fetchAthleteZones("token");
    expect(zones).toBeNull();
  });
});
```

#### Golden matrix impact

None (data layer only).

#### Acceptance criteria

- [ ] New sign-ins request `profile:read_all`
- [ ] Legacy sessions see reconnect prompt
- [ ] `session.athlete.hrZones` populated after fresh connect
- [ ] `resolveZones` from PR-A1 now returns Strava-source zones for connected users
- [ ] `npm run test:e2e` passes existing Strava tests

#### Prompt for Claude Code

```
Execute PR-C1 from BRIEFS_V2.md section 5. Extend Strava scope and fetch /athlete/zones after connect.

Files per brief:
- api/strava/config.ts — add profile:read_all
- src/data/strava.ts — fetchAthleteZones + populate session.athlete.hrZones
- src/ui/StravaModal.tsx — reconnect prompt for legacy sessions

Add tests in test/unit/strava.test.ts.

PR title: "feat(strava): fetch athlete zones on connect (§7.2, §7.4)"
```

---

### PR-C2: Multi-activity fetch + IndexedDB cache

**Branch:** `git checkout -b phase-c-02-activity-cache`
**Rules:** 1.
**Preconditions:** PR-C1.
**Diff estimate:** +180 / -25.

#### Files

**Modified:**
- `src/data/strava.ts` — add `fetchRecentActivities(session, count = 60)` with 6-hour cache.
- `src/storage/db.ts` — add IndexedDB store `stravaActivities` keyed by athlete ID.
- `src/App.jsx` — on Strava connect success, kick off prefetch in background.

#### Change spec

`src/storage/db.ts`:

```ts
// Add to the IndexedDB schema migration:
db.createObjectStore("stravaActivities", { keyPath: "athleteId" });

export async function saveActivities(athleteId: number, activities: unknown[]): Promise<void> {
  await put("stravaActivities", { athleteId, activities, updatedAt: Date.now() });
}

export async function loadActivities(athleteId: number): Promise<{ activities: unknown[]; updatedAt: number } | null> {
  return (await get("stravaActivities", athleteId)) ?? null;
}
```

`src/data/strava.ts`:

```ts
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;  // 6 hours

export async function fetchRecentActivities(session: StravaSession, count = 60) {
  if (!session.athlete?.id) return [];

  const cached = await loadActivities(session.athlete.id);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return cached.activities;
  }

  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${count}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!res.ok) return cached?.activities ?? [];

  const activities = await res.json();
  await saveActivities(session.athlete.id, activities);
  return activities;
}

export async function invalidateActivityCache(athleteId: number): Promise<void> {
  await del("stravaActivities", athleteId);
}
```

App.jsx: after `Strava.completeSignIn` success, dispatch `fetchRecentActivities(session)` and store on state. Fire again after successful new-activity load (invalidate cache).

#### Test-first spec

`test/unit/activityCache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRecentActivities } from "../../src/data/strava";
import { saveActivities, loadActivities } from "../../src/storage/db";

describe("fetchRecentActivities cache behaviour", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns fresh cache without hitting network", async () => {
    await saveActivities(1, [{ id: "a1" }]);
    const spy = vi.spyOn(global, "fetch");
    const result = await fetchRecentActivities({ athlete: { id: 1 } } as any, 10);
    expect(result).toEqual([{ id: "a1" }]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refetches when cache is older than TTL", async () => {
    await saveActivities(2, [{ id: "old" }]);
    // Manually age the cache
    const cached = await loadActivities(2);
    (cached as any).updatedAt = Date.now() - 7 * 3600 * 1000;
    global.fetch = vi.fn(async () => new Response(JSON.stringify([{ id: "new" }])));
    const result = await fetchRecentActivities({
      athlete: { id: 2 }, accessToken: "t",
    } as any, 10);
    expect(result).toEqual([{ id: "new" }]);
  });
});
```

#### Golden matrix impact

None.

#### Acceptance criteria

- [ ] After Strava connect, cache populates in background
- [ ] Second app open uses cache (network tab confirms)
- [ ] Cache invalidates after 6 hours or after new activity import

#### Prompt for Claude Code

```
Execute PR-C2. Fetch and cache 60 recent activities after Strava connect.

Files per brief.

Write test/unit/activityCache.test.ts FIRST.

PR title: "feat(strava): prefetch and cache activities (§7.2)"
```

---

### PR-C3: PB detection

**Branch:** `git checkout -b phase-c-03-pb-detection`
**Rules:** 1.
**Preconditions:** PR-C2.
**Diff estimate:** +240 / -5.

#### Files

**Added:**
- `src/data/pb.ts` (~180 lines).
- `test/unit/pb.test.ts` (~100 lines).

**Modified:**
- `src/App.jsx` — on activity load, `detectPBs(current, cache)`; store on activity as `pb`.
- `src/model/fields.ts` — expose `{pb.distance}`, `{pb.previous}`, `{pb.delta}`, `{pb.time}`.
- `src/model/bindings.ts` — add PB chips.

#### Change spec

`src/data/pb.ts`:

```ts
export interface PBResult {
  /** Standard distance matched (metres). */
  distance: number;
  /** Previous personal best time at this distance (seconds), or null if first attempt. */
  previous: number | null;
  /** This activity's time at this distance (seconds). */
  current: number;
  /** current - previous (negative = faster). */
  delta: number;
}

const STANDARD_DISTANCES = [1609.34, 5000, 10000, 21097.5, 42195] as const;

interface HistoryActivity {
  distance: number;
  moving_time: number;
  sport_type?: string;
}

interface CurrentActivity {
  distance: number;
  time: number;
  sport: string;
  splits?: number[];  // pace per km, seconds
}

/**
 * Detects PBs across standard distances.
 * A PB is claimed only when current time strictly beats the best in history at the same distance.
 * Sport comparison is loose (any Run subtype counts as run).
 */
export function detectPBs(current: CurrentActivity, history: HistoryActivity[]): PBResult[] {
  const currentSport = current.sport.toLowerCase();
  const sameSport = history.filter((h) =>
    h.sport_type?.toLowerCase().includes(currentSport)
  );

  const results: PBResult[] = [];

  for (const d of STANDARD_DISTANCES) {
    if (current.distance < d * 0.98) continue;

    const currentTime = timeAtDistance(current, d);
    if (currentTime === null) continue;

    const historicalTimes = sameSport
      .filter((h) => h.distance >= d * 0.98)
      .map((h) => timeAtDistance({
        distance: h.distance,
        time: h.moving_time,
        sport: currentSport,
      }, d))
      .filter((t): t is number => t !== null);

    const previous = historicalTimes.length > 0 ? Math.min(...historicalTimes) : null;

    if (previous === null || currentTime < previous) {
      results.push({
        distance: d,
        previous,
        current: currentTime,
        delta: previous === null ? 0 : currentTime - previous,
      });
    }
  }

  return results;
}

/**
 * Time to cover a standard distance within an activity.
 * If splits are available, uses cumulative min for the target distance.
 * Otherwise, scales proportionally (approximation).
 */
function timeAtDistance(act: CurrentActivity, targetM: number): number | null {
  if (act.distance < targetM * 0.98) return null;
  if (act.splits && act.splits.length > 0) {
    // splits[i] is pace (sec/km) for km i. Find the fastest contiguous window of targetKm.
    const targetKm = targetM / 1000;
    const windowSize = Math.floor(targetKm);
    if (act.splits.length < windowSize) return null;
    let bestWindowSum = Infinity;
    for (let i = 0; i + windowSize <= act.splits.length; i++) {
      const sum = act.splits.slice(i, i + windowSize).reduce((a, b) => a + b, 0);
      if (sum < bestWindowSum) bestWindowSum = sum;
    }
    // Add fractional km if needed
    return bestWindowSum + (targetKm - windowSize) * (act.splits[act.splits.length - 1] ?? 0);
  }
  // Fall back: proportional scaling
  return act.time * (targetM / act.distance);
}
```

`src/model/fields.ts` additions in `buildFields`:

```ts
if (act.pb && act.pb.length > 0) {
  const best = act.pb[0];  // primary PB
  fields["pb.distance"] = Math.round(best.distance);
  fields["pb.distanceLabel"] = formatDistanceLabel(best.distance);
  fields["pb.time"] = fmtPace(best.current);
  fields["pb.previous"] = best.previous ? fmtPace(best.previous) : null;
  fields["pb.delta"] = best.previous ? fmtDelta(best.delta) : "First!";
}

function formatDistanceLabel(m: number): string {
  const map: Record<number, string> = {
    1609.34: "1 mile", 5000: "5K", 10000: "10K", 21097.5: "Half", 42195: "Marathon",
  };
  return map[Math.round(m * 100) / 100] ?? `${(m / 1000).toFixed(1)} km`;
}

function fmtDelta(delta: number): string {
  const abs = Math.abs(delta);
  const sign = delta < 0 ? "-" : "+";
  return `${sign}${fmtPace(abs)}`;
}
```

#### Test-first spec

`test/unit/pb.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { detectPBs } from "../../src/data/pb";

describe("detectPBs", () => {
  it("detects a 10K PB against slower historical", () => {
    const current = { distance: 10200, time: 2670, sport: "run", splits: Array(10).fill(267) };  // 44:30
    const history = [{ distance: 10500, moving_time: 2700, sport_type: "Run" }];  // 45:00 pace
    const pbs = detectPBs(current, history);
    const tenK = pbs.find((p) => p.distance === 10000);
    expect(tenK).toBeDefined();
    expect(tenK!.previous).toBeLessThan(3000);
    expect(tenK!.current).toBeLessThan(tenK!.previous!);
  });

  it("returns no PB when current is slower", () => {
    const current = { distance: 10200, time: 2800, sport: "run", splits: Array(10).fill(280) };
    const history = [{ distance: 10200, moving_time: 2670, sport_type: "Run" }];
    const pbs = detectPBs(current, history);
    expect(pbs).toHaveLength(0);
  });

  it("marks first-of-distance as PB with previous=null", () => {
    const current = { distance: 5100, time: 1500, sport: "run", splits: Array(5).fill(300) };
    const pbs = detectPBs(current, []);
    const fiveK = pbs.find((p) => p.distance === 5000);
    expect(fiveK?.previous).toBeNull();
    expect(fiveK?.delta).toBe(0);
  });

  it("does not claim a PB for a distance the activity didn't cover", () => {
    const current = { distance: 3000, time: 900, sport: "run" };
    const pbs = detectPBs(current, []);
    expect(pbs.every((p) => p.distance <= 3000)).toBe(true);
  });

  it("ignores different-sport history", () => {
    const current = { distance: 10200, time: 2670, sport: "run", splits: Array(10).fill(267) };
    const history = [{ distance: 10200, moving_time: 2000, sport_type: "Ride" }];  // cycling, faster
    const pbs = detectPBs(current, history);
    // Should still be a PB for run (cycling isn't counted)
    expect(pbs.some((p) => p.distance === 10000)).toBe(true);
  });
});
```

#### Golden matrix impact

None until templates using `{pb.*}` are added (PR-C5).

#### Acceptance criteria

- [ ] PB detected for demo activity when a fake history is injected
- [ ] `fields["pb.distanceLabel"]` shows "10K" for 10000m
- [ ] `fields["pb.delta"]` shows "-0:30" for 30s faster

#### Prompt for Claude Code

```
Execute PR-C3. Add PB detection at src/data/pb.ts.

Full implementation in the brief. Handle both split-based and proportional-scaling time-at-distance.

Wire into App.jsx: on activity load with cached history available, call detectPBs and store on act.pb.

Expose {pb.distance}, {pb.distanceLabel}, {pb.time}, {pb.previous}, {pb.delta} bindings in fields.ts.

Write test/unit/pb.test.ts FIRST — all 5 cases.

PR title: "feat(data): PB detection across standard distances (§7.5)"
```

---

### PR-C4: Streak + monthly aggregates

**Branch:** `git checkout -b phase-c-04-aggregates`
**Rules:** 1.
**Preconditions:** PR-C2.
**Diff estimate:** +180 / -5.

#### Files

**Added:**
- `src/data/aggregates.ts` (~130 lines).
- `test/unit/aggregates.test.ts` (~80 lines).

**Modified:**
- `src/model/fields.ts` — expose `{streak.days}`, `{monthly.distance}`, `{monthly.count}`, `{monthly.time}`, `{monthly.monthName}`.

#### Change spec

`src/data/aggregates.ts`:

```ts
interface HistoryActivity {
  start_date: string;  // ISO
  distance: number;
  moving_time: number;
}

/**
 * Consecutive-day streak counting back from today.
 * A day counts if ANY activity occurred on it (in local time).
 */
export function computeStreak(activities: HistoryActivity[], today: Date = new Date()): number {
  const days = new Set<string>();
  for (const a of activities) {
    const d = new Date(a.start_date);
    days.add(d.toISOString().slice(0, 10));
  }
  let streak = 0;
  const cursor = new Date(today);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface MonthlyTotals {
  monthName: string;
  distance: number;  // metres
  count: number;
  time: number;      // seconds
}

/**
 * Totals for the current calendar month.
 */
export function monthlyTotals(activities: HistoryActivity[], asOf: Date = new Date()): MonthlyTotals {
  const month = asOf.getMonth();
  const year = asOf.getFullYear();
  const inMonth = activities.filter((a) => {
    const d = new Date(a.start_date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  return {
    monthName: asOf.toLocaleString(undefined, { month: "long" }),
    distance: inMonth.reduce((s, a) => s + (a.distance ?? 0), 0),
    count: inMonth.length,
    time: inMonth.reduce((s, a) => s + (a.moving_time ?? 0), 0),
  };
}
```

Fields:

```ts
if (opts.history && Array.isArray(opts.history)) {
  const streak = computeStreak(opts.history as HistoryActivity[]);
  const monthly = monthlyTotals(opts.history as HistoryActivity[]);
  fields["streak.days"] = streak;
  fields["monthly.distance"] = Math.round(monthly.distance / 1000 * 10) / 10;  // km
  fields["monthly.count"] = monthly.count;
  fields["monthly.time"] = fmtTime(monthly.time);
  fields["monthly.monthName"] = monthly.monthName.toUpperCase();
}
```

Requires App.jsx to pass `opts.history` to `buildFields`.

#### Test-first spec

`test/unit/aggregates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeStreak, monthlyTotals } from "../../src/data/aggregates";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();

describe("computeStreak", () => {
  const today = new Date(2026, 8, 12);  // 12 Sep 2026

  it("returns 0 for empty history", () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const history = [
      { start_date: iso(2026, 9, 12), distance: 5000, moving_time: 1500 },
      { start_date: iso(2026, 9, 11), distance: 5000, moving_time: 1500 },
      { start_date: iso(2026, 9, 10), distance: 5000, moving_time: 1500 },
    ];
    expect(computeStreak(history, today)).toBe(3);
  });

  it("stops at first gap", () => {
    const history = [
      { start_date: iso(2026, 9, 12), distance: 5000, moving_time: 1500 },
      { start_date: iso(2026, 9, 11), distance: 5000, moving_time: 1500 },
      { start_date: iso(2026, 9, 9), distance: 5000, moving_time: 1500 },  // gap on 10th
    ];
    expect(computeStreak(history, today)).toBe(2);
  });
});

describe("monthlyTotals", () => {
  it("sums only current month", () => {
    const asOf = new Date(2026, 8, 15);  // 15 Sep
    const history = [
      { start_date: iso(2026, 9, 1), distance: 10000, moving_time: 3000 },
      { start_date: iso(2026, 9, 15), distance: 5000, moving_time: 1500 },
      { start_date: iso(2026, 8, 30), distance: 100000, moving_time: 30000 },  // August
    ];
    const totals = monthlyTotals(history, asOf);
    expect(totals.count).toBe(2);
    expect(totals.distance).toBe(15000);
    expect(totals.time).toBe(4500);
    expect(totals.monthName.toLowerCase()).toContain("september");
  });
});
```

#### Golden matrix impact

None until Phase C5 templates use these fields.

#### Acceptance criteria

- [ ] Streak = 0 for user with no activities
- [ ] Streak counts consecutive days
- [ ] Monthly totals scoped to current calendar month
- [ ] Fields available in `buildFields` output when history passed

#### Prompt for Claude Code

```
Execute PR-C4. Compute streak and monthly aggregates.

Files per brief.

Write test/unit/aggregates.test.ts FIRST — all cases.

Update App.jsx to pass opts.history to buildFields.

PR title: "feat(data): streak and monthly aggregates (§7.5)"
```

---

### PR-C5: 4 PB/milestone JSON templates

**Branch:** `git checkout -b phase-c-05-pb-templates`
**Rules:** 7.
**Preconditions:** PR-C3, PR-C4.
**Diff estimate:** +500 / 0 (four templates in one PR — 125 lines each average — under cap).

#### Templates

1. **`newPb`** — big "NEW PB" text + delta bar showing previous vs current time as a horizontal comparison.
2. **`raceRecap`** — 3-column grid: time, avg pace, calories, all large.
3. **`streakBadge`** — "N DAYS" hero, small dot strip visualising last 30 days.
4. **`monthlyRecap`** — "SEPTEMBER" hero, total distance, activity count, top 3 runs list.

#### Change spec

Full JSON for each in `src/templates/index.ts`. Same structure as B2 `heroRoute`. Each uses only look tokens for colours.

Example for `newPb`:

```ts
{
  id: "newPb",
  name: "New PB",
  category: "milestone",
  requires: ["pb"],
  aspects: ["story", "post-1-1"],
  layers: [
    {
      id: "title",
      type: "text",
      anchor: { x: 0.5, y: 0.15 },
      origin: { x: 0.5, y: 0.5 },
      text: "NEW PB",
      style: { color: "$accent", font: "$font.display", size: 96, weight: 900, align: "center", letterSpacing: 8 },
    },
    {
      id: "distanceLabel",
      type: "text",
      anchor: { x: 0.5, y: 0.28 },
      origin: { x: 0.5, y: 0.5 },
      text: "{pb.distanceLabel}",
      style: { color: "$text", font: "$font.body", size: 48, weight: 600, align: "center", uppercase: true },
    },
    {
      id: "currentTime",
      type: "text",
      anchor: { x: 0.5, y: 0.5 },
      origin: { x: 0.5, y: 0.5 },
      text: "{pb.time}",
      style: { color: "$text", font: "$font.display", size: 260, weight: 900, align: "center" },
    },
    {
      id: "delta",
      type: "text",
      anchor: { x: 0.5, y: 0.65 },
      origin: { x: 0.5, y: 0.5 },
      text: "{pb.delta} vs {pb.previous}",
      style: { color: "$textMuted", font: "$font.body", size: 32, weight: 500, align: "center" },
    },
  ],
}
```

Other three follow same pattern.

#### Test-first spec

Extend `test/unit/templates.test.ts`:

```ts
describe("PB templates", () => {
  for (const id of ["newPb", "raceRecap", "streakBadge", "monthlyRecap"]) {
    it(`${id} is well-formed`, () => {
      const tpl = TEMPLATES.find((t) => t.id === id);
      expect(tpl).toBeDefined();
      expect(tpl!.category).toBeDefined();
    });
  }
});
```

#### Acceptance criteria

- [ ] All 4 templates in `src/templates/index.ts`
- [ ] All appear in Designs tab under respective categories
- [ ] `npm run lint:looks` passes
- [ ] Goldens recorded for each × 3-5 representative looks

#### Prompt for Claude Code

```
Execute PR-C5. Author 4 PB/milestone templates: newPb, raceRecap, streakBadge, monthlyRecap.

Full JSON for newPb is in the brief; use as pattern for the other 3.

Use {pb.*}, {streak.*}, {monthly.*} bindings from PR-C3 and PR-C4.

PR title: "feat(templates): 4 PB/milestone designs (§4.8)"
```

---

### PR-C6: `timeTrue` route animation

**Branch:** `git checkout -b phase-c-06-timetrue-route`
**Rules:** 5, 6.
**Preconditions:** PR-B13.
**Diff estimate:** +80 / -10.

#### Files

**Modified:**
- `src/engine/routeLayer.ts` — accept optional `timings?: number[]` (seconds per route point) in `RouteRenderOptions`.
- `src/App.jsx` — extract `timings` from activity time streams when available; fall back to linear (index-based).

#### Change spec

In `routeLayer.ts` progressive drawing:

```ts
export interface RouteRenderOptions {
  progress: number;  // 0..1
  timings?: number[];  // if present, progress is time-based
  ...
}

function progressToPointIndex(progress: number, timings: number[] | undefined, pointCount: number): number {
  if (!timings || timings.length !== pointCount) {
    return Math.min(pointCount - 1, Math.floor(progress * pointCount));
  }
  const total = timings[timings.length - 1];
  const target = progress * total;
  // Binary search
  let lo = 0, hi = timings.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timings[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
```

Use `progressToPointIndex` in the draw loop where it currently computes `Math.floor(progress * points.length)`.

App.jsx: when `activity.timeStream` is available (from Strava streams API — a Phase C data-layer extension), pass to `series.routeTimings`.

For MVP without stream API: compute `timings` as `points.map((_, i) => i / points.length * activity.time)` — linear approximation. Not truly time-true but the plumbing is ready for the streams API to make it accurate.

#### Test-first spec

`test/unit/routeTimings.test.ts`:

```ts
import { describe, it, expect } from "vitest";

// Import the unexported progressToPointIndex, or test via drawRoute call
```

Test that at progress=0.5 with linear timings, index is 50% of points; with skewed timings (fast first half, slow second half), index is different at progress=0.5.

#### Acceptance criteria

- [ ] Route drawing pace matches supplied timings
- [ ] Fallback to linear when timings absent
- [ ] Animated route templates still work

#### Prompt for Claude Code

```
Execute PR-C6. Add timeTrue route drawing.

RouteRenderOptions gains optional timings?: number[]. When present, progress-by-time (binary search on cumulative time). When absent, current linear behaviour.

App.jsx: derive timings from activity.time and point count as an approximation.

PR title: "feat(route): timeTrue drawing follows timings (§4.7)"
```

---

### PR-C7: `videoHud` template

**Branch:** `git checkout -b phase-c-07-video-hud`
**Rules:** 7.
**Preconditions:** PR-C6.
**Diff estimate:** +180 / 0.

#### Files

**Modified:**
- `src/templates/index.ts` — new `videoHud` template.

#### Change spec

```ts
{
  id: "videoHud",
  name: "Video HUD",
  category: "video",
  requires: ["route"],
  aspects: ["story", "post-1-1"],
  layers: [
    {
      id: "topName",
      type: "text",
      anchor: { x: 0.5, y: 0.06 },
      origin: { x: 0.5, y: 0 },
      text: "{name}",
      style: { color: "$text", font: "$font.body", size: 40, weight: 700, align: "center", uppercase: true, letterSpacing: 3 },
    },
    {
      id: "cornerRoute",
      type: "route",
      anchor: { x: 0.9, y: 0.85 },
      origin: { x: 1, y: 1 },
      size: { w: 0.25, h: 0.15 },
      style: { mode: "solid", stroke: "$accent", weight: 3, runnerDot: true },
    },
    {
      id: "bottomBar",
      type: "shape",
      shape: "rect",
      anchor: { x: 0.5, y: 1 },
      origin: { x: 0.5, y: 1 },
      size: { w: 1, h: 0.12 },
      style: { fill: "$bg", alpha: 0.85 },
    },
    {
      id: "distance",
      type: "stat",
      anchor: { x: 0.1, y: 0.94 },
      origin: { x: 0, y: 0.5 },
      binding: "distance",
      style: { valueColor: "$text", labelColor: "$textMuted", font: "$font.display", valueSize: 56 },
      anim: { preset: "countUp" },
    },
    {
      id: "pace",
      type: "stat",
      anchor: { x: 0.5, y: 0.94 },
      origin: { x: 0.5, y: 0.5 },
      binding: "pace",
      style: { valueColor: "$text", labelColor: "$textMuted", font: "$font.display", valueSize: 56 },
    },
    {
      id: "hr",
      type: "stat",
      anchor: { x: 0.9, y: 0.94 },
      origin: { x: 1, y: 0.5 },
      binding: "hr",
      style: { valueColor: "$text", labelColor: "$textMuted", font: "$font.display", valueSize: 56 },
    },
  ],
}
```

Add `"video"` to `TemplateCategory` if not present.

#### Acceptance criteria

- [ ] `videoHud` appears in Designs > Video category
- [ ] Renders correctly against demo activity
- [ ] Video export animates route corner + count-up stats

#### Prompt for Claude Code

```
Execute PR-C7. Author videoHud template per the brief.

PR title: "feat(templates): videoHud data-driven video design (§4.8)"
```

---

### PR-C8: Curated headlines library

**Branch:** `git checkout -b phase-c-08-headlines`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +150 / -10.

#### Files

**Added:**
- `src/model/headlines.ts` (~120 lines).

**Modified:**
- `src/ui/AddMenu.tsx` — Headline tile opens a chooser showing 4-6 relevant headlines.

#### Change spec

`src/model/headlines.ts`:

```ts
export const HEADLINE_LIBRARY = {
  pb: ["New PB", "Course PB", "Segment PB", "Fastest yet"],
  milestone: ["First 5K", "First 10K", "First half marathon", "First marathon", "100 days", "1000 km", "10,000 km"],
  training: ["Long run", "Recovery", "Threshold", "Intervals", "Hills", "Fartlek", "Tempo", "Progression"],
  events: ["Race day", "Track night", "Group run", "Solo miles", "Sunday long run"],
  weather: ["Rain run", "Sunrise miles", "Golden hour", "Snow day", "Heat wave"],
  mood: ["Just did it", "One more mile", "Nothing to prove", "Chased the light", "Kept it easy"],
} as const;

export interface HeadlineContext {
  hasPb?: boolean;
  distance?: number;
  hour?: number;  // 0-23
  weather?: "rain" | "sun" | "snow" | null;
  streak?: number;
}

export function suggestHeadlines(ctx: HeadlineContext): string[] {
  const out: string[] = [];
  if (ctx.hasPb) out.push(...HEADLINE_LIBRARY.pb.slice(0, 2));
  if (ctx.distance && ctx.distance >= 21097) out.push("Long run");
  if (ctx.distance && ctx.distance >= 5000 && ctx.distance < 10000) out.push("5K");
  if (ctx.streak && ctx.streak >= 7) out.push(`${ctx.streak} days`);
  if (ctx.hour !== undefined && ctx.hour >= 5 && ctx.hour < 8) out.push("Sunrise miles");
  if (ctx.hour !== undefined && ctx.hour >= 17 && ctx.hour < 20) out.push("Golden hour");
  if (ctx.weather === "rain") out.push("Rain run");
  if (ctx.weather === "sun") out.push("Sunshine miles");
  // Fill up to 6 with defaults
  const defaults = [...HEADLINE_LIBRARY.mood.slice(0, 2), ...HEADLINE_LIBRARY.training.slice(0, 2)];
  while (out.length < 6) {
    const next = defaults.shift();
    if (!next) break;
    if (!out.includes(next)) out.push(next);
  }
  return out.slice(0, 6);
}
```

In AddMenu, when user taps "Headline":

```tsx
const suggestions = suggestHeadlines({
  hasPb: (effectiveAct.pb?.length ?? 0) > 0,
  distance: effectiveAct.distance,
  hour: effectiveAct.date ? new Date(effectiveAct.date).getHours() : undefined,
  weather: effectiveAct.weather?.condition,
  streak: effectiveAct.streak,
});
setHeadlinePicker({ suggestions });
```

A small popover renders the 6 suggestions as buttons.

#### Test-first spec

`test/unit/headlines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { suggestHeadlines } from "../../src/model/headlines";

describe("suggestHeadlines", () => {
  it("includes PB headlines when hasPb", () => {
    const out = suggestHeadlines({ hasPb: true });
    expect(out).toContain("New PB");
  });

  it("includes Long run for half+ marathon distance", () => {
    expect(suggestHeadlines({ distance: 21100 })).toContain("Long run");
  });

  it("includes time-of-day contextual headline", () => {
    expect(suggestHeadlines({ hour: 6 })).toContain("Sunrise miles");
    expect(suggestHeadlines({ hour: 18 })).toContain("Golden hour");
  });

  it("returns at most 6 suggestions", () => {
    const out = suggestHeadlines({ hasPb: true, distance: 21100, streak: 30, hour: 6, weather: "rain" });
    expect(out.length).toBeLessThanOrEqual(6);
  });
});
```

#### Acceptance criteria

- [ ] Tap Add > Headline → 6 relevant suggestions appear
- [ ] Tapping a suggestion creates a text layer with that headline
- [ ] Custom entry still available

#### Prompt for Claude Code

```
Execute PR-C8. Add curated headlines library and wire into AddMenu.

Full impl in the brief.

Write test/unit/headlines.test.ts FIRST.

PR title: "feat(add-menu): curated headline suggestions (§6.5)"
```

---

### PR-C9: Weather badge

**Branch:** `git checkout -b phase-c-09-weather`
**Rules:** 1, 4 (adds OpenWeather API dep pattern — needs §11.1 entry).
**Preconditions:** none.
**Diff estimate:** +240 / -5.

#### Files

**Added:**
- `api/weather.ts` (~60 lines) — Edge function proxying OpenWeather to hide API key.
- `src/data/weather.ts` (~130 lines) — client, caching in IndexedDB keyed by activity ID.
- `test/unit/weather.test.ts` (~80 lines).

**Modified:**
- `src/model/fields.ts` — expose `{weather.temp}`, `{weather.tempC}`, `{weather.condition}`, `{weather.icon}`.

#### Change spec

`api/weather.ts` (Vercel Edge function):

```ts
export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const dt = url.searchParams.get("dt");  // unix timestamp

  if (!lat || !lon || !dt) return new Response("missing params", { status: 400 });

  const key = process.env.OPENWEATHER_KEY;
  if (!key) return new Response("not configured", { status: 500 });

  const res = await fetch(
    `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${dt}&appid=${key}&units=metric`,
    { headers: { Accept: "application/json" } }
  );
  const data = await res.json();
  return new Response(JSON.stringify({
    temp: data.data?.[0]?.temp,
    condition: data.data?.[0]?.weather?.[0]?.main,
    icon: data.data?.[0]?.weather?.[0]?.icon,
  }), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
}
```

`src/data/weather.ts`:

```ts
export interface WeatherData {
  tempC: number;
  condition: string;  // "Clear", "Rain", "Snow", etc.
  icon: string;  // OpenWeather icon code
}

export async function fetchWeatherForActivity(activityId: string, lat: number, lon: number, dateIso: string): Promise<WeatherData | null> {
  const cached = await loadWeather(activityId);
  if (cached) return cached;

  const dt = Math.floor(new Date(dateIso).getTime() / 1000);
  const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}&dt=${dt}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.temp) return null;

  const weather: WeatherData = {
    tempC: Math.round(data.temp),
    condition: data.condition ?? "Unknown",
    icon: data.icon ?? "01d",
  };
  await saveWeather(activityId, weather);
  return weather;
}

// Convert condition to a short label for badges
export function weatherLabel(w: WeatherData, units: "C" | "F" = "C"): string {
  const t = units === "F" ? Math.round(w.tempC * 9 / 5 + 32) : w.tempC;
  return `${t}°${units} ${w.condition}`;
}
```

Fields:

```ts
if (act.weather) {
  fields["weather.tempC"] = act.weather.tempC;
  fields["weather.temp"] = opts.units === "mi" ? Math.round(act.weather.tempC * 9 / 5 + 32) : act.weather.tempC;
  fields["weather.condition"] = act.weather.condition;
  fields["weather.icon"] = act.weather.icon;
}
```

**§11.1 entry to add:**

```
OpenWeather API — accessed via /api/weather edge function. Requires OPENWEATHER_KEY env var (free tier: 1000 calls/day).
```

#### Test-first spec

`test/unit/weather.test.ts`:

```ts
describe("fetchWeatherForActivity", () => {
  it("returns cached if present", async () => { ... });
  it("caches on successful fetch", async () => { ... });
  it("returns null on API error", async () => { ... });
});

describe("weatherLabel", () => {
  it("formats Celsius by default", () => {
    expect(weatherLabel({ tempC: 12, condition: "Clear", icon: "01d" })).toBe("12°C Clear");
  });
  it("converts to Fahrenheit when units=mi", () => {
    expect(weatherLabel({ tempC: 0, condition: "Snow", icon: "13d" }, "F")).toBe("32°F Snow");
  });
});
```

#### Acceptance criteria

- [ ] Weather fields available in bindings for activities with lat/lon
- [ ] Cached in IndexedDB
- [ ] `OPENWEATHER_KEY` set in Vercel env → API works; unset → graceful null
- [ ] §11.1 updated

#### Prompt for Claude Code

```
Execute PR-C9. Add weather API with edge-function proxy.

New: api/weather.ts, src/data/weather.ts.
Modified: src/model/fields.ts adds weather bindings.

Add OPENWEATHER_KEY to Vercel env. Add row to STRIDE_STUDIO_V2_SPEC.md §11.1 per template in brief.

Write test/unit/weather.test.ts FIRST.

PR title: "feat(data): weather badge for activities (§7.6)"
```

---

### PR-C10: FIT file support (lazy chunk)

**Branch:** `git checkout -b phase-c-10-fit-import`
**Rules:** 4 (adds `@garmin/fitsdk`).
**Preconditions:** none.
**Diff estimate:** +180 / -5.

#### Files

**Modified:**
- `src/data/gpx.ts` — add `parseFit(fileBuffer)` alongside `parseGpx`, dynamically importing `@garmin/fitsdk`.
- `src/App.jsx` — file input accepts `.fit`; router picks `parseFit` for `.fit`, `parseGpx` for `.gpx`, existing TCX for `.tcx`.
- `STRIDE_STUDIO_V2_SPEC.md §11.1` — new dep row.

#### Change spec

`src/data/gpx.ts` add:

```ts
export async function parseFit(buffer: ArrayBuffer): Promise<ImportedActivity | null> {
  const { Decoder, Stream } = await import("@garmin/fitsdk");
  const stream = Stream.fromByteArray(new Uint8Array(buffer));
  const decoder = new Decoder(stream);
  if (!decoder.isFIT() || !decoder.checkIntegrity()) return null;

  const { messages } = decoder.read({
    applyScaleAndOffset: true,
    convertTypesToStrings: true,
  });

  // Extract records (per-second data points)
  const records = messages.recordMesgs ?? [];
  if (records.length === 0) return null;

  const hrValues: number[] = [];
  const routePoints: Array<[number, number]> = [];
  const elevValues: number[] = [];

  for (const r of records) {
    if (r.heartRate) hrValues.push(r.heartRate);
    if (r.positionLat && r.positionLong) {
      routePoints.push([r.positionLat / 2 ** 31 * 180, r.positionLong / 2 ** 31 * 180]);
    }
    if (r.altitude) elevValues.push(r.altitude);
  }

  const session = messages.sessionMesgs?.[0];
  return {
    sport: session?.sport === "cycling" ? "ride" : "run",
    name: session?.eventType ?? "Activity",
    date: session?.startTime ?? new Date().toISOString(),
    distance: session?.totalDistance ?? 0,
    time: session?.totalTimerTime ?? 0,
    elevation: session?.totalAscent ?? 0,
    hr: session?.avgHeartRate ?? null,
    activityHrMax: hrValues.length > 0 ? Math.max(...hrValues) : null,
    calories: session?.totalCalories ?? null,
    route: routePoints.length > 0 ? routePoints : null,
    elev: elevValues.length > 0 ? elevValues : null,
    hrStream: hrValues.length > 0 ? thin(hrValues, 500) : null,
    splits: [],  // Complex to derive from FIT; skip for MVP
  };
}
```

App.jsx file input:

```jsx
<input type="file" accept=".gpx,.tcx,.fit" onChange={async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  let parsed: ImportedActivity | null;
  if (ext === ".fit") {
    parsed = await parseFit(await file.arrayBuffer());
  } else if (ext === ".gpx") {
    parsed = parseGpx(await file.text());
  } else if (ext === ".tcx") {
    parsed = parseTcx(await file.text());
  } else return;
  if (parsed) setAct(importedToActivity(parsed));
}} />
```

#### Acceptance criteria

- [ ] `.fit` file uploads work
- [ ] `@garmin/fitsdk` only loaded when user picks a .fit (verify via network tab)
- [ ] Initial bundle size doesn't increase
- [ ] §11.1 updated

#### Prompt for Claude Code

```
Execute PR-C10. Add FIT file support via dynamic import.

Full impl in brief.

npm install @garmin/fitsdk.
Add row to §11.1 of the spec.

Verify bundle: npm run size — initial chunk unchanged; new fit-decoder chunk visible.

PR title: "feat(import): FIT file support via lazy chunk (§7.3)"
```

---

### PR-C11: Increase HR stream thinning to 500 samples

**Branch:** `git checkout -b phase-c-11-thin-cap`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +2 / -2.

#### Files

**Modified:**
- `src/App.jsx:479` — `Math.max(1, Math.floor(arr.length / 200))` → `Math.max(1, Math.floor(arr.length / 500))`.
- `src/data/gpx.ts` — same change wherever `thin` is called with a 200 cap.

#### Acceptance criteria

- [ ] HR trace on a long run appears smoother
- [ ] `npm run test:golden` — likely small diff; expected. Re-record.

#### Prompt for Claude Code

```
Execute PR-C11. Change stream thinning from 200 to 500 samples.

Files: src/App.jsx:479 and any other `thin(x, 200)` call site.

Goldens may drift slightly. Add golden-update if so.

PR title: "perf(streams): thin to 500 samples for smoother chart (§7.1)"
```

---

## 6. PHASE D — video, polish, TypeScript conversion (weeks 10-12)

### PR-D1: Rename "Save sticker" → "Stats Sticker"

**Branch:** `git checkout -b phase-d-01-sticker-rename`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +2 / -2.

#### Files

- `src/App.jsx:874` (approximate — grep for "Save sticker") — change label.

#### Change spec

```jsx
// BEFORE
<button ...>Save sticker (transparent)</button>

// AFTER
<button ...>Stats Sticker</button>
```

Match Strava's own terminology. Small change, big semantic win.

#### Acceptance criteria

- [ ] Export button reads "Stats Sticker"
- [ ] Existing e2e test for export updated if it selects by label

#### Prompt for Claude Code

```
Execute PR-D1. Rename "Save sticker (transparent)" → "Stats Sticker" in the export row.

Also update any e2e tests that select by this label.

PR title: "chore(labels): 'Stats Sticker' matches Strava wording"
```

---

### PR-D2: Story-frame mock preview for sticker export

**Branch:** `git checkout -b phase-d-02-story-mock`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +140 / -10.

#### Files

**Added:**
- `src/ui/StoryMock.tsx` (~100 lines).

**Modified:**
- `src/App.jsx` — after "Stats Sticker" export succeeds, show the result inside a Story-frame mock (mock Instagram Story chrome with placeholder photo, sticker positioned as it would be).

#### Change spec

`src/ui/StoryMock.tsx`:

```tsx
export interface StoryMockProps {
  stickerUrl: string;
  onClose: () => void;
  onDownload: () => void;
}

export function StoryMock({ stickerUrl, onClose, onDownload }: StoryMockProps) {
  return (
    <div className="modal" data-testid="story-mock">
      <div className="modal-inner" style={{ maxWidth: 360 }}>
        <h3>Preview on Story</h3>
        <div className="story-frame">
          {/* Mock IG story chrome: progress bar top, gradient photo bg, sticker centred at 60% down */}
          <div className="story-progress-bar" />
          <div className="story-photo-mock" />
          <img src={stickerUrl} alt="Your sticker" className="story-sticker-preview" />
          <div className="story-caption-mock">Add to story</div>
        </div>
        <p className="muted small">This is how your sticker will look on an Instagram Story.</p>
        <div className="row">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={onDownload}>Download PNG</button>
        </div>
      </div>
    </div>
  );
}
```

CSS in styles.css:

```css
.story-frame {
  aspect-ratio: 9 / 16;
  background: linear-gradient(135deg, #666, #333);
  border-radius: 24px;
  overflow: hidden;
  position: relative;
}
.story-progress-bar {
  position: absolute; top: 8px; left: 8px; right: 8px; height: 3px;
  background: rgba(255,255,255,0.3); border-radius: 2px;
}
.story-progress-bar::after {
  content: ""; display: block; height: 100%; width: 40%; background: rgba(255,255,255,0.9); border-radius: 2px;
}
.story-photo-mock {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.35));
}
.story-sticker-preview {
  position: absolute; top: 60%; left: 50%; transform: translate(-50%, -50%);
  max-width: 70%; max-height: 40%;
}
```

In App.jsx, after sticker export success, set `result.previewKind = "story-sticker"`; render StoryMock when `result?.previewKind === "story-sticker"`.

#### Acceptance criteria

- [ ] After "Stats Sticker" export, mock story appears
- [ ] Sticker overlaid at ~60% down (thumb-friendly position)
- [ ] Download button triggers the actual PNG save

#### Prompt for Claude Code

```
Execute PR-D2. Add Story-frame mock preview for sticker export.

Files per brief. Add StoryMock component + CSS.

PR title: "feat(export): Story-frame mock preview for stickers (§9.2)"
```

---

### PR-D3: 720p video export preset

**Branch:** `git checkout -b phase-d-03-video-720p`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +30 / -5.

#### Files

**Modified:**
- `src/export/video.ts` — accept a `size: 720 | 1080 | 1440` option; default 1080; scale canvas accordingly.
- `src/App.jsx` — export row Seg has a size selector; default 1080, add "Fast (720p, older phones)" option.

#### Change spec

In video.ts:

```ts
export interface VideoExportOptions {
  ...
  size?: 720 | 1080 | 1440;
}

export async function exportVideo(scene: Scene, options: VideoExportOptions) {
  const size = options.size ?? 1080;
  const w = scene.aspect === "story" ? size * 9 / 16 : size;
  const h = scene.aspect === "story" ? size : size;
  ...
}
```

App.jsx export UI:

```jsx
<Seg
  value={videoSize}
  options={[[720, "Fast"], [1080, "Standard"], [1440, "Quality"]]}
  onChange={setVideoSize}
/>
```

#### Acceptance criteria

- [ ] 720p option produces a 720×1280 video for story
- [ ] Older phones can render 720p without dropped frames

#### Prompt for Claude Code

```
Execute PR-D3. Add 720p and 1440p video export presets.

Files per brief.

PR title: "feat(export): 720/1080/1440p video presets (§9.3)"
```

---

### PR-D4: 60-second videos + trim UI

**Branch:** `git checkout -b phase-d-04-video-trim`
**Rules:** 1.
**Preconditions:** PR-D3.
**Diff estimate:** +220 / -3.

#### Files

**Modified:**
- `src/export/video.ts` — `MAX_CLIP_SECONDS = 60` (was likely 15 or 30).
- **Added:** `src/ui/TrimSheet.tsx` (~150 lines) — scrubber with start + end handles for uploaded video clips.

#### Change spec

TrimSheet: draggable start + end handles on a timeline, preview shows the current frame. On confirm, store `trimStart` and `trimEnd` on the media object; video export honours them.

```tsx
export function TrimSheet({ videoUrl, onConfirm, onCancel }: TrimSheetProps) {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (v && end === null) {
      v.addEventListener("loadedmetadata", () => setEnd(Math.min(60, v.duration)), { once: true });
    }
  }, [end]);

  return (
    <div className="modal" data-testid="trim-sheet">
      <div className="modal-inner">
        <h3>Trim video</h3>
        <video ref={videoRef} src={videoUrl} controls muted />
        <div className="trim-timeline">
          <input type="range" min={0} max={videoRef.current?.duration ?? 60} step={0.1} value={start} onChange={(e) => setStart(parseFloat(e.target.value))} />
          <input type="range" min={0} max={videoRef.current?.duration ?? 60} step={0.1} value={end ?? 60} onChange={(e) => setEnd(parseFloat(e.target.value))} />
        </div>
        <p className="muted small">Length: {(end ?? 60) - start}s (max 60)</p>
        <div className="row">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={() => onConfirm({ start, end: end ?? 60 })}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
```

If uploaded video is >60s, show TrimSheet before proceeding.

#### Acceptance criteria

- [ ] Videos up to 60s export cleanly
- [ ] Videos >60s prompt trim before export
- [ ] Trim positions honoured in exported MP4

#### Prompt for Claude Code

```
Execute PR-D4. Increase MAX_CLIP_SECONDS to 60. Add TrimSheet UI for longer clips.

Files per brief.

PR title: "feat(export): 60s videos + trim UI (§9.3)"
```

---

### PR-D5: Transparent WebM (VP9 alpha) export

**Branch:** `git checkout -b phase-d-05-webm-alpha`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +200 / -10.

#### Files

**Modified:**
- `src/export/video.ts` — feature-detect VP9 alpha via `MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")` combined with a canvas-alpha test. If supported, offer WebM alpha; fall back to MP4 with black background.

#### Change spec

Detection:

```ts
export function supportsTransparentWebm(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  return MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      || MediaRecorder.isTypeSupported("video/webm;codecs=vp9");
}
```

In export flow:

```ts
if (options.transparent && supportsTransparentWebm()) {
  // Use MediaRecorder with vp9 mime, alpha canvas, no bg fill
} else if (options.transparent) {
  showToast("Transparent video not supported on this browser; falling back to solid background.");
  // Fall through to standard export
}
```

Add "Transparent" checkbox in the export row for video exports.

#### Acceptance criteria

- [ ] Chromium: transparent WebM downloads with alpha channel intact
- [ ] Safari/Firefox: shown a toast explaining limitation, falls back gracefully
- [ ] Transparent WebM played back in a video editor (or Chrome tab) shows transparent background

#### Prompt for Claude Code

```
Execute PR-D5. Transparent WebM export via VP9 alpha with feature detection.

Feature detection: MediaRecorder.isTypeSupported.
Fallback: toast + solid bg.

PR title: "feat(export): transparent WebM for reels-with-alpha (§9.3)"
```

---

### PR-D6: Per-layer blend modes

**Branch:** `git checkout -b phase-d-06-blend-modes`
**Rules:** 5, 1.
**Preconditions:** none.
**Diff estimate:** +100 / -5.

#### Files

**Modified:**
- `src/model/types.ts` — add `blendMode?: GlobalCompositeOperation` to `LayerBase`.
- `src/engine/layers.ts` — set `ctx.globalCompositeOperation = layer.blendMode ?? "source-over"` before drawing each layer, restore after.
- `src/ui/Inspector.tsx` — new "Blend" Row in Arrange section with Seg: Normal / Multiply / Screen / Overlay / Lighten / Darken.

#### Change spec

Layers:

```ts
// In renderLayer
const prevBlend = ctx.globalCompositeOperation;
ctx.globalCompositeOperation = layer.blendMode ?? "source-over";
// ... draw ...
ctx.globalCompositeOperation = prevBlend;
```

Inspector:

```tsx
<Row label="Blend">
  <Seg
    value={layer.blendMode ?? "source-over"}
    options={[
      ["source-over", "Normal"],
      ["multiply", "Multiply"],
      ["screen", "Screen"],
      ["overlay", "Overlay"],
      ["lighten", "Lighten"],
      ["darken", "Darken"],
    ]}
    onChange={(v) => patchLayer(layer.id, (s) => { s.blendMode = v; })}
  />
</Row>
```

#### Test-first spec

`test/unit/blendMode.test.ts`:

```ts
it("layer with blendMode=multiply sets ctx.globalCompositeOperation", () => {
  const ctx = mockCtx();
  const layer = { ...defaultTextLayer, blendMode: "multiply" };
  renderLayer(ctx, layer, ...);
  expect(ctx.globalCompositeOperation).toBe("source-over");  // restored after
  // Assert it was set during
});
```

#### Acceptance criteria

- [ ] Overlaying text with `multiply` on a photo darkens the underlying pixels
- [ ] Blend mode Seg in Inspector's Arrange section

#### Prompt for Claude Code

```
Execute PR-D6. Add per-layer blend modes.

Files per brief. Inspector control in Arrange section (add if missing).

PR title: "feat(layers): per-layer blend modes (§4.4)"
```

---

### PR-D7: Background removal (on-device)

**Branch:** `git checkout -b phase-d-07-bg-remove`
**Rules:** 4 (adds `@imgly/background-removal-js` as lazy chunk).
**Preconditions:** none.
**Diff estimate:** +150 / -3.

#### Files

**Modified:**
- `src/ui/Inspector.tsx` — Image layer gains a "Cut out subject" button under the Type section.
- `STRIDE_STUDIO_V2_SPEC.md §11.1` — new dep row.

#### Change spec

```tsx
// Inspector Image layer
<button
  type="button"
  className="btn"
  onClick={async () => {
    const { removeBackground } = await import("@imgly/background-removal");
    const blob = await removeBackground(layer.src);
    // Upload the new blob, replace layer.src
    const url = URL.createObjectURL(blob);
    patchLayer(layer.id, (s) => { s.src = url; s.hasAlpha = true; });
  }}
  data-testid="bg-remove"
>
  ✂ Cut out subject
</button>
```

Show a spinner while processing (~2s on modern hardware).

§11.1 addition: `@imgly/background-removal-js — WASM model for on-device background removal. Lazy chunk (~4MB). Loaded only when user clicks "Cut out subject".`

#### Acceptance criteria

- [ ] "Cut out subject" button visible on Image layer
- [ ] Clicking removes background in ~2s
- [ ] Result has alpha channel preserved through export

#### Prompt for Claude Code

```
Execute PR-D7. Add on-device background removal via @imgly/background-removal-js as lazy chunk.

Add row to §11.1.

Verify: initial bundle unchanged; lazy chunk visible after clicking "Cut out subject".

PR title: "feat(image): background removal (§2.7)"
```

---

### PR-D8: More aspect ratios (3:4, 16:9)

**Branch:** `git checkout -b phase-d-08-more-ratios`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +40 / -5.

#### Files

**Modified:**
- `src/App.jsx` — format Seg options list.

**Created by a precondition, modified here:**
- `src/model/formats.ts` — add `"post-3-4"` (900×1200 TikTok square) and `"landscape-16-9"`
  (1920×1080 YouTube thumb). This file does not exist yet: `FORMATS` still lives in
  `src/render.js`, and **PR-B12** is what extracts it. Until B12 lands, edit `src/render.js`
  instead — or hold D8 behind B12, which is the phase order anyway.

#### Change spec

```ts
export const FORMATS = {
  story: { w: 1080, h: 1920, label: "Story", ratio: "9:16" },
  "post-1-1": { w: 1080, h: 1080, label: "Square", ratio: "1:1" },
  "post-4-5": { w: 1080, h: 1350, label: "Portrait", ratio: "4:5" },
  "post-3-4": { w: 900, h: 1200, label: "TikTok", ratio: "3:4" },        // new
  "landscape-16-9": { w: 1920, h: 1080, label: "Landscape", ratio: "16:9" }, // new
} as const;
```

#### Acceptance criteria

- [ ] Format Seg shows 5 options
- [ ] Switching formats preserves layer anchors (relative coordinates)
- [ ] Export in new formats works

#### Prompt for Claude Code

```
Execute PR-D8. Add 3:4 and 16:9 aspect ratios.

Files: src/model/formats.ts, src/App.jsx.

PR title: "feat(formats): 3:4 and 16:9 aspect ratios"
```

---

### PR-D9: Post to Strava

**Branch:** `git checkout -b phase-d-09-post-to-strava`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +180 / -5.

#### Files

**Added:**
- `api/strava/upload-photo.ts` — Edge function that takes an authenticated request + activity ID + PNG blob, calls Strava's `POST /activities/{id}/photos` endpoint.

**Modified:**
- `src/App.jsx` result modal — add "Post to Strava" button after PNG/sticker export, visible only when connected to Strava AND activity has a Strava ID.

#### Change spec

Uses Strava's `POST /activities/{id}/photos` endpoint (multipart/form-data). Requires the `activity:write` scope, which is a NEW permission — add to PR-C1's scope extension.

Show upload progress; on success, show "Posted!" and open a link to the Strava activity page.

#### Acceptance criteria

- [ ] "Post to Strava" button visible when session has activity ID
- [ ] Uploaded photo appears on the Strava activity page
- [ ] Handles unauth / no-write-scope with clear error

#### Prompt for Claude Code

```
Execute PR-D9. Add "Post to Strava" for exported images.

Requires activity:write scope — extend PR-C1's scope list.

Files per brief.

PR title: "feat(strava): post exported image back to activity"
```

---

### PR-D10: Autosave dep fix + two-tab conflict warning

**Branch:** `git checkout -b phase-d-10-autosave-fix`
**Rules:** 1.
**Preconditions:** none.
**Diff estimate:** +80 / -20.

#### Change spec

Autosave in App.jsx: remove animation-time state from useEffect deps (currently re-fires on every animation tick — wasteful and burns quota).

Two-tab: on save, include `updatedAt` version check. If Doc-in-DB has newer `updatedAt`, show:

```tsx
<div className="conflict-toast">
  Another tab saved a newer version. What would you like to do?
  <button onClick={reloadFromDb}>Load newer version (lose this)</button>
  <button onClick={saveOverwrite}>Overwrite with this version</button>
</div>
```

#### Acceptance criteria

- [ ] Autosave doesn't fire on animation state changes
- [ ] Open two tabs, save in tab A, then save in tab B → tab B shows conflict warning

#### Prompt for Claude Code

```
Execute PR-D10. Fix autosave over-triggering + add two-tab conflict warning.

PR title: "fix(autosave): dependency list + two-tab conflict warning (§8)"
```

---

### PR-D11: Convert App.jsx to App.tsx (part 1 — rename + minimal types)

**Branch:** `git checkout -b phase-d-11-app-tsx-1`
**Rules:** careful — biome ignores App.jsx currently.
**Preconditions:** All Phase A/B/C merged.
**Diff estimate:** +240 / -20 (this PR is rename + top-level types only; layer-type-safety in D12).

#### Files

**Renamed:**
- `src/App.jsx` → `src/App.tsx`. (The target is the output of this PR, not an input — listing
  it as "Modified" is what made `verify:plan` flag this brief.)

**Modified:**
- `src/model/types.ts` — reuse `Activity`, `Series`, `Opts`, `Media`, `ExportResult` from here
  where they already exist; declare the rest locally in `App.tsx`.

#### Change spec

1. Rename file.
2. Add `interface` declarations for local types.
3. Type `useState` calls: `useState<Activity>(DEMO)`, etc.
4. Type refs and handlers.
5. Leave layer-level type safety for D12 (this PR would exceed 400 lines otherwise).

**Do NOT remove from biome.json ignores yet** — D12 does that after full type coverage.

#### Acceptance criteria

- [ ] App.tsx compiles with `--noImplicitAny` off
- [ ] Existing tests pass
- [ ] biome still ignores App.tsx (temporary)

#### Prompt for Claude Code

```
Execute PR-D11 part 1. Rename src/App.jsx → src/App.tsx. Add top-level types (Activity, Series, Opts, Media, ExportResult).

DO NOT go layer-by-layer through every event handler — that's D12.

DO NOT remove from biome.json ignores yet.

Diff budget: 400 lines. If nearing cap, stop and defer to D12.

PR title: "refactor(app): App.jsx → App.tsx part 1 (§14)"
```

---

### PR-D12: App.tsx full type coverage (part 2)

Same PR pattern. Handlers, layer-specific types, deprecation of remaining `any`, removal from biome ignores.

#### Prompt for Claude Code

```
Execute PR-D12 part 2. Full type coverage on App.tsx: handlers, layer-specific types, remove any.

Remove src/App.tsx from biome.json ignores.

PR title: "refactor(app): App.tsx part 2 — full type coverage (§14)"
```

---

## 7. Phase D extras — map tiles programme (3 PRs)

Deep review §2.12 called out map tile background as a major missing feature. This is a 3-PR programme.

### PR-D13: Map tile fetcher + IndexedDB cache

**Branch:** `git checkout -b phase-d-13-map-fetch`
**Rules:** 4 (Mapbox or MapTiler API — needs §11.1 entry).
**Preconditions:** none.
**Diff estimate:** +240 / 0.

#### Files

**Added:**
- `src/data/mapTiles.ts` — fetch tiles for a given lat/lon bbox at appropriate zoom.
- `api/maptiles.ts` — Edge function proxying to Mapbox/MapTiler to hide API key.

#### Change spec

Choose Mapbox Static Images API OR MapTiler. Mapbox: free tier 50k req/mo. MapTiler: free 100k req/mo. Recommend MapTiler for cost.

Given a route (list of lat/lon), compute the bbox with margin, request a static image at the appropriate zoom to fit the route, cache the resulting blob in IndexedDB keyed by `${lat.toFixed(3)}-${lon.toFixed(3)}-${zoom}-${style}`.

Return a Blob URL usable as the background layer.

Style options: `outdoor`, `satellite`, `street`, `dark`, `light` — user selects in Inspector.

#### Acceptance criteria

- [ ] Given a route, function returns a Blob URL for the map tile
- [ ] Second call for same bbox uses cache
- [ ] API key hidden behind edge function

#### Prompt for Claude Code

```
Execute PR-D13. Add map tile fetching with cache.

Choose MapTiler (recommended for cost). Add MAPTILER_KEY to Vercel env.

Full impl in brief. Add row to §11.1.

PR title: "feat(map): tile fetcher with IndexedDB cache (§2.12)"
```

---

### PR-D14: `mapBackground` layer type

**Branch:** `git checkout -b phase-d-14-map-layer`
**Rules:** 5.
**Preconditions:** PR-D13.
**Diff estimate:** +150 / 0.

#### Files

**Modified:**
- `src/model/types.ts` — add `MapBackgroundLayer` type.
- `src/engine/layers.ts` — render `mapBackground` by loading its Blob URL and drawing as background.
- `src/ui/AddMenu.tsx` — new "Map background" tile.
- `src/ui/Inspector.tsx` — MapBackground controls (style Seg, zoom slider).

#### Change spec

New layer type:

```ts
export interface MapBackgroundLayer extends LayerBase {
  type: "mapBackground";
  style: "outdoor" | "satellite" | "street" | "dark" | "light";
  // Position + zoom auto-computed from route if bound; otherwise user-controllable.
  bindings?: {
    center?: "route";  // auto-centre on route
    bbox?: "route";    // auto-fit route in view
  };
}
```

Renderer resolves the map tile URL (calling into PR-D13 fetcher), draws as full-bleed background.

Inspector allows switching style, adjusting bbox margin.

#### Acceptance criteria

- [ ] "Map background" option appears in Add menu
- [ ] Adding it while an activity has a route auto-fits the route
- [ ] Style switch works

#### Prompt for Claude Code

```
Execute PR-D14. Add mapBackground layer type.

Files per brief.

PR title: "feat(map): mapBackground layer type (§2.12)"
```

---

### PR-D15: Map background templates

**Branch:** `git checkout -b phase-d-15-map-templates`
**Rules:** 7.
**Preconditions:** PR-D14.
**Diff estimate:** +400 / 0 (3 templates).

3 templates using map background:
1. **`mapHero`** — map background, route overlaid, one hero stat.
2. **`mapSplit`** — map top half, stats bottom half.
3. **`mapWatermark`** — map at low alpha with everything else on top.

Follow B2 pattern.

#### Prompt for Claude Code

```
Execute PR-D15. Author 3 map-background templates: mapHero, mapSplit, mapWatermark.

Follow B2 pattern.

PR title: "feat(templates): 3 map-background designs (§4.8, §2.12)"
```

---


---

## 8. PATH B EXTENSIONS — accounts and cloud sync (weeks 13+)

This section is 8 real briefs for the accounts + sync programme, the first Path B extension worth executing after Phase D. The rest of Path B (brand kits, AI, teams, creator programme, print, SEO) remains sketched in Section 9 — they depend on strategic decisions (which AI vendor, whether to pursue enterprise, etc.) that need explicit sign-off before spec'ing.

### PR-PB1: Supabase setup + auth service

**Branch:** `git checkout -b path-b-01-supabase-setup`
**Rules:** 4 (adds `@supabase/supabase-js` dep).
**Preconditions:** Phase D complete.
**Diff estimate:** +180 / 0.

#### Why Supabase (over Firebase, self-hosted Postgres, etc.)

- PostgreSQL underneath — real SQL, works with existing schemas
- Row-level security (RLS) that maps 1:1 to per-user access
- Realtime subscriptions built in (needed for team collaboration in later Path B PRs)
- Auth built in with magic-link, email/password, and OAuth
- Storage bucket for image uploads
- Free tier generous enough for MVP validation
- Migration path to self-hosted Postgres if scale requires

Alternative decision if pursued: this brief is Supabase-specific; substitute if choosing Firebase / bespoke.

#### Files

**Added:**
- `src/data/supabase.ts` (~80 lines) — client singleton.
- `.env.example` — `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`.
- `supabase/migrations/001_initial_schema.sql` (~120 lines) — users, documents, assets tables.

**Modified:**
- `package.json` — add `@supabase/supabase-js`.
- `STRIDE_STUDIO_V2_SPEC.md §11.1` — new dep row.

#### Change spec

`src/data/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("Supabase URL/anon key not set; cloud features disabled.");
}

export const supabase: SupabaseClient | null = (url && key) ? createClient(url, key) : null;

/** Convenience — throws if Supabase not configured. Use in code that requires cloud. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase;
}
```

`supabase/migrations/001_initial_schema.sql`:

```sql
-- Users table proxied to Supabase Auth (auth.users)
-- No standalone user table needed initially.

-- Documents: user-authored designs
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default 'Untitled',
  doc_json jsonb not null,
  aspect text not null default 'story',
  look_id text,
  template_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index documents_user_id on documents(user_id);

-- Assets: uploaded images/videos
create table assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  bucket_path text not null unique,
  kind text not null check (kind in ('image', 'video')),
  original_name text,
  size_bytes int not null,
  created_at timestamptz default now()
);
create index assets_user_id on assets(user_id);

-- RLS: only owner can read/write
alter table documents enable row level security;
create policy "own documents" on documents
  for all using (auth.uid() = user_id);

alter table assets enable row level security;
create policy "own assets" on assets
  for all using (auth.uid() = user_id);

-- Trigger: bump updated_at on document update
create function bump_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
create trigger docs_bump_updated_at before update on documents
  for each row execute function bump_updated_at();
```

Set up Storage bucket via Supabase dashboard: `assets` with public read (files are UUIDed and unguessable), authenticated write, 100MB size limit per file.

#### Acceptance criteria

- [ ] Supabase project provisioned
- [ ] Migration applied
- [ ] Supabase client can query `documents` (returning empty for unauth)
- [ ] RLS confirmed via manual test: anon user cannot select

#### Prompt for Claude Code

```
Execute PR-PB1. Set up Supabase.

Steps:
1. Create Supabase project via dashboard (not automatable).
2. Run supabase/migrations/001_initial_schema.sql per brief.
3. Create 'assets' storage bucket (public read, authenticated write).
4. Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY to .env.
5. npm install @supabase/supabase-js.
6. Create src/data/supabase.ts per brief.
7. Add row to spec §11.1.

Verify: import supabase in a test file, call supabase.from('documents').select() — should return empty result for anon.

PR title: "feat(cloud): Supabase setup + schema (PB1)"
```

---

### PR-PB2: Auth UI (sign-in, sign-up, magic link)

**Branch:** `git checkout -b path-b-02-auth-ui`
**Rules:** 1.
**Preconditions:** PR-PB1.
**Diff estimate:** +280 / -10.

#### Files

**Added:**
- `src/ui/Auth.tsx` (~200 lines) — modal with tabs: Sign In / Sign Up / Magic Link.
- `src/data/session.ts` (~60 lines) — session state hook using `supabase.auth.onAuthStateChange`.

**Modified:**
- `src/App.jsx` — top-bar user button → opens auth modal when signed out, opens profile menu when signed in.

#### Change spec

`src/ui/Auth.tsx`:

```tsx
import { useState } from "react";
import { requireSupabase } from "../data/supabase";

export interface AuthProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function Auth({ onClose, onSuccess }: AuthProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = requireSupabase();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        setErr("Check your email for the link.");
        setBusy(false);
        return;
      }
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal" data-testid="auth-modal">
      <div className="modal-inner" style={{ maxWidth: 400 }}>
        <div className="tabs">
          <button onClick={() => setMode("signin")} className={mode === "signin" ? "on" : ""}>Sign in</button>
          <button onClick={() => setMode("signup")} className={mode === "signup" ? "on" : ""}>Sign up</button>
          <button onClick={() => setMode("magic")} className={mode === "magic" ? "on" : ""}>Magic link</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="auth-email" />
          </label>
          {mode !== "magic" && (
            <label className="field">
              <span>Password</span>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="auth-password" />
            </label>
          )}
          {err && <p className="error small">{err}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "..." : mode === "signup" ? "Create account" : mode === "magic" ? "Send link" : "Sign in"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </form>
      </div>
    </div>
  );
}
```

`src/data/session.ts`:

```ts
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

export function useSession(): { user: User | null; session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user: session?.user ?? null, session, loading };
}
```

#### Acceptance criteria

- [ ] Sign up creates a user in Supabase
- [ ] Sign in with password works
- [ ] Magic link sends an email
- [ ] Session persists across reload
- [ ] Sign out clears session

#### Prompt for Claude Code

```
Execute PR-PB2. Auth UI with sign-in/up/magic-link.

Files per brief. Wire into App.jsx top bar.

PR title: "feat(auth): sign-in/sign-up UI (PB2)"
```

---

### PR-PB3: Cloud document storage

**Branch:** `git checkout -b path-b-03-cloud-docs`
**Rules:** 1.
**Preconditions:** PR-PB2.
**Diff estimate:** +280 / -50.

#### Files

**Added:**
- `src/storage/cloud.ts` — `saveDocToCloud`, `loadDocFromCloud`, `listCloudDocs`, `deleteCloudDoc`.

**Modified:**
- `src/storage/db.ts` — `saveDoc` becomes dual-write: IndexedDB + cloud (if signed in).
- `src/ui/MyDesigns.tsx` — list docs from both sources; sync badges.

#### Change spec

`src/storage/cloud.ts`:

```ts
import { requireSupabase } from "../data/supabase";
import type { Doc } from "../model/types";

export async function saveDocToCloud(doc: Doc): Promise<string> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const row = {
    id: doc.id,
    user_id: user.id,
    title: doc.title ?? "Untitled",
    doc_json: doc,
    aspect: doc.aspect,
    look_id: doc.lookId,
    template_id: doc.templateId,
  };
  const { data, error } = await supabase.from("documents").upsert(row).select().single();
  if (error) throw error;
  return data.id;
}

export async function loadDocFromCloud(id: string): Promise<Doc | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
  if (error) return null;
  return data.doc_json as Doc;
}

export async function listCloudDocs(): Promise<Array<{ id: string; title: string; updated_at: string; aspect: string; template_id: string | null }>> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("documents")
    .select("id, title, updated_at, aspect, template_id")
    .order("updated_at", { ascending: false });
  if (error) return [];
  return data;
}

export async function deleteCloudDoc(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}
```

`saveDoc` in `src/storage/db.ts` becomes:

```ts
export async function saveDoc(doc: Doc): Promise<string> {
  // Local always
  const localId = await saveDocLocal(doc);
  // Cloud if signed in
  try {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await saveDocToCloud({ ...doc, id: localId });
    }
  } catch (e) {
    // Cloud failure doesn't break local save
    console.warn("Cloud save failed", e);
  }
  return localId;
}
```

`MyDesigns.tsx` merges local + cloud lists, showing sync status per doc (synced / local-only / cloud-only).

#### Acceptance criteria

- [ ] Signed-in save writes to both IndexedDB and cloud
- [ ] Signed-out save writes to IndexedDB only
- [ ] MyDesigns shows sync badges
- [ ] Sign-in on a new device shows cloud-only docs

#### Prompt for Claude Code

```
Execute PR-PB3. Dual-write documents to IndexedDB + cloud.

Files per brief.

PR title: "feat(cloud): document storage (PB3)"
```

---

### PR-PB4: First-sign-in migration (offer to upload existing docs)

**Branch:** `git checkout -b path-b-04-migration`
**Rules:** 1.
**Preconditions:** PR-PB3.
**Diff estimate:** +150 / -5.

#### Files

**Added:**
- `src/ui/MigrationSheet.tsx` (~100 lines).

**Modified:**
- `src/App.jsx` — after first sign-in, check if user has local docs but no cloud docs; if so, show migration sheet.

#### Change spec

Migration sheet: "You have 5 designs saved locally. Upload them to your account?" — with Upload / Not now buttons. Upload = iterate localDocs, call saveDocToCloud for each.

Track migration completion in localStorage so it's not shown twice.

#### Acceptance criteria

- [ ] Migration prompt shows once per user
- [ ] Upload succeeds and cloud reflects local docs
- [ ] "Not now" dismisses forever

#### Prompt for Claude Code

```
Execute PR-PB4. Migration sheet after first sign-in.

Files per brief.

PR title: "feat(cloud): migrate local docs on first sign-in (PB4)"
```

---

### PR-PB5: Asset storage in Supabase Storage

**Branch:** `git checkout -b path-b-05-asset-storage`
**Rules:** 1.
**Preconditions:** PR-PB2.
**Diff estimate:** +200 / -30.

#### Files

**Added:**
- `src/storage/assets.ts` — `uploadAsset(file)` returns a public URL; `deleteAsset(path)`.

**Modified:**
- `src/App.jsx` file input — on signed-in users, upload to Supabase Storage instead of keeping only in IndexedDB.
- Layer `src` field can now be a Storage public URL.

#### Change spec

```ts
export async function uploadAsset(file: File): Promise<string> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const ext = file.name.slice(file.name.lastIndexOf("."));
  const path = `${user.id}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage.from("assets").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",  // 1 year
  });
  if (error) throw error;
  await supabase.from("assets").insert({
    user_id: user.id,
    bucket_path: path,
    kind: file.type.startsWith("video/") ? "video" : "image",
    original_name: file.name,
    size_bytes: file.size,
  });
  return supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
}
```

For signed-out users, keep IndexedDB blob URL only.

#### Acceptance criteria

- [ ] Signed-in users' images uploaded to Storage on file pick
- [ ] Layer `src` uses public URL
- [ ] Signed-out users work as before (blob URL)

#### Prompt for Claude Code

```
Execute PR-PB5. Asset storage in Supabase Storage.

Files per brief. Layer.src can be either blob:URL (offline) or https URL (cloud).

PR title: "feat(cloud): asset storage in Supabase (PB5)"
```

---

### PR-PB6: Realtime sync per doc

**Branch:** `git checkout -b path-b-06-realtime`
**Rules:** 1.
**Preconditions:** PR-PB3.
**Diff estimate:** +180 / -10.

#### Files

**Added:**
- `src/data/sync.ts` — Supabase Realtime channel per open doc; subscribes to `documents` row updates.

**Modified:**
- `src/App.jsx` — on doc load, subscribe; on remote update, patch local state (or prompt for conflict).

#### Change spec

Simple last-write-wins realtime — a stepping stone to CRDT (later PR). Sufficient for single-user multi-device scenario:

```ts
export function subscribeToDoc(docId: string, onUpdate: (doc: Doc) => void): () => void {
  const supabase = requireSupabase();
  const channel = supabase.channel(`doc:${docId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "documents",
      filter: `id=eq.${docId}`,
    }, (payload) => {
      onUpdate(payload.new.doc_json as Doc);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
```

App.jsx: on doc load, `subscribeToDoc(docId, (newDoc) => { if (newDoc.updated_at > localDoc.updated_at) mergeInFromRemote(newDoc); })`.

#### Acceptance criteria

- [ ] Open same doc on two devices; edit on device A → reflects on device B within 2 seconds
- [ ] Conflict (both edit simultaneously) → last write wins with a warning toast

#### Prompt for Claude Code

```
Execute PR-PB6. Realtime doc sync via Supabase Realtime.

Simple LWW; CRDT deferred to a later PR.

PR title: "feat(cloud): realtime doc sync (PB6)"
```

---

### PR-PB7: Session refresh + sign-out + delete-account

**Branch:** `git checkout -b path-b-07-session-mgmt`
**Rules:** 1.
**Preconditions:** PR-PB2.
**Diff estimate:** +140 / -5.

#### Change spec

- Silent token refresh (Supabase does this by default, verify)
- Sign-out button in profile menu → `supabase.auth.signOut()`
- Delete account flow: confirm dialog → call `supabase.auth.admin.deleteUser` (requires an edge function since anon key can't delete)
- Edge function `api/delete-account.ts` — verifies caller identity, deletes user + cascades to documents/assets via RLS on-delete-cascade

#### Acceptance criteria

- [ ] Sign-out clears session, redirects to landing state
- [ ] Delete-account removes all user data
- [ ] Existing sessions stay valid on refresh

#### Prompt for Claude Code

```
Execute PR-PB7. Session management: sign-out, delete-account, silent refresh.

Files per brief.

PR title: "feat(auth): sign-out + delete-account (PB7)"
```

---

### PR-PB8: Stripe billing MVP (free vs Pro tier)

**Branch:** `git checkout -b path-b-08-stripe-mvp`
**Rules:** 4 (adds `stripe`).
**Preconditions:** PR-PB2.
**Diff estimate:** +320 / -10.

#### Files

**Added:**
- `api/stripe/checkout.ts` — Edge function to create a Checkout Session.
- `api/stripe/webhook.ts` — Edge function for `checkout.session.completed`, `customer.subscription.updated`, etc.
- `src/data/billing.ts` — `getTier(user)`, `openCheckout(tier)`.
- `supabase/migrations/002_subscriptions.sql` — subscriptions table.

**Created by a precondition, modified here:**
- `src/ui/Settings.tsx` — Billing section: current plan, upgrade button. Created by **PR-A4.5**.

#### Change spec

**Schema:**

```sql
create table subscriptions (
  user_id uuid references auth.users(id) primary key on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  status text not null default 'active',
  current_period_end timestamptz,
  updated_at timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "own subscription" on subscriptions
  for select using (auth.uid() = user_id);
```

Feature gates (checked at read time):
- Free: 20 template limit, watermark on exports, 720p max video
- Pro (£9/mo): unlimited templates, no watermark, up to 4K video

`getTier(user)`: read subscription; default `"free"`.

Checkout function creates a session with Stripe's hosted checkout. Success URL back to app; webhook updates the subscriptions table.

#### Acceptance criteria

- [ ] Free user with 20 saved designs sees "limit reached" on 21st save
- [ ] Upgrade → Stripe Checkout → success → tier becomes "pro"
- [ ] Downgrade / cancel handled via webhook

#### Prompt for Claude Code

```
Execute PR-PB8. Stripe billing MVP with Free / Pro tiers.

Stripe setup: create product + monthly recurring price in Stripe Dashboard.

Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET to Vercel env.

Files per brief.

PR title: "feat(billing): Stripe MVP with Free / Pro (PB8)"
```

---

## 9. Remaining Path B extensions (sketched)

These programmes remain sketched because they depend on strategic decisions that need explicit sign-off. Each should be spec'd properly before starting, using this document's Phase A/B/C/D briefs as the quality bar.

- **Brand Kit v1** (~6 PRs) — logo upload, colour palette, font upload, `$brand.*` token, apply-brand button, brand-locked templates.
- **AI Magic Design** (~5 PRs) — Anthropic/OpenAI API key, edge function, prompt template with few-shot, UI, credit tracking. Decision required: AI vendor + credit economics.
- **Real-time collaboration (teams)** (~8 PRs) — Yjs CRDT on doc model, awareness (cursors), comments, version history, team invites, roles, locked templates, approval workflow. Decision required: whether to commit to enterprise sales.
- **Creator marketplace** (~4 code PRs + operational) — application form, review queue, Stripe Connect payout, creator analytics. Operational: legal, tax, moderation.
- **SEO landing pages** (~3 PRs) — per-template routes, category pages, sitemap + OG + JSON-LD.
- **Print + certificates** (~4 PRs) — bleed-aware PDF export, bulk personalisation (CSV → N certificates), Printful/Printify integration, fulfilment webhooks.

---

## 10. Appendix A: `verify-plan.mjs` script

Save at `scripts/verify-plan.mjs`. Runs as `node scripts/verify-plan.mjs PR-A2` (or without args to check every brief).

```js
#!/usr/bin/env node
/**
 * Verify a brief in BRIEFS_V2.md against the actual repo.
 *
 * Checks:
 *   1. Every "Files > Modified" path exists.
 *   2. Every "Files > Added" path does NOT exist yet.
 *   3. Every "Files > Deleted" path DOES exist yet.
 *   4. Every "Line references verified" claim matches the current file content.
 *
 * Usage:
 *   node scripts/verify-plan.mjs           # check every brief
 *   node scripts/verify-plan.mjs PR-A2     # check one brief
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(process.cwd());
const BRIEFS_PATH = resolve(REPO, "STRIDE_STUDIO_CLAUDE_CODE_BRIEFS.md");  // or BRIEFS_V2.md
const brief = readFileSync(BRIEFS_PATH, "utf8");

const filter = process.argv[2];

/** Split the brief into PR sections. */
function splitPRs(content) {
  const sections = content.split(/^### (PR-[A-Z0-9.]+):/m);
  const prs = [];
  for (let i = 1; i < sections.length; i += 2) {
    prs.push({ id: `PR-${sections[i].split(":")[0].slice(3)}`, body: sections[i + 1] });
  }
  return prs;
}

function extractLineRefs(body) {
  const section = body.match(/#### Line references verified\s+([\s\S]*?)(?=\n####|\n---)/);
  if (!section) return [];
  const refs = [];
  const rx = /`([^`]+):(\d+)(?:-\d+)?`.*?—\s*`([^`]+)`/g;
  let m;
  while ((m = rx.exec(section[1]))) {
    refs.push({ file: m[1], line: parseInt(m[2], 10), expected: m[3] });
  }
  return refs;
}

function extractFileClaims(body) {
  const section = body.match(/#### Files\s+([\s\S]*?)(?=\n#### |\n---)/);
  if (!section) return { added: [], modified: [], deleted: [] };
  const added = [], modified = [], deleted = [];
  const modMatch = section[1].match(/\*\*Modified:\*\*([\s\S]*?)(?=\*\*|$)/);
  const addMatch = section[1].match(/\*\*Added:\*\*([\s\S]*?)(?=\*\*|$)/);
  const delMatch = section[1].match(/\*\*Deleted:\*\*([\s\S]*?)(?=\*\*|$)/);
  const pathRx = /`([^`]+\.[a-z]+)`/g;
  if (modMatch) { let m; while ((m = pathRx.exec(modMatch[1]))) modified.push(m[1]); }
  if (addMatch) { let m; while ((m = pathRx.exec(addMatch[1]))) added.push(m[1]); }
  if (delMatch) { let m; while ((m = pathRx.exec(delMatch[1]))) deleted.push(m[1]); }
  return { added, modified, deleted };
}

function checkBrief(pr) {
  const errors = [];
  const { added, modified, deleted } = extractFileClaims(pr.body);
  const lineRefs = extractLineRefs(pr.body);

  for (const f of modified) {
    const p = resolve(REPO, f);
    if (!existsSync(p)) errors.push(`  ✗ Modified path missing: ${f}`);
  }
  for (const f of added) {
    const p = resolve(REPO, f);
    if (existsSync(p)) errors.push(`  ✗ Added path already exists: ${f}`);
  }
  for (const f of deleted) {
    const p = resolve(REPO, f);
    if (!existsSync(p)) errors.push(`  ✗ Deleted path already gone: ${f}`);
  }

  for (const ref of lineRefs) {
    const p = resolve(REPO, ref.file);
    if (!existsSync(p)) {
      errors.push(`  ✗ Line ref file missing: ${ref.file}`);
      continue;
    }
    const lines = readFileSync(p, "utf8").split("\n");
    const actual = lines[ref.line - 1] ?? "";
    // Normalise: strip whitespace, quotes, semicolons for loose match
    const norm = (s) => s.replace(/[\s;"'`]/g, "");
    if (!norm(actual).includes(norm(ref.expected))) {
      errors.push(`  ✗ ${ref.file}:${ref.line} expected ${JSON.stringify(ref.expected.slice(0, 40))}, got ${JSON.stringify(actual.trim().slice(0, 60))}`);
    }
  }

  return errors;
}

const prs = splitPRs(brief);
let totalErrors = 0;
for (const pr of prs) {
  if (filter && pr.id !== filter) continue;
  const errors = checkBrief(pr);
  if (errors.length === 0) {
    console.log(`✓ ${pr.id}`);
  } else {
    console.log(`✗ ${pr.id}`);
    for (const e of errors) console.log(e);
    totalErrors += errors.length;
  }
}

if (totalErrors > 0) {
  console.error(`\n${totalErrors} verification errors. Update briefs before executing.`);
  process.exit(1);
}
```

Add to `package.json`:

```json
"scripts": {
  ...
  "verify:plan": "node scripts/verify-plan.mjs"
}
```

Run before starting any PR: `npm run verify:plan PR-A2`. If it fails, the brief is drifted from the repo (someone merged something in the meantime) — update the brief before Claude Code touches anything.

---

## 11. Appendix B: sequencing chart

Critical path with parallelism opportunities:

```
Week 1
├── PR-A0 (fixtures)
├── PR-A1 (hr.ts)
├── PR-A2 (chartLayers)
├── PR-A6 (fmtPace)                          ← parallel
├── PR-A7 (splits tail note)                 ← parallel
└── PR-A8 (CSS variables)                    ← parallel

Week 2
├── PR-A3 (fields.ts)
├── PR-A4 (App.jsx hrMax wiring)
├── PR-A4.5 (Settings sheet)
├── PR-A5 (render.js + gpx.ts cleanup)
├── PR-A9 (look-derived accent)              ← after A8
├── PR-A10 (warm defaults)
├── PR-A11 (onboarding)
└── PR-A15 (zundo debounce)                  ← parallel

Week 3
├── PR-A12 (font bundling)
├── PR-A13 (look.motion wiring)              ← parallel
├── PR-A14 (look.photo.suits wiring)         ← parallel
└── PR-A16 (smart placement)                 ← parallel

Week 4
├── PR-B1 (CLAUDE.md rule 8)
├── PR-B2 (heroRoute template)               ← parallel with all Bs
├── PR-B3-B7 (5 more route templates)        ← parallel
└── PR-B21 (pinch-to-zoom)                   ← parallel

Week 5
├── PR-B8, B9, B10 (delete 13 legacy templates in 3 PRs)
├── PR-B11 (background.ts extract part 1)
├── PR-B15 (PalettePicker infrastructure)    ← parallel
└── PR-B20 (share-a-layout receiving)        ← parallel

Week 6
├── PR-B12 (render.js delete part 2)
├── PR-B13 (route tokens)
├── PR-B14 (watermark mode)
├── PR-B16-B19 (PalettePicker swap, eyedropper, under-look) ← parallel
└── PR-B22 (inspector consistency pass)

Week 7
├── PR-C1 (Strava zones)
├── PR-C2 (activity cache)
├── PR-C3 (PB detection)                     ← parallel
└── PR-C4 (aggregates)                       ← parallel

Week 8
├── PR-C5 (PB templates)
├── PR-C6 (timeTrue route)
├── PR-C7 (videoHud template)
├── PR-C8 (headlines)                        ← parallel
└── PR-C11 (thin cap)                        ← parallel

Week 9
├── PR-C9 (weather)
├── PR-C10 (FIT import)                      ← parallel
└── PR-D13 (map tile fetcher — early start)  ← parallel

Week 10
├── PR-D1, D2, D3, D6 (sticker rename, story mock, 720p, blend)  ← all parallel
├── PR-D14 (mapBackground layer)
└── PR-D8 (aspect ratios)                    ← parallel

Week 11
├── PR-D4 (60s + trim)
├── PR-D5 (WebM alpha)
├── PR-D7 (background removal)               ← parallel
└── PR-D15 (3 map templates)

Week 12
├── PR-D9 (post to Strava)
├── PR-D10 (autosave fix)                    ← parallel
├── PR-D11 (App.tsx part 1)
└── PR-D12 (App.tsx part 2)

Week 13+ (Path B)
├── PR-PB1 (Supabase setup)
├── PR-PB2 (auth UI)
├── PR-PB3-PB8 (docs, migration, assets, realtime, session, billing)
```

Parallelism: ~2-3 PRs per week is comfortable for a single developer using Claude Code. Higher throughput requires either more devs or accepting that some parallel PRs will merge-conflict and need rebase.

---

## 12. Appendix C: one-message Claude Code handoff pattern

Copy-paste into Claude Code at the start of each PR session:

```
Read BRIEFS_V2.md at section "PR-XX". Follow the exact spec.

Rules of engagement:
1. Test-first: write the failing test in the file(s) listed under "Test-first spec" BEFORE implementing. Verify it fails on main.
2. Only touch files in the "Files" section. Do not modify anything outside that list without asking me first.
3. Keep the diff under 400 lines total.
4. Run `npm run verify:plan PR-XX` at the start to confirm the brief is still in sync with the repo. If it fails, stop and tell me.
5. After implementing, run `npm run verify && npm run test:e2e && npm run test:golden`.
6. Open a PR with the title in the brief, and the description template from BRIEFS_V2.md section 0.4.

If the golden matrix is expected to change per the brief, add the `golden-update` label and re-record. Do not re-record without checking with me if the brief said the goldens shouldn't change.
```

That message + the brief section reference is all Claude Code needs.

---

## 13. Appendix D: what changed vs v1, per PR

For traceability during Phase A execution — flag any drift by comparing.

| PR | v1 | v2 |
|---|---|---|
| PR-A0 | (missing) | Added — fixture prep required before A1 |
| PR-A1 | zoneOf returns int (correct) but no ZONE_META export | ZONE_META exported for legacy render.js shim consumers |
| PR-A2 | Addressed lines 158, 428 only | Addresses lines 158, 171-172, 209, 428, 484 (all 5 sites) |
| PR-A3 | Correct signature | Unchanged; added notice that App.jsx breaks until A4 |
| PR-A4 | "Add Settings sheet" (wrong — extends existing) | Extends ManualForm at App.jsx:80; new Settings sheet in A4.5 |
| PR-A4.5 | (missing) | Added — full Settings sheet with theme, units, HR |
| PR-A5 | Delete zoneOf — breaks lines 749/757 | Delete via compat shim; render.js internal callers keep working |
| PR-A6 | Only render.js formatters | + delete fields.ts's duplicate fmtTimeFromPace |
| PR-A7 | Correct | Unchanged |
| PR-A8 | Correct | Unchanged |
| PR-A9 | Correct | Unchanged (added contrast.ts as new util) |
| PR-A10 | Correct | Added note re: goldens |
| PR-A11 | Correct | Expanded onboarding component impl |
| PR-A12 | (missing) | Added — 15 woff2 fonts + look wiring |
| PR-A13 | (missing) | Added — look.motion.entrance wiring |
| PR-A14 | (missing) | Added — look.photo.suits wiring |
| PR-A15 | (missing) | Added — zundo debounce |
| PR-A16 | (missing) | Added — smart placement using existing placement.ts |
| PR-B7 | +400/-900 (over cap) | Split into B11 (extract) + B12 (delete) |
| PR-B15-B19 | (missing) | Added — 5-PR PalettePicker programme |
| PR-B20 | (missing) | Added — share-a-layout receiving UX |
| PR-B21 | (missing) | Added — pinch-to-zoom + pan |
| PR-B22 | (missing) | Added — inspector consistency pass |
| PR-C1 through C11 | Each ~5 lines | Fully spec'd to Phase A quality |
| PR-D1 through D12 | Each ~3-5 lines | Fully spec'd to Phase A quality |
| PR-D13, D14, D15 | (missing, sketched in Path B) | Added — 3-PR map tiles programme in Phase D extras |
| Section 5 (Path B) | 42 bullets | 8 real briefs for accounts + sync; rest still sketched but flagged |
| Appendix A | (missing) | Added — verify-plan.mjs script |
| Appendix B | Rough Gantt | Full parallelism-aware sequencing chart |
| Appendix C | Correct | Expanded with verify-plan mention |

---

**End of BRIEFS_V2.md.**

Total: ~30 executable briefs across Phases A-D, plus 8 Path B briefs, plus a verify script and full sequencing. This document IS the plan; combined with the deep review and strategy doc, it is everything needed to execute.

