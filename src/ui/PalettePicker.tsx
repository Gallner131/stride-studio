// A real colour palette — §6.12.
//
// What this replaces offered six chips, four of which were actual colours: white, black,
// red, blue. For an app whose whole job is making something look good, that is not a
// palette, it is a placeholder.
//
// The grid below is ten hues at five lightnesses, plus a neutral ramp — 60 colours, chosen
// so every column is usable as a text colour on a light ground and every row holds together
// as a set. The two look tokens stay pinned at the top because they are the ones that
// survive a look change: a literal colour is a decision the athlete has made and we keep it,
// a token restyles with everything else.

export interface PalettePickerProps {
  value: string | null;
  onChange: (value: string) => void;
  /** Adds a "no colour" chip for properties that can be unset. */
  allowNone?: boolean;
  onNone?: () => void;
}

/** Colours that follow the active look rather than overriding it. */
const TOKENS: Array<{ value: string; label: string }> = [
  { value: "$text", label: "Look text" },
  { value: "$accent", label: "Look accent" },
  { value: "$textMuted", label: "Look muted" },
];

/**
 * Ten hues x five lightnesses. Ordered light to dark down each column so a row reads as one
 * intensity across the spectrum, which is how you pick "a dark one" without hunting.
 */
const HUES: Array<{ name: string; shades: string[] }> = [
  { name: "Red", shades: ["#FFD9D6", "#FF9A94", "#F4564C", "#C8322A", "#7E1C17"] },
  { name: "Orange", shades: ["#FFE2C7", "#FFB570", "#FC7A18", "#C85A08", "#7A3604"] },
  { name: "Amber", shades: ["#FFEFC2", "#FFD666", "#F5B301", "#BE8A00", "#7A5800"] },
  { name: "Lime", shades: ["#ECF9C0", "#D0EE70", "#A8CE22", "#7D9A14", "#4E610B"] },
  { name: "Green", shades: ["#CDF2DC", "#7FDCA8", "#34B871", "#238A53", "#145433"] },
  { name: "Teal", shades: ["#C8F1F0", "#6FDCDA", "#20B7B4", "#158B89", "#0B5655"] },
  { name: "Blue", shades: ["#D3E6FF", "#88BCFF", "#2A7FF5", "#1A5BB8", "#0E3872"] },
  { name: "Indigo", shades: ["#DCDCFF", "#A9A7FA", "#6A63EC", "#4840B4", "#2B2670"] },
  { name: "Violet", shades: ["#F0D9FF", "#D09BF7", "#A758E0", "#7E3CAC", "#4E236B"] },
  { name: "Pink", shades: ["#FFD9EC", "#FF9BC8", "#F2509B", "#BD2F71", "#761A44"] },
];

/** Paper, ink and everything between. */
const NEUTRALS = ["#FFFFFF", "#F4F2ED", "#DCD8D0", "#B4AFA6", "#7E7A72", "#4A4741", "#262421", "#111111"];

const isOn = (value: string | null, candidate: string) =>
  (value ?? "").toUpperCase() === candidate.toUpperCase();

export function PalettePicker({ value, onChange, allowNone = false, onNone }: PalettePickerProps) {
  return (
    <div className="palette" data-testid="palette-picker">
      <div className="palette-section">
        <span className="palette-label">Follows the look</span>
        <div className="palette-row">
          {TOKENS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`palette-token ${isOn(value, t.value) ? "on" : ""}`}
              title={t.label}
              aria-label={t.label}
              data-testid={`palette-${t.value.replace("$", "")}`}
              onClick={() => onChange(t.value)}
            >
              {t.label.replace("Look ", "")}
            </button>
          ))}
          {allowNone && (
            <button
              type="button"
              className={`palette-token ${value === null ? "on" : ""}`}
              title="No colour"
              onClick={() => onNone?.()}
            >
              none
            </button>
          )}
        </div>
      </div>

      <div className="palette-section">
        <span className="palette-label">Neutrals</span>
        <div className="palette-neutrals">
          {NEUTRALS.map((c) => (
            <button
              key={c}
              type="button"
              className={`palette-chip ${isOn(value, c) ? "on" : ""}`}
              style={{ background: c }}
              title={c}
              aria-label={c}
              data-testid={`palette-${c.replace("#", "")}`}
              onClick={() => onChange(c)}
            />
          ))}
        </div>
      </div>

      <div className="palette-section">
        <span className="palette-label">Colours</span>
        <div className="palette-grid">
          {HUES.map((h) => (
            <div className="palette-col" key={h.name}>
              {h.shades.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`palette-chip ${isOn(value, c) ? "on" : ""}`}
                  style={{ background: c }}
                  title={`${h.name} ${c}`}
                  aria-label={`${h.name} ${c}`}
                  data-testid={`palette-${c.replace("#", "")}`}
                  onClick={() => onChange(c)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <label className="palette-custom">
        <span>Any colour</span>
        <input
          type="color"
          value={/^#[0-9A-F]{6}$/i.test(value ?? "") ? (value as string) : "#111111"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          data-testid="palette-custom"
        />
      </label>
    </div>
  );
}

/** Every literal colour the palette offers, for tests and for the look linter. */
export const PALETTE_COLOURS = [...NEUTRALS, ...HUES.flatMap((h) => h.shades)];
