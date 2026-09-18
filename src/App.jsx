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
import { TemplateGallery } from "./ui/TemplateGallery.tsx";
import { LookPicker } from "./ui/LookPicker.tsx";
import { Suggestions } from "./ui/Suggestions.tsx";
import { analysePhoto } from "./engine/photo.ts";
import { handleShortcut, SHORTCUTS } from "./editor/shortcuts.ts";
import { previewSettled, previewT } from "./editor/previewClock.ts";
import { measureLayer } from "./engine/layers.ts";
import { AlignBar } from "./ui/AlignBar.tsx";
import { getLook, DEFAULT_LOOK_ID } from "./looks/index.ts";
import { hyroxFields, hyroxToActivity } from "./model/hyrox.ts";
import {
  copyImageToClipboard,
  cropCanvas,
  exportFileName,
  stickerCrop,
  toBlob as canvasToBlob,
} from "./export/image.ts";
import { canUseWebCodecs, exportVideo, MAX_CLIP_SECONDS } from "./export/video.ts";
import { BUNDLED_FAMILIES } from "./engine/text.ts";
import { unregisterServiceWorker } from "./pwa/register.ts";
import * as Strava from "./data/strava.ts";
import { parseHeartRateZones, resolveAthleteHrMax, resolveZones, zoneOfBands } from "./data/hr.ts";
import { fetchRouteMap, MAP_STYLES, projectToCanvas } from "./data/mapTiles.ts";
import { buildCaption } from "./export/caption.ts";
import { layoutFromLocation, layoutToDocument, shareUrl } from "./export/shareLayout.ts";
import { MyDesigns } from "./ui/MyDesigns.tsx";
import { Settings } from "./ui/Settings.tsx";
import { contrastText, readableAccent } from "./util/contrast.ts";
import { newChartLayer, newRouteLayer, newStatLayer, newStatRowLayer, newTextLayer } from "./model/defaults.ts";
import { saveDoc, listDocs, loadDoc, deleteDoc, loadPrefs, savePrefs } from "./storage/db.ts";
import {
  W, H, FORMATS, setFormat, ANIM_SECONDS, DEMO, SPORTS, sportFromStrava, DEFAULT_OPTS,
  renderFrame, fmtTime, fmtDate, fmtDist, decodePolyline, derive,
} from "./render.js";

// Strava session storage lives in src/data/strava.ts, which owns the key and migrates the
// legacy pasted-token shape (§7.2).
const canShareFiles = typeof navigator !== "undefined" && !!navigator.canShare;

// ---- small UI pieces (module scope so inputs keep focus while typing) ----
function Seg({ value, options, onChange }) {
  return <div className="seg">{options.map(([v, label]) => <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>{label}</button>)}</div>;
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
      {/* This is the peak reached on THIS run, not the athlete's maximum. The old label
          said "for zones", which is what it was wrongly used for (§7.4); zones now come from
          Strava or from Settings, never from here. */}
      <Field label="Max heart rate on this run"><input type="number" placeholder="optional" defaultValue={act.activityHrMax || ""} onChange={(e) => upd({ activityHrMax: parseInt(e.target.value, 10) || null })} /></Field>
      <Field label="Calories"><input type="number" placeholder="optional" defaultValue={act.calories || ""} onChange={(e) => upd({ calories: parseInt(e.target.value, 10) || null })} /></Field>
    </div>
  );
}

// thumbnail of one template, re-rendered when inputs change

export default function App() {
  const [media, setMedia] = useState(null);
  const [act, setAct] = useState(DEMO);
  const [template, setTemplate] = useState("poster");
  const [opts, setOpts] = useState(DEFAULT_OPTS);
  const [format, setFmt] = useState("story");
  const [tab, setTab] = useState("designs");
  const [showStrava, setShowStrava] = useState(false);
  const [exporting, setExporting] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [animKey, setAnimKey] = useState(0);
  const [strava, setStrava] = useState(() => Strava.loadSession() ?? {});
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
  const storeSetFormat = useEditor((st) => st.setFormat);
  const toggleSafeZones = useEditor((st) => st.toggleSafeZones);
  const clearSelection = useEditor((st) => st.clearSelection);
  const deleteSelection = useEditor((st) => st.deleteSelection);
  const addLayer = useEditor((st) => st.addLayer);
  const patchDoc = useEditor((st) => st.patchDoc);
  const setStoreDoc = useEditor((st) => st.setDoc);
  const [designs, setDesigns] = useState([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [quality, setQuality] = useState("hd"); // 720 | 1080 (hd) | 2x
  const tone = "deadpan";
  const [storageNote, setStorageNote] = useState("");

  // Undo/redo comes from zundo's temporal store (§6.1).
  const temporal = useStore(useEditor.temporal, (st) => st);
  const undo = () => useEditor.temporal.getState().undo();
  const redo = () => useEditor.temporal.getState().redo();
  const canUndo = temporal.pastStates.length > 0;
  const canRedo = temporal.futureStates.length > 0;

  const [hyrox, setHyrox] = useState(null);
  // The athlete's real heart-rate zones, from Strava. Null means we do not know them, and
  // nothing zone-related is drawn rather than guessed (§7.4).
  const [zoneBands, setZoneBands] = useState(null);
  // Stored preferences. `hrMax` here is the athlete's own maximum — the second honest
  // source of zones, for anyone who has not connected Strava. PR-A4.5 gives it a UI.
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showSettings, setShowSettings] = useState(false);
  const [lookId, setLookId] = useState(DEFAULT_LOOK_ID);
  const [matchedLook, setMatchedLook] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  // A photo-derived look is not in the curated set, so it lives beside it.
  const look = useMemo(
    () => (lookId === "from-photo" && matchedLook ? matchedLook : getLook(lookId)),
    [lookId, matchedLook],
  );

  // Analyse the photo once, on device, for Match my photo and Three for you (§2.7 S1, S2).
  useEffect(() => {
    if (media?.type !== "image") { setAnalysis(null); return; }
    try { setAnalysis(analysePhoto(media.el)); } catch { setAnalysis(null); }
  }, [media]);

  // A HYROX result drives both the legacy activity (so existing templates work) and the
  // extra {hyroxTotal}, {roxzone}, {station.*} bindings.
  const effectiveAct = useMemo(() => (hyrox ? { ...act, ...hyroxToActivity(hyrox) } : act), [act, hyrox]);

  // One place decides which zones we have, and it is never told about the activity. Strava's
  // own zones win; a maximum typed into Settings is the fallback; otherwise undefined, and
  // everything zone-shaped draws nothing rather than something invented (§7.4).
  const athlete = useMemo(() => (zoneBands ? { hrZones: zoneBands } : null), [zoneBands]);
  const zones = useMemo(() => resolveZones(prefs, athlete), [prefs, athlete]);
  // The rings need a denominator and no band carries one, so it is resolved separately.
  const athleteHrMax = useMemo(() => resolveAthleteHrMax(prefs, athlete), [prefs, athlete]);

  // The legacy switch-case renderer cannot import the resolver — doing so breaks the golden
  // harness, which loads src/render.js as a raw ES module — so it is handed the answer
  // instead. Kept out of `opts` state on purpose: opts is saved into documents, and the
  // athlete's zones are session data that must not be frozen into a design (§7.4).
  // Which theme is actually on screen. Held in state rather than read back off the DOM,
  // because the accent below depends on it and effects run in declaration order — reading
  // `dataset.theme` from the accent effect gave the light neutral on a dark-preferring
  // browser, which the a11y suite caught as #1a1a1a on #38383a, 1.48:1.
  const [resolvedTheme, setResolvedTheme] = useState("light");

  // "auto" follows the OS and keeps following it, so a system change at dusk is picked up
  // without a reload.
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const choice = prefs.theme ?? "auto";
      const next = choice === "auto" ? (media.matches ? "dark" : "light") : choice;
      root.dataset.theme = next;
      setResolvedTheme(next);
      // The browser paints its own chrome around the page from this, so a stale value means
      // a dark bar above a light app on a phone. Static markup cannot follow a toggle.
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim());
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [prefs.theme]);

  // The chrome wears the look the athlete is designing in. `readableAccent` is what stops
  // that going wrong: a look's accent is chosen against that look's own canvas, so
  // blueprint's pure white would be an invisible selected-state border on an off-white
  // chrome. When the accent cannot be seen, the neutral for the current theme stands in.
  useEffect(() => {
    const root = document.documentElement;
    const chrome = getComputedStyle(root).getPropertyValue("--bg").trim();
    const neutral = resolvedTheme === "dark" ? "#f2f2f2" : "#1a1a1a";
    const accent = readableAccent(look?.colors?.accent, chrome, neutral);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-contrast", contrastText(accent));
  }, [look, resolvedTheme]);

  // Places a coordinate on the canvas using the map's own projection, so the trace lands on
  // the roads it was run on — and keeps doing so as the map is zoomed or panned, because
  // this mirrors the same cover fit drawCover uses.
  const [mapBusy, setMapBusy] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapGeo, setMapGeo] = useState(null);

  const placeRoute = useMemo(() => {
    if (!mapGeo || !media?.attribution) return undefined;
    return projectToCanvas({
      box: mapGeo.box,
      imgW: mapGeo.imgW,
      imgH: mapGeo.imgH,
      canvasW: W,
      canvasH: H,
      zoom: opts.zoom ?? 1,
      panX: opts.panX ?? 0,
      panY: opts.panY ?? 0,
    });
  }, [mapGeo, media, opts.zoom, opts.panX, opts.panY]);

  const renderOpts = useMemo(
    () => ({ ...opts, zones: zones?.bands ?? null, athleteHrMax }),
    [opts, zones, athleteHrMax],
  );

  const fields = useMemo(() => {
    const base = buildFields(effectiveAct, opts, zones?.bands ?? null);
    return hyrox ? { ...base, ...hyroxFields(hyrox) } : base;
  }, [effectiveAct, opts, hyrox, zones]);
  const series = useMemo(() => {
    const a = effectiveAct;
    const km = (a.distance || 0) / 1000;
    // Relative effort, when Strava has not supplied one: minutes-in-zone weighted (§7.4).
    //
    // This was the last place a zone was worked out from a heart rate the app had no
    // business dividing by — `a.hrMax || 190`, the peak of this very run — with its own
    // private copy of the 60/70/80/90 thresholds. It now asks the same bands as everything
    // else, and when there are no bands there is no effort score, because an effort number
    // derived from a made-up maximum is exactly the kind of confident wrong answer this
    // whole change is removing.
    let effort;
    if (a.hrStream?.length && zones) {
      const weights = [1, 2, 3, 5, 8];
      const perSample = (a.time || 0) / a.hrStream.length / 60;
      const score = a.hrStream.reduce((acc, bpm) => {
        const z = zoneOfBands(bpm, zones.bands);
        return z === null ? acc : acc + perSample * weights[z];
      }, 0);
      effort = Math.max(0, Math.min(100, Math.round((score / (60 * 5)) * 100)));
    }
    return {
      route: a.route || [],
      hr: a.hrStream || [],
      zones: zones?.bands,
      athleteHrMax: athleteHrMax ?? undefined,
      splits: a.splits || [],
      altitude: a.elev || [],
      distanceKm: km,
      durationSeconds: a.time || 0,
      avgHr: a.hr || undefined,
      effort,
      calories: a.calories || undefined,
    };
  }, [effectiveAct, zones, athleteHrMax]);

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

  // Align, distribute and format reflow all need to know how big a layer actually is, and
  // must agree with the renderer — so they share its measurement.
  const measureRef2 = useRef(null);
  const measure = useCallback(
    (layer) => {
      if (!measureRef2.current) {
        const c = document.createElement("canvas");
        c.width = 8; c.height = 8;
        measureRef2.current = c.getContext("2d");
      }
      const env = { ctx: measureRef2.current, fields, asset: assetResolver, anim: { opacity: 1, dx: 0, dy: 0, scale: 1, progress: 1 }, hyrox, series };
      try { return measureLayer(layer, env); } catch { return { w: 200, h: 100 }; }
    },
    [fields, assetResolver, hyrox, series],
  );

  // Hand the measurer to the store, so a newly added object is placed by its real size
  // rather than a guess — see src/model/placement.ts.
  useEffect(() => {
    useEditor.getState().setMeasure(measure);
  }, [measure]);

  const canvasRef = useRef(null);
  // A coarse luminance map of the photo, measured once when it changes (§2.7 S4).
  //
  // The engine cannot do this itself: ctx.getImageData forces a GPU readback of several
  // milliseconds, and doing it per text layer per frame across a six-second animation is
  // seconds of jank — and the engine takes no DOM anyway (CLAUDE.md rule 6). A photo does
  // not change while the layers animate, so once is enough.
  const [backdrop, setBackdrop] = useState(null);
  useEffect(() => {
    const el = media?.el;
    if (!el) {
      setBackdrop(null);
      return;
    }
    const COLS = 8;
    const ROWS = 14;
    try {
      const small = document.createElement("canvas");
      small.width = COLS;
      small.height = ROWS;
      const sctx = small.getContext("2d", { willReadFrequently: true });
      if (!sctx) return;
      // Downscaling to one pixel per cell IS the averaging, and it runs on the GPU.
      sctx.drawImage(el, 0, 0, COLS, ROWS);
      const { data } = sctx.getImageData(0, 0, COLS, ROWS);
      const lum = [];
      for (let i = 0; i < data.length; i += 4) {
        const ch = (v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        lum.push(0.2126 * ch(data[i]) + 0.7152 * ch(data[i + 1]) + 0.0722 * ch(data[i + 2]));
      }
      setBackdrop({ cols: COLS, rows: ROWS, lum });
    } catch {
      // A tainted canvas (a cross-origin photo) cannot be read. No map, no adaptation.
      setBackdrop(null);
    }
  }, [media]);

  const stateRef = useRef({});
  stateRef.current = { media, act: effectiveAct, template, opts, format, doc, fields, assetResolver, editingTextId, hyrox, series, look, backdrop, renderOpts, placeRoute };
  const startRef = useRef(performance.now());
  // Restart the animation whenever there is something new to watch — including turning the
  // Animated toggle on. Without opts.animate here the preview plays once, holds, and then
  // the toggle does nothing you can see, because the clock has already run out.
  useEffect(() => { startRef.current = performance.now(); }, [template, animKey, act, format, opts.animate, doc.templateId]);
  useEffect(() => { setFormat(format); }, [format]);

  // §4.9: switching format keeps anchors and only nudges what would fall outside the new
  // safe zone or canvas width.
  useEffect(() => {
    storeSetFormat(format, measure);
  }, [format]);

  // The legacy state (template, format, opts, units) is still the source of truth for the
  // template pass, so mirror it into the document. Phase 2 inverts this.
  // A look owns colour and texture for the document layers; mirror the key tokens into the
  // legacy opts so the template pass underneath does not fight it.
  useEffect(() => {
    if (!look) return;
    setOpts((o) => ({
      ...o,
      accent: look.colors.accent.startsWith("#") ? look.colors.accent : o.accent,
      grain: look.texture.grain,
      vignette: look.texture.vignette,
      uppercase: look.type.uppercase,
    }));
  }, [look]);

  useEffect(() => {
    patchDoc((d) => {
      d.templateId = template;
      d.opts = opts;
      d.units = opts.units === "mi" ? "mi" : "km";
      d.prefs.safeZones = safeZones;
      d.lookId = lookId;
    });
  }, [template, format, opts, safeZones, lookId, patchDoc]);

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

  useEffect(() => {
    const onKey = (e) => {
      handleShortcut(e, {
        store: () => useEditor.getState(),
        measure,
        undo: () => useEditor.temporal.getState().undo(),
        redo: () => useEditor.temporal.getState().redo(),
        onExportImage: () => exportImage("full"),
        onAddText: () => { const l = newTextLayer(); addLayer(l); setTab("designs"); },
        onAddStat: () => { addLayer(newStatLayer("distance")); setTab("designs"); },
        onAddRoute: () => { addLayer(newRouteLayer()); setTab("designs"); },
        onToggleShortcutHelp: () => setShowShortcuts((v) => !v),
        onFit: () => {},
        onZoom: () => {},
        // Layers live in 1000-wide canvas units; the stage is ~330 CSS px on a phone.
        unitsPerPx: () => {
          const r = canvasRef.current?.getBoundingClientRect();
          return r?.width > 0 ? 1000 / r.width : 3;
        },
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Autosave 500 ms after the last change, so a Safari reload never costs work (§1.1 A8, §8).
  useEffect(() => {
    if (doc.layers.length === 0 && doc.name === "Untitled design") return;
    const id = setTimeout(async () => {
      const c = document.createElement("canvas");
      c.width = 216; c.height = Math.round((FORMATS[format].h / FORMATS[format].w) * 216);
      const k = 216 / FORMATS[format].w;
      const cx = c.getContext("2d");
      cx.scale(k, k);
      try { renderFrame(cx, media, act, template, { ...stateRef.current.renderOpts, animate: false }, 1, 1); } catch {}
      cx.save(); cx.scale(W / 1000, W / 1000);
      try { renderLayers(cx, doc, { t: Number.POSITIVE_INFINITY, mode: "thumb", fields, asset: assetResolver, hyrox, series, look }); } catch {}
      cx.restore();
      const res = await saveDoc({ ...doc, thumb: c.toDataURL("image/jpeg", 0.6) });
      if (!res.ok && res.reason) setStorageNote(res.reason);
      else savePrefs({ lastDocId: doc.id });
    }, 500);
    return () => clearTimeout(id);
  }, [doc, format, media, act, template, opts, fields, assetResolver]);

  // Restore the last design on first load (§3.8 "Continue last design").
  //
  // Skipped when the URL carries a shared layout: both effects run on mount and this one is
  // async, so it would otherwise land second and overwrite the layout the link asked for.
  useEffect(() => {
    (async () => {
      if (window.location.hash.startsWith("#layout=")) return;
      const { lastDocId } = loadPrefs();
      if (!lastDocId) return;
      const saved = await loadDoc(lastDocId);
      if (saved && saved.layers.length > 0) {
        setStoreDoc(saved);
        setTemplate(saved.templateId || "poster");
        setFmt(saved.format || "story");
        if (saved.opts && Object.keys(saved.opts).length) setOpts((o) => ({ ...o, ...saved.opts }));
        say("Picked up where you left off");
      }
    })();
  }, []);

  const refreshDesigns = useCallback(async () => { setDesigns(await listDocs()); }, []);

  // The athlete's real heart-rate zones. Fetched once per session; if Strava will not give
  // them — an older connection granted before profile:read_all was requested, say — we keep
  // null and simply do not draw zones, rather than deriving them from a number that is not
  // a maximum (§7.4).
  const loadZones = useCallback(async (session) => {
    if (!session?.connected) return;
    const { data, session: fresh } = await Strava.fetchAthleteZones(session);
    if (fresh && fresh !== session) setStrava(fresh);
    setZoneBands(parseHeartRateZones(data));
  }, []);

  // Zones live in React state, and the session is restored from storage on mount — so
  // without this, they were fetched once at sign-in and gone on the next page load. Every
  // reload showed no zones, which is exactly what "the zone fix isn't working" looked like.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once for the restored session
  useEffect(() => {
    const restored = Strava.loadSession();
    if (restored?.connected) loadZones(restored);
  }, [loadZones]);

  // Plays once, then holds. See src/editor/previewClock.ts for why it no longer replays.
  const animElapsed = () => (performance.now() - startRef.current) / 1000;
  const animT = () => previewT(animElapsed(), ANIM_SECONDS);
  const animDone = () => previewSettled(animElapsed(), ANIM_SECONDS);

  // A Design from the Designs tab owns the whole composition: its elements ARE the design.
  // The legacy template must then draw only the background, or its own hero, stats and route
  // are painted underneath and you see two complete designs stacked on one canvas.
  const designOwnsCanvas = (d) => (d?.layers ?? []).some((l) => l.source === "template");
  // null means "draw nothing at all" — a sticker export of a Design is just its layers.
  const legacyMode = (d, mode) => (designOwnsCanvas(d) ? (mode === "sticker" ? null : "background") : mode);

  // The canvas paints once and holds; it does not re-run when a web font finishes loading.
  // So a design drawn before the faces arrive stays drawn in the fallback — Impact where the
  // look asked for Monoton — and looks like the bundling did nothing. One redraw once the
  // fonts are ready fixes it, and after that they are in the browser's cache.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    const fonts = document.fonts;
    if (!fonts) {
      setFontsReady(true);
      return;
    }
    // Every family has to be asked for by name. Canvas will not request one and neither will
    // fonts.ready, which resolves straight away because nothing is pending — the faces sit
    // there "unloaded" and every design draws in the fallback.
    Promise.all(BUNDLED_FAMILIES.map((family) => fonts.load(`700 32px "${family}"`).catch(() => null)))
      .then(() => fonts.ready)
      .then(() => {
        if (live) setFontsReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { media, act, template, opts, format } = stateRef.current;
    setFormat(format);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    let progress = 1;
    if (media?.type === "video" && media.el.duration) progress = media.el.currentTime / media.el.duration;
    const ctx = c.getContext("2d");
    const lm = legacyMode(stateRef.current.doc, "full");
    // When a Design owns the canvas and there is no photo behind it, the LOOK is the page.
    //
    // Without this the legacy renderer painted its own dark gradient underneath and the
    // design's colours came from the look's tokens, so any light look — paper, journal,
    // clinic — drew dark text on a dark ground and read as broken. "A look restyles every
    // element at once" has to include the surface those elements sit on.
    const ownsCanvas = designOwnsCanvas(stateRef.current.doc);
    if (ownsCanvas && !media) {
      ctx.fillStyle = stateRef.current.look?.colors?.bg ?? "#111111";
      ctx.fillRect(0, 0, W, H);
    } else if (lm) {
      renderFrame(ctx, media, act, template, stateRef.current.renderOpts, progress, opts.animate ? animT() : 1, lm);
    } else {
      ctx.clearRect(0, 0, W, H);
    }

    // Document layers, drawn on top in canvas units (1000 wide, §4.1).
    const st = stateRef.current;
    if (st.doc?.layers?.length) {
      ctx.save();
      ctx.scale(W / 1000, W / 1000);
      renderLayers(ctx, st.doc, {
        backdrop: stateRef.current.backdrop,
        placeRoute: stateRef.current.placeRoute,
        // Once settled, ask for t = Infinity rather than t = 6. Infinity is the settled
        // state every preset agrees on (engine/anim.ts), and it is exactly what export and
        // thumbnails pass — so a held preview is now pixel-identical to what you save.
        t: opts.animate && !animDone() ? animT() * 6 : Number.POSITIVE_INFINITY,
        mode: "full",
        fields: st.fields,
        asset: st.assetResolver,
        hyrox: st.hyrox,
        series: st.series,
        look: st.look,
        hideLayerId: st.editingTextId,
      });
      ctx.restore();
    }

    // Mapbox's terms require its credit to be visible wherever one of its maps is. The image
    // is fetched without the baked-in version so it can be placed legibly rather than
    // wherever the tile happened to put it — which means drawing it here, last, so no design
    // can cover it and every export carries it.
    const credit = stateRef.current.media?.attribution;
    if (credit) {
      ctx.save();
      ctx.font = `500 ${Math.round(W * 0.019)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const pad = Math.round(W * 0.022);
      const tw = ctx.measureText(credit).width;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, H - pad * 2.1, tw + pad * 2, pad * 2.1);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(credit, pad, H - pad * 0.7);
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    let alive = true, raf = 0;
    // Video keeps its own clock, so it loops for as long as it plays. A still design stops
    // requesting frames the moment the animation settles — otherwise the phone redraws an
    // identical frame sixty times a second for the life of the tab.
    const loop = () => {
      if (!alive) return;
      draw();
      if (media?.type === "video" || !animDone()) raf = requestAnimationFrame(loop);
    };
    if (media?.type === "video" || opts.animate) loop(); else draw();
    return () => { alive = false; cancelAnimationFrame(raf); };
  // animKey is in here because the loop stops once the animation settles; pressing Replay
  // resets the clock, and without a dependency on it nothing would start drawing again.
  }, [media, act, template, opts, format, draw, doc, fields, editingTextId, series, look, animKey, fontsReady]);

  // Reframing the photo must repaint at once. The draw loop stops once the animation has
  // settled, and a change to `opts` alone did not restart it — the canvas kept showing the
  // pre-pinch framing while the state underneath it was already correct.
  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw on transform, not on identity
  useEffect(() => {
    draw();
  }, [opts.zoom, opts.panX, opts.panY]);

  // ---- Strava (§7.2) ----
  //
  // Sign in ONCE. The old flow asked people to paste an access token that Strava expires
  // after six hours (§1.2 E1), which is why the connection kept dropping — and pasting a
  // token is not something anyone will do on a phone. This is a plain redirect, so it works
  // identically on a phone, and the token refreshes itself from then on.
  const [stravaConfig, setStravaConfig] = useState(null);

  useEffect(() => {
    Strava.fetchConfig().then(setStravaConfig);
  }, []);

  // Handle the redirect back from Strava, then load the activity list.
  useEffect(() => {
    (async () => {
      const { session, error: signInError } = await Strava.completeSignIn(window.location.search);
      Strava.clearOAuthParams();
      if (signInError) { setShowStrava(true); setStatus(signInError); return; }
      if (!session) return;
      setStrava(session);
      setShowStrava(true);
      await loadActivities(session);
      await loadZones(session);
    })();
  }, []);

  const loadActivities = async (session) => {
    setStatus("Loading your recent activities…");
    const { data, error: apiError, session: fresh } = await Strava.fetchActivities(session, 30);
    if (fresh && fresh !== session) setStrava(fresh);
    if (apiError) { setStatus(apiError); return; }
    setActivities(data ?? []);
    setStatus((data ?? []).length ? `${data.length} activities. Tap one.` : "Connected, but no activities found.");
  };

  const connectStrava = () => {
    if (!stravaConfig?.configured) {
      setStatus("Strava sign-in is not configured on this deployment yet.");
      return;
    }
    Strava.beginSignIn(stravaConfig);
  };

  const disconnect = () => {
    Strava.saveSession(null);
    setStrava({});
    setActivities([]);
    setStatus("Disconnected.");
  };

  const useToken = async () => {
    // Kept behind an "Advanced" disclosure for testers (§7.2), and honest that it dies in
    // six hours because a pasted token has no refresh token attached.
    const token = (strava.token || "").trim();
    if (!token) { setStatus("Paste an access token first."); return; }
    const session = { accessToken: token, refreshToken: "", expiresAt: 0, connected: true };
    Strava.saveSession(session);
    setStrava(session);
    await loadActivities(session);
    await loadZones(session);
  };

  const pickActivity = async (a) => {
    setStatus(`Loading ${a.name}…`);
    const [detail, streams] = await Promise.all([
      Strava.fetchActivity(strava, a.id),
      Strava.fetchStreams(strava, a.id),
    ]);
    if (detail.session && detail.session !== strava) setStrava(detail.session);

    const dd = detail.data ?? {};
    const sd = streams.data ?? {};
    const thin = (arr) => {
      if (!arr?.length) return null;
      const step = Math.max(1, Math.floor(arr.length / 200));
      return arr.filter((_, i) => i % step === 0);
    };

    const splits = (dd.splits_metric ?? [])
      .filter((sp) => sp.distance > 200)
      .map((sp) => sp.moving_time / (sp.distance / 1000));

    setAct({
      id: a.id,
      sport: sportFromStrava(a.sport_type || a.type),
      name: a.name,
      date: a.start_date_local || a.start_date,
      distance: a.distance || 0,
      time: a.moving_time,
      elevation: a.total_elevation_gain || 0,
      hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
      // The peak reached during THIS run, for display. It used to have 5 added and be used
      // as the zone ceiling, which reported every run as Z4/Z5 (§7.4). Zones now come from
      // the athlete's own Strava zones; see zoneBands below.
      activityHrMax: a.max_heartrate ? Math.round(a.max_heartrate) : null,
      calories: dd.calories ? Math.round(dd.calories) : null,
      route: decodePolyline(dd.map?.polyline || a.map?.summary_polyline),
      splits: splits.length ? splits : null,
      elev: thin(sd.altitude?.data),
      hrStream: thin(sd.heartrate?.data),
      externalUrl: `https://www.strava.com/activities/${a.id}`,
    });
    setHyrox(null);
    setShowStrava(false);
    setStatus("");
  };

  // ---- media ----
  //
  // HEIC: Safari decodes it natively, so an iPhone user is fine. Chrome and Firefox cannot,
  // and the old message told everyone to change their camera settings — which is wrong
  // advice on the browser where it already works. The message now names the browser's
  // limitation instead of blaming the phone (§1.2 E8 is only half-fixed: a real decoder is
  // still needed for Chrome).
  // Map backgrounds (§2.12). The map arrives as `media`, so zoom, pan, filters, the dim and
  // the adaptive legibility all apply to it exactly as they do to a photo — nothing new has
  // to learn what a map is.
  const useMapBackground = async (style) => {
    const route = (effectiveAct.route || []).map(([lat, lon]) => ({ lat, lon }));
    if (route.length === 0) {
      setError("This activity has no GPS track, so there is no map to draw.");
      return;
    }
    setMapBusy(true);
    setError("");
    try {
      const map = await fetchRouteMap(route, style, 720, Math.round((720 * H) / W));
      if (!map) {
        setError("Map backgrounds are not available right now.");
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (media?.type === "video") media.el.pause();
        // Mapbox requires its attribution to be visible wherever one of its maps is, and the
        // image is requested without the baked-in credit so it can be placed legibly here.
        setMedia({ type: "image", el: img, url: map.url, name: `map-${style}`, attribution: map.attribution });
        setMapGeo({ box: map.box, imgW: map.width, imgH: map.height });
        // The legacy templates' small route inset is a decorative thumbnail, not a
        // geographic one, so over a map it is the same run drawn twice at two scales.
        setOpts((o) => ({ ...o, showMap: false }));
      };
      img.src = map.url;
    } finally {
      setMapBusy(false);
    }
  };

  const clearMedia = () => {
    if (media?.type === "video") media.el.pause();
    if (media?.url) URL.revokeObjectURL(media.url);
    const wasMap = Boolean(media?.attribution);
    setMedia(null);
    setMapGeo(null);
    setError("");
    // Undo what applying a map changed, so removing it really does put things back: the
    // route inset returns, and the framing resets rather than leaving a photo you add next
    // mysteriously zoomed into its own corner.
    setOpts((o) => ({ ...o, ...(wasMap ? { showMap: true } : {}), zoom: 1, panX: 0, panY: 0 }));
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    const url = URL.createObjectURL(f);
    if (media?.type === "video") media.el.pause();

    if (f.type.startsWith("video")) {
      const v = document.createElement("video");
      v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
      v.onerror = () => setError("This video format could not be played here. Try an MP4 (H.264) or an iPhone MOV.");
      v.onloadeddata = () => {
        v.play().catch(() => {});
        setMedia({ type: "video", el: v, url, name: f.name });
        setTemplate((t) => (["hud", "chase"].includes(t) ? t : "hud"));
        setTab("designs");
      };
      v.load();
    } else if (f.type.startsWith("image") || /\.(heic|heif)$/i.test(f.name)) {
      const img = new Image();
      img.onerror = () => {
        const heic = /\.(heic|heif)$/i.test(f.name) || /heic|heif/i.test(f.type);
        setError(
          heic
            ? "This browser cannot open HEIC photos. Safari can — or export the photo as JPEG from Photos."
            : "This image could not be opened. Try a JPEG or PNG.",
        );
      };
      img.onload = () => {
        setMedia({ type: "image", el: img, url, name: f.name });
        setAnimKey((k) => k + 1);
      };
      img.src = url;
    } else {
      setError("Please choose a photo or a video file.");
    }
    e.target.value = "";
  };

  // ---- export (§9) ----
  const [imageFormat, setImageFormat] = useState("png");
  const [videoPath, setVideoPath] = useState(null);

  useEffect(() => {
    canUseWebCodecs(1080, 1920).then((ok) => setVideoPath(ok ? "webcodecs" : "mediarecorder"));
  }, []);

  // §2.7 S16: a layout link opens as a template, with no server involved.
  useEffect(() => {
    const { layout, error: linkError } = layoutFromLocation(window.location.hash);
    if (linkError) { setError(linkError); return; }
    if (!layout) return;
    setStoreDoc(layoutToDocument(layout, useEditor.getState().doc));
    if (layout.lookId) setLookId(layout.lookId);
    setFmt(layout.format);
    window.history.replaceState({}, "", window.location.pathname);
    say(`"${layout.name}" opened — add your own photo and run`);
  }, []);

  // §9.5: opens offline, and says so rather than silently swapping under the user.
  // The worker is gone (src/pwa/register.ts explains why). Remove any copy still installed
  // in someone's browser, so the page they see is the page that was deployed.
  useEffect(() => { unregisterServiceWorker(); }, []);

  const exportScale = () => (quality === "fast" ? 720 / FORMATS[format].w : quality === "2x" ? 2 : 1);

  const mkCanvas = () => {
    setFormat(format);
    const k = exportScale();
    const c = document.createElement("canvas");
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    c.getContext("2d").scale(k, k);
    return c;
  };

  const fileName = (ext) =>
    exportFileName(effectiveAct.name, d.hasDist ? fmtDist(d.dist) : null, opts.units, effectiveAct.date, ext);

  /** Legacy template pass plus the document layers, at `t` seconds. */
  const drawFull = (ctx, mode, t = Number.POSITIVE_INFINITY) => {
    const animT2 = t === Number.POSITIVE_INFINITY ? 1 : Math.min(1, t / ANIM_SECONDS);
    const lm = legacyMode(doc, mode);
    if (lm) renderFrame(ctx, media, effectiveAct, template, stateRef.current.renderOpts, 1, animT2, lm);
    else ctx.clearRect(0, 0, W, H);
    if (doc.layers.length) {
      ctx.save();
      ctx.scale(W / 1000, W / 1000);
      renderLayers(ctx, doc, { t, mode, fields, asset: assetResolver, hyrox, series, look, backdrop, placeRoute });
      ctx.restore();
    }
  };

  const exportImage = async (mode = "full") => {
    try {
      const c = mkCanvas();
      drawFull(c.getContext("2d"), mode);

      let out = c;
      // §9.2: a sticker is cropped tight to what it contains, not a full transparent frame.
      if (mode === "sticker" && doc.layers.length > 0) {
        const measureCtx = document.createElement("canvas").getContext("2d");
        const env = { ctx: measureCtx, fields, asset: assetResolver, anim: { opacity: 1, dx: 0, dy: 0, scale: 1, progress: 1 }, hyrox, series };
        const placed = layoutDoc(doc, env, look).placed.filter((pl) => {
          const layer = doc.layers.find((l) => l.id === pl.id);
          return layer?.visible && layer?.sticker;
        });
        const canvasUnits = { w: 1000, h: (1000 * FORMATS[format].h) / FORMATS[format].w };
        const rect = stickerCrop(placed, canvasUnits, exportScale());
        if (rect) out = cropCanvas(c, rect, (W / 1000) * exportScale());
      }

      const ext = mode === "sticker" ? "png" : imageFormat;
      const blob = await canvasToBlob(out, ext);
      if (!blob) throw new Error("canvas returned nothing");
      setResult({ url: URL.createObjectURL(blob), blob, kind: "image", ext, mode });
    } catch (e) {
      setError(`Export failed: ${e.message}`);
    }
  };

  const exportVideoNow = async () => {
    setExporting("video");
    setError("");
    setProgressPct(0);

    const clip = media?.type === "video" ? media.el : null;
    if (clip && clip.duration > MAX_CLIP_SECONDS) {
      setExporting("");
      setError(`This video is ${Math.round(clip.duration)} seconds. Trim it to ${MAX_CLIP_SECONDS} seconds or under in your Photos app, or export a still image instead.`);
      return;
    }

    const k = exportScale();
    const duration = clip?.duration || ANIM_SECONDS + 1.5;

    try {
      if (clip) { clip.loop = false; clip.pause(); }
      const out = await exportVideo({
        width: Math.round(W * k),
        height: Math.round(H * k),
        fps: 30,
        duration,
        bitrate: 10_000_000,
        onProgress: (done, total) => setProgressPct(Math.round((done / total) * 100)),
        drawFrame: (ctx, t) => {
          ctx.save();
          ctx.scale(k, k);
          if (clip) {
            // Frame-accurate: seek the clip rather than playing it (§9.3).
            try { clip.currentTime = Math.min(clip.duration, t); } catch {}
            renderFrame(ctx, media, effectiveAct, template, stateRef.current.renderOpts, clip.duration ? t / clip.duration : 0, Math.min(1, t / ANIM_SECONDS), "full");
          } else {
            renderFrame(ctx, media, effectiveAct, template, { ...stateRef.current.renderOpts, animate: true }, 1, Math.min(1, t / ANIM_SECONDS), "full");
          }
          if (doc.layers.length) {
            ctx.scale(W / 1000, W / 1000);
            renderLayers(ctx, doc, { t, mode: "full", fields, asset: assetResolver, hyrox, series, look, backdrop, placeRoute });
          }
          ctx.restore();
        },
      });

      setResult({ url: URL.createObjectURL(out.blob), blob: out.blob, kind: "video", ext: out.ext, mode: "full", path: out.path });
      say(out.path === "webcodecs" ? `Encoded ${out.frames} frames` : "Recorded in real time");
    } catch (e) {
      setError(`Video export failed: ${e.message}`);
    } finally {
      if (clip) { clip.loop = true; clip.play().catch(() => {}); }
      setExporting("");
    }
  };


  const share = async () => {
    if (!result) return;
    try {
      const file = new File([result.blob], fileName(result.ext), { type: result.blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: act.name }); return; }
      say("Sharing is not available in this browser. Use Download, then post from your camera roll.");
    } catch (e) { if (e.name !== "AbortError") say(`Could not share: ${e.message}`); }
  };
  const captionInput = () => ({
    name: effectiveAct.name,
    sport: effectiveAct.sport ?? "run",
    distance: d.hasDist ? `${fmtDist(d.dist)} ${d.unit}` : null,
    time: fmtTime(effectiveAct.time ?? 0),
    pace: d.hasDist ? d.paceStr : null,
    elevation: effectiveAct.elevation ? `${Math.round(d.elevV)} ${d.elevU}` : null,
    hr: effectiveAct.hr ? `${effectiveAct.hr} bpm` : null,
    calories: effectiveAct.calories ? `${effectiveAct.calories} kcal` : null,
    isHyrox: !!hyrox,
    hyroxDivision: hyrox ? hyroxFields(hyrox).hyroxDivision : null,
    roxzone: hyrox ? hyroxFields(hyrox).roxzone : null,
  });
  const caption = () => buildCaption(captionInput(), tone);

  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(caption()); say("Caption copied"); } catch { say("Copy failed. Long-press the caption text instead."); }
  };

  const set = (k, val) => setOpts((o) => ({ ...o, [k]: val }));
  const setStat = (k) => setOpts((o) => ({ ...o, stats: { ...o.stats, [k]: !o.stats[k] } }));

  const d = useMemo(() => derive(effectiveAct, opts), [effectiveAct, opts]);

  return (
    <div className="app">
      <div className="wrap">
        <section className="preview">
          {/* Pinned on a phone. Choosing a design meant scrolling the canvas off screen,
              picking blind, then scrolling back to see what happened. */}
          <div className="preview-pinned">
          <div className="row" style={{ marginBottom: 10 }}>
            <h1>
              Stride Studio{" "}
              {/* Which build is actually on screen. Without this, "I refreshed and nothing
                  changed" and "it is deployed" are both unfalsifiable. */}
              <span className="build-stamp" data-testid="build-stamp">
                {typeof __BUILD_STAMP__ === "string" ? __BUILD_STAMP__ : "dev"}
              </span>
            </h1>
            <Seg value={format} options={[["story", "9:16"], ["post", "4:5"], ["square", "1:1"]]} onChange={setFmt} />
          </div>
          <div className="stage" style={{ aspectRatio: `${FORMATS[format].w}/${FORMATS[format].h}` }}>
            <canvas ref={canvasRef} width={W} height={H} data-testid="stage" />
            <StudioOverlay
              fields={fields}
              asset={assetResolver}
              onOpenInspector={() => setTab("designs")}
              photo={media ? { zoom: opts.zoom ?? 1, panX: opts.panX ?? 0, panY: opts.panY ?? 0 } : null}
              onPhotoTransform={(next) => setOpts((o) => ({ ...o, ...next }))}
            />
            {!media && (
              <label className="add-media" data-testid="add-media" title="Vertical photos and videos work best">
                <span aria-hidden="true">＋</span>
                <strong>Add a photo or video</strong>
                <input type="file" accept="image/*,video/*" onChange={onFile} data-testid="file-input" />
              </label>
            )}
            {/* Offered whenever there is an animation to replay. It used to require media,
                so on the default empty canvas there was no way to watch it twice. */}
            {opts.animate && <button type="button" className="replay" onClick={() => setAnimKey((k) => k + 1)} title="Replay animation" data-testid="replay">↻</button>}
          </div>
          </div>
          <div className="btnrow toolbar">
            <button type="button" className="btn" onClick={() => undo()} disabled={!canUndo} title="Undo" data-testid="undo">↶</button>
            <button type="button" className="btn" onClick={() => redo()} disabled={!canRedo} title="Redo" data-testid="redo">↷</button>
            <button type="button" className={`btn ${safeZones ? "on" : ""}`} onClick={toggleSafeZones} title="Instagram safe zones" data-testid="safe-zones">Safe zones</button>
            <button type="button" className="btn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings" data-testid="settings-button">⚙</button>
            <button
              type="button"
              className={`btn ${opts.animate ? "on" : ""}`}
              onClick={() => set("animate", !opts.animate)}
              title={opts.animate ? "Animation on — tap for a still design" : "Animation off"}
              data-testid="toggle-animate"
            >
              {opts.animate ? "Animated" : "Still"}
            </button>
            {selection.length > 0 && (
              <button type="button" className="btn" onClick={clearSelection} data-testid="deselect">
                Deselect{selection.length > 1 ? ` (${selection.length})` : ""}
              </button>
            )}
            {/* Removing something used to mean leaving the canvas for the Layers panel or the
                Inspector — and Backspace, the obvious way, does not exist on a phone. */}
            {selection.length > 0 && (
              <button
                type="button"
                className="btn danger"
                onClick={deleteSelection}
                title="Delete the selected element"
                data-testid="delete-selection"
              >
                Delete{selection.length > 1 ? ` (${selection.length})` : ""}
              </button>
            )}
          </div>
          <div className="btnrow">
            <label className="btn">{media ? "Change media" : "Choose file"}<input type="file" accept="image/*,video/*" onChange={onFile} data-testid="file-input-2" /></label>
            {(effectiveAct.route || []).length > 0 && (
              <button type="button" className="btn" disabled={mapBusy} onClick={() => setShowMapPicker((v) => !v)} data-testid="map-background">
                {mapBusy ? "Fetching map…" : media?.attribution ? "Change map" : "Use a map"}
              </button>
            )}
            {media && (
              <button type="button" className="btn" onClick={clearMedia} data-testid="remove-media">
                {media.attribution ? "Remove map" : "Remove photo"}
              </button>
            )}
            <button type="button" className="btn strava" onClick={() => setShowStrava(true)}>{strava.connected ? "Strava" : "Connect Strava"}</button>
          </div>
          {selection.length > 1 && <AlignBar measure={measure} />}
          {error && <div className="error" role="alert">{error}</div>}
        </section>

        <section className="controls">
          <nav className="tabs">
            {[["designs", "Designs"], ["look", "Looks"], ["add", "Add"], ["layers", "Layers"]].map(([k, l]) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={`tab-${k}`}>{l}{k === "layers" && doc.layers.length > 0 ? ` (${doc.layers.length})` : ""}</button>)}
          </nav>

          {/* Selecting something turns the panel into that element's editor. The tab
              content is what you get when nothing is selected. */}
          {selection.length > 0 ? (
            <Inspector onDone={clearSelection} />
          ) : (
            <>
          {tab === "designs" && (
            <>
              <Suggestions
                caps={caps}
                analysis={analysis}
                hasPhoto={media?.type === "image"}
                onApply={(id, matched, name) => {
                  if (matched) setMatchedLook(matched);
                  setLookId(id);
                  say(`${name} applied`);
                }}
              />
                <TemplateGallery caps={caps} onApplied={(name) => say(`${name} applied — tap anything to edit it`)} />

              <div className="card">
                <div className="muted small label">My designs</div>
                <MyDesigns onOpen={(name) => say(`Opened "${name}"`)} onToast={say} />
              </div>

              {doc.layers.length > 0 && (
                <button
                  type="button"
                  className="btn"
                  data-testid="share-layout"
                  onClick={async () => {
                    const url = shareUrl(doc, window.location.origin, window.location.pathname);
                    try {
                      await navigator.clipboard.writeText(url);
                      say("Layout link copied — anyone can open it with their own run");
                    } catch {
                      setError(`Copy failed. The link is: ${url}`);
                    }
                  }}
                >
                  Share this layout
                </button>
              )}
            </>
          )}
          {tab === "add" && <AddMenu onAdded={() => setTab("designs")} />}
          {tab === "layers" && <LayersPanel onSelect={() => setTab("designs")} />}

          {tab === "look" && (
            <div className="stack">
              {matchedLook && (
                <button
                  type="button"
                  className={`lookcard wide-look ${lookId === "from-photo" ? "on" : ""}`}
                  style={{ background: matchedLook.colors.bg, color: matchedLook.colors.text }}
                  onClick={() => setLookId("from-photo")}
                  data-testid="look-from-photo"
                >
                  <span className="lookcard-swatches">
                    <i style={{ background: matchedLook.colors.accent }} />
                    <i style={{ background: matchedLook.colors.accent2 }} />
                  </span>
                  <span className="lookcard-name">From your photo</span>
                </button>
              )}
              <LookPicker lookId={lookId} onPick={(id) => { setLookId(id); say(`${getLook(id)?.name} applied`); }} />
            </div>
          )}
            </>
          )}

          <div className="exports">
            <button type="button" className="btn primary" onClick={() => exportImage("full")} disabled={!!exporting} data-testid="export-image">Save image</button>
            <button type="button" className="btn primary" onClick={exportVideoNow} disabled={!!exporting} data-testid="export-video">{exporting === "video" ? `Recording ${progressPct}%` : media?.type === "video" ? "Save video" : "Save animated video"}</button>
            <button type="button" className="btn" onClick={() => exportImage("sticker")} disabled={!!exporting} data-testid="export-sticker">Save sticker (transparent)</button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="muted small">Export size</span>
            <Seg
              value={quality}
              options={[["fast", "720"], ["hd", String(FORMATS[format].w)], ["2x", String(FORMATS[format].w * 2)]]}
              onChange={setQuality}
            />
          </div>
          <div className="row">
            <span className="muted small">Image format</span>
            <Seg value={imageFormat} options={[["png", "PNG"], ["jpeg", "JPEG (smaller)"]]} onChange={setImageFormat} />
          </div>
          <p className="muted small" data-testid="video-note">
            {videoPath === "webcodecs"
              ? "Video is encoded frame by frame, so it does not matter if you switch apps while it runs."
              : videoPath === "mediarecorder"
                ? "This browser records video in real time, so keep this screen in front until it finishes."
                : "Checking how this browser can encode video…"}
            {" The sticker is cropped tight to the overlay, for dropping onto any Story."}
          </p>
        </section>
      </div>

      {showMapPicker && (
        <Modal onClose={() => setShowMapPicker(false)} title="Map background">
          <p className="muted small">Your route, drawn on a real map. Pick a style.</p>
          <div className="chips" data-testid="map-styles">
            {MAP_STYLES.map((m) => (
              <button
                key={m.id}
                type="button"
                className="chip"
                data-testid={`map-style-${m.id}`}
                onClick={() => {
                  setShowMapPicker(false);
                  useMapBackground(m.id);
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} onChange={setPrefs} />
      )}
      {showStrava && (
        <Modal onClose={() => setShowStrava(false)} title="Strava">
          {!strava.connected && (
            <>
              {stravaConfig?.configured ? (
                <>
                  <p className="small">
                    Sign in once. Stride Studio keeps the connection alive by itself, so it will not
                    drop every six hours like the old version did.
                  </p>
                  <button
                    type="button"
                    className="btn primary strava"
                    onClick={connectStrava}
                    data-testid="strava-signin"
                  >
                    Sign in with Strava
                  </button>
                </>
              ) : (
                <p className="small" data-testid="strava-unconfigured">
                  Strava sign-in is not set up on this deployment yet. It needs the Strava client ID
                  and secret as environment variables, and the callback domain on the Strava API app
                  set to <strong>{typeof window !== "undefined" ? window.location.host : ""}</strong>.
                  Until then you can paste a token below, but Strava expires those after six hours.
                </p>
              )}

              <details style={{ marginTop: 12 }}>
                <summary className="muted small">Advanced: paste an access token</summary>
                <p className="muted small">
                  From strava.com/settings/api. It stops working after six hours, and cannot renew
                  itself, so this is for testing only.
                </p>
                <div className="hms">
                  <input
                    placeholder="Access token"
                    value={strava.token || ""}
                    onChange={(e) => setStrava({ ...strava, token: e.target.value })}
                    data-testid="token-input"
                  />
                  <button type="button" className="btn" onClick={useToken}>Load</button>
                </div>
              </details>
            </>
          )}

          {strava.connected && (
            <div className="row">
              <span className="small">
                Connected{strava.athleteName ? ` as ${strava.athleteName}` : ""}.
                {strava.refreshToken ? "" : " This is a pasted token, so it will expire."}
              </span>
              <span>
                <button type="button" className="link" onClick={() => loadActivities(strava)}>Refresh</button>{" "}
                <button type="button" className="link" onClick={disconnect}>Disconnect</button>
              </span>
            </div>
          )}

          {/* A connection that was granted without activity permission cannot be repaired by
              pressing Connect again: approval_prompt=auto makes Strava skip the consent
              screen and reissue the same narrow token. This is the only way to be re-asked. */}
          {strava.connected && !Strava.grantedActivityAccess(strava) && stravaConfig?.configured && (
            <div className="row" data-testid="strava-scope-warning" style={{ marginTop: 8 }}>
              <span className="small">
                Strava did not grant permission to read your activities, so there is nothing to
                import. Reconnect and tick “View data about your activities”.
              </span>
              <button
                type="button"
                className="btn primary strava"
                data-testid="strava-regrant"
                onClick={() => Strava.beginSignIn(stravaConfig, { force: true })}
              >
                Reconnect
              </button>
            </div>
          )}

          {/* Zones come from GET /athlete/zones, which needs profile:read_all. A connection
              made before that scope was requested gets a 401 there, and the app would then
              simply draw no zones — indistinguishable from being broken. Say what to do. */}
          {strava.connected && !zoneBands && stravaConfig?.configured && (
            <div className="row" data-testid="strava-zones-warning" style={{ marginTop: 8 }}>
              <span className="small">
                Your Strava heart-rate zones have not been imported, so zone charts stay
                empty. Reconnect to grant access to your profile.
              </span>
              <button
                type="button"
                className="btn primary strava"
                data-testid="strava-regrant-zones"
                onClick={() => Strava.beginSignIn(stravaConfig, { force: true })}
              >
                Reconnect
              </button>
            </div>
          )}

          {status && <div className="muted small" style={{ marginTop: 8 }} data-testid="strava-status">{status}</div>}

          <div className="list">
            {activities.map((a) => (
              <button key={a.id} type="button" onClick={() => pickActivity(a)} data-testid={`strava-act-${a.id}`}>
                <strong>{a.name}</strong>
                <span className="muted small">
                  {SPORTS[sportFromStrava(a.sport_type || a.type)]?.label}, {fmtDate(a.start_date_local)}
                  {a.distance ? `, ${(a.distance / 1000).toFixed(1)} km` : ""}, {fmtTime(a.moving_time)}
                </span>
              </button>
            ))}
          </div>

          {/* §7.2 compliance: Strava requires a link back to the activity when showing its data. */}
          {activities.length > 0 && (
            <p className="muted small">Compatible with Strava.</p>
          )}

          <button type="button" className="link" style={{ marginTop: 10 }} onClick={() => { setAct(DEMO); setShowStrava(false); }}>
            Use the demo run instead
          </button>
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
            {result.kind === "image" && (
              <button
                type="button"
                className="btn"
                data-testid="copy-image"
                onClick={async () => {
                  const ok = await copyImageToClipboard(result.blob);
                  say(ok ? "Image copied — paste it into your Story" : "Copying images is not available in this browser");
                }}
              >
                Copy image
              </button>
            )}
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            {canShareFiles ? "Share opens your phone's share sheet: pick Instagram, then Story or Post. " : "On a phone, press and hold the preview to save it to your camera roll. "}
            {result.mode === "sticker" ? "In Instagram, add it as a photo sticker on top of any Story." : "Caption is one tap away."}
          </p>
        </Modal>
      )}
      {showShortcuts && (
        <Modal title="Keyboard shortcuts" onClose={() => setShowShortcuts(false)}>
          <ul className="shortcuts">
            {SHORTCUTS.map((s2) => (
              <li key={s2.keys}>
                <kbd>{s2.keys}</kbd>
                <span>{s2.action}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
