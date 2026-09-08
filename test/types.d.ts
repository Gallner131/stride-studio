export type GoldenTier = "sticker" | "photo";

export interface GoldenCell {
  name: string;
  template: string;
  format: string;
  look: string;
  activity: string;
  tier: GoldenTier;
}

export interface GoldenHarness {
  /** Render width in px per tier. See harness.html for why they differ. */
  WIDTHS: Record<GoldenTier, number>;
  FIXED_DATE: string;
  templates: string[];
  formats: string[];
  looks: string[];
  activities: string[];
  tiers: GoldenTier[];
  photoAnchors: string[];
  matrix: GoldenCell[];
  /** Renders one cell and returns a base64-encoded PNG. */
  renderCell(cell: Omit<GoldenCell, "name">): string;
}

declare global {
  interface Window {
    __golden: GoldenHarness;
  }
}
