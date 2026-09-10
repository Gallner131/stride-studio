# Handoff — next session

Read `CLAUDE.md` first (working rules, what is and is not done, findings worth not
rediscovering). This file is the queue: four things George asked for, in his priority order,
with what I already know about each.

**Read this before starting:** George gave a full product spec and said "execute it". The
previous session built Phase 0 — tests and CI, zero visible change — without saying up front
that Phase 0 ships nothing a user can see. That was the right order per §13 and the wrong
thing to do silently. **If a task's first step produces nothing visible, say so in one
sentence and offer to skip ahead.**

---

## State as of handoff

- Branch `phase0-stabilise`, pushed to GitHub. **Production runs this branch**, deployed via
  `vercel deploy --prod` (Vercel is NOT git-connected, so pushing does not deploy).
- Live: https://stride-studio-sooty.vercel.app
- **Strava is fully configured and working.** Client ID `276637`, callback domain already
  correct, `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` / `APP_ORIGIN` set in Vercel
  production. `/api/strava/config` returns `configured: true`. Athlete limit raised to 10.
- Suite: 205 unit, 104 e2e per viewport, 354-cell golden smoke, 24/24 look linter.
  Bundle ~137 KB gzipped (30 % of the 450 KB budget).
- **The golden baseline has still never been recorded.** Run the `golden-update` workflow.

---

## 1. A short walkthrough for new users

**What George asked for:** "new users get a small and basic walkthrough how it works".

Not built. §3.8 covers the empty state and §6.13 mentions one-time coach marks, but there is
no first-run explanation of the core idea, which is the one thing that is not obvious: **you
can tap anything on the design and change it.** People arriving from the old version will
assume the design is a fixed picture.

Suggested shape — keep it very short, dismissible, once only:

1. "Pick a design" → points at the Designs tab
2. "Tap anything on it to change it" → the actual insight
3. "Pick a look to restyle it all at once"
4. "Save or share"

Store the dismissal in `ss.prefs` via `savePrefs` (`src/storage/db.ts`), so it never returns.
Do NOT block the canvas with a modal — §3.1 says the canvas is the interface. Coach marks or
a single dismissible strip are both fine; a four-screen carousel is not.

Worth including: a line saying nothing is uploaded. It is a real differentiator (§2.4) and
new users do not know it.

## 2. Turning animation off — DONE, verify it is what he meant

**What George reported:** "can you definitely turn the animations off? I can't seem to."

Two real bugs, both fixed in the final commit, both worth understanding:

- **`animAt` returned a NaN scale at `t = Infinity`** for the looping `pulse` preset.
  `Math.sin(Infinity)` is NaN, which became `ctx.scale(NaN, NaN)` and made the layer VANISH.
  Since `t = Infinity` is exactly what "animation off", thumbnails and image export use, any
  pulsing element disappeared the moment you turned animation off. Fixed by returning
  `STATIC_ANIM` for any non-finite `t` — it is the settled state for every preset.
- **The Animate toggle was unfindable.** It lives in the Look tab, and Phase 3 put 24 look
  cards above it, so it was buried far down a scrolling panel. Moved to the canvas toolbar
  beside Undo / Redo / Safe zones, labelled **Animated / Still**.

`test/e2e/anim.spec.ts` covers both: that consecutive frames stop differing, and that a
pulsing element still renders when animation is off.

**Ask him to confirm this was the problem.** If he instead meant "the exported video should
be able to be a still", or "I want animation off by DEFAULT", those are different changes —
the default is currently on (`DEFAULT_OPTS.animate`).

## 3. Transparent sticker download — mostly built, needs a GIF decision

**What George asked for:** "users can just download the graphics as a photo/gif with no
background which can be added to an instagram story. Like how Strava works currently."

**Already built and live:** "Save sticker (transparent)" exports a transparent PNG cropped
tight to the design (§9.2), plus a "Copy image" button so it can be pasted straight into
Instagram's Story composer. Tested in `test/e2e/export.spec.ts`.

So the feature exists. What to check with him:

- **Is he finding it?** It is the third button in the export row, labelled "Save sticker
  (transparent)". If the answer is "I didn't know that was there", the fix is naming and
  placement, not new code. Strava calls it a "sticker"; consider matching that language and
  promoting it next to Save image rather than after the video button.
- **Does he specifically want an animated GIF?** That is genuinely not built. Notes:
  - GIF is limited to 256 colours and 1-bit transparency, so a soft-edged design gets an
    ugly fringe. Instagram Stories also do not accept a GIF upload as media in the normal
    flow — the usual route is a transparent PNG sticker, or an MP4/WebM.
  - A transparent VIDEO is better on paper (WebM/VP9 with alpha, or HEVC with alpha for
    iOS) but Instagram's support is inconsistent and iOS/Android differ.
  - **Recommendation: establish what he actually wants first.** "Like Strava" is a
    transparent PNG sticker, which already works. If he wants motion, the honest answer is a
    transparent WebM plus a warning that Instagram may flatten it.
  - If a GIF is wanted anyway, `src/export/video.ts` already renders every frame offline —
    a GIF encoder would slot in beside the MP4 muxer. `gifenc` is small and fast.

## 4. Feedback from the Claude Chrome extension

George will bring detailed UI feedback captured while using the live app. Nothing to do
until it arrives, but prepare for it:

- **Ask for it as a list**, and triage into: (a) a real bug, (b) a design change, (c) a spec
  change. Fix (a) immediately with a test; (b) and (c) need his call on priority.
- **Write a test for every bug before fixing it.** That is the pattern the whole suite
  follows and it is why the regressions in this session were caught.
- Expect a lot of it to be about the legacy templates in the **Style** tab, which are still
  the old switch-case renderer and cannot be edited element by element. If so, that is the
  argument for doing the §13 Phase 2 step 2 re-authoring next — and it needs the golden
  baseline recorded first.

---

## Practical notes for whoever picks this up

- `npm run dev` builds and serves on `http://127.0.0.1:4173/dist/index.html`.
  Add `--lan` to `scripts/serve.mjs` to reach it from a phone on the same Wi-Fi.
- `npm run verify` runs typecheck, lint, unit, build and size. Browser suites are
  `npm run test:e2e` and `npm run test:golden`.
- Deploying: `vercel deploy` for a preview, `vercel deploy --prod` for live. **Always
  preview first** — the first production attempt this session failed on an invalid
  `vercel.json` runtime, and a preview caught it instead of the live URL.
- The API functions are **edge runtime** (`export const config = { runtime: "edge" }`).
  Vercel's Node runtime cannot invoke Web-standard `Request`/`Response` handlers and returns
  `FUNCTION_INVOCATION_FAILED`.
- Pointer tests target `[data-testid='overlay']`, not `[data-testid='stage']` — the overlay
  canvas sits on top.
- A hash-only navigation does not remount the app; shared-layout tests need a fresh
  `page.goto`.
