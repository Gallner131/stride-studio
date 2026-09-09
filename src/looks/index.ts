// The 24 curated looks (§4.5, Appendix B).
//
// Authored by scripts/make-looks.mjs and validated by `npm run lint:looks` (§12.7), which
// checks token completeness, font validity and contrast on every commit. Adding a look is a
// JSON file plus a green linter run — that is the whole cost (§4.5).
import type { Look } from "../engine/tokens";

import blueprint from "./blueprint.json";
import broadsheet from "./broadsheet.json";
import clean from "./clean.json";
import clinic from "./clinic.json";
import dashboard from "./dashboard.json";
import ember from "./ember.json";
import film from "./film.json";
import flare from "./flare.json";
import frost from "./frost.json";
import iron from "./iron.json";
import journal from "./journal.json";
import kit from "./kit.json";
import ledger from "./ledger.json";
import neon from "./neon.json";
import paper from "./paper.json";
import pulse from "./pulse.json";
import retro78 from "./retro78.json";
import shade from "./shade.json";
import studio from "./studio.json";
import telemetry from "./telemetry.json";
import track from "./track.json";
import volt from "./volt.json";
import y2k from "./y2k.json";
import zine from "./zine.json";

/** In family order, so the picker groups without sorting (§6.9). */
export const LOOKS: Look[] = [
  clean,
  shade,
  frost,
  film,
  volt,
  track,
  flare,
  ember,
  paper,
  broadsheet,
  journal,
  zine,
  ledger,
  telemetry,
  blueprint,
  dashboard,
  clinic,
  pulse,
  studio,
  iron,
  neon,
  retro78,
  y2k,
  kit,
] as Look[];

export const LOOK_BY_ID = new Map(LOOKS.map((l) => [l.id, l]));

export const DEFAULT_LOOK_ID = "clean";

export const getLook = (id: string | null | undefined): Look | null =>
  (id ? LOOK_BY_ID.get(id) : null) ?? null;
