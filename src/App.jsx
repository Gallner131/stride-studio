import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  W, H, FORMATS, setFormat, ANIM_SECONDS, DEMO, DEMO_WORKOUT, SPORTS, sportFromStrava, PALETTE, FILTERS, FONTS, BACKGROUNDS,
  renderCanvas, fmtTime, fmtPace, fmtDate, fmtDist, decodePolyline, derive,
} from "./render.js";

const STRAVA_KEY = "stride.strava";
const loadStored = () => { try { return JSON.parse(localStorage.getItem(STRAVA_KEY) || "{}"); } catch { return {}; } };
const store = (obj) => { try { localStorage.setItem(STRAVA_KEY, JSON.stringify(obj)); } catch {} };

// Presets: cohesive design systems for runners
const PRESETS = {
  clean: {
    id: "clean", name: "Clean", bg: "#FFFFFF", text: "#111111", accent: "#FF5722", fonts: { hero: "sans", body: "sans" }
  },
  dark: {
    id: "dark", name: "Dark", bg: "#161616", text: "#F2F2F2", accent: "#FF5722", fonts: { hero: "sans", body: "sans" }
  },
  minimal: {
    id: "minimal", name: "Minimal", bg: "#F5F5F5", text: "#333333", accent: "#000000", fonts: { hero: "serif", body: "sans" }
  },
  energetic: {
    id: "energetic", name: "Energetic", bg: "#FFF8E1", text: "#1A1A1A", accent: "#FF6D00", fonts: { hero: "sans", body: "sans" }
  },
  neon: {
    id: "neon", name: "Neon", bg: "#0A0E27", text: "#00FF88", accent: "#00FFFF", fonts: { hero: "mono", body: "mono" }
  },
};

// Element factory
function createElement(type, { x = 540, y = 400, w = 200, h = 100, stat = "distance", text = "Your text here", ...rest } = {}) {
  const id = "elem-" + Date.now() + Math.random().toString(36).slice(2, 9);
  return {
    id, type, x, y, w, h, z: 1, stat, text, fontSize: 48, fontFamily: "sans", color: "#111111",
    ...rest
  };
}

export default function App() {
  const [media, setMedia] = useState(null);
  const [act, setAct] = useState(DEMO);
  const [format, setFmt] = useState("story");
  const [elements, setElements] = useState([
    createElement("stat", { x: 100, y: 200, w: 300, h: 120, stat: "distance" }),
    createElement("text", { x: 100, y: 350, w: 400, h: 80, text: act.name, fontSize: 36 }),
  ]);
  const [selectedId, setSelectedId] = useState(elements[0]?.id || null);
  const [preset, setPreset] = useState("dark");
  const [showStrava, setShowStrava] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [strava, setStrava] = useState(() => loadStored());
  const [activities, setActivities] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [result, setResult] = useState(null);
  const [quality, setQuality] = useState("hd");

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const presetData = PRESETS[preset];

  const say = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  // Canvas rendering loop
  useEffect(() => {
    setFormat(format);
    const c = canvasRef.current;
    if (!c) return;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d");
    renderCanvas(ctx, elements, media, act, presetData);
  }, [elements, media, act, format, preset]);

  // Element selection & dragging
  const getElementAt = (x, y) => {
    const sorted = [...elements].sort((a, b) => b.z - a.z);
    for (const el of sorted) {
      if (x >= el.x && x < el.x + el.w && y >= el.y && y < el.y + el.h) return el.id;
    }
    return null;
  };

  const onCanvasPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const elId = getElementAt(x, y);
    setSelectedId(elId || null);
    if (elId) {
      dragRef.current = { elId, startX: x, startY: y };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onCanvasPointerMove = (e) => {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const dx = x - dragRef.current.startX;
    const dy = y - dragRef.current.startY;
    setElements((els) =>
      els.map((el) =>
        el.id === dragRef.current.elId ? { ...el, x: el.x + dx, y: el.y + dy } : el
      )
    );
    dragRef.current.startX = x;
    dragRef.current.startY = y;
  };

  const onCanvasPointerUp = () => { dragRef.current = null; };

  // Add element
  const addElement = (type) => {
    const el = createElement(type);
    setElements([...elements, el]);
    setSelectedId(el.id);
  };

  // Update selected element
  const updateElement = (patch) => {
    setElements((els) => els.map((el) => el.id === selectedId ? { ...el, ...patch } : el));
  };

  // Delete selected
  const deleteSelected = () => {
    setElements((els) => els.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  // Get selected element
  const selected = elements.find((el) => el.id === selectedId);

  // Strava auth
  const auth = (t) => ({ headers: { Authorization: `Bearer ${t}` } });
  const fetchActivities = async (token) => {
    setStatus("Loading activities...");
    try {
      const r = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=40", auth(token));
      if (r.status === 401) throw new Error("token rejected");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setActivities(await r.json());
      setStatus("");
    } catch (err) { setStatus(`Error: ${err.message}`); }
  };

  const useToken = async () => {
    if (!strava.token?.trim()) { setStatus("Paste a token first."); return; }
    const next = { ...strava, token: strava.token.trim() };
    if (await fetchActivities(next.token)) { next.connected = true; store(next); setStrava(next); }
  };

  const pickActivity = async (a) => {
    setStatus("Loading...");
    try {
      const [dr, sr] = await Promise.all([
        fetch(`https://www.strava.com/api/v3/activities/${a.id}`, auth(strava.token)),
        fetch(`https://www.strava.com/api/v3/activities/${a.id}/streams?keys=altitude,heartrate&key_by_type=true`, auth(strava.token)),
      ]);
      if (dr.ok) {
        const dd = await dr.json();
        setAct({
          id: a.id, sport: a.sport_type || "run", name: a.name, date: a.start_date_local || a.start_date,
          distance: a.distance || 0, time: a.moving_time, elevation: a.total_elevation_gain || 0,
          hr: a.average_heartrate ? Math.round(a.average_heartrate) : null, hrMax: a.max_heartrate || 190,
          calories: null, route: [], splits: [], elev: [], hrStream: [],
        });
      }
      setShowStrava(false);
      setStatus("");
    } catch (err) { setStatus(`Error: ${err.message}`); }
  };

  // Export
  const mkCanvas = () => {
    setFormat(format);
    const k = quality === "fast" ? 2 / 3 : 1;
    const c = document.createElement("canvas");
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    c.getContext("2d").scale(k, k);
    return c;
  };

  const exportImage = async () => {
    try {
      const c = mkCanvas();
      const ctx = c.getContext("2d");
      renderCanvas(ctx, elements, media, act, presetData);
      const blob = await new Promise((res) => c.toBlob(res, "image/png"));
      setResult({ url: URL.createObjectURL(blob), blob, ext: "png" });
      say("Image ready to download");
    } catch (e) { setError(`Export failed: ${e.message}`); }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    const url = URL.createObjectURL(f);
    if (f.type.startsWith("image")) {
      const img = new Image();
      img.onload = () => { setMedia({ type: "image", el: img, url, name: f.name }); };
      img.onerror = () => setError("Could not load image.");
      img.src = url;
    } else if (f.type.startsWith("video")) {
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      v.loop = true;
      v.onloadeddata = () => { setMedia({ type: "video", el: v, url, name: f.name }); };
      v.onerror = () => setError("Could not load video.");
      v.load();
    } else setError("Choose a photo or video.");
    e.target.value = "";
  };

  return (
    <div className="app" style={{ background: presetData.bg, color: presetData.text }}>
      <div className="top-bar">
        <h1>Stride Canvas</h1>
        <div className="controls-row">
          <div className="seg">
            {[["story", "9:16"], ["post", "4:5"], ["square", "1:1"]].map(([id, label]) => (
              <button key={id} className={format === id ? "on" : ""} onClick={() => setFmt(id)}>{label}</button>
            ))}
          </div>
          <div className="seg">
            {Object.values(PRESETS).map((p) => (
              <button key={p.id} className={preset === p.id ? "on" : ""} onClick={() => setPreset(p.id)} title={p.name}>{p.name}</button>
            ))}
          </div>
          <button className="btn primary" onClick={exportImage}>Export</button>
        </div>
      </div>

      <div className="workspace">
        {/* Left sidebar: Element library */}
        <aside className="sidebar left">
          <div className="panel">
            <h3>Add elements</h3>
            <button className="btn-add" onClick={() => addElement("stat")}>+ Stat block</button>
            <button className="btn-add" onClick={() => addElement("text")}>+ Text</button>
            <button className="btn-add" onClick={() => addElement("shape")}>+ Shape</button>
            <div style={{ marginTop: 16 }}>
              <label className="btn">Choose photo<input type="file" accept="image/*,video/*" onChange={onFile} style={{ display: "none" }} /></label>
            </div>
          </div>

          <div className="panel">
            <h3>Activity</h3>
            <button className="link" onClick={() => setShowStrava(true)}>Load from Strava</button>
            <p className="small muted">{act.name} • {fmtDist(derive(act, {}).dist)} km</p>
          </div>
        </aside>

        {/* Center: Canvas */}
        <main className="canvas-container">
          <div className="stage" style={{ aspectRatio: `${FORMATS[format].w}/${FORMATS[format].h}` }}>
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerCancel={onCanvasPointerUp}
              style={{ cursor: "grab", background: presetData.bg }}
            />
            {selected && (
              <div
                className="selection-box"
                style={{
                  left: `${(selected.x / W) * 100}%`,
                  top: `${(selected.y / H) * 100}%`,
                  width: `${(selected.w / W) * 100}%`,
                  height: `${(selected.h / H) * 100}%`,
                }}
              />
            )}
          </div>
        </main>

        {/* Right sidebar: Inspector */}
        <aside className="sidebar right">
          <div className="panel">
            <h3>Element</h3>
            {selected ? (
              <>
                <p className="small muted">{selected.type}</p>
                {selected.type === "stat" && (
                  <>
                    <label>
                      <span className="label">Stat</span>
                      <select value={selected.stat} onChange={(e) => updateElement({ stat: e.target.value })}>
                        <option value="distance">Distance</option>
                        <option value="time">Time</option>
                        <option value="pace">Pace</option>
                        <option value="elevation">Elevation</option>
                        <option value="hr">Heart rate</option>
                      </select>
                    </label>
                  </>
                )}
                {selected.type === "text" && (
                  <>
                    <label>
                      <span className="label">Text</span>
                      <input
                        type="text"
                        value={selected.text}
                        onChange={(e) => updateElement({ text: e.target.value })}
                        maxLength={100}
                      />
                    </label>
                    <label>
                      <span className="label">Size: {selected.fontSize}px</span>
                      <input
                        type="range"
                        min="12"
                        max="120"
                        value={selected.fontSize}
                        onChange={(e) => updateElement({ fontSize: parseInt(e.target.value) })}
                      />
                    </label>
                  </>
                )}
                <label>
                  <span className="label">Width: {Math.round(selected.w)}px</span>
                  <input type="range" min="20" max="1000" value={selected.w} onChange={(e) => updateElement({ w: parseFloat(e.target.value) })} />
                </label>
                <label>
                  <span className="label">Height: {Math.round(selected.h)}px</span>
                  <input type="range" min="20" max="1200" value={selected.h} onChange={(e) => updateElement({ h: parseFloat(e.target.value) })} />
                </label>
                <button className="btn" style={{ marginTop: 12, background: "#c41c3b", color: "#fff" }} onClick={deleteSelected}>Delete</button>
              </>
            ) : (
              <p className="muted small">Click an element to edit</p>
            )}
          </div>
        </aside>
      </div>

      {/* Strava modal */}
      {showStrava && (
        <div className="backdrop" onClick={() => setShowStrava(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Load from Strava</h2>
            {!strava.token && (
              <>
                <p className="small">Paste an access token from <strong>strava.com/settings/api</strong></p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="Access token"
                    value={strava.token || ""}
                    onChange={(e) => setStrava({ ...strava, token: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button className="btn" onClick={useToken}>Load</button>
                </div>
              </>
            )}
            {status && <p className="muted small">{status}</p>}
            <div className="list">
              {activities.map((a) => (
                <button key={a.id} type="button" onClick={() => pickActivity(a)} className="list-item">
                  <strong>{a.name}</strong>
                  <span className="muted small">{(a.distance / 1000).toFixed(1)} km • {fmtTime(a.moving_time)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Export result */}
      {result && (
        <div className="backdrop" onClick={() => { URL.revokeObjectURL(result.url); setResult(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Export</h2>
            <img src={result.url} alt="Export preview" style={{ width: "100%", borderRadius: 8, marginBottom: 12 }} />
            <a className="btn primary" href={result.url} download={`stride-${Date.now()}.${result.ext}`}>Download</a>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
