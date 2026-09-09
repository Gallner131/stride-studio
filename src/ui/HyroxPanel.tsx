import React from "react";
import { useEditor } from "../editor/store";
import { newHyroxBreakdown, newHyroxSplits, newHyroxStations, newTextLayer } from "../model/defaults";
import type { HyroxDivision, HyroxResult } from "../model/hyrox";
import { DIVISION_LABEL, deriveHyrox, formatTime, parseHyroxPaste } from "../model/hyrox";

const SAMPLE = `HYROX London 2026
Open Men 30-34
Running 1 00:04:52
1000m SkiErg 00:04:21
Running 2 00:05:10
50m Sled Push 00:02:48
Running 3 00:05:22
50m Sled Pull 00:03:41
Running 4 00:05:31
80m Burpee Broad Jump 00:05:02
Running 5 00:05:40
1000m Row 00:04:12
Running 6 00:05:35
200m Farmers Carry 00:02:31
Running 7 00:05:44
100m Sandbag Lunges 00:04:18
Running 8 00:05:12
Wall Balls 00:06:44
Roxzone 00:06:12
Overall 01:22:55`;

export interface HyroxPanelProps {
  hyrox: HyroxResult | null;
  onApply: (result: HyroxResult | null) => void;
  onToast: (message: string) => void;
}

/**
 * HYROX input.
 *
 * Paste rather than lookup, deliberately. results.hyrox.com has no public API and returns
 * 403 to automated requests, so a lookup would mean proxy-scraping a site that does not
 * want to be scraped — fragile, and it would be the only feature sending your identity off
 * the device. Copying your own splits table costs one extra gesture and needs no network
 * call at all.
 */
export function HyroxPanel({ hyrox, onApply, onToast }: HyroxPanelProps) {
  const [paste, setPaste] = React.useState("");
  const [problems, setProblems] = React.useState<string[]>([]);
  const addLayer = useEditor((s) => s.addLayer);
  const patchDoc = useEditor((s) => s.patchDoc);

  const handleParse = (text: string) => {
    const { result, problems: found, segmentsFound } = parseHyroxPaste(text);
    setProblems(found);
    if (!result) {
      onToast("Could not read that. Copy the whole splits table.");
      return;
    }
    onApply(result);
    patchDoc((d) => {
      d.name = result.event;
    });
    onToast(`Read ${segmentsFound} of 16 segments`);
  };

  const derived = hyrox ? deriveHyrox(hyrox) : null;

  return (
    <div className="stack hyrox-panel">
      <div className="card">
        <div className="muted small label">Your HYROX result</div>
        <p className="small" style={{ marginTop: 0 }}>
          Open your result on <strong>results.hyrox.com</strong>, select the splits table and copy it. Paste
          it here — nothing leaves your phone.
        </p>
        <textarea
          className="wide hyrox-paste"
          rows={5}
          placeholder={"Running 1  00:04:52\n1000m SkiErg  00:04:21\n…"}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text) {
              e.preventDefault();
              setPaste(text);
              handleParse(text);
            }
          }}
          data-testid="hyrox-paste"
        />
        <div className="btnrow">
          <button
            type="button"
            className="btn primary"
            onClick={() => handleParse(paste)}
            data-testid="hyrox-read"
          >
            Read splits
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPaste(SAMPLE);
              handleParse(SAMPLE);
            }}
            data-testid="hyrox-sample"
          >
            Use a sample race
          </button>
          {hyrox && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                onApply(null);
                setPaste("");
                setProblems([]);
              }}
              data-testid="hyrox-clear"
            >
              Clear
            </button>
          )}
        </div>

        {problems.length > 0 && (
          <ul className="hyrox-problems" data-testid="hyrox-problems">
            {problems.map((p) => (
              <li key={p} className="small">
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hyrox && derived && (
        <>
          <div className="card" data-testid="hyrox-summary">
            <div className="row">
              <div>
                <strong>{hyrox.event}</strong>{" "}
                <span className="muted small">
                  {DIVISION_LABEL[hyrox.division]}
                  {hyrox.ageGroup ? ` · ${hyrox.ageGroup}` : ""}
                </span>
                <div className="muted small">
                  {formatTime(derived.totalSeconds)} · running {formatTime(derived.runSeconds)} · stations{" "}
                  {formatTime(derived.stationSeconds)} · roxzone {formatTime(derived.roxzoneSeconds)} (
                  {Math.round(derived.roxzoneShare * 1000) / 10}%)
                </div>
              </div>
            </div>

            <div className="grid2" style={{ marginTop: 10 }}>
              <Field label="Division">
                <select
                  value={hyrox.division}
                  onChange={(e) => onApply({ ...hyrox, division: e.target.value as HyroxDivision })}
                  data-testid="hyrox-division"
                >
                  {(Object.keys(DIVISION_LABEL) as HyroxDivision[]).map((d) => (
                    <option key={d} value={d}>
                      {DIVISION_LABEL[d]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Event name">
                <input
                  value={hyrox.event}
                  onChange={(e) => onApply({ ...hyrox, event: e.target.value })}
                  data-testid="hyrox-event"
                />
              </Field>
            </div>

            {!derived.complete && (
              <p className="small" style={{ marginBottom: 0 }}>
                Some splits are missing, so the visuals show only what was read. Nothing is invented.
              </p>
            )}
          </div>

          <div className="card">
            <div className="muted small label">Add a HYROX visual</div>
            <div className="tiles">
              <button
                type="button"
                className="tile"
                data-testid="add-hyrox-breakdown"
                onClick={() => addLayer(newHyroxBreakdown())}
              >
                <span className="tile-icon" aria-hidden="true">
                  ▤
                </span>
                <strong>Time breakdown</strong>
                <em className="muted">Running vs stations vs roxzone</em>
              </button>
              <button
                type="button"
                className="tile"
                data-testid="add-hyrox-stations"
                onClick={() => addLayer(newHyroxStations())}
              >
                <span className="tile-icon" aria-hidden="true">
                  ▥
                </span>
                <strong>Station times</strong>
                <em className="muted">Eight bars, slowest marked</em>
              </button>
              <button
                type="button"
                className="tile"
                data-testid="add-hyrox-splits"
                onClick={() => addLayer(newHyroxSplits())}
              >
                <span className="tile-icon" aria-hidden="true">
                  ☰
                </span>
                <strong>Splits table</strong>
                <em className="muted">All 16 segments</em>
              </button>
              <button
                type="button"
                className="tile"
                data-testid="add-hyrox-hero"
                onClick={() =>
                  addLayer(
                    newTextLayer({
                      name: "Finish time",
                      text: "{hyroxTotal}",
                      style: {
                        ...newTextLayer().style,
                        size: 210,
                        weight: 800,
                        font: "cond",
                        align: "center",
                        letterSpacing: -0.03,
                      },
                    }),
                  )
                }
              >
                <span className="tile-icon" aria-hidden="true">
                  ⏱
                </span>
                <strong>Finish time</strong>
                <em className="muted">The hero number</em>
              </button>
              <button
                type="button"
                className="tile"
                data-testid="add-hyrox-roxzone"
                onClick={() =>
                  addLayer(
                    newTextLayer({
                      name: "Roxzone",
                      text: "Roxzone {roxzone} · {roxzonePercent}% of the race",
                      style: { ...newTextLayer().style, size: 40, weight: 600, align: "center" },
                    }),
                  )
                }
              >
                <span className="tile-icon" aria-hidden="true">
                  %
                </span>
                <strong>Roxzone line</strong>
                <em className="muted">The time nobody counts</em>
              </button>
              <button
                type="button"
                className="tile"
                data-testid="add-hyrox-card"
                onClick={() => {
                  addLayer(
                    newTextLayer({
                      name: "Event",
                      text: "{hyroxEvent} · {hyroxDivision}",
                      anchor: { ax: 0.5, ay: 0 },
                      origin: { ox: 0.5, oy: 0 },
                      offset: { dx: 0, dy: 300 },
                      style: {
                        ...newTextLayer().style,
                        size: 38,
                        weight: 600,
                        align: "center",
                        uppercase: true,
                        letterSpacing: 0.06,
                      },
                    }),
                  );
                  addLayer(
                    newTextLayer({
                      name: "Finish time",
                      text: "{hyroxTotal}",
                      anchor: { ax: 0.5, ay: 0 },
                      origin: { ox: 0.5, oy: 0 },
                      offset: { dx: 0, dy: 360 },
                      style: {
                        ...newTextLayer().style,
                        size: 190,
                        weight: 800,
                        font: "cond",
                        align: "center",
                        letterSpacing: -0.03,
                      },
                    }),
                  );
                  addLayer(
                    newHyroxBreakdown({
                      anchor: { ax: 0.5, ay: 0 },
                      origin: { ox: 0.5, oy: 0 },
                      offset: { dx: 0, dy: 600 },
                    }),
                  );
                  addLayer(
                    newHyroxStations({
                      anchor: { ax: 0.5, ay: 1 },
                      origin: { ox: 0.5, oy: 1 },
                      offset: { dx: 0, dy: -420 },
                      h: 470,
                    }),
                  );
                  onToast("Race card added — drag anything to move it");
                }}
              >
                <span className="tile-icon" aria-hidden="true">
                  ✦
                </span>
                <strong>Race card</strong>
                <em className="muted">The whole lot, laid out</em>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="muted small">{label}</span>
      {children}
    </label>
  );
}
