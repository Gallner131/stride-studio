import { firstSelected, useEditor } from "../editor/store";
import { STAT_FIELDS } from "../engine/dataLayers";
import { STICKERS } from "../engine/stickers";
import { FONT_STACKS } from "../engine/text";
import { BINDING_CHIPS } from "../model/bindings";
import type {
  AnimPreset,
  ChartLayer,
  ImageLayer,
  Layer,
  RouteLayer,
  ShapeLayer,
  StatLayer,
  StatRowLayer,
  StickerLayer,
  TextLayer,
} from "../model/types";
import { ColorPicker, NumberSlider, Row, Section, Seg } from "./atoms";

const FONT_LABELS: [string, string][] = [
  ["sans", "Modern"],
  ["cond", "Condensed"],
  ["serif", "Editorial"],
  ["mono", "Mono"],
  ["script", "Handwritten"],
  ["rounded", "Rounded"],
];

const ANIM_PRESETS: [AnimPreset, string][] = [
  ["none", "None"],
  ["fadeIn", "Fade in"],
  ["slideUp", "Slide up"],
  ["slideDown", "Slide down"],
  ["slideLeft", "Slide left"],
  ["slideRight", "Slide right"],
  ["scaleIn", "Scale in"],
  ["typewriter", "Typewriter"],
  ["pulse", "Pulse"],
];

/** Contextual inspector — §6.4. Controls are for the selected element, not a wall of tabs. */
export function Inspector({ onDone }: { onDone: () => void }) {
  const layer = useEditor(firstSelected);
  const patchLayer = useEditor((s) => s.patchLayer);
  const removeLayer = useEditor((s) => s.removeLayer);
  const duplicateLayer = useEditor((s) => s.duplicateLayer);
  const bringForward = useEditor((s) => s.bringForward);
  const sendBackward = useEditor((s) => s.sendBackward);
  const setEditingText = useEditor((s) => s.setEditingText);

  if (!layer) {
    return <p className="muted small">Tap something on the design to edit it.</p>;
  }

  const patch = (fn: (l: Layer) => void) => patchLayer(layer.id, fn);

  return (
    <div className="inspector" data-testid="inspector">
      <div className="row ins-title">
        <strong>{layer.name}</strong>
        <button type="button" className="link" onClick={onDone} data-testid="inspector-done">
          Done
        </button>
      </div>

      {layer.type === "text" && (
        <TextControls layer={layer} patch={patch} onEdit={() => setEditingText(layer.id)} />
      )}
      {layer.type === "shape" && <ShapeControls layer={layer} patch={patch} />}
      {layer.type === "image" && <ImageControls layer={layer} patch={patch} />}
      {layer.type === "sticker" && <StickerControls layer={layer} patch={patch} />}
      {layer.type === "stat" && <StatControls layer={layer} patch={patch} />}
      {layer.type === "statRow" && <StatRowControls layer={layer} patch={patch} />}
      {layer.type === "route" && <RouteControls layer={layer} patch={patch} />}
      {layer.type === "chart" && <ChartControls layer={layer} patch={patch} />}

      <Section title="Animation">
        <Row label="Preset">
          <select
            value={layer.anim.preset}
            onChange={(e) =>
              patch((l) => {
                l.anim.preset = e.target.value as AnimPreset;
              })
            }
            data-testid="anim-preset"
          >
            {ANIM_PRESETS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Delay">
          <NumberSlider
            value={layer.anim.delay === "auto" ? 0 : layer.anim.delay}
            min={0}
            max={4}
            step={0.1}
            suffix="s"
            onChange={(v) =>
              patch((l) => {
                l.anim.delay = v;
              })
            }
          />
        </Row>
        <Row label="Duration">
          <NumberSlider
            value={layer.anim.duration}
            min={0.1}
            max={4}
            step={0.1}
            suffix="s"
            onChange={(v) =>
              patch((l) => {
                l.anim.duration = v;
              })
            }
          />
        </Row>
      </Section>

      <Section title="Arrange">
        <Row label="Opacity">
          <NumberSlider
            value={layer.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) =>
              patch((l) => {
                l.opacity = v;
              })
            }
          />
        </Row>
        <Row label="Rotation">
          <NumberSlider
            value={layer.rotation}
            min={-180}
            max={180}
            step={1}
            suffix="°"
            onChange={(v) =>
              patch((l) => {
                l.rotation = v;
              })
            }
          />
        </Row>
        <Row label="Position">
          <span className="steppers">
            <button
              type="button"
              onClick={() =>
                patch((l) => {
                  l.offset.dx -= 10;
                })
              }
            >
              ←
            </button>
            <button
              type="button"
              onClick={() =>
                patch((l) => {
                  l.offset.dx += 10;
                })
              }
            >
              →
            </button>
            <button
              type="button"
              onClick={() =>
                patch((l) => {
                  l.offset.dy -= 10;
                })
              }
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() =>
                patch((l) => {
                  l.offset.dy += 10;
                })
              }
            >
              ↓
            </button>
          </span>
        </Row>
        <Row label="In the sticker export">
          <Seg
            value={layer.sticker ? "yes" : "no"}
            options={[
              ["yes", "Included"],
              ["no", "Excluded"],
            ]}
            onChange={(v) =>
              patch((l) => {
                l.sticker = v === "yes";
              })
            }
          />
        </Row>
        <div className="ins-actions">
          <button type="button" className="btn" onClick={() => bringForward(layer.id)}>
            Forward
          </button>
          <button type="button" className="btn" onClick={() => sendBackward(layer.id)}>
            Back
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => duplicateLayer(layer.id)}
            data-testid="dup-layer"
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => removeLayer(layer.id)}
            data-testid="delete-layer"
          >
            Delete
          </button>
        </div>
      </Section>
    </div>
  );
}

function TextControls({
  layer,
  patch,
  onEdit,
}: {
  layer: TextLayer;
  patch: (fn: (l: Layer) => void) => void;
  onEdit: () => void;
}) {
  const set = (fn: (t: TextLayer) => void) => patch((l) => fn(l as TextLayer));

  return (
    <>
      <Section title="Colour" open>
        <Row label="Text">
          <ColorPicker
            value={layer.style.color}
            onChange={(c) =>
              set((t) => {
                t.style.color = c ?? "#FFFFFF";
              })
            }
          />
        </Row>
        <Row label="Shadow">
          <Seg
            value={layer.style.shadow ? "on" : "off"}
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(v) =>
              set((t) => {
                t.style.shadow = v === "on";
              })
            }
          />
        </Row>
        <Row label="Behind the text">
          <ColorPicker
            allowNone
            value={layer.style.fill?.color ?? null}
            onChange={(c) =>
              set((t) => {
                t.style.fill = c
                  ? { color: c, pad: t.style.fill?.pad ?? 18, radius: t.style.fill?.radius ?? 14 }
                  : null;
              })
            }
          />
        </Row>
      </Section>
      <Section title="Text" open>
        <textarea
          className="wide"
          rows={3}
          value={layer.text}
          onChange={(e) =>
            set((t) => {
              t.text = e.target.value;
            })
          }
          data-testid="layer-text"
        />
        <div className="chips tight">
          {BINDING_CHIPS.map((c) => (
            <button
              key={c.token}
              type="button"
              className="chip"
              onClick={() =>
                set((t) => {
                  t.text = `${t.text}${c.token}`;
                })
              }
              title={`Insert ${c.token}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={onEdit} data-testid="edit-on-canvas">
          Edit on the design
        </button>
      </Section>

      <Section title="Type" open>
        <Row label="Font">
          <span className="chips tight">
            {FONT_LABELS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip ${layer.style.font === id ? "on" : ""}`}
                style={{ fontFamily: FONT_STACKS[id] }}
                onClick={() =>
                  set((t) => {
                    t.style.font = id;
                  })
                }
                data-testid={`font-${id}`}
              >
                {label}
              </button>
            ))}
          </span>
        </Row>
        <Row label="Size">
          <NumberSlider
            value={layer.style.size}
            min={16}
            max={400}
            onChange={(v) =>
              set((t) => {
                t.style.size = v;
              })
            }
          />
        </Row>
        <Row label="Weight">
          <Seg
            value={String(layer.style.weight)}
            options={[
              ["400", "Regular"],
              ["600", "Medium"],
              ["800", "Bold"],
            ]}
            onChange={(v) =>
              set((t) => {
                t.style.weight = Number(v);
              })
            }
          />
        </Row>
        <Row label="Align">
          <Seg
            value={layer.style.align}
            options={[
              ["left", "Left"],
              ["center", "Centre"],
              ["right", "Right"],
            ]}
            onChange={(v) =>
              set((t) => {
                t.style.align = v;
              })
            }
          />
        </Row>
        <Row label="Line height">
          <NumberSlider
            value={layer.style.lineHeight}
            min={0.8}
            max={2}
            step={0.05}
            onChange={(v) =>
              set((t) => {
                t.style.lineHeight = v;
              })
            }
          />
        </Row>
        <Row label="Letter spacing">
          <NumberSlider
            value={layer.style.letterSpacing}
            min={-0.08}
            max={0.3}
            step={0.01}
            onChange={(v) =>
              set((t) => {
                t.style.letterSpacing = v;
              })
            }
          />
        </Row>
        <Row label="Max width">
          <NumberSlider
            value={layer.style.maxWidth}
            min={120}
            max={1000}
            step={10}
            onChange={(v) =>
              set((t) => {
                t.style.maxWidth = v;
              })
            }
          />
        </Row>
        <Row label="Uppercase">
          <Seg
            value={layer.style.uppercase ? "on" : "off"}
            options={[
              ["off", "Off"],
              ["on", "ON"],
            ]}
            onChange={(v) =>
              set((t) => {
                t.style.uppercase = v === "on";
              })
            }
          />
        </Row>
      </Section>

      <Section title="Effects">
        <Row label="Effect">
          <select
            value={layer.style.effect.kind}
            onChange={(e) =>
              set((t) => {
                t.style.effect = {
                  ...t.style.effect,
                  kind: e.target.value as TextLayer["style"]["effect"]["kind"],
                };
              })
            }
            data-testid="text-effect"
          >
            {["none", "outline", "gradient", "highlight", "glow", "longShadow"].map((k) => (
              <option key={k} value={k}>
                {k === "longShadow" ? "Long shadow" : k[0]?.toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </Row>
        {layer.style.effect.kind !== "none" && (
          <Row label="Effect colour">
            <ColorPicker
              allowNone
              value={layer.style.effect.color ?? null}
              onChange={(c) =>
                set((t) => {
                  t.style.effect = { ...t.style.effect, color: c ?? undefined };
                })
              }
            />
          </Row>
        )}
      </Section>
    </>
  );
}

function ShapeControls({ layer, patch }: { layer: ShapeLayer; patch: (fn: (l: Layer) => void) => void }) {
  const set = (fn: (s: ShapeLayer) => void) => patch((l) => fn(l as ShapeLayer));
  return (
    <Section title="Shape" open>
      <Row label="Kind">
        <select
          value={layer.shape}
          onChange={(e) =>
            set((s) => {
              s.shape = e.target.value as ShapeLayer["shape"];
            })
          }
        >
          {["rect", "pill", "ellipse", "line", "tape"].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Fill">
        <ColorPicker
          allowNone
          value={layer.style.fill}
          onChange={(c) =>
            set((s) => {
              s.style.fill = c;
            })
          }
        />
      </Row>
      <Row label="Corner radius">
        <NumberSlider
          value={layer.style.radius}
          min={0}
          max={200}
          onChange={(v) =>
            set((s) => {
              s.style.radius = v;
            })
          }
        />
      </Row>
      <Row label="Width">
        <NumberSlider
          value={typeof layer.w === "number" ? layer.w : 300}
          min={20}
          max={1000}
          onChange={(v) =>
            set((s) => {
              s.w = v;
            })
          }
        />
      </Row>
      <Row label="Height">
        <NumberSlider
          value={typeof layer.h === "number" ? layer.h : 200}
          min={4}
          max={1400}
          onChange={(v) =>
            set((s) => {
              s.h = v;
            })
          }
        />
      </Row>
    </Section>
  );
}

function ImageControls({ layer, patch }: { layer: ImageLayer; patch: (fn: (l: Layer) => void) => void }) {
  const set = (fn: (i: ImageLayer) => void) => patch((l) => fn(l as ImageLayer));
  return (
    <Section title="Photo / logo" open>
      <Row label="Corner radius">
        <NumberSlider
          value={layer.style.radius}
          min={0}
          max={300}
          onChange={(v) =>
            set((i) => {
              i.style.radius = v;
            })
          }
        />
      </Row>
      <Row label="Shadow">
        <Seg
          value={layer.style.shadow ? "on" : "off"}
          options={[
            ["on", "On"],
            ["off", "Off"],
          ]}
          onChange={(v) =>
            set((i) => {
              i.style.shadow = v === "on";
            })
          }
        />
      </Row>
      <Row label="Width">
        <NumberSlider
          value={typeof layer.w === "number" ? layer.w : 300}
          min={40}
          max={1000}
          onChange={(v) =>
            set((i) => {
              const ratio = typeof i.h === "number" && typeof i.w === "number" ? i.h / i.w : 1;
              i.w = v;
              i.h = Math.round(v * ratio);
            })
          }
        />
      </Row>
    </Section>
  );
}

function StickerControls({ layer, patch }: { layer: StickerLayer; patch: (fn: (l: Layer) => void) => void }) {
  const set = (fn: (s: StickerLayer) => void) => patch((l) => fn(l as StickerLayer));
  return (
    <Section title="Sticker" open>
      <Row label="Colour">
        <ColorPicker
          value={layer.style.fill}
          onChange={(c) =>
            set((s) => {
              s.style.fill = c ?? "#FFFFFF";
            })
          }
        />
      </Row>
      <Row label="Size">
        <NumberSlider
          value={typeof layer.w === "number" ? layer.w : 160}
          min={40}
          max={800}
          onChange={(v) =>
            set((s) => {
              s.w = v;
              s.h = v;
            })
          }
        />
      </Row>
      <div className="sticker-grid">
        {STICKERS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`sticker-pick ${layer.svgId === s.id ? "on" : ""}`}
            title={s.name}
            onClick={() =>
              set((l) => {
                l.svgId = s.id;
              })
            }
          >
            <svg viewBox="0 0 100 100" aria-label={s.name}>
              <path
                d={s.d}
                fill={s.strokeOnly ? "none" : "currentColor"}
                stroke="currentColor"
                strokeWidth={s.strokeOnly ? 8 : 0}
              />
            </svg>
          </button>
        ))}
      </div>
    </Section>
  );
}

function StatControls({ layer, patch }: { layer: StatLayer; patch: (fn: (l: Layer) => void) => void }) {
  const set = (fn: (s: StatLayer) => void) => patch((l) => fn(l as StatLayer));
  return (
    <>
      <Section title="Colour" open>
        <Row label="Value">
          <ColorPicker
            value={layer.style.valueColor}
            onChange={(c) =>
              set((s) => {
                s.style.valueColor = c ?? "#FFFFFF";
              })
            }
          />
        </Row>
        <Row label="Label">
          <ColorPicker
            value={layer.style.labelColor}
            onChange={(c) =>
              set((s) => {
                s.style.labelColor = c ?? "#FFFFFF";
              })
            }
          />
        </Row>
      </Section>
      <Section title="Data" open>
        <Row label="Field">
          <select
            value={layer.field}
            onChange={(e) =>
              set((s) => {
                s.field = e.target.value;
              })
            }
            data-testid="stat-field"
          >
            {STAT_FIELDS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Label">
          <Seg
            value={layer.showLabel ? "on" : "off"}
            options={[
              ["on", "Shown"],
              ["off", "Hidden"],
            ]}
            onChange={(v) =>
              set((s) => {
                s.showLabel = v === "on";
              })
            }
          />
        </Row>
        <Row label="Layout">
          <Seg
            value={layer.layout}
            options={[
              ["stacked", "Stacked"],
              ["inline", "Inline"],
              ["labelAbove", "Label on top"],
            ]}
            onChange={(v) =>
              set((s) => {
                s.layout = v;
              })
            }
          />
        </Row>
        <Row label="Count up">
          <Seg
            value={layer.countUp ? "on" : "off"}
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(v) =>
              set((s) => {
                s.countUp = v === "on";
              })
            }
          />
        </Row>
      </Section>
      <Section title="Type">
        <Row label="Size">
          <NumberSlider
            value={layer.style.valueSize}
            min={24}
            max={420}
            onChange={(v) =>
              set((s) => {
                s.style.valueSize = v;
              })
            }
          />
        </Row>
        <Row label="Font">
          <span className="chips tight">
            {FONT_LABELS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip ${layer.style.valueFont === id ? "on" : ""}`}
                style={{ fontFamily: FONT_STACKS[id] }}
                onClick={() =>
                  set((s) => {
                    s.style.valueFont = id;
                  })
                }
              >
                {label}
              </button>
            ))}
          </span>
        </Row>
        <Row label="Label size">
          <NumberSlider
            value={layer.style.labelSize}
            min={12}
            max={90}
            onChange={(v) =>
              set((s) => {
                s.style.labelSize = v;
              })
            }
          />
        </Row>
      </Section>
    </>
  );
}

function StatRowControls({ layer, patch }: { layer: StatRowLayer; patch: (fn: (l: Layer) => void) => void }) {
  const set = (fn: (s: StatRowLayer) => void) => patch((l) => fn(l as StatRowLayer));
  return (
    <>
      <Section title="Colour" open>
        <Row label="Value">
          <ColorPicker
            value={layer.style.color}
            onChange={(c) =>
              set((s) => {
                s.style.color = c ?? "#FFFFFF";
              })
            }
          />
        </Row>
      </Section>
      <Section title="Data" open>
        <p className="muted small" style={{ margin: 0 }}>
          Tap to add or remove. Fields your activity does not have are dropped automatically.
        </p>
        <div className="chips tight">
          {STAT_FIELDS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${layer.fields.includes(f.id) ? "on" : ""}`}
              data-testid={`row-field-${f.id}`}
              onClick={() =>
                set((s) => {
                  s.fields = s.fields.includes(f.id)
                    ? s.fields.filter((x) => x !== f.id)
                    : [...s.fields, f.id];
                })
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <Row label="Labels">
          <Seg
            value={layer.showLabels ? "on" : "off"}
            options={[
              ["on", "Shown"],
              ["off", "Hidden"],
            ]}
            onChange={(v) =>
              set((s) => {
                s.showLabels = v === "on";
              })
            }
          />
        </Row>
      </Section>
      <Section title="Layout">
        <Row label="Direction">
          <Seg
            value={layer.layout}
            options={[
              ["row", "Row"],
              ["column", "Column"],
              ["grid2", "Grid"],
            ]}
            onChange={(v) =>
              set((s) => {
                s.layout = v;
              })
            }
          />
        </Row>
        <Row label="Gap">
          <NumberSlider
            value={layer.gap}
            min={8}
            max={160}
            onChange={(v) =>
              set((s) => {
                s.gap = v;
              })
            }
          />
        </Row>
        <Row label="Divider">
          <Seg
            value={layer.divider}
            options={[
              ["none", "None"],
              ["dot", "Dot"],
              ["line", "Line"],
            ]}
            onChange={(v) =>
              set((s) => {
                s.divider = v;
              })
            }
          />
        </Row>
        <Row label="Panel">
          <Seg
            value={layer.style.panel ? layer.style.panel.kind : "none"}
            options={[
              ["none", "None"],
              ["glass", "Glass"],
              ["solid", "Solid"],
            ]}
            onChange={(v) =>
              set((s) => {
                s.style.panel =
                  v === "none"
                    ? null
                    : {
                        kind: v as "glass" | "solid",
                        color: v === "glass" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.55)",
                        pad: 26,
                        radius: 22,
                      };
              })
            }
          />
        </Row>
        <Row label="Size">
          <NumberSlider
            value={layer.style.valueSize}
            min={18}
            max={140}
            onChange={(v) =>
              set((s) => {
                s.style.valueSize = v;
              })
            }
          />
        </Row>
      </Section>
    </>
  );
}

function RouteControls({ layer, patch }: { layer: RouteLayer; patch: (fn: (l: Layer) => void) => void }) {
  const set = (fn: (r: RouteLayer) => void) => patch((l) => fn(l as RouteLayer));
  const modes: RouteLayer["style"]["mode"][] = [
    "solid",
    "dotted",
    "dashed",
    "glow",
    "tube",
    "sketch",
    "extrude",
  ];
  return (
    <>
      <Section title="Style" open>
        <Row label="Line">
          <span className="chips tight">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${layer.style.mode === m ? "on" : ""}`}
                data-testid={`route-mode-${m}`}
                onClick={() =>
                  set((r) => {
                    r.style.mode = m;
                  })
                }
              >
                {m}
              </button>
            ))}
          </span>
        </Row>
        <Row label="Colour by">
          <Seg
            value={layer.style.colorBy}
            options={[
              ["none", "One colour"],
              ["pace", "Pace"],
              ["hr", "HR"],
              ["elevation", "Grade"],
            ]}
            onChange={(v) =>
              set((r) => {
                r.style.colorBy = v;
              })
            }
          />
        </Row>
        <Row label="Colour">
          <ColorPicker
            value={layer.style.stroke}
            onChange={(c) =>
              set((r) => {
                r.style.stroke = c ?? "#FFFFFF";
              })
            }
          />
        </Row>
        <Row label="Width">
          <NumberSlider
            value={layer.style.width}
            min={2}
            max={40}
            onChange={(v) =>
              set((r) => {
                r.style.width = v;
              })
            }
          />
        </Row>
        <Row label="Ends">
          <Seg
            value={layer.style.endpoints}
            options={[
              ["dots", "Dots"],
              ["pins", "Pins"],
              ["flags", "Flags"],
              ["none", "None"],
            ]}
            onChange={(v) =>
              set((r) => {
                r.style.endpoints = v;
              })
            }
          />
        </Row>
      </Section>
      <Section title="Markers">
        <Row label="Km dots">
          <Seg
            value={layer.style.markers.km ? "on" : "off"}
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(v) =>
              set((r) => {
                r.style.markers.km = v === "on";
              })
            }
          />
        </Row>
        <Row label="Km labels">
          <Seg
            value={layer.style.markers.labels ? "on" : "off"}
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(v) =>
              set((r) => {
                r.style.markers.labels = v === "on";
              })
            }
          />
        </Row>
        <Row label="Arrows">
          <Seg
            value={layer.style.markers.arrows ? "on" : "off"}
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(v) =>
              set((r) => {
                r.style.markers.arrows = v === "on";
              })
            }
          />
        </Row>
        <Row label="Runner dot">
          <Seg
            value={layer.style.runnerDot ? "on" : "off"}
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(v) =>
              set((r) => {
                r.style.runnerDot = v === "on";
              })
            }
          />
        </Row>
        <Row label="Fill loops">
          <Seg
            value={layer.style.silhouette ? "on" : "off"}
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(v) =>
              set((r) => {
                r.style.silhouette = v === "on";
              })
            }
          />
        </Row>
      </Section>
      <Section title="Detail">
        <Row label="Simplify">
          <NumberSlider
            value={layer.style.simplify}
            min={0}
            max={12}
            step={0.5}
            onChange={(v) =>
              set((r) => {
                r.style.simplify = v;
              })
            }
          />
        </Row>
      </Section>
    </>
  );
}

function ChartControls({ layer, patch }: { layer: ChartLayer; patch: (fn: (l: Layer) => void) => void }) {
  const set = (fn: (c: ChartLayer) => void) => patch((l) => fn(l as ChartLayer));
  const kinds: ChartLayer["kind"][] = ["hr", "pace", "elevation", "splits", "zones", "rings"];
  return (
    <>
      <Section title="Colour" open>
        <Row label="Accent">
          <ColorPicker
            value={layer.style.color}
            onChange={(c) =>
              set((ch) => {
                ch.style.color = c ?? "#D8FF3A";
              })
            }
          />
        </Row>
        <Row label="Text">
          <ColorPicker
            value={layer.style.text}
            onChange={(c) =>
              set((ch) => {
                ch.style.text = c ?? "#FFFFFF";
              })
            }
          />
        </Row>
      </Section>
      <Section title="Chart" open>
        <Row label="Kind">
          <span className="chips tight">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className={`chip ${layer.kind === k ? "on" : ""}`}
                data-testid={`chart-kind-${k}`}
                onClick={() =>
                  set((c) => {
                    c.kind = k;
                  })
                }
              >
                {k}
              </button>
            ))}
          </span>
        </Row>
        {layer.kind === "hr" && (
          <>
            <Row label="Zone colours">
              <Seg
                value={layer.options.zoneColours ? "on" : "off"}
                options={[
                  ["on", "On"],
                  ["off", "Off"],
                ]}
                onChange={(v) =>
                  set((c) => {
                    c.options.zoneColours = v === "on";
                  })
                }
              />
            </Row>
            <Row label="Zone bands">
              <Seg
                value={layer.options.bands ? "on" : "off"}
                options={[
                  ["on", "On"],
                  ["off", "Off"],
                ]}
                onChange={(v) =>
                  set((c) => {
                    c.options.bands = v === "on";
                  })
                }
              />
            </Row>
            <Row label="Smoothing">
              <NumberSlider
                value={layer.options.smooth}
                min={1}
                max={25}
                onChange={(v) =>
                  set((c) => {
                    c.options.smooth = v;
                  })
                }
              />
            </Row>
          </>
        )}
        {layer.kind === "pace" && (
          <Row label="Shape">
            <Seg
              value={layer.options.mode}
              options={[
                ["wave", "Wave"],
                ["bars", "Bars"],
              ]}
              onChange={(v) =>
                set((c) => {
                  c.options.mode = v;
                })
              }
            />
          </Row>
        )}
        {(layer.kind === "splits" || layer.kind === "pace") && (
          <Row label="Values">
            <Seg
              value={layer.options.showValues ? "on" : "off"}
              options={[
                ["on", "Shown"],
                ["off", "Hidden"],
              ]}
              onChange={(v) =>
                set((c) => {
                  c.options.showValues = v === "on";
                })
              }
            />
          </Row>
        )}
        {layer.kind === "zones" && (
          <Row label="Show">
            <Seg
              value={layer.options.showPercent ? "on" : "off"}
              options={[
                ["on", "Minutes"],
                ["off", "Hidden"],
              ]}
              onChange={(v) =>
                set((c) => {
                  c.options.showPercent = v === "on";
                })
              }
            />
          </Row>
        )}
        <Row label="Labels">
          <Seg
            value={layer.options.labels ? "on" : "off"}
            options={[
              ["on", "Shown"],
              ["off", "Hidden"],
            ]}
            onChange={(v) =>
              set((c) => {
                c.options.labels = v === "on";
              })
            }
          />
        </Row>
      </Section>
    </>
  );
}
