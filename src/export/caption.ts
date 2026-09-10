// Caption generator — §2.7 S17.
//
// Five voices, deterministic. No AI: it is instant, it works offline, it never says
// anything strange, and the same activity always produces the same caption — which means
// the user can predict it and edit rather than reroll.

export type CaptionTone = "deadpan" | "hype" | "data" | "poetic" | "club";

export const TONES: { id: CaptionTone; name: string; hint: string }[] = [
  { id: "deadpan", name: "Deadpan", hint: "Says what happened" },
  { id: "hype", name: "Hype", hint: "Loud about it" },
  { id: "data", name: "Data", hint: "Just the numbers" },
  { id: "poetic", name: "Poetic-lite", hint: "One nice line" },
  { id: "club", name: "Club", hint: "For a group account" },
];

export interface CaptionInput {
  name: string;
  sport: string;
  /** Formatted distance with unit, e.g. "21.1 km". Null when the activity has none. */
  distance: string | null;
  time: string;
  pace: string | null;
  elevation: string | null;
  hr: string | null;
  calories: string | null;
  /** True when the activity is a HYROX race. */
  isHyrox?: boolean;
  hyroxDivision?: string | null;
  roxzone?: string | null;
  /** Set when the user has marked this a personal best. */
  isPb?: boolean;
}

const HASHTAGS: Record<string, string[]> = {
  run: ["#running", "#runningcommunity", "#runnersofinstagram", "#strava"],
  trailrun: ["#trailrunning", "#trailrunner", "#running", "#strava"],
  ride: ["#cycling", "#ridelife", "#cyclinglife", "#strava"],
  swim: ["#swimming", "#openwaterswimming", "#triathlon"],
  hike: ["#hiking", "#trails", "#outdoors"],
  walk: ["#walking", "#steps", "#outdoors"],
  workout: ["#workout", "#training", "#fitness", "#gym"],
  hyrox: ["#hyrox", "#hyroxtraining", "#hybridathlete", "#fitnessracing"],
  other: ["#training", "#fitness"],
};

function tags(input: CaptionInput): string[] {
  if (input.isHyrox) return HASHTAGS.hyrox as string[];
  return (HASHTAGS[input.sport] ?? HASHTAGS.other) as string[];
}

/** The stat spine every tone can draw on. */
function facts(input: CaptionInput): string[] {
  return [
    input.distance,
    input.time,
    input.pace,
    input.elevation ? `${input.elevation} up` : null,
    input.hr,
  ].filter((x): x is string => x !== null && x !== "");
}

export function buildCaption(input: CaptionInput, tone: CaptionTone): string {
  const stats = facts(input);
  const hashtags = tags(input).join(" ");
  const pb = input.isPb ? " PB." : "";

  switch (tone) {
    case "deadpan": {
      // Names the thing, states the numbers, stops.
      const line = input.isHyrox
        ? `${input.name}. ${input.time}${input.hyroxDivision ? `, ${input.hyroxDivision}` : ""}.`
        : `${input.name}.${pb}`;
      return [line, stats.join(" · "), "", hashtags].join("\n");
    }

    case "hype": {
      const opener = input.isPb
        ? "New PB and I am not normal about it"
        : input.isHyrox
          ? "That is a wrap on the hardest hour of my week"
          : (input.distance ?? input.time) && input.sport === "run"
            ? "Legs gone, heart full"
            : "Put the work in";
      return [`${opener}.`, stats.join(" · "), "", hashtags].join("\n");
    }

    case "data": {
      // No prose at all. One labelled line per figure.
      const rows = [
        input.distance ? `Distance  ${input.distance}` : null,
        `Time      ${input.time}`,
        input.pace ? `Pace      ${input.pace}` : null,
        input.elevation ? `Elevation ${input.elevation}` : null,
        input.hr ? `Avg HR    ${input.hr}` : null,
        input.calories ? `Calories  ${input.calories}` : null,
        input.roxzone ? `Roxzone   ${input.roxzone}` : null,
      ].filter((x): x is string => x !== null);
      return [...rows, "", hashtags].join("\n");
    }

    case "poetic": {
      // One line, and deliberately restrained — this is the tone most likely to embarrass
      // someone, so it stays short and never claims a feeling on their behalf.
      const line = input.isHyrox
        ? "Eight runs, eight stations, one very long conversation with myself."
        : input.sport === "workout"
          ? "Nobody saw it. It still counted."
          : input.elevation
            ? "Up, mostly. Worth it, eventually."
            : "Quiet roads and a good excuse to be out early.";
      return [line, stats.join(" · "), "", hashtags].join("\n");
    }

    case "club": {
      const header = input.isHyrox
        ? `HYROX — ${input.name}`
        : `${input.name}${input.distance ? ` — ${input.distance}` : ""}`;
      return [header, stats.join(" · "), "", "Everyone welcome. Details in the bio.", "", hashtags].join(
        "\n",
      );
    }
  }
}

/** Never mentions Strava unless the user adds it (§9.4) — asserted by the tests. */
export const mentionsStrava = (caption: string): boolean => /strava/i.test(caption.replace(/#\w+/g, ""));
