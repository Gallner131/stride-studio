// HYROX support.
//
// A HYROX result is a 16-segment race — 8 x 1 km runs interleaved with 8 stations — plus
// the roxzone (the transitions). None of that fits the existing activity model, which
// assumes one distance and one duration, so HYROX gets its own shape.
//
// Where the data comes from: results.hyrox.com is a server-rendered mika:timing portal with
// no public JSON API, and it returns 403 to automated requests. Rather than proxy-scrape a
// site that does not want to be scraped, the primary input is PASTE: the athlete copies
// their own splits table from their own result page and pastes it in. That needs no
// network call at all, which keeps the "nothing leaves the device" promise (§2.5) intact.
// A lookup via a third-party JSON API can be added later behind a serverless function.

export type HyroxDivision = "open" | "pro" | "doubles" | "relay" | "adaptive";

export const DIVISION_LABEL: Record<HyroxDivision, string> = {
  open: "Open",
  pro: "Pro",
  doubles: "Doubles",
  relay: "Relay",
  adaptive: "Adaptive",
};

export type HyroxStationId =
  | "skierg"
  | "sledPush"
  | "sledPull"
  | "burpees"
  | "row"
  | "carry"
  | "lunges"
  | "wallBalls";

export interface HyroxStationDef {
  id: HyroxStationId;
  /** Short label for tight layouts. */
  short: string;
  /** Full label as HYROX names it. */
  name: string;
  /** Position in the race, 1-8. */
  order: number;
  /** Matched against pasted text, lowercased. */
  aliases: string[];
}

/** The eight stations, in race order. */
export const HYROX_STATIONS: HyroxStationDef[] = [
  { id: "skierg", short: "SkiErg", name: "1000 m SkiErg", order: 1, aliases: ["skierg", "ski erg", "ski"] },
  {
    id: "sledPush",
    short: "Sled Push",
    name: "50 m Sled Push",
    order: 2,
    aliases: ["sled push", "sledpush", "push sled"],
  },
  {
    id: "sledPull",
    short: "Sled Pull",
    name: "50 m Sled Pull",
    order: 3,
    aliases: ["sled pull", "sledpull", "pull sled"],
  },
  {
    id: "burpees",
    short: "Burpees",
    name: "80 m Burpee Broad Jump",
    order: 4,
    aliases: ["burpee broad jump", "burpee", "burpees", "bbj", "broad jump"],
  },
  { id: "row", short: "Row", name: "1000 m Row", order: 5, aliases: ["rowerg", "row erg", "row", "rowing"] },
  {
    id: "carry",
    short: "Farmers",
    name: "200 m Farmers Carry",
    order: 6,
    aliases: ["farmers carry", "farmer's carry", "farmers", "farmer carry", "kettlebell carry"],
  },
  {
    id: "lunges",
    short: "Lunges",
    name: "100 m Sandbag Lunges",
    order: 7,
    aliases: ["sandbag lunges", "sandbag lunge", "lunges", "lunge"],
  },
  {
    id: "wallBalls",
    short: "Wall Balls",
    name: "Wall Balls",
    order: 8,
    aliases: ["wall balls", "wallballs", "wall ball", "wallball"],
  },
];

export const STATION_BY_ID = new Map(HYROX_STATIONS.map((s) => [s.id, s]));

export interface HyroxSegment {
  kind: "run" | "station";
  /** 1-8 for both runs and stations. */
  order: number;
  stationId?: HyroxStationId;
  label: string;
  /** Seconds. */
  seconds: number;
}

export interface HyroxResult {
  /** Free text, e.g. "HYROX London 2026". */
  event: string;
  division: HyroxDivision;
  /** As printed on the result, e.g. "30-34". */
  ageGroup?: string;
  athlete?: string;
  /** Total race time in seconds. */
  totalSeconds: number;
  /** Roxzone total in seconds, when the result reports it. */
  roxzoneSeconds?: number;
  runs: HyroxSegment[];
  stations: HyroxSegment[];
  overallRank?: number;
  divisionRank?: number;
  ageGroupRank?: number;
  fieldSize?: number;
  date?: string;
}

// ---------------------------------------------------------------- parsing

const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;

/** "1:12:34" -> 4354, "4:52" -> 292. */
export function parseTime(text: string): number | null {
  const m = TIME.exec(text);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = m[3] === undefined ? null : Number(m[3]);
  if (c === null) return a * 60 + b; // mm:ss
  return a * 3600 + b * 60 + c; // hh:mm:ss
}

export const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const RUN_WORDS = ["running", "run", "lauf"];
const ROXZONE_WORDS = ["roxzone", "rox zone", "transition"];
const TOTAL_WORDS = ["overall", "total", "finish", "gesamt", "net time", "nettozeit"];

function matchStation(line: string): HyroxStationDef | null {
  const l = line.toLowerCase();
  // Longest alias first, so "sled pull" is not swallowed by "sled".
  const candidates = HYROX_STATIONS.flatMap((s) => s.aliases.map((a) => ({ s, a }))).sort(
    (x, y) => y.a.length - x.a.length,
  );
  for (const { s, a } of candidates) if (l.includes(a)) return s;
  return null;
}

function matchRunOrder(line: string): number | null {
  const l = line.toLowerCase();
  if (!RUN_WORDS.some((w) => l.includes(w))) return null;

  // A leading index is checked FIRST, because in "3. Running 5:22" a trailing-number pattern
  // would otherwise grab the 5 from the time. The trailing form additionally refuses a digit
  // that is part of a time, via the (?!\d*:) lookahead.
  const leading = l.match(/(\d)\s*[.)]\s*(?:run(?:ning)?|lauf)/);
  if (leading?.[1]) return Number(leading[1]);

  const trailing = l.match(/(?:run(?:ning)?|lauf)\s*#?\s*(\d)(?!\d*:)/);
  return trailing?.[1] ? Number(trailing[1]) : null;
}

export interface ParseResult {
  result: HyroxResult | null;
  /** Human-readable notes about what could not be read. */
  problems: string[];
  /** How many of the 16 segments were found. */
  segmentsFound: number;
}

/**
 * Parses a splits table copied from a HYROX result page.
 *
 * Deliberately tolerant: the portal's markup, language and label wording vary by season and
 * event ("Running 1" vs "Run 1" vs "1. Lauf"), and a paste picks up stray columns like
 * cumulative times and rankings. So this scans line by line for a recognisable label plus
 * the FIRST time on that line, and reports what it could not find rather than guessing.
 */
export function parseHyroxPaste(text: string): ParseResult {
  const problems: string[] = [];
  if (!text.trim()) return { result: null, problems: ["Nothing pasted."], segmentsFound: 0 };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const runs = new Map<number, number>();
  const stations = new Map<HyroxStationId, number>();
  let roxzone: number | undefined;
  let total: number | undefined;
  let event: string | undefined;
  let athlete: string | undefined;
  let ageGroup: string | undefined;
  let division: HyroxDivision | undefined;

  for (const line of lines) {
    const seconds = parseTime(line);
    const lower = line.toLowerCase();

    // Metadata lines carry no time.
    if (seconds === null) {
      if (!event && /hyrox/i.test(line)) event = line.slice(0, 60);
      if (!division) division = detectDivision(line);
      if (!ageGroup) {
        const ag = line.match(/\b(\d{2}\s*-\s*\d{2})\b/) ?? line.match(/\b(\d{2}\+)\b/);
        if (ag?.[1]) ageGroup = ag[1].replace(/\s/g, "");
      }
      continue;
    }

    if (!division) division = detectDivision(line) ?? division;

    if (TOTAL_WORDS.some((w) => lower.includes(w))) {
      total = Math.max(total ?? 0, seconds);
      continue;
    }
    if (ROXZONE_WORDS.some((w) => lower.includes(w))) {
      roxzone = seconds;
      continue;
    }

    const runOrder = matchRunOrder(line);
    if (runOrder !== null) {
      if (!runs.has(runOrder)) runs.set(runOrder, seconds);
      continue;
    }

    const station = matchStation(line);
    if (station && !stations.has(station.id)) {
      stations.set(station.id, seconds);
    }
  }

  const runSegments: HyroxSegment[] = [...runs.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([order, secs]) => ({ kind: "run" as const, order, label: `Run ${order}`, seconds: secs }));

  const stationSegments: HyroxSegment[] = HYROX_STATIONS.filter((s) => stations.has(s.id)).map((s) => ({
    kind: "station" as const,
    order: s.order,
    stationId: s.id,
    label: s.short,
    seconds: stations.get(s.id) as number,
  }));

  const segmentsFound = runSegments.length + stationSegments.length;

  if (stationSegments.length === 0) {
    problems.push("No station splits found. Copy the whole splits table, including the station names.");
  } else if (stationSegments.length < 8) {
    const missing = HYROX_STATIONS.filter((s) => !stations.has(s.id)).map((s) => s.short);
    problems.push(
      `Missing ${missing.length} station${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  }
  if (runSegments.length < 8) {
    problems.push(`Found ${runSegments.length} of 8 runs.`);
  }

  // If no total was labelled, fall back to the sum of what we have — clearly worse, so say so.
  if (total === undefined) {
    const sum =
      runSegments.reduce((a, s) => a + s.seconds, 0) +
      stationSegments.reduce((a, s) => a + s.seconds, 0) +
      (roxzone ?? 0);
    if (sum > 0) {
      total = sum;
      problems.push("No finish time found, so it was added up from the splits.");
    }
  }

  if (segmentsFound === 0 || total === undefined) {
    return { result: null, problems, segmentsFound };
  }

  return {
    result: {
      event: event ?? "HYROX",
      division: division ?? "open",
      ageGroup,
      athlete,
      totalSeconds: total,
      roxzoneSeconds: roxzone,
      runs: runSegments,
      stations: stationSegments,
    },
    problems,
    segmentsFound,
  };
}

function detectDivision(line: string): HyroxDivision | undefined {
  const l = line.toLowerCase();
  if (/\bpro\b/.test(l)) return "pro";
  if (/\bdouble/.test(l)) return "doubles";
  if (/\brelay\b/.test(l)) return "relay";
  if (/\badaptive\b/.test(l)) return "adaptive";
  if (/\bopen\b/.test(l)) return "open";
  return undefined;
}

// ---------------------------------------------------------------- derived

export interface HyroxDerived {
  totalSeconds: number;
  runSeconds: number;
  stationSeconds: number;
  roxzoneSeconds: number;
  /** Roxzone as a share of total. Compare this rather than absolute seconds: transition
   *  distances differ by venue, so absolute roxzone is not comparable between events. */
  roxzoneShare: number;
  runShare: number;
  stationShare: number;
  /** Mean run split in seconds. */
  avgRunSeconds: number;
  fastestRun?: HyroxSegment;
  slowestRun?: HyroxSegment;
  fastestStation?: HyroxSegment;
  slowestStation?: HyroxSegment;
  /** Runs, in race order, as a series for charts. */
  runSeries: number[];
  stationSeries: { label: string; seconds: number; id: HyroxStationId }[];
  /** True when all 16 segments are present. */
  complete: boolean;
}

export function deriveHyrox(result: HyroxResult): HyroxDerived {
  const runSeconds = result.runs.reduce((a, s) => a + s.seconds, 0);
  const stationSeconds = result.stations.reduce((a, s) => a + s.seconds, 0);

  // Prefer a reported roxzone; otherwise infer it as the unaccounted remainder.
  const inferred = Math.max(0, result.totalSeconds - runSeconds - stationSeconds);
  const roxzoneSeconds = result.roxzoneSeconds ?? inferred;

  const total = result.totalSeconds || runSeconds + stationSeconds + roxzoneSeconds;
  const byTime = (a: HyroxSegment, b: HyroxSegment) => a.seconds - b.seconds;
  const runsSorted = [...result.runs].sort(byTime);
  const stationsSorted = [...result.stations].sort(byTime);

  return {
    totalSeconds: total,
    runSeconds,
    stationSeconds,
    roxzoneSeconds,
    roxzoneShare: total > 0 ? roxzoneSeconds / total : 0,
    runShare: total > 0 ? runSeconds / total : 0,
    stationShare: total > 0 ? stationSeconds / total : 0,
    avgRunSeconds: result.runs.length ? runSeconds / result.runs.length : 0,
    fastestRun: runsSorted[0],
    slowestRun: runsSorted[runsSorted.length - 1],
    fastestStation: stationsSorted[0],
    slowestStation: stationsSorted[stationsSorted.length - 1],
    runSeries: [...result.runs].sort((a, b) => a.order - b.order).map((s) => s.seconds),
    stationSeries: result.stations
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ label: s.label, seconds: s.seconds, id: s.stationId as HyroxStationId })),
    complete: result.runs.length === 8 && result.stations.length === 8,
  };
}

/** Field table additions for text bindings (§4.6), so {roxzone} etc. work in text layers. */
export function hyroxFields(result: HyroxResult): Record<string, string | number | null> {
  const d = deriveHyrox(result);
  const fields: Record<string, string | number | null> = {
    hyroxEvent: result.event,
    hyroxDivision: DIVISION_LABEL[result.division],
    hyroxAgeGroup: result.ageGroup ?? null,
    hyroxTotal: formatTime(d.totalSeconds),
    runTotal: formatTime(d.runSeconds),
    stationTotal: formatTime(d.stationSeconds),
    roxzone: formatTime(d.roxzoneSeconds),
    roxzonePercent: Math.round(d.roxzoneShare * 1000) / 10,
    avgRun: formatTime(d.avgRunSeconds),
    // Pace over the 8 km of running only. This is the number athletes mean by "run pace";
    // finish time / 8 km would be far slower because it includes the stations.
    runPace: d.runSeconds > 0 ? `${formatTime(d.runSeconds / 8)} /km` : null,
    runDistance: 8,
    fastestRun: d.fastestRun ? formatTime(d.fastestRun.seconds) : null,
    slowestStation: d.slowestStation?.label ?? null,
    fastestStation: d.fastestStation?.label ?? null,
    hyroxRank: result.overallRank ?? null,
    hyroxFieldSize: result.fieldSize ?? null,
  };
  for (const s of result.stations) {
    if (s.stationId) fields[`station.${s.stationId}`] = formatTime(s.seconds);
  }
  for (const r of result.runs) fields[`run.${r.order}`] = formatTime(r.seconds);
  return fields;
}

/** Converts a HYROX result into the legacy activity shape, so existing templates still work. */
export function hyroxToActivity(result: HyroxResult): Record<string, unknown> {
  const d = deriveHyrox(result);
  return {
    id: `hyrox:${result.event}`,
    sport: "workout",
    subtype: "HYROX",
    name: result.event,
    date: result.date ?? new Date().toISOString(),
    // Distance is deliberately 0 here, even though the race contains 8 km of running.
    //
    // The legacy activity model has one (distance, time) pair, and it derives pace from it.
    // Handing it 8 km with the FINISH time would make every template print roughly
    // 8:40 /km, when the athlete's actual run pace is nearer 4:27 /km — the difference is
    // the stations and the roxzone. A misleading number on a graphic someone shares is
    // worse than a missing one, so the legacy pass shows duration as the hero (sport
    // "workout" has no distance, §4.7) and the real figures are exposed as HYROX bindings:
    // {runTotal}, {runPace}, {runDistance}, {station.*}.
    distance: 0,
    time: d.totalSeconds,
    elevation: 0,
    hr: null,
    activityHrMax: null,
    calories: null,
    route: [],
    splits: result.runs.map((r) => r.seconds),
    elev: [],
    hrStream: [],
    hyrox: result,
  };
}
