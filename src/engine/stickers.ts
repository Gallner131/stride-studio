// Sticker library — §2.7 S11. Original marks drawn for this app as Path2D data on a
// 100x100 grid, recoloured by look tokens. No third-party IP.
export interface StickerDef {
  id: string;
  name: string;
  /** SVG path data on a 0-100 viewBox. */
  d: string;
  /** Drawn as a stroke rather than a fill. */
  strokeOnly?: boolean;
}

export const STICKERS: StickerDef[] = [
  {
    id: "shoe",
    name: "Shoe",
    d: "M8 68 C8 58 14 52 24 50 L44 46 C52 44 56 40 62 34 C68 28 74 26 80 30 C86 34 86 42 82 48 L92 54 C96 57 96 63 92 66 L86 70 C82 72 76 72 72 70 L20 74 C13 74 8 72 8 68 Z",
  },
  {
    id: "medal",
    name: "Medal",
    d: "M50 10 L38 34 L62 34 Z M50 34 A22 22 0 1 0 50 78 A22 22 0 1 0 50 34 Z M50 44 L54 54 L65 55 L57 62 L59 72 L50 67 L41 72 L43 62 L35 55 L46 54 Z",
  },
  {
    id: "trophy",
    name: "Trophy",
    d: "M28 14 H72 V30 A22 22 0 0 1 28 30 Z M20 16 H28 V32 A10 10 0 0 1 20 22 Z M80 16 H72 V32 A10 10 0 0 0 80 22 Z M46 52 H54 V70 H46 Z M32 70 H68 V80 H32 Z",
  },
  { id: "lightning", name: "Lightning", d: "M56 6 L26 54 H46 L40 94 L74 42 H52 Z" },
  {
    id: "flame",
    name: "Flame",
    d: "M50 6 C58 24 74 32 74 52 C74 70 63 84 50 84 C37 84 26 70 26 52 C26 38 34 32 40 24 C42 34 48 36 50 6 Z",
  },
  {
    id: "heart",
    name: "Heart",
    d: "M50 84 C20 62 10 48 10 34 C10 20 20 12 32 12 C40 12 46 16 50 24 C54 16 60 12 68 12 C80 12 90 20 90 34 C90 48 80 62 50 84 Z",
  },
  { id: "arrow-up", name: "Arrow up", d: "M50 8 L82 44 H62 V92 H38 V44 H18 Z" },
  { id: "arrow-right", name: "Arrow right", d: "M92 50 L56 82 V62 H8 V38 H56 V18 Z" },
  { id: "mountain", name: "Mountain", d: "M4 82 L34 30 L52 60 L62 44 L96 82 Z" },
  {
    id: "sun",
    name: "Sun",
    d: "M50 28 A22 22 0 1 0 50 72 A22 22 0 1 0 50 28 Z M46 2 H54 V16 H46 Z M46 84 H54 V98 H46 Z M2 46 H16 V54 H2 Z M84 46 H98 V54 H84 Z M14 18 L20 12 L30 22 L24 28 Z M70 72 L76 66 L86 76 L80 82 Z M80 18 L86 24 L76 34 L70 28 Z M24 72 L30 78 L20 88 L14 82 Z",
  },
  { id: "moon", name: "Moon", d: "M62 6 A46 46 0 1 0 62 94 A38 38 0 1 1 62 6 Z" },
  { id: "cloud", name: "Cloud", d: "M26 72 A18 18 0 0 1 28 36 A24 24 0 0 1 72 34 A16 16 0 0 1 76 72 Z" },
  {
    id: "rain",
    name: "Rain",
    d: "M26 58 A18 18 0 0 1 28 22 A24 24 0 0 1 72 20 A16 16 0 0 1 76 58 Z M32 68 L26 86 H34 L40 68 Z M52 68 L46 86 H54 L60 68 Z M72 68 L66 86 H74 L80 68 Z",
  },
  {
    id: "wind",
    name: "Wind",
    d: "M10 34 H62 A10 10 0 1 0 52 24 M10 52 H78 A10 10 0 1 1 68 62 M10 70 H50",
    strokeOnly: true,
  },
  {
    id: "dumbbell",
    name: "Dumbbell",
    d: "M14 34 H26 V66 H14 Z M28 42 H36 V58 H28 Z M36 46 H64 V54 H36 Z M64 42 H72 V58 H64 Z M74 34 H86 V66 H74 Z",
  },
  {
    id: "kettlebell",
    name: "Kettlebell",
    d: "M38 12 H62 A18 18 0 0 1 66 36 A28 28 0 1 1 34 36 A18 18 0 0 1 38 12 Z M44 20 A12 12 0 0 0 44 32 H56 A12 12 0 0 0 56 20 Z",
  },
  {
    id: "stopwatch",
    name: "Stopwatch",
    d: "M50 18 A34 34 0 1 0 50 86 A34 34 0 1 0 50 18 Z M42 4 H58 V14 H42 Z M46 32 H54 V54 H46 Z M50 50 L70 62 L66 68 L46 56 Z",
  },
  {
    id: "finish-flag",
    name: "Finish flag",
    d: "M22 8 H28 V92 H22 Z M32 12 H50 V26 H32 Z M50 12 H68 V26 H50 Z M32 26 H50 V40 H32 Z M50 26 H68 V40 H50 Z",
  },
  {
    id: "pin",
    name: "Pin",
    d: "M50 6 C33 6 20 19 20 36 C20 58 50 94 50 94 C50 94 80 58 80 36 C80 19 67 6 50 6 Z M50 26 A11 11 0 1 0 50 48 A11 11 0 1 0 50 26 Z",
  },
  { id: "star", name: "Star", d: "M50 6 L62 38 L96 38 L68 58 L78 92 L50 71 L22 92 L32 58 L4 38 L38 38 Z" },
  {
    id: "sparkle",
    name: "Sparkle",
    d: "M50 6 C54 34 66 46 94 50 C66 54 54 66 50 94 C46 66 34 54 6 50 C34 46 46 34 50 6 Z",
  },
  {
    id: "bubble",
    name: "Speech bubble",
    d: "M14 16 H86 A8 8 0 0 1 94 24 V62 A8 8 0 0 1 86 70 H44 L24 90 V70 H14 A8 8 0 0 1 6 62 V24 A8 8 0 0 1 14 16 Z",
  },
  { id: "tape", name: "Tape", d: "M4 34 L96 26 L96 62 L4 70 Z" },
  { id: "circle", name: "Circle", d: "M50 6 A44 44 0 1 0 50 94 A44 44 0 1 0 50 6 Z" },
  {
    id: "ring",
    name: "Ring",
    d: "M50 10 A40 40 0 1 0 50 90 A40 40 0 1 0 50 10 Z M50 26 A24 24 0 1 1 50 74 A24 24 0 1 1 50 26 Z",
  },
  { id: "check", name: "Check", d: "M12 54 L36 78 L88 22", strokeOnly: true },
  { id: "cross", name: "Cross", d: "M18 18 L82 82 M82 18 L18 82", strokeOnly: true },
  { id: "plus", name: "Plus", d: "M44 12 H56 V44 H88 V56 H56 V88 H44 V56 H12 V44 H44 Z" },
  { id: "route", name: "Route", d: "M16 84 C16 84 24 50 44 50 C64 50 64 20 84 20", strokeOnly: true },
  {
    id: "watch",
    name: "Watch",
    d: "M36 6 H64 V18 H36 Z M36 82 H64 V94 H36 Z M50 16 A34 34 0 1 0 50 84 A34 34 0 1 0 50 16 Z M46 34 H54 V52 H46 Z M50 50 H68 V58 H50 Z",
  },
  { id: "water", name: "Water drop", d: "M50 6 C50 6 22 40 22 60 A28 28 0 1 0 78 60 C78 40 50 6 50 6 Z" },
  { id: "podium", name: "Podium", d: "M6 58 H32 V92 H6 Z M34 38 H66 V92 H34 Z M68 66 H94 V92 H68 Z" },
];

export const STICKER_BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

const pathCache = new Map<string, Path2D>();

export function stickerPath(svgId: string): Path2D | null {
  const def = STICKER_BY_ID.get(svgId);
  if (!def) return null;
  let p = pathCache.get(svgId);
  if (!p) {
    p = new Path2D(def.d);
    pathCache.set(svgId, p);
  }
  return p;
}
