import { firstSelected, useEditor } from "../editor/store";
import { STICKERS } from "../engine/stickers";
import { FONT_STACKS } from "../engine/text";
import { BINDING_CHIPS } from "../model/bindings";
import type { AnimPreset, ImageLayer, Layer, ShapeLayer, StickerLayer, TextLayer } from "../model/types";
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
    <div className="inspector">
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

      <Section title="Colour">
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
