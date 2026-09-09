import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useStore } from "zustand";
import { useEditor } from "./editor/store.ts";
import { renderLayers } from "./engine/render.ts";
import { unionBounds, layoutDoc } from "./engine/layout.ts";
import { buildFields } from "./model/fields.ts";
import { taglineToLayer } from "./model/migrate.ts";
import { StudioOverlay } from "./ui/StudioOverlay.tsx";
import { Inspector } from "./ui/Inspector.tsx";
import { AddMenu } from "./ui/AddMenu.tsx";
import { LayersPanel } from "./ui/LayersPanel.tsx";
import { HyroxPanel } from "./ui/HyroxPanel.tsx";
import { TemplateGallery } from "./ui/TemplateGallery.tsx";
import { hyroxFields, hyroxToActivity } from "./model/hyrox.ts";
import { newChartLayer, newRouteLayer, newStatLayer, newStatRowLayer } from "./model/defaults.ts";
import { saveDoc, listDocs, loadDoc, deleteDoc, loadPrefs, savePrefs } from "./storage/db.ts";
import {
  W, H, FORMATS, setFormat, ANIM_SECONDS, DEMO, DEMO_WORKOUT, SPORTS, sportFromStrava, CATEGORIES, TEMPLATES, PALETTE, FILTERS, FONTS, BACKGROUNDS, DEFAULT_OPTS,
  renderFrame, captionFor, fmtTime, fmtPace, fmtDate, fmtDist, decodePolyline, derive,
} from "./render.js";

const STRAVA_KEY = "stride.strava";
const loadStored = () => { try { return JSON.parse(localStorage.getItem(STRAVA_KEY) || "{}"); } catch { return {}; } };
const store = (obj) => { try { localStorage.setItem(STRAVA_KEY, JSON.stringify(obj)); } catch {} };
const canShareFiles = typeof navigator !== "undefined" && !!navigator.canShare;
const LOOKS_KEY = "stride.looks";
const loadLooks = () => { try { return JSON.parse(localStorage.getItem(LOOKS_KEY) || "[]"); } catch { return []; } };
const saveLooks = (l) => { try { localStorage.setItem(LOOKS_KEY, JSON.stringify(l)); } catch {} };

// ---- small UI pieces (module scope so inputs keep focus while typing) ----
function Seg({ value, options, onChange }) {
  return <div className="seg">{options.map(([v, label]) => <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>{label}</button>)}</div>;
}
function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <label className="slider">
      <div className="row"><span className="muted">{label}</span><span>{fmt ? fmt(value) : value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}
function Chip({ on, onClick, children, testid }) { return <button type="button" className={`chip ${on ? "on" : ""}`} onClick={onClick} data-testid={testid}>{children}</button>; }
function Toggle({ on, onChange, label }) {
  return <button type="button" className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}><span className="knob" /><span>{label}</span></button>;
}
function Modal({ title, children, onClose }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 12 }}><h2>{title}</h2><button type="button" className="link" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) { return <label className="field"><span className="muted small">{label}</span>{children}</label>; }
function ManualForm({ act, onChange }) {
  const h = Math.floor(act.time / 3600), m = Math.floor((act.time % 3600) / 60), s = act.time % 60;
  const upd = (patch) => onChange({ ...act, ...patch });
  const num = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
  return (
    <div className="grid2" style={{ marginTop: 14 }}>
      <div className="span2"><Field label="Activity name"><input value={act.name} onChange={(e) => upd({ name: e.target.value })} /></Field></div>
      <Field label="Sport"><select value={act.sport || "run"} onChange={(e) => upd({ sport: e.target.value })}>{Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      <Field label="Date"><input type="date" value={(act.date || "").slice(0, 10)} onChange={(e) => e.target.value && upd({ date: new Date(e.target.value + "T09:00:00").toISOString() })} /></Field>
      <Field label="Distance (km)"><input type="number" step="0.01" min="0" defaultValue={((act.distance || 0) / 1000).toFixed(2)} onChange={(e) => upd({ distance: Math.max(0, parseFloat(e.target.value) || 0) * 1000 })} /></Field>
      <Field label="Elevation gain (m)"><input type="number" defaultValue={Math.round(act.elevation || 0)} onChange={(e) => upd({ elevation: parseFloat(e.target.value) || 0 })} /></Field>
      <div className="span2"><Field label="Time (h : m : s)">
        <div className="hms">
          <input type="number" min="0" value={h} onChange={(e) => upd({ time: num(e.target.value) * 3600 + m * 60 + s })} />
          <input type="number" min="0" max="59" value={m} onChange={(e) => upd({ time: h * 3600 + num(e.target.value) * 60 + s })} />
          <input type="number" min="0" max="59" value={s} onChange={(e) => upd({ time: h * 3600 + m * 60 + num(e.target.value) })} />
        </div>
      </Field></div>
      <Field label="Avg heart rate"><input type="number" placeholder="optional" defaultValue={act.hr || ""} onChange={(e) => upd({ hr: parseInt(e.target.value, 10) || null })} /></Field>
      <Field label="Max heart rate (for zones)"><input type="number" placeholder="e.g. 185" defaultValue={act.hrMax || ""} onChange={(e) => upd({ hrMax: parseInt(e.target.value, 10) || null })} /></Field>
      <Field label="Calories"><input type="number" placeholder="optional" defaultValue={act.calories || ""} onChange={(e) => upd({ calories: parseInt(e.target.value, 10) || null })} /></Field>
    </div>
  );
}

// thumbnail of one template, re-rendered when inputs change
function Thumb({ tpl, media, act, opts, format, selected, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const f = FORMATS[format]; const k = 216 / f.w;
    c.width = 216; c.height = Math.round(f.h * k);
    const ctx = c.getContext("2d"); ctx.save(); ctx.scale(k, k);
    try { renderFrame(ctx, media, act, tpl.id, { ...opts, animate: false }, 1, 1); } catch {}
    ctx.restore();
  }, [tpl.id, media, act, opts, format]);
  return (
    <button type="button" className={`thumb ${selected ? "on" : ""}`} onClick={onClick} data-testid={`tpl-${tpl.id}`}>
      <canvas ref={ref} />
      <span><strong>{tpl.name}</strong><em className="muted">{tpl.desc}</em></span>
    </button>
  );
}

export default function App() {
  const [media, setMedia] = useState(null);
  const [act, setAct] = useState(DEMO);
  const [template, setTemplate] = useState("sticker");
  const [opts, setOpts] = useState(DEFAULT_OPTS);
  const [format, setFmt] = useState("story");
  const [cat, setCat] = useState("All");
  const [tab, setTab] = useState("style");
  const [showStrava, setShowStrava] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [exporting, setExporting] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [animKey, setAnimKey] = useState(0);
  const [strava, setStrava] = useState(() => loadStored());
  const [looks, setLooks] = useState(() => loadLooks());
  const [lookName, setLookName] = useState("");
  const dragRef = useRef(null);
  const [activities, setActivities] = useState([]);
  const [status, setStatus] = useState("");

  // --- document model (Phase 1). The legacy template still draws underneath; doc.layers
  // are the addressable elements on top (spec §13 Phase 1 step 2).
  const doc = useEditor((st) => st.doc);
  const selection = useEditor((st) => st.selection);
  const editingTextId = useEditor((st) => st.editingTextId);
  const editorMode = useEditor((st) => st.mode);
  const safeZones = useEditor((st) => st.safeZones);
  const setEditorMode = useEditor((st) => st.setMode);
  const toggleSafeZones = useEditor((st) => st.toggleSafeZones);
  const clearSelection = useEditor((st) => st.clearSelection);
  const addLayer = useEditor((st) => st.addLayer);
  const patchDoc = useEditor((st) => st.patchDoc);
  const setStoreDoc = useEditor((st) => st.setDoc);
  const [designs, setDesigns] = useState([]);
  const [storageNote, setStorageNote] = useState("");

  // Undo/redo comes from zundo's temporal store (§6.1).
  const temporal = useStore(useEditor.temporal, (st) => st);
  const undo = () => useEditor.temporal.getState().undo();
  const redo = () => useEditor.temporal.getState().redo();
  const canUndo = temporal.pastStates.length > 0;
  const canRedo = temporal.futureStates.length > 0;

  const [hyrox, setHyrox] = useState(null);

  // A HYROX result drives both the legacy activity (so existing templates work) and the
  // extra {hyroxTotal}, {roxzone}, {station.*} bindings.
  const effectiveAct = useMemo(() => (hyrox ? { ...act, ...hyroxToActivity(hyrox) } : act), [act, hyrox]);
  const fields = useMemo(() => {
    const base = buildFields(effectiveAct, opts);
    return hyrox ? { ...base, ...hyroxFields(hyrox) } : base;
  }, [effectiveAct, opts, hyrox]);
  const series = useMemo(() => {
    const a = effectiveAct;
    const km = (a.distance || 0) / 1000;
    // Relative effort, when Strava has not supplied one: minutes-in-zone weighted (§7.4).
    let effort;
    if (a.hrStream?.length) {
      const max = a.hrMax || 190;
      const weights = [1, 2, 3, 5, 8];
      const perSample = (a.time || 0) / a.hrStream.length / 60;
      const score = a.hrStream.reduce((acc, bpm) => {
        const f = bpm / max;
        const z = f < 0.6 ? 0 : f < 0.7 ? 1 : f < 0.8 ? 2 : f < 0.9 ? 3 : 4;
        return acc + perSample * weights[z];
      }, 0);
      effort = Math.max(0, Math.min(100, Math.round((score / (60 * 5)) * 100)));
    }
    return {
      route: a.route || [],
      hr: a.hrStream || [],
      hrMax: a.hrMax || undefined,
      splits: a.splits || [],
      altitude: a.elev || [],
      distanceKm: km,
      durationSeconds: a.time || 0,
      avgHr: a.hr || undefined,
      effort,
      calories: a.calories || undefined,
    };
  }, [effectiveAct]);

  const caps = useMemo(
    () => ({
      route: (effectiveAct.route?.length ?? 0) > 1,
      hr: (effectiveAct.hrStream?.length ?? 0) > 1 || !!effectiveAct.hr,
      splits: (effectiveAct.splits?.length ?? 0) > 1,
      elevation: (effectiveAct.elev?.length ?? 0) > 1,
      distance: (effectiveAct.distance ?? 0) > 0,
      hyrox: !!hyrox,
    }),
    [effectiveAct, hyrox],
  );

  const assetResolver = useCallback((id) => (id === "photo" && media?.type === "image" ? media.el : null), [media]);

  const canvasRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { media, act: effectiveAct, template, opts, format, doc, fields, assetResolver, editingTextId, hyrox, series };
  const startRef = useRef(performance.now());
  useEffect(() => { startRef.current = performance.now(); }, [template, animKey, act, format]);
  useEffect(() => { setFormat(format); }, [format]);

  // The legacy state (template, format, opts, units) is still the source of truth for the
  // template pass, so mirror it into the document. Phase 2 inverts this.
  useEffect(() => {
    patchDoc((d) => {
      d.templateId = template;
      d.format = format;
      d.opts = opts;
      d.units = opts.units === "mi" ? "mi" : "km";
      d.prefs.safeZones = safeZones;
    });
  }, [template, format, opts, safeZones, patchDoc]);

  // §13 Phase 1 step 5: the single tagline field becomes a real text layer.
  useEffect(() => {
    if (!opts.tagline) return;
    const layer = taglineToLayer(opts);
    if (layer) {
      addLayer(layer);
      setOpts((o) => ({ ...o, tagline: "" }));
      say("Your line is now a text layer you can drag");
    }
  }, [opts.tagline]);

  const say = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  // Autosave 500 ms after the last change, so a Safari reload never costs work (§1.1 A8, §8).
  useEffect(() => {
    if (doc.layers.length === 0 && doc.name === "Untitled design") return;
    const id = setTimeout(async () => {
      const c = document.createElement("canvas");
      c.width = 216; c.height = Math.round((FORMATS[format].h / FORMATS[format].w) * 216);
      const k = 216 / FORMATS[format].w;
      const cx = c.getContext("2d");
      cx.scale(k, k);
      try { renderFrame(cx, media, act, template, { ...opts, animate: false }, 1, 1); } catch {}
      cx.save(); cx.scale(W / 1000, W / 1000);
      try { renderLayers(cx, doc, { t: Number.POSITIVE_INFINITY, mode: "thumb", fields, asset: assetResolver, hyrox, series }); } catch {}
      cx.restore();
      const res = await saveDoc({ ...doc, thumb: c.toDataURL("image/jpeg", 0.6) });
      if (!res.ok && res.reason) setStorageNote(res.reason);
      else savePrefs({ lastDocId: doc.id });
    }, 500);
    return () => clearTimeout(id);
  }, [doc, format, media, act, template, opts, fields, assetResolver]);

  // Restore the last design on first load (§3.8 "Continue last design").
  useEffect(() => {
    (async () => {
      const { lastDocId } = loadPrefs();
      if (!lastDocId) return;
      const saved = await loadDoc(lastDocId);
      if (saved && saved.layers.length > 0) {
        setStoreDoc(saved);
        setTemplate(saved.templateId || "sticker");
        setFmt(saved.format || "story");
        if (saved.opts && Object.keys(saved.opts).length) setOpts((o) => ({ ...o, ...saved.opts }));
        say("Picked up where you left off");
      }
    })();
  }, []);

  const refreshDesigns = useCallback(async () => { setDesigns(await listDocs()); }, []);

  const animT = () => {
    const el = (performance.now() - startRef.current) / 1000;
    const cycle = ANIM_SECONDS + 2.5; // animate, hold, replay
    return Math.min(1, (el % cycle) / ANIM_SECONDS);
  };

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { media, act, template, opts, format } = stateRef.current;
    setFormat(format);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    let progress = 1;
    if (media?.type === "video" && media.el.duration) progress = media.el.currentTime / media.el.duration;
    const ctx = c.getContext("2d");
    renderFrame(ctx, media, act, template, opts, progress, opts.animate ? animT() : 1);

    // Document layers, drawn on top in canvas units (1000 wide, §4.1).
    const st = stateRef.current;
    if (st.doc?.layers?.length) {
      ctx.save();
      ctx.scale(W / 1000, W / 1000);
      renderLayers(ctx, st.doc, {
        t: opts.animate ? animT() * 6 : Number.POSITIVE_INFINITY,
        mode: "full",
        fields: st.fields,
        asset: st.assetResolver,
        hyrox: st.hyrox,
        series: st.series,
        hideLayerId: st.editingTextId,
      });
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    let alive = true, raf = 0;
    const loop = () => { if (!alive) return; draw(); raf = requestAnimationFrame(loop); };
    if (media?.type === "video" || opts.animate) loop(); else draw();
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [media, act, template, opts, format, draw, doc, fields, editingTextId, series]);

  // OAuth redirect (?code=...)
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;
    const saved = loadStored();
    ["code", "scope", "state"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.toString());
    if (!saved.clientId || !saved.clientSecret) { setError("Strava sent a code back but the client ID/secret were not saved. Open Connect Strava and try again."); return; }
    (async () => {
      setShowStrava(true); setStatus("Finishing Strava sign-in...");
      try {
        const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: saved.clientId, client_secret: saved.clientSecret, code, grant_type: "authorization_code" }) });
        const data = await r.json();
        if (!r.ok || !data.access_token) throw new Error(data.message || `HTTP ${r.status}`);
        const next = { ...saved, token: data.access_token, refresh: data.refresh_token, expires: data.expires_at, athlete: data.athlete?.firstname, connected: true };
        store(next); setStrava(next);
        await fetchActivities(next.token);
      } catch (e) { setStatus(`Sign-in failed: ${e.message}`); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- media ----
  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setError("");
    const url = URL.createObjectURL(f);
    if (media?.type === "video") media.el.pause();
    if (f.type.startsWith("video")) {
      const v = document.createElement("video");
      v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
      v.onerror = () => setError("This video format could not be played here. Try an MP4 (H.264) or an iPhone MOV.");
      v.onloadeddata = () => { v.play().catch(() => {}); setMedia({ type: "video", el: v, url, name: f.name }); setTemplate((t) => (["hud", "chase"].includes(t) ? t : "hud")); setTab("style"); };
      v.load();
    } else if (f.type.startsWith("image")) {
      const img = new Image();
      img.onerror = () => setError("This image could not be opened. HEIC needs converting to JPG first (iPhone: Settings > Camera > Formats > Most Compatible).");
      img.onload = () => { setMedia({ type: "image", el: img, url, name: f.name }); setAnimKey((k) => k + 1); };
      img.src = url;
    } else setError("Please choose a photo or a video file.");
    e.target.value = "";
  };

  // ---- Strava ----
  const auth = (t) => ({ headers: { Authorization: `Bearer ${t}` } });
  const fetchActivities = async (token) => {
    setStatus("Loading your recent activities...");
    try {
      const r = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=40", auth(token));
      if (r.status === 401) throw new Error("token rejected (expired, or missing activity:read scope)");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list = await r.json();
      setActivities(list);
      setStatus(list.length ? `${list.length} activities loaded. Tap one.` : "Connected, but no activities found.");
      return true;
    } catch (err) { setStatus(`Could not load from Strava: ${err.message}.`); return false; }
  };
  const startOAuth = () => {
    if (!strava.clientId || !strava.clientSecret) { setStatus("Enter your Strava client ID and client secret first."); return; }
    if (window.location.protocol === "file:") { setStatus("Sign-in needs the app served over http://localhost (see README), or paste an access token below."); return; }
    store(strava);
    const u = new URL("https://www.strava.com/oauth/authorize");
    u.searchParams.set("client_id", strava.clientId); u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", window.location.origin + window.location.pathname);
    u.searchParams.set("approval_prompt", "auto"); u.searchParams.set("scope", "read,activity:read,activity:read_all");
    window.location.href = u.toString();
  };
  const useToken = async () => {
    if (!strava.token?.trim()) { setStatus("Paste an access token first."); return; }
    const next = { ...strava, token: strava.token.trim() };
    if (await fetchActivities(next.token)) { next.connected = true; store(next); setStrava(next); }
  };
  const pickActivity = async (a) => {
    setStatus(`Loading ${a.name}...`);
    let splits = null, elev = null, hrStream = null, calories = null;
    try {
      const [dr, sr] = await Promise.all([
        fetch(`https://www.strava.com/api/v3/activities/${a.id}`, auth(strava.token)),
        fetch(`https://www.strava.com/api/v3/activities/${a.id}/streams?keys=altitude,heartrate&key_by_type=true`, auth(strava.token)),
      ]);
      if (dr.ok) { const dd = await dr.json(); splits = (dd.splits_metric || []).filter((s) => s.distance > 200).map((s) => s.moving_time / (s.distance / 1000)); calories = dd.calories ? Math.round(dd.calories) : null; }
      if (sr.ok) {
        const sd = await sr.json();
        const thin = (arr) => { if (!arr?.length) return null; const step = Math.max(1, Math.floor(arr.length / 200)); return arr.filter((_, i) => i % step === 0); };
        elev = thin(sd.altitude?.data); hrStream = thin(sd.heartrate?.data);
      }
    } catch {}
    setAct({
      id: a.id, sport: sportFromStrava(a.sport_type || a.type), name: a.name, date: a.start_date_local || a.start_date,
      distance: a.distance || 0, time: a.moving_time, elevation: a.total_elevation_gain || 0,
      hr: a.average_heartrate ? Math.round(a.average_heartrate) : null, hrMax: a.max_heartrate ? Math.round(a.max_heartrate) + 5 : act.hrMax || 190, calories,
      route: decodePolyline(a.map?.summary_polyline), splits, elev, hrStream,
    });
    setShowStrava(false); setStatus("");
  };
  const disconnect = () => { store({}); setStrava({}); setActivities([]); setStatus("Disconnected."); };

  // ---- export ----
  const [quality, setQuality] = useState("hd"); // hd = 1080 wide, fast = 720 wide (older phones)
  const mkCanvas = () => { setFormat(format); const k = quality === "fast" ? 2 / 3 : 1; const c = document.createElement("canvas"); c.width = Math.round(W * k); c.height = Math.round(H * k); c.getContext("2d").scale(k, k); return c; };
  const toBlob = (c, type) => new Promise((res) => c.toBlob(res, type));
  const fileName = (ext) => `${(act.name || "activity").replace(/[^\w-]+/g, "-").toLowerCase()}-${fmtDist(derive(act, opts).dist)}${opts.units}.${ext}`;

  const drawFull = (ctx, mode, t = Number.POSITIVE_INFINITY) => {
    renderFrame(ctx, media, effectiveAct, template, opts, 1, 1, mode);
    if (doc.layers.length) {
      ctx.save();
      ctx.scale(W / 1000, W / 1000);
      renderLayers(ctx, doc, { t, mode, fields, asset: assetResolver, hyrox, series });
      ctx.restore();
    }
  };

  const exportImage = async (mode = "full") => {
    try {
      const c = mkCanvas();
      drawFull(c.getContext("2d"), mode);
      const blob = await toBlob(c, "image/png");
      if (!blob) throw new Error("canvas returned nothing");
      setResult({ url: URL.createObjectURL(blob), blob, kind: "image", ext: "png", mode });
    } catch (e) { setError(`Export failed: ${e.message}`); }
  };

  const record = async (drawFrame, durationMs, videoEl) => {
    if (typeof MediaRecorder === "undefined") throw new Error("this browser cannot record video (use Chrome, Edge, Firefox or Safari 14.1+)");
    const c = mkCanvas(); const ctx = c.getContext("2d");
    // Manual frame capture (requestFrame) is far more reliable than the automatic 30fps capture, especially while a source video is decoding.
    let stream = c.captureStream(0);
    let track = stream.getVideoTracks()[0];
    const manual = track && typeof track.requestFrame === "function";
    if (!manual) { stream = c.captureStream(30); track = stream.getVideoTracks()[0]; }
    if (videoEl) { try { const vs = videoEl.captureStream ? videoEl.captureStream() : videoEl.mozCaptureStream?.(); vs?.getAudioTracks().forEach((tr) => stream.addTrack(tr)); } catch {} }
    const mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10_000_000 } : undefined);
    const chunks = []; rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    const stopped = new Promise((res) => (rec.onstop = res));
    const t0 = performance.now(); let running = true;
    const tick = () => { if (!running) return; const el = performance.now() - t0; drawFrame(ctx, el); if (manual) track.requestFrame(); setProgressPct(Math.min(100, Math.round((el / durationMs) * 100))); requestAnimationFrame(tick); };
    rec.start(250); tick();
    if (videoEl) { await videoEl.play(); await new Promise((res) => { const h = () => { videoEl.removeEventListener("ended", h); res(); }; videoEl.addEventListener("ended", h); }); }
    else await new Promise((res) => setTimeout(res, durationMs));
    drawFrame(ctx, durationMs); if (manual) track.requestFrame(); await new Promise((r) => setTimeout(r, 250));
    running = false; rec.stop(); await stopped;
    const type = rec.mimeType || mime || "video/webm";
    return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
  };

  const exportVideo = async () => {
    setExporting("video"); setError(""); setProgressPct(0);
    const v = media?.type === "video" ? media.el : null;
    try {
      let out;
      if (v) {
        v.loop = false; v.pause(); v.currentTime = 0;
        await new Promise((res) => { const h = () => { v.removeEventListener("seeked", h); res(); }; v.addEventListener("seeked", h); setTimeout(res, 800); });
        out = await record((ctx) => {
          renderFrame(ctx, media, act, template, opts, v.duration ? v.currentTime / v.duration : 0, Math.min(1, v.currentTime / ANIM_SECONDS));
          if (doc.layers.length) { ctx.save(); ctx.scale(W / 1000, W / 1000); renderLayers(ctx, doc, { t: v.currentTime, mode: "full", fields, asset: assetResolver, hyrox, series }); ctx.restore(); }
        }, (v.duration || 5) * 1000, v);
        v.loop = true; v.play().catch(() => {});
      } else {
        const dur = (ANIM_SECONDS + 1.5) * 1000;
        out = await record((ctx, el) => {
          renderFrame(ctx, media, act, template, { ...opts, animate: true }, 1, Math.min(1, el / 1000 / ANIM_SECONDS));
          if (doc.layers.length) { ctx.save(); ctx.scale(W / 1000, W / 1000); renderLayers(ctx, doc, { t: el / 1000, mode: "full", fields, asset: assetResolver, hyrox, series }); ctx.restore(); }
        }, dur, null);
      }
      setResult({ url: URL.createObjectURL(out.blob), blob: out.blob, kind: "video", ext: out.ext, mode: "full" });
    } catch (e) { setError(`Video export failed: ${e.message}`); }
    finally { setExporting(""); }
  };

  const share = async () => {
    if (!result) return;
    try {
      const file = new File([result.blob], fileName(result.ext), { type: result.blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: act.name }); return; }
      say("Sharing is not available in this browser. Use Download, then post from your camera roll.");
    } catch (e) { if (e.name !== "AbortError") say(`Could not share: ${e.message}`); }
  };
  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(captionFor(effectiveAct, opts)); say("Caption copied"); } catch { say("Copy failed. Long-press the caption text instead."); }
  };

  const set = (k, val) => setOpts((o) => ({ ...o, [k]: val }));
  const setStat = (k) => setOpts((o) => ({ ...o, stats: { ...o.stats, [k]: !o.stats[k] } }));
  const shuffle = () => {
    const pool = TEMPLATES.filter((t) => t.cat !== "Video" || media?.type === "video");
    const t = pool[Math.floor(Math.random() * pool.length)].id;
    const a = PALETTE[Math.floor(Math.random() * PALETTE.length)].c;
    const f = FILTERS[Math.floor(Math.random() * FILTERS.length)].id;
    setTemplate(t); setOpts((o) => ({ ...o, accent: a, filter: f, theme: a === "#111111" ? "dark" : "light" }));
  };

  const d = useMemo(() => derive(effectiveAct, opts), [effectiveAct, opts]);
  const hasPosition = ["sticker", "ticker", "bib", "grid", "stamp"].includes(template);
  const hasMap = ["hud", "poster", "frame", "corner", "headline", "polaroid", "retro", "neon"].includes(template);
  const shown = TEMPLATES.filter((t) => cat === "All" || t.cat === cat);
  const thumbOpts = useMemo(() => ({ ...opts, scale: 1, offsetX: 0, offsetY: 0, zoom: 1, showMap: true, animate: false, kenburns: false, grain: 0, tagline: "" }), [opts.theme, opts.accent, opts.filter, opts.units, opts.stats, opts.vignette, opts.dim, opts.position, opts.fontHero, opts.fontBody, opts.textColor, opts.uppercase, opts.show, opts.bg]);

  return (
    <div className="app">
      <div className="wrap">
        <section className="preview">
          <div className="row" style={{ marginBottom: 10 }}>
            <h1>Stride Studio</h1>
            <Seg value={format} options={[["story", "9:16"], ["post", "4:5"], ["square", "1:1"]]} onChange={setFmt} />
          </div>
          <div className="stage" style={{ aspectRatio: `${FORMATS[format].w}/${FORMATS[format].h}` }}>
            <canvas ref={canvasRef} width={W} height={H} data-testid="stage" />
            <StudioOverlay
              fields={fields}
              asset={assetResolver}
              onEmptyPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); dragRef.current = { x: e.clientX, y: e.clientY, ox: opts.offsetX || 0, oy: opts.offsetY, k: W / r.width }; e.currentTarget.setPointerCapture(e.pointerId); }}
              onEmptyPointerMove={(e) => { const dr = dragRef.current; if (!dr) return; const nx = Math.round(dr.ox + (e.clientX - dr.x) * dr.k), ny = Math.round(dr.oy + (e.clientY - dr.y) * dr.k); setOpts((o) => ({ ...o, offsetX: Math.max(-500, Math.min(500, nx)), offsetY: Math.max(-800, Math.min(800, ny)) })); }}
              onEmptyPointerUp={() => { dragRef.current = null; }}
            />
            {!media && (
              <label className="dropzone">
                <strong>Add a photo or video</strong>
                <span className="muted small">Vertical works best. Tap to choose.</span>
                <input type="file" accept="image/*,video/*" onChange={onFile} data-testid="file-input" />
              </label>
            )}
            {media && opts.animate && <button type="button" className="replay" onClick={() => setAnimKey((k) => k + 1)} title="Replay animation">↻</button>}
          </div>
          <div className="btnrow toolbar">
            <button type="button" className="btn" onClick={() => undo()} disabled={!canUndo} title="Undo" data-testid="undo">↶</button>
            <button type="button" className="btn" onClick={() => redo()} disabled={!canRedo} title="Redo" data-testid="redo">↷</button>
            <button type="button" className={`btn ${safeZones ? "on" : ""}`} onClick={toggleSafeZones} title="Instagram safe zones" data-testid="safe-zones">Safe zones</button>
            {selection.length > 0 && (
              <button type="button" className="btn" onClick={clearSelection} data-testid="deselect">Deselect</button>
            )}
          </div>
          <div className="btnrow">
            <label className="btn">{media ? "Change media" : "Choose file"}<input type="file" accept="image/*,video/*" onChange={onFile} data-testid="file-input-2" /></label>
            <button type="button" className="btn" onClick={shuffle}>Surprise me</button>
            <button type="button" className="btn strava" onClick={() => setShowStrava(true)}>{strava.connected ? "Strava" : "Connect Strava"}</button>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
        </section>

        <section className="controls">
          <nav className="tabs">
            {[["style", "Style"], ["designs", "Designs"], ["add", "Add"], ["layers", "Layers"], ["look", "Look"], ["text", "Text"], ["stats", "Stats"], ["hyrox", "HYROX"], ["adjust", "Adjust"]].map(([k, l]) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={`tab-${k}`}>{l}{k === "layers" && doc.layers.length > 0 ? ` (${doc.layers.length})` : ""}</button>)}
          </nav>

          {/*
            The inspector takes over the element-styling tabs, but NOT the document-level
            ones: switching template, loading data or browsing layers must stay reachable
            while something is selected.
          */}
          {selection.length > 0 && ["style", "look", "text", "adjust"].includes(tab) && (
            <Inspector onDone={clearSelection} />
          )}

          {tab === "designs" && (
            <TemplateGallery caps={caps} onApplied={(name) => say(`${name} applied — tap anything to edit it`)} />
          )}
          {tab === "add" && <AddMenu onAdded={() => setTab("style")} />}
          {tab === "hyrox" && (
            <HyroxPanel hyrox={hyrox} onApply={setHyrox} onToast={say} />
          )}
          {tab === "layers" && <LayersPanel onSelect={() => setTab("style")} />}

          {tab === "style" && selection.length === 0 && (
            <>
              <div className="chips" style={{ marginBottom: 12 }}>{CATEGORIES.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
              <div className="gallery">
                {shown.map((t) => <Thumb key={t.id} tpl={t} media={media} act={act} opts={thumbOpts} format={format} selected={template === t.id} onClick={() => setTemplate(t.id)} />)}
              </div>
              {cat === "Video" && media?.type !== "video" && <p className="muted small" style={{ marginTop: 10 }}>These follow the clip's timeline, so they look best with a video. With a photo they still animate over 6 seconds.</p>}
            </>
          )}

          {tab === "look" && selection.length === 0 && (
            <div className="stack">
              <div>
                <div className="muted small label">Accent</div>
                <div className="swatches">
                  {PALETTE.map((p) => <button key={p.c} type="button" title={p.name} aria-label={p.name} className={`swatch ${opts.accent === p.c ? "on" : ""}`} style={{ background: p.c }} onClick={() => set("accent", p.c)} />)}
                  <label className="swatch custom" title="Custom colour">+<input type="color" value={/^#[0-9A-F]{6}$/i.test(opts.accent) ? opts.accent : "#ffffff"} onChange={(e) => set("accent", e.target.value.toUpperCase())} /></label>
                </div>
              </div>
              {!media && (
                <div>
                  <div className="muted small label">Background (no photo)</div>
                  <div className="swatches">{BACKGROUNDS.map((b) => <button key={b.id} type="button" title={b.name} aria-label={b.name} className={`swatch ${opts.bg === b.id ? "on" : ""}`} style={{ background: `linear-gradient(160deg, ${b.stops.join(",")})` }} onClick={() => set("bg", b.id)} data-testid={`bg-${b.id}`} />)}</div>
                </div>
              )}
              <div className="grid2">
                <div><div className="muted small label">Text</div><Seg value={opts.theme} options={[["light", "Light"], ["dark", "Dark"]]} onChange={(v) => set("theme", v)} /></div>
                {hasPosition && <div><div className="muted small label">Position</div><Seg value={opts.position} options={[["top", "Top"], ["bottom", "Bottom"]]} onChange={(v) => set("position", v)} /></div>}
                {hasMap && <div><div className="muted small label">Route map</div><Seg value={opts.showMap ? "on" : "off"} options={[["on", "Shown"], ["off", "Hidden"]]} onChange={(v) => set("showMap", v === "on")} /></div>}
              </div>
              <div>
                <div className="muted small label">Photo filter</div>
                <div className="chips">{FILTERS.map((f) => <Chip key={f.id} on={opts.filter === f.id} onClick={() => set("filter", f.id)}>{f.name}</Chip>)}</div>
              </div>
              <div className="grid2">
                <Toggle on={opts.animate} onChange={(v) => set("animate", v)} label="Animate" />
                <Toggle on={opts.kenburns} onChange={(v) => set("kenburns", v)} label="Slow zoom on photo" />
              </div>
              <Slider label="Vignette" value={opts.vignette} min={0} max={0.7} step={0.05} onChange={(v) => set("vignette", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
              <Slider label="Darken photo" value={opts.dim} min={0} max={0.6} step={0.05} onChange={(v) => set("dim", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
              <Slider label="Film grain" value={opts.grain} min={0} max={0.35} step={0.05} onChange={(v) => set("grain", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
            </div>
          )}

          {tab === "text" && selection.length === 0 && (
            <div className="stack">
              <div>
                <div className="muted small label">Big numbers</div>
                <div className="chips">{FONTS.map((f) => <Chip key={f.id} on={opts.fontHero === f.id} onClick={() => set("fontHero", f.id)} testid={`hero-${f.id}`}><span style={{ fontFamily: f.css }}>{f.name}</span></Chip>)}</div>
              </div>
              <div>
                <div className="muted small label">Labels and stats</div>
                <div className="chips">{FONTS.map((f) => <Chip key={f.id} on={opts.fontBody === f.id} onClick={() => set("fontBody", f.id)}><span style={{ fontFamily: f.css }}>{f.name}</span></Chip>)}</div>
              </div>
              <div>
                <div className="muted small label">Text colour</div>
                <div className="swatches">
                  <button type="button" className={`swatch auto ${!opts.textColor ? "on" : ""}`} onClick={() => set("textColor", null)} title="Automatic (light/dark)">Auto</button>
                  {PALETTE.map((p) => <button key={p.c} type="button" title={p.name} aria-label={p.name} className={`swatch ${opts.textColor === p.c ? "on" : ""}`} style={{ background: p.c }} onClick={() => set("textColor", p.c)} />)}
                  <label className="swatch custom" title="Custom colour">+<input type="color" value={/^#[0-9A-F]{6}$/i.test(opts.textColor || "") ? opts.textColor : "#ffffff"} onChange={(e) => set("textColor", e.target.value.toUpperCase())} /></label>
                </div>
              </div>
              <div>
                <div className="muted small label">Your own words</div>
                <p className="small" style={{ marginTop: 0 }}>
                  Text is now a layer you can put anywhere, style on its own, and add as many of as you like.
                </p>
                <button type="button" className="btn primary" onClick={() => setTab("add")} data-testid="go-add-text">
                  Add text
                </button>
              </div>
              <div>
                <div className="muted small label">Show</div>
                <div className="chips">
                  <Chip on={opts.show.name !== false} onClick={() => setOpts((o) => ({ ...o, show: { ...o.show, name: o.show.name === false } }))}>Activity name</Chip>
                  <Chip on={opts.show.meta !== false} onClick={() => setOpts((o) => ({ ...o, show: { ...o.show, meta: o.show.meta === false } }))} testid="show-meta">Name and date line</Chip>
                  <Chip on={opts.show.row !== false} onClick={() => setOpts((o) => ({ ...o, show: { ...o.show, row: o.show.row === false } }))}>Stat row</Chip>
                  <Chip on={opts.uppercase} onClick={() => set("uppercase", !opts.uppercase)}>UPPERCASE</Chip>
                </div>
              </div>
            </div>
          )}

          {tab === "stats" && selection.length === 0 && (
            <div className="stack">
              <div className="card">
                <div className="row">
                  <div>
                    <strong>{effectiveAct.name}</strong> <span className="muted small">{hyrox ? "HYROX" : SPORTS[effectiveAct.sport]?.label || "Run"}</span>
                    <div className="muted small">{d.hasDist ? `${fmtDist(d.dist)} ${d.unit}, ` : ""}{fmtTime(effectiveAct.time)}{d.hasDist ? `, ${d.paceStr}` : ""}{effectiveAct.elevation ? `, ${Math.round(d.elevV)} ${d.elevU}` : ""}{effectiveAct.hr ? `, ${effectiveAct.hr} bpm` : ""}</div>
                    {hyrox && (
                      <div className="muted small">
                        8 km of running in {hyroxFields(hyrox).runTotal} · {hyroxFields(hyrox).runPace}
                      </div>
                    )}
                  </div>
                  <button type="button" className="link" onClick={() => setShowManual((s) => !s)} data-testid="edit-stats">{showManual ? "Done" : "Edit"}</button>
                </div>
                {showManual && <ManualForm key={act.id} act={act} onChange={setAct} />}
                <div className="chips" style={{ marginTop: 12 }}>
                  <Chip on={act.id === "demo"} onClick={() => setAct(DEMO)}>Demo run</Chip>
                  <Chip on={act.id === "demo-workout"} onClick={() => setAct(DEMO_WORKOUT)} testid="demo-workout">Demo workout</Chip>
                  <Chip onClick={() => setShowStrava(true)}>From Strava</Chip>
                </div>
              </div>
              <div><div className="muted small label">Units</div><Seg value={opts.units} options={[["km", "Kilometres"], ["mi", "Miles"]]} onChange={(v) => set("units", v)} /></div>
              <div>
                <div className="muted small label">Show in the stat row</div>
                <div className="chips">{[["time", "Time"], ["pace", "Pace / speed"], ["elev", "Elevation"], ["hr", "Heart rate"], ["cal", "Calories"], ["date", "Date"]].map(([k, l]) => <Chip key={k} on={opts.stats[k]} onClick={() => setStat(k)}>{l}</Chip>)}</div>
              </div>
              <div className="card">
                <div className="muted small label">Caption</div>
                <pre className="caption">{captionFor(effectiveAct, opts)}</pre>
                <button type="button" className="btn" onClick={copyCaption} data-testid="copy-caption">Copy caption</button>
              </div>
            </div>
          )}

          {tab === "adjust" && selection.length === 0 && (
            <div className="stack">
              <Slider label="Text size" value={opts.scale} min={0.7} max={1.35} step={0.05} onChange={(v) => set("scale", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
              <p className="muted small" style={{ margin: 0 }}>Tip: drag directly on the preview to move the design.</p>
              <Slider label="Move left / right" value={opts.offsetX || 0} min={-500} max={500} step={10} onChange={(v) => set("offsetX", v)} fmt={(v) => `${v > 0 ? "+" : ""}${v}`} />
              <Slider label="Move up / down" value={opts.offsetY} min={-800} max={800} step={10} onChange={(v) => set("offsetY", v)} fmt={(v) => `${v > 0 ? "+" : ""}${v}`} />
              <Slider label="Photo zoom" value={opts.zoom} min={1} max={2} step={0.02} onChange={(v) => set("zoom", v)} fmt={(v) => `${v.toFixed(2)}x`} />
              <button type="button" className="link" onClick={() => setOpts((o) => ({ ...DEFAULT_OPTS, accent: o.accent, filter: o.filter, theme: o.theme, units: o.units, stats: o.stats, fontHero: o.fontHero, fontBody: o.fontBody, textColor: o.textColor, tagline: o.tagline, show: o.show }))}>Reset position and size</button>
              <div className="card">
                <div className="muted small label">My looks</div>
                <p className="small">Save the current style, colours, fonts and filter as a preset you can apply to any future run in one tap.</p>
                <div className="hms">
                  <input value={lookName} onChange={(e) => setLookName(e.target.value)} placeholder="Name this look" data-testid="look-name" />
                  <button type="button" className="btn" data-testid="save-look" onClick={() => { const name = lookName.trim() || `Look ${looks.length + 1}`; const { offsetX, offsetY, zoom, ...rest } = opts; const next = [...looks.filter((l) => l.name !== name), { name, template, format, opts: rest }]; setLooks(next); saveLooks(next); setLookName(""); say(`Saved "${name}"`); }}>Save</button>
                </div>
                {looks.length > 0 && (
                  <div className="chips" style={{ marginTop: 10 }}>
                    {looks.map((l) => (
                      <span key={l.name} className="chip lookchip">
                        <button type="button" onClick={() => { setTemplate(l.template); setFmt(l.format || "story"); setOpts((o) => ({ ...o, ...l.opts })); say(`Applied "${l.name}"`); }} data-testid={`look-${l.name}`}>{l.name}</button>
                        <button type="button" aria-label={`Delete ${l.name}`} onClick={() => { const next = looks.filter((x) => x.name !== l.name); setLooks(next); saveLooks(next); }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="exports">
            <button type="button" className="btn primary" onClick={() => exportImage("full")} disabled={!!exporting} data-testid="export-image">Save image</button>
            <button type="button" className="btn primary" onClick={exportVideo} disabled={!!exporting} data-testid="export-video">{exporting === "video" ? `Recording ${progressPct}%` : media?.type === "video" ? "Save video" : "Save animated video"}</button>
            <button type="button" className="btn" onClick={() => exportImage("sticker")} disabled={!!exporting} data-testid="export-sticker">Save sticker (transparent)</button>
          </div>
          <div className="row" style={{ marginTop: 10 }}><span className="muted small">Export size</span><Seg value={quality} options={[["hd", `${FORMATS[format].w}×${FORMATS[format].h}`], ["fast", `${Math.round(FORMATS[format].w * 2 / 3)}×${Math.round(FORMATS[format].h * 2 / 3)} (faster)`]]} onChange={setQuality} /></div>
          <p className="muted small"> Video records in real time, so keep this tab in front. The sticker is just the overlay, for dropping onto any Story.</p>
        </section>
      </div>

      {showStrava && (
        <Modal onClose={() => setShowStrava(false)} title="Strava">
          {!strava.connected && (
            <>
              <p className="small">Paste an access token from <strong>strava.com/settings/api</strong>. It lasts 6 hours.</p>
              <div className="hms">
                <input placeholder="Access token" value={strava.token || ""} onChange={(e) => setStrava({ ...strava, token: e.target.value })} data-testid="token-input" />
                <button type="button" className="btn" onClick={useToken}>Load</button>
              </div>
              <hr />
              <p className="muted small" style={{ marginTop: 10, marginBottom: 10 }}>Or use the demo run to start creating:</p>
            </>
          )}
          {strava.connected && (
            <div className="row">
              <span className="small">Connected{strava.athlete ? ` as ${strava.athlete}` : ""}.</span>
              <span><button type="button" className="link" onClick={() => fetchActivities(strava.token)}>Refresh</button>{" "}<button type="button" className="link" onClick={disconnect}>Disconnect</button></span>
            </div>
          )}
          {status && <div className="muted small" style={{ marginTop: 8 }} data-testid="strava-status">{status}</div>}
          <div className="list">
            {activities.map((a) => (
              <button key={a.id} type="button" onClick={() => pickActivity(a)}>
                <strong>{a.name}</strong>
                <span className="muted small">{SPORTS[sportFromStrava(a.sport_type || a.type)]?.label}, {fmtDate(a.start_date_local)}{a.distance ? `, ${(a.distance / 1000).toFixed(1)} km` : ""}, {fmtTime(a.moving_time)}</span>
              </button>
            ))}
          </div>
          <button type="button" className="link" style={{ marginTop: 10 }} onClick={() => { setAct(DEMO); setShowStrava(false); }}>Use demo run instead</button>
        </Modal>
      )}

      {result && (
        <Modal onClose={() => { URL.revokeObjectURL(result.url); setResult(null); }} title={result.kind === "image" ? (result.mode === "sticker" ? "Your sticker" : "Your image") : "Your video"}>
          <div className={`stage small-stage ${result.mode === "sticker" ? "checker" : ""}`} style={{ aspectRatio: `${FORMATS[format].w}/${FORMATS[format].h}` }}>
            {result.kind === "image" ? <img src={result.url} alt="Export preview" data-testid="result-image" /> : <video src={result.url} controls playsInline autoPlay muted loop data-testid="result-video" />}
          </div>
          <div className="exports" style={{ marginTop: 12 }}>
            {canShareFiles && <button type="button" className="btn primary" onClick={share} data-testid="share">Share to Instagram, Messages...</button>}
            <a className="btn primary" href={result.url} download={fileName(result.ext)}>Download {result.ext.toUpperCase()}</a>
            <button type="button" className="btn" onClick={copyCaption}>Copy caption</button>
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            {canShareFiles ? "Share opens your phone's share sheet: pick Instagram, then Story or Post. " : "On a phone, press and hold the preview to save it to your camera roll. "}
            {result.mode === "sticker" ? "In Instagram, add it as a photo sticker on top of any Story." : "Caption is one tap away."}
          </p>
        </Modal>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
