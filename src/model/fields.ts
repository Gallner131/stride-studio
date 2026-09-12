// Builds the §4.6 field table from a legacy activity + opts, so text layers can bind to
// activity data. Phase 1 exposes the fields the legacy `derive()` already computes; the
// milestone/weather/delta fields arrive with the data layer in Phase 5.
import type { ZoneBand } from "../data/hr";
import { zoneSharesFromBands } from "../data/hr";
import { derive, fmtClock, fmtDate, fmtDateLong, fmtDist, fmtTime, SPORTS } from "../render.js";
import type { FieldTable } from "./bindings";

interface LegacyActivity {
  name?: string;
  sport?: string;
  date?: string;
  time?: number;
  distance?: number;
  elevation?: number;
  hr?: number | null;
  /** The peak reached during THIS activity. For display; never a zone ceiling. */
  activityHrMax?: number | null;
  calories?: number | null;
  splits?: number[] | null;
  hrStream?: number[] | null;
}

export function buildFields(
  act: LegacyActivity,
  opts: Record<string, unknown>,
  /** The athlete's real zones from Strava. Without them, zone bindings are left unset. */
  zones: ZoneBand[] | null = null,
): FieldTable {
  const d = derive(act, opts, 1);
  const sportTable = SPORTS as Record<string, { label: string } | undefined>;
  const sport = sportTable[act.sport ?? "run"] ?? SPORTS.run;

  const fields: FieldTable = {
    distance: d.hasDist ? Number(fmtDist(d.dist)) : null,
    unit: d.unit,
    time: fmtTime(act.time ?? 0),
    pace: d.hasDist ? d.paceStr : null,
    paceValue: d.hasDist ? d.paceStr.split(" ")[0] : null,
    elevation: act.elevation ? Math.round(d.elevV) : null,
    elevUnit: d.elevU,
    hr: act.hr ?? null,
    // The binding key stays `hrMax` — two shipped designs print {hrMax} and mean the peak
    // this run reached, which is what activityHrMax holds. Only the source field is renamed.
    hrMax: act.activityHrMax ?? null,
    calories: act.calories ?? null,
    date: fmtDate(act.date),
    startTime: fmtClock(act.date),
    name: act.name ?? "",
    sport: sport.label,
    splitCount: act.splits?.length ?? null,
    fastestSplit: act.splits?.length ? fmtTimeFromPace(Math.min(...act.splits)) : null,
  };

  // Long/short date variants are reachable through modifiers, but the legacy formatters are
  // separate functions, so expose them as their own keys too.
  fields["date|long"] = fmtDateLong(act.date);

  // Zone bindings come from the athlete's own zones or not at all. They used to divide by
  // `act.hrMax`, which for a Strava import is the peak reached during THAT RUN — so an easy
  // run at 140 bpm reported as Z4 (§7.4). Absent zones leave these unset, and a design
  // binding {zonePercent.2} then renders empty rather than confidently wrong.
  const shares = act.hrStream?.length ? zoneSharesFromBands(act.hrStream, zones ?? []) : null;
  if (shares) {
    const total = (act.time ?? 0) / 60;
    shares.forEach((share, i) => {
      fields[`zonePercent.${i + 1}`] = Math.round(share * 100);
      fields[`zoneMinutes.${i + 1}`] = Math.round(share * total);
    });
  }

  return fields;
}

function fmtTimeFromPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  // Guard the legacy fmtPace "4:60" bug (see CLAUDE.md) at the call site.
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}
