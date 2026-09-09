import React from "react";

/**
 * A labelled inspector row. Deliberately a <div> with a <span> label rather than a <label>:
 * the children are often several controls (a slider plus a number box, a chip group), so a
 * single <label> would claim to caption exactly one of them and mis-announce the rest.
 */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="ins-row" aria-label={label}>
      <span className="muted small">{label}</span>
      <span className="ins-control">{children}</span>
    </fieldset>
  );
}

export function Section({
  title,
  children,
  open = false,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(open);
  return (
    <div className={`ins-section ${expanded ? "open" : ""}`}>
      <button
        type="button"
        className="ins-head"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      >
        <strong>{title}</strong>
        <span className="muted">{expanded ? "–" : "+"}</span>
      </button>
      {expanded && <div className="ins-body">{children}</div>}
    </div>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function NumberSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <span className="numslider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        className="numbox"
        min={min}
        max={max}
        step={step}
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
      {suffix && <em className="muted small">{suffix}</em>}
    </span>
  );
}

export const SWATCHES = [
  "#FFFFFF",
  "#111111",
  "#D8FF3A",
  "#FFD23F",
  "#FF6B6B",
  "#FF2D95",
  "#C7B8FF",
  "#5AC8FA",
  "#2BD4BD",
  "#F5EFE0",
  "#2A5BFF",
  "#E8461E",
];

export function ColorPicker({
  value,
  onChange,
  allowNone = false,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  allowNone?: boolean;
}) {
  return (
    <span className="swatches tight">
      {allowNone && (
        <button
          type="button"
          className={`swatch auto ${value === null ? "on" : ""}`}
          onClick={() => onChange(null)}
          title="None"
        >
          –
        </button>
      )}
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          title={c}
          className={`swatch ${value?.toUpperCase() === c ? "on" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="swatch custom" title="Custom colour">
        +
        <input
          type="color"
          value={/^#[0-9A-F]{6}$/i.test(value ?? "") ? (value as string) : "#ffffff"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      </label>
    </span>
  );
}
