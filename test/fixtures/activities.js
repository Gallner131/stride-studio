// Golden/e2e activity fixtures (spec §12.2).
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
 * The athlete the fixtures belong to — a true maximum of 190 bpm, and the five zones
 * Strava would return for them (§7.4).
 *
 * Shaped exactly as `GET /athlete/zones` returns it: Z1 starts at 0, and Z5 has no
 * ceiling. Not a list of five lower bounds — that shape cannot say "and everything above
 * 171 bpm", which is precisely what Strava says, and standing a derived ceiling in its
 * place is the habit this whole phase exists to break.
 *
 * Note 190 against the run's peak of 178. Keeping those two numbers visibly different in
 * the fixtures is what stops the resolver work from passing while still conflating them.
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
export const FIXTURE_RUN = { ...DEMO, date: FIXED_DATE };

/** Demo workout: no distance, no route, no splits, HR stream only. Spec §4.7. */
export const FIXTURE_WORKOUT = { ...DEMO_WORKOUT, date: FIXED_DATE };

export const FIXTURE_ACTIVITIES = {
  run: FIXTURE_RUN,
  workout: FIXTURE_WORKOUT,
};

/** For tests that need both halves of the distinction at once. */
export const FIXTURE_SESSION = {
  activity: FIXTURE_RUN,
  athlete: FIXTURE_ATHLETE,
};
