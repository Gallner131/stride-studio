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

/** Demo run: 21.1 km, route, splits, elevation, HR stream. */
export const FIXTURE_RUN = { ...DEMO, date: FIXED_DATE };

/** Demo workout: no distance, no route, no splits, HR stream only. Spec §4.7. */
export const FIXTURE_WORKOUT = { ...DEMO_WORKOUT, date: FIXED_DATE };

export const FIXTURE_ACTIVITIES = {
  run: FIXTURE_RUN,
  workout: FIXTURE_WORKOUT,
};
