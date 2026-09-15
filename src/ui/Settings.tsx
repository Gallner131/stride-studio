// Settings sheet — §6.11.
//
// This exists because PR-A4 made `prefs.hrMax` a source of heart-rate zones and there was
// nowhere to enter one. Zones come from the athlete's Strava zones or from a maximum they
// tell us themselves; without this sheet the second half of that was unreachable.
//
// Every change writes through immediately and calls `onChange`, so the design on the stage
// re-renders as the number is typed. A preference that only takes effect after a reload
// looks exactly like a preference that does not work.
import { useEffect, useState } from "react";
import type { Prefs } from "../storage/db";
import { loadPrefs, savePrefs } from "../storage/db";

export interface SettingsProps {
  onClose: () => void;
  onChange?: (prefs: Prefs) => void;
}

export function Settings({ onClose, onChange }: SettingsProps) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());

  // Escape closes, as it does for a native dialog. The app's other sheets rely on a click
  // on the backdrop, which is unreachable from a keyboard — and this file, unlike App.jsx,
  // is linted, so the gap showed up rather than shipping quietly.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs({ [key]: value });
    onChange?.(next);
  }

  return (
    // Same shell as the app's other sheets. The backdrop is a real button rather than a div
    // with a click handler, so closing by clicking away is reachable by keyboard too.
    <div className="backdrop">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "none", border: 0, cursor: "default" }}
      />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{ position: "relative" }}
        data-testid="settings-sheet"
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <h2>Settings</h2>
          <button type="button" className="link" onClick={onClose} data-testid="settings-close">
            Close
          </button>
        </div>

        <div className="stack">
          <section>
            <h3 className="label">Units</h3>
            <label className="field">
              <span className="muted small">Distance</span>
              <select
                value={prefs.units}
                onChange={(e) => update("units", e.target.value as Prefs["units"])}
                data-testid="prefs-units"
              >
                <option value="km">Kilometres</option>
                <option value="mi">Miles</option>
              </select>
            </label>
          </section>

          <section>
            <h3 className="label">Heart rate</h3>
            <label className="field">
              <span className="muted small">Your max heart rate</span>
              <input
                className="wide"
                type="number"
                inputMode="numeric"
                min={100}
                max={230}
                placeholder="e.g. 190"
                value={prefs.hrMax ?? ""}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  update("hrMax", Number.isFinite(v) && v > 0 ? v : null);
                }}
                data-testid="prefs-hrmax"
              />
            </label>
            <p className="muted small">
              Used to work out your zones. If you connect Strava we use the zones from your Strava settings
              instead — those are the ones you already trust. Either way, we never guess them from a single
              run.
            </p>
          </section>

          <section>
            <h3 className="label">Appearance</h3>
            <label className="field">
              <span className="muted small">Theme</span>
              <select
                value={prefs.theme ?? "auto"}
                onChange={(e) => update("theme", e.target.value as Prefs["theme"])}
                data-testid="prefs-theme"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Match system</option>
              </select>
            </label>
          </section>

          <section>
            <h3 className="label">Editor</h3>
            <label className="row">
              <span className="small">Show safe zones by default</span>
              <input
                type="checkbox"
                checked={prefs.safeZones}
                onChange={(e) => update("safeZones", e.target.checked)}
                data-testid="prefs-safezones"
              />
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}
