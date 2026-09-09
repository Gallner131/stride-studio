import React from "react";
import { useEditor } from "../editor/store";
import { STICKERS } from "../engine/stickers";
import {
  newChartLayer,
  newRouteLayer,
  newShapeLayer,
  newStatLayer,
  newStatRowLayer,
  newStickerLayer,
  newTextLayer,
} from "../model/defaults";
import type { ShapeKind } from "../model/types";

/** Add menu — §6.5. Layer types that need data the activity lacks are disabled with a reason. */
export function AddMenu({ onAdded }: { onAdded: () => void }) {
  const addLayer = useEditor((s) => s.addLayer);
  const setEditingText = useEditor((s) => s.setEditingText);
  const [showStickers, setShowStickers] = React.useState(false);

  const addText = (over: Parameters<typeof newTextLayer>[0] = {}) => {
    const layer = newTextLayer(over);
    addLayer(layer);
    setEditingText(layer.id);
    onAdded();
  };

  const addShape = (shape: ShapeKind) => {
    addLayer(newShapeLayer(shape));
    onAdded();
  };

  return (
    <div className="addmenu">
      <div className="tiles">
        <Tile label="Text" hint="Any words you like" testid="add-text" onClick={() => addText()} icon="T" />
        <Tile
          label="Headline"
          hint="Big and bold"
          testid="add-headline"
          onClick={() =>
            addText({
              name: "Headline",
              text: "New PB",
              style: {
                ...newTextLayer().style,
                size: 140,
                weight: 800,
                uppercase: true,
                letterSpacing: -0.02,
              },
            })
          }
          icon="H"
        />
        <Tile
          label="Stat line"
          hint="Bound to your activity"
          testid="add-stat"
          onClick={() =>
            addText({
              name: "Stat line",
              text: "{distance} {unit} · {time} · {pace}",
              style: { ...newTextLayer().style, size: 44, weight: 600 },
            })
          }
          icon="#"
        />
        <Tile
          label="Distance"
          hint="The hero number"
          testid="add-distance"
          onClick={() =>
            addText({
              name: "Distance",
              text: "{distance}",
              style: {
                ...newTextLayer().style,
                size: 260,
                weight: 800,
                font: "cond",
                letterSpacing: -0.04,
              },
              anim: { preset: "countUp", delay: 0.1, duration: 1.8, ease: "outExpo" },
            })
          }
          icon="21"
        />
        <Tile
          label="Distance stat"
          hint="Hero number, counts up"
          testid="add-stat-distance"
          onClick={() => {
            addLayer(newStatLayer("distance"));
            onAdded();
          }}
          icon="#"
        />
        <Tile
          label="Stat row"
          hint="Time · pace · elevation"
          testid="add-stat-row"
          onClick={() => {
            addLayer(newStatRowLayer());
            onAdded();
          }}
          icon="≡"
        />
        <Tile
          label="Route"
          hint="Your GPS trace"
          testid="add-route"
          onClick={() => {
            addLayer(newRouteLayer());
            onAdded();
          }}
          icon="◠"
        />
        <Tile
          label="Heart rate"
          hint="Trace with zone bands"
          testid="add-chart-hr"
          onClick={() => {
            addLayer(newChartLayer("hr"));
            onAdded();
          }}
          icon="♥"
        />
        <Tile
          label="Splits"
          hint="Per-km bars"
          testid="add-chart-splits"
          onClick={() => {
            addLayer(newChartLayer("splits"));
            onAdded();
          }}
          icon="▉"
        />
        <Tile
          label="Pace wave"
          hint="Pace across the run"
          testid="add-chart-pace"
          onClick={() => {
            addLayer(newChartLayer("pace"));
            onAdded();
          }}
          icon="∿"
        />
        <Tile
          label="Elevation"
          hint="Climb profile"
          testid="add-chart-elevation"
          onClick={() => {
            addLayer(newChartLayer("elevation"));
            onAdded();
          }}
          icon="⛰"
        />
        <Tile
          label="HR zones"
          hint="Time in each zone"
          testid="add-chart-zones"
          onClick={() => {
            addLayer(newChartLayer("zones"));
            onAdded();
          }}
          icon="▤"
        />
        <Tile
          label="Rings"
          hint="Effort gauges"
          testid="add-chart-rings"
          onClick={() => {
            addLayer(newChartLayer("rings"));
            onAdded();
          }}
          icon="◎"
        />
        <Tile
          label="Rectangle"
          hint="Panel or bar"
          testid="add-rect"
          onClick={() => addShape("rect")}
          icon="▭"
        />
        <Tile label="Pill" hint="Rounded badge" testid="add-pill" onClick={() => addShape("pill")} icon="⬭" />
        <Tile
          label="Circle"
          hint="Dot or ring"
          testid="add-ellipse"
          onClick={() => addShape("ellipse")}
          icon="◯"
        />
        <Tile
          label="Line"
          hint="Rule or divider"
          testid="add-line"
          onClick={() => addShape("line")}
          icon="—"
        />
        <Tile label="Tape" hint="Torn strip" testid="add-tape" onClick={() => addShape("tape")} icon="▬" />
        <Tile
          label="Sticker"
          hint="32 marks"
          testid="add-sticker"
          onClick={() => setShowStickers((v) => !v)}
          icon="★"
        />
      </div>

      {showStickers && (
        <div className="sticker-grid big">
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="sticker-pick"
              title={s.name}
              data-testid={`sticker-${s.id}`}
              onClick={() => {
                addLayer(newStickerLayer(s.id));
                setShowStickers(false);
                onAdded();
              }}
            >
              <svg viewBox="0 0 100 100" aria-label={s.name}>
                <path
                  d={s.d}
                  fill={s.strokeOnly ? "none" : "currentColor"}
                  stroke="currentColor"
                  strokeWidth={s.strokeOnly ? 8 : 0}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      )}

      <p className="muted small">
        Everything you add can be tapped, dragged, resized and rotated on the design.
      </p>
    </div>
  );
}

function Tile({
  label,
  hint,
  icon,
  onClick,
  testid,
}: {
  label: string;
  hint: string;
  icon: string;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button type="button" className="tile" onClick={onClick} data-testid={testid}>
      <span className="tile-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{label}</strong>
      <em className="muted">{hint}</em>
    </button>
  );
}
