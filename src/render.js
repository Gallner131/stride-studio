// Stride Studio render engine v3 (framework-free so it is easy to test)
export const FORMATS = {
  story: { id: "story", name: "Story / Reel", w: 1080, h: 1920, hint: "9:16" },
  post: { id: "post", name: "Feed post", w: 1080, h: 1350, hint: "4:5" },
  square: { id: "square", name: "Square", w: 1080, h: 1080, hint: "1:1" },
};
export let W = 1080;
export let H = 1920;
export function setFormat(id) { const f = FORMATS[id] || FORMATS.story; W = f.w; H = f.h; return f; }

const MI = 0.621371;
export const ANIM_SECONDS = 6;

export const fmtTime = (s) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
export const fmtPace = (sec) => {
  if (!isFinite(sec) || sec <= 0) return "--:--";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
export const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch { return ""; } };
export const fmtDateLong = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; } };
export const fmtClock = (iso) => { try { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
export function fmtDist(d) { return d >= 100 ? d.toFixed(0) : d >= 10 ? d.toFixed(1) : d.toFixed(2); }
const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export function decodePolyline(str) {
  if (!str) return [];
  let index = 0, lat = 0, lng = 0, out = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

// ---- demo data ----
function demoRoute() {
  const pts = [];
  for (let i = 0; i <= 260; i++) {
    const a = (i / 260) * Math.PI * 2;
    const r = 1 + 0.22 * Math.sin(3 * a) + 0.08 * Math.sin(7 * a + 1) + 0.04 * Math.sin(13 * a);
    pts.push([51.5 + r * 0.011 * Math.cos(a), -0.15 + r * 0.017 * Math.sin(a) * 1.15]);
  }
  return pts;
}
const demoSplits = (n, base) => Array.from({ length: n }, (_, i) => base + Math.round(Math.sin(i * 1.7) * 9 + Math.cos(i * 0.6) * 7 + (i > n - 4 ? -10 : 0)));
const demoElev = () => Array.from({ length: 120 }, (_, i) => 20 + 30 * Math.sin(i / 9) + 18 * Math.sin(i / 3.3 + 2) + 10 * Math.sin(i / 1.4) + i * 0.15);
const demoHr = () => Array.from({ length: 200 }, (_, i) => { const t = i / 199; return Math.round(105 + 55 * (1 - Math.exp(-t * 6)) + 8 * Math.sin(i / 7) + 4 * Math.sin(i / 2.3) + (t > 0.85 ? 12 : 0)); });

export const DEMO = {
  id: "demo", sport: "run", name: "Sunday long run", date: new Date().toISOString(),
  distance: 21100, time: 6135, elevation: 84, hr: 158, hrMax: 178, calories: 1420,
  route: demoRoute(), splits: demoSplits(21, 291), elev: demoElev(), hrStream: demoHr(),
};
export const DEMO_WORKOUT = {
  id: "demo-workout", sport: "workout", name: "Strength + core", date: new Date().toISOString(),
  distance: 0, time: 2700, elevation: 0, hr: 132, hrMax: 171, calories: 410,
  route: [], splits: [], elev: [], hrStream: Array.from({ length: 200 }, (_, i) => Math.round(110 + 35 * Math.abs(Math.sin(i / 14)) + 8 * Math.sin(i / 3) + (i % 40 < 6 ? -20 : 0))),
};

export const SPORTS = {
  run: { label: "Run", pace: true }, trailrun: { label: "Trail run", pace: true },
  walk: { label: "Walk", pace: true }, hike: { label: "Hike", pace: true },
  ride: { label: "Ride", speed: true }, swim: { label: "Swim", per100: true },
  workout: { label: "Workout", noDistance: true }, other: { label: "Activity", pace: true },
};
export function sportFromStrava(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("trail")) return "trailrun";
  if (t.includes("run")) return "run";
  if (t.includes("ride") || t.includes("cycl") || t.includes("bike")) return "ride";
  if (t.includes("swim")) return "swim";
  if (t.includes("hike")) return "hike";
  if (t.includes("walk")) return "walk";
  if (["workout", "weighttraining", "crossfit", "yoga", "hiit", "elliptical", "rowing", "stairstepper", "pilates"].some((k) => t.includes(k))) return "workout";
  return "other";
}

// ---- catalogue ----
export const CATEGORIES = ["All", "Stats", "Map", "Health", "Editorial", "Fun", "Video"];
export const TEMPLATES = [
  { id: "sticker", name: "Clean stats", desc: "Transparent stats, no orange box", cat: "Stats" },
  { id: "corner", name: "Corner", desc: "Small and quiet, top right", cat: "Stats" },
  { id: "poster", name: "Poster", desc: "Big condensed number", cat: "Stats" },
  { id: "spine", name: "Spine", desc: "Distance runs up the left edge", cat: "Stats" },
  { id: "grid", name: "Glass grid", desc: "Frosted stat tiles", cat: "Stats" },
  { id: "stack", name: "Stack", desc: "Every stat, huge, stacked", cat: "Stats" },
  { id: "splits", name: "Splits", desc: "Per-km bars", cat: "Stats" },
  { id: "pacewave", name: "Pace wave", desc: "Pace across the distance", cat: "Stats" },
  { id: "ticker", name: "Ticker", desc: "Thin data strip", cat: "Editorial" },
  { id: "headline", name: "Headline", desc: "Newspaper front page", cat: "Editorial" },
  { id: "frame", name: "Frame", desc: "Inset photo with caption bar", cat: "Editorial" },
  { id: "polaroid", name: "Polaroid", desc: "Instant print, handwritten", cat: "Editorial" },
  { id: "receipt", name: "Receipt", desc: "Itemised, till roll", cat: "Fun" },
  { id: "bib", name: "Race bib", desc: "Pinned number card", cat: "Fun" },
  { id: "retro", name: "Retro", desc: "70s race poster stripes", cat: "Fun" },
  { id: "tape", name: "Tape", desc: "Scrolling caution tape", cat: "Fun" },
  { id: "neon", name: "Neon", desc: "Glowing sign", cat: "Fun" },
  { id: "noir", name: "Noir map", desc: "Glowing route, nothing else", cat: "Map" },
  { id: "bigmap", name: "Big map", desc: "Route fills the frame", cat: "Map" },
  { id: "orbit", name: "Orbit", desc: "Route as a ring around the stat", cat: "Map" },
  { id: "stamp", name: "Stamp", desc: "Route badge, postmark style", cat: "Map" },
  { id: "elevation", name: "Elevation", desc: "Climb profile", cat: "Map" },
  { id: "hrwave", name: "Heart rate", desc: "HR trace with zone bands", cat: "Health" },
  { id: "zones", name: "Zones", desc: "Time in each HR zone", cat: "Health" },
  { id: "rings", name: "Rings", desc: "Effort gauges, watch-face style", cat: "Health" },
  { id: "hud", name: "Live HUD", desc: "Counting stats for POV video", cat: "Video" },
  { id: "chase", name: "Chase", desc: "Route draws itself, stats follow", cat: "Video" },
];
export const PALETTE = [
  { name: "White", c: "#FFFFFF" }, { name: "Black", c: "#111111" }, { name: "Strava", c: "#FC5200" },
  { name: "Volt", c: "#D8FF3A" }, { name: "Sun", c: "#FFD23F" }, { name: "Coral", c: "#FF6B6B" },
  { name: "Hot pink", c: "#FF2D95" }, { name: "Lilac", c: "#C7B8FF" }, { name: "Sky", c: "#5AC8FA" },
  { name: "Teal", c: "#2BD4BD" }, { name: "Mint", c: "#B9FBC0" }, { name: "Cream", c: "#F5EFE0" },
  { name: "Cobalt", c: "#2A5BFF" }, { name: "Blood orange", c: "#E8461E" }, { name: "Gold", c: "#D9A441" }, { name: "Slate", c: "#6C7A89" },
];
export const FILTERS = [
  { id: "none", name: "None", css: "none" },
  { id: "fade", name: "Fade", css: "contrast(0.9) saturate(0.85) brightness(1.06)" },
  { id: "film", name: "Film", css: "contrast(1.1) saturate(1.15) sepia(0.15)" },
  { id: "mono", name: "Mono", css: "grayscale(1) contrast(1.12)" },
  { id: "cool", name: "Cool", css: "saturate(0.9) hue-rotate(-12deg) brightness(0.98)" },
  { id: "warm", name: "Warm", css: "sepia(0.28) saturate(1.25)" },
  { id: "punch", name: "Punch", css: "contrast(1.2) saturate(1.35)" },
  { id: "vhs", name: "VHS", css: "contrast(1.15) saturate(1.5) hue-rotate(8deg) brightness(0.95)" },
  { id: "bleach", name: "Bleach", css: "contrast(1.3) saturate(0.4) brightness(1.15)" },
];
export const FONTS = [
  { id: "sans", name: "Modern", css: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: "cond", name: "Condensed", css: 'Impact, "Arial Narrow", "Helvetica Neue", Arial, sans-serif' },
  { id: "serif", name: "Editorial", css: 'Georgia, "Times New Roman", serif' },
  { id: "mono", name: "Mono", css: '"SF Mono", Menlo, Consolas, "Courier New", monospace' },
  { id: "script", name: "Handwritten", css: '"Brush Script MT", "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive' },
  { id: "rounded", name: "Rounded", css: '"SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", "Varela Round", system-ui, sans-serif' },
];
export const BACKGROUNDS = [
  { id: "night", name: "Night", stops: ["#0f0c29", "#302b63", "#24243e"] },
  { id: "sunrise", name: "Sunrise", stops: ["#ff9966", "#ff5e62", "#6a0572"] },
  { id: "forest", name: "Forest", stops: ["#134e5e", "#71b280"] },
  { id: "volt", name: "Volt", stops: ["#1a1a1a", "#3a4a00", "#d8ff3a"] },
  { id: "ocean", name: "Ocean", stops: ["#0f2027", "#203a43", "#2c5364"] },
  { id: "peach", name: "Peach", stops: ["#ffecd2", "#fcb69f"] },
  { id: "ink", name: "Ink", stops: ["#111111", "#2a2a2a"] },
  { id: "paper", name: "Paper", stops: ["#f7f3ea", "#e9e2d2"] },
];
export const DEFAULT_OPTS = {
  fontHero: "sans", fontBody: "sans", textColor: null, uppercase: false, tagline: "", taglinePos: "top", taglineSize: 1,
  show: { row: true, meta: true, name: true }, bg: "night", offsetX: 0,
  theme: "light", accent: "#FFFFFF", position: "bottom", showMap: true, filter: "none",
  units: "km", stats: { time: true, pace: true, elev: true, hr: false, cal: false, date: true },
  scale: 1, offsetY: 0, zoom: 1, vignette: 0.25, dim: 0, animate: true, kenburns: true, grain: 0,
};

const DEF_SANS = FONTS[0].css;
const DEF_COND = FONTS[1].css;
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = '"SF Mono", Menlo, Consolas, "Courier New", monospace';
const SCRIPT = '"Brush Script MT", "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive';

// ---- primitives ----
function mediaSize(media) { const el = media.el; return media.type === "video" ? [el.videoWidth, el.videoHeight] : [el.naturalWidth, el.naturalHeight]; }
function drawCover(ctx, media, zoom, filterCss, box) {
  box = box || { x: 0, y: 0, w: W, h: H };
  const [mw, mh] = mediaSize(media);
  if (!mw || !mh) return;
  const s = Math.max(box.w / mw, box.h / mh) * zoom;
  const dw = mw * s, dh = mh * s;
  ctx.save();
  if (filterCss && filterCss !== "none" && "filter" in ctx) ctx.filter = filterCss;
  try { ctx.drawImage(media.el, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh); } catch {}
  ctx.restore();
}
function vignette(ctx, strength) {
  if (!strength) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
let grainSeed = 1;
function rnd() { grainSeed = (grainSeed * 16807) % 2147483647; return grainSeed / 2147483647; }
function grain(ctx, amount) {
  if (!amount) return;
  grainSeed = 7; ctx.save(); ctx.globalAlpha = amount;
  for (let i = 0; i < 2500; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#000"; ctx.fillRect(rnd() * W, rnd() * H, 3, 3); }
  ctx.restore();
}
function wash(ctx, y0, y1, dark, alpha) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  const rgb = dark ? "0,0,0" : "255,255,255";
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${alpha})`);
  ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
}
function projectRoute(pts, box) {
  if (!pts || !pts.length) return [];
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const xy = pts.map(([la, lo]) => { const x = lo * k, y = -la; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); return [x, y]; });
  const sw = maxX - minX || 1e-6, sh = maxY - minY || 1e-6;
  const s = Math.min(box.w / sw, box.h / sh);
  const ox = box.x + (box.w - sw * s) / 2, oy = box.y + (box.h - sh * s) / 2;
  return xy.map(([x, y]) => [ox + (x - minX) * s, oy + (y - minY) * s]);
}
function drawRoute(ctx, pts, box, o) {
  const { color, width, glow = 0, progress = 1, ghost = "rgba(255,255,255,0.25)", dot = true } = o;
  const P = projectRoute(pts, box);
  if (P.length < 2) return null;
  const n = Math.max(2, Math.floor(P.length * progress));
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (progress < 1 && ghost) { ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = ghost; ctx.lineWidth = width; ctx.stroke(); }
  ctx.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = P[i]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.shadowBlur = 0;
  if (progress < 1 && dot) { const [x, y] = P[n - 1]; ctx.beginPath(); ctx.arc(x, y, width * 1.6, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  ctx.restore();
  return P[n - 1];
}
function hexRgb(hex) { const h = (hex || "#ffffff").replace("#", ""); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; }
function hexAlpha(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function isDark(hex) { const [r, g, b] = hexRgb(hex); return (r * 299 + g * 587 + b * 114) / 1000 < 140; }
function drawArea(ctx, data, box, color, txt, progress = 1, lineW = 6) {
  if (!data || data.length < 2) return;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const n = Math.max(2, Math.floor(data.length * progress));
  const pt = (i) => [box.x + (i / (data.length - 1)) * box.w, box.y + box.h - ((data[i] - min) / rng) * box.h];
  ctx.save();
  ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h);
  for (let i = 0; i < n; i++) { const [x, y] = pt(i); ctx.lineTo(x, y); }
  ctx.lineTo(pt(n - 1)[0], box.y + box.h); ctx.closePath();
  const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  g.addColorStop(0, hexAlpha(color, 0.65)); g.addColorStop(1, hexAlpha(color, 0));
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = pt(i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.strokeStyle = txt; ctx.lineWidth = lineW; ctx.lineJoin = "round"; ctx.stroke();
  ctx.restore();
}
function shadow(ctx, on) { if (on) { ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 4; } else { ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; } }
function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function fitText(ctx, text, maxW, weight, size, family) { let s = size; do { ctx.font = `${weight} ${Math.round(s)}px ${family}`; s -= 4; } while (ctx.measureText(text).width > maxW && s > 16); return ctx.font; }
function wrapText(ctx, text, maxW, weight, size, family) {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const testLine = line ? line + " " + word : word;
    if (ctx.measureText(testLine).width <= maxW) {
      line = testLine;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function frosted(ctx, media, filter, zoom, x, y, w, h, r, light) {
  ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.clip();
  if (media && "filter" in ctx) { ctx.filter = `blur(28px)`; drawCover(ctx, media, zoom * 1.1, null); ctx.filter = "none"; }
  ctx.fillStyle = light ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.45)"; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.strokeStyle = light ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.15)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}

// ---- HR zones ----
export const ZONES = [
  { n: 1, name: "Recovery", lo: 0.5, hi: 0.6, c: "#8FA3B5" }, { n: 2, name: "Easy", lo: 0.6, hi: 0.7, c: "#4FC1E9" },
  { n: 3, name: "Aerobic", lo: 0.7, hi: 0.8, c: "#7BE495" }, { n: 4, name: "Threshold", lo: 0.8, hi: 0.9, c: "#FFB347" },
  { n: 5, name: "Max", lo: 0.9, hi: 2, c: "#FF5A5F" },
];
export function zoneOf(bpm, max) { const f = bpm / (max || 190); return ZONES.find((z) => f < z.hi) || ZONES[4]; }
export function zoneShares(stream, max) {
  const counts = [0, 0, 0, 0, 0];
  if (!stream || !stream.length) return counts;
  stream.forEach((b) => { counts[zoneOf(b, max).n - 1]++; });
  return counts.map((c) => c / stream.length);
}

// ---- derived stats ----
export function derive(act, opts, progress = 1) {
  const sport = SPORTS[act.sport] || SPORTS.run;
  const mi = opts.units === "mi";
  const kmRaw = (act.distance || 0) / 1000;
  const km = kmRaw || 0.001;
  const dist = mi ? kmRaw * MI : kmRaw;
  const unit = mi ? "mi" : "km";
  const paceSec = act.time / (mi ? km * MI : km);
  const speed = dist / (act.time / 3600 || 1);
  const elevV = mi ? (act.elevation || 0) * 3.28084 : (act.elevation || 0);
  const elevU = mi ? "ft" : "m";
  const hasDist = !sport.noDistance && kmRaw > 0;
  const paceLabel = sport.speed ? "Speed" : "Pace";
  const paceStr = sport.speed ? `${speed.toFixed(1)} ${unit}/h` : sport.per100 ? `${fmtPace(act.time / (act.distance / 100 || 1))} /100m` : `${fmtPace(paceSec)} /${unit}`;
  const row = [];
  if (opts.stats.time) row.push(fmtTime(act.time * progress));
  if (opts.stats.pace && hasDist) row.push(paceStr);
  if (opts.stats.elev && act.elevation && hasDist) row.push(`${Math.round(elevV)} ${elevU}`);
  if (opts.stats.hr && act.hr) row.push(`${act.hr} bpm`);
  if (opts.stats.cal && act.calories) row.push(`${act.calories} kcal`);
  const show = opts.show || { row: true, meta: true, name: true };
  let meta = [show.name !== false ? act.name : null, opts.stats.date ? fmtDate(act.date) : null].filter(Boolean).join("  ");
  if (show.meta === false) meta = "";
  if (opts.uppercase) meta = meta.toUpperCase();
  const hero = hasDist ? { v: fmtDist(dist * progress), u: unit, label: unit === "km" ? "KILOMETRES" : "MILES" } : { v: fmtTime(act.time * progress), u: "", label: "MOVING TIME" };
  // when the hero is time, don't repeat it in the row
  let rowNoHero = hasDist ? row : row.filter((r) => r !== fmtTime(act.time * progress));
  if (show.row === false) rowNoHero = [];
  return { sport, hasDist, km: kmRaw, dist, unit, paceSec, speed, elevV, elevU, row: rowNoHero, meta, hero, paceLabel, paceStr, liveDist: dist * progress };
}

export function captionFor(act, opts) {
  const d = derive(act, opts, 1);
  const bits = [];
  if (d.hasDist) bits.push(`${fmtDist(d.dist)} ${d.unit}`);
  bits.push(fmtTime(act.time));
  if (d.hasDist) bits.push(d.paceStr);
  if (act.elevation && d.hasDist) bits.push(`${Math.round(d.elevV)} ${d.elevU} up`);
  if (act.hr) bits.push(`${act.hr} bpm avg`);
  const tags = d.sport.speed ? "#cycling #strava #ridelife #cyclinglife" : d.sport.noDistance ? "#workout #strava #training #fitness" : "#running #strava #runningcommunity #stravarun #runnersofinstagram";
  return `${act.name}\n${bits.join(" · ")}\n\n${tags}`;
}

// ---- master render ----
// progress: 0..1 position in a video clip (1 for stills). t: 0..1 animation time. mode: "full" | "sticker"
export function renderFrame(ctx, media, act, template, opts, progress = 1, t = 1, mode = "full") {
  // Callers may pre-scale the context (thumbnails, fast export); everything below is in W x H design units.
  ctx.clearRect(0, 0, W, H);
  const sticker = mode === "sticker";
  const light = opts.theme === "light";
  const anim = opts.animate ? easeOut(t) : 1;
  const filter = (FILTERS.find((f) => f.id === opts.filter) || FILTERS[0]).css;
  const kb = opts.kenburns && opts.animate && media?.type !== "video" ? 1 + 0.06 * t : 1;
  const zoom = opts.zoom * kb;
  const solidBg = ["frame", "polaroid", "receipt", "retro", "headline"].includes(template);

  const SANS = (FONTS.find((f) => f.id === opts.fontBody) || FONTS[0]).css;
  const COND = (FONTS.find((f) => f.id === opts.fontHero) || FONTS[1]).css;
  const HERO = opts.fontHero && opts.fontHero !== "sans" ? COND : SANS; // big numbers use the hero font
  if (!sticker && !solidBg) {
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, W, H);
    if (media) drawCover(ctx, media, zoom, filter);
    else {
      const bg = BACKGROUNDS.find((b) => b.id === opts.bg) || BACKGROUNDS[0];
      const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
      bg.stops.forEach((c, i) => g.addColorStop(i / (bg.stops.length - 1), c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    vignette(ctx, opts.vignette);
    if (opts.dim) { ctx.fillStyle = `rgba(0,0,0,${opts.dim})`; ctx.fillRect(0, 0, W, H); }
    grain(ctx, opts.grain);
  }

  const txt = opts.textColor || (light ? "#FFFFFF" : "#0E0E0E");
  const sub = opts.textColor ? hexAlpha(opts.textColor, 0.8) : light ? "rgba(255,255,255,0.8)" : "rgba(14,14,14,0.72)";
  const acc = opts.accent;
  const accOrTxt = (acc === "#FFFFFF" && light) || (acc === "#111111" && !light) ? txt : acc;
  const S = opts.scale;
  const F = (n) => `${Math.round(n * S)}px`;
  const isVideoTpl = ["hud", "chase"].includes(template);
  const liveP = isVideoTpl ? progress : anim;
  const d = derive(act, opts, liveP);
  const dFull = derive(act, opts, 1);
  const M = 84;
  const hrMax = act.hrMax || 190;

  ctx.save();
  ctx.translate(opts.offsetX || 0, opts.offsetY);
  ctx.textBaseline = "alphabetic";
  shadow(ctx, light && !solidBg && !["bib", "grid", "zones", "rings", "neon", "tape"].includes(template));

  switch (template) {
    case "sticker": {
      const y0 = opts.position === "top" ? 300 : H - 330;
      ctx.textAlign = "center";
      ctx.fillStyle = sub; ctx.font = `600 ${F(40)} ${SANS}`; ctx.fillText(d.meta, W / 2, y0 - 150 * S);
      ctx.fillStyle = accOrTxt; ctx.font = `800 ${F(d.hero.u ? 300 : 220)} ${HERO}`; ctx.fillText(d.hero.v, W / 2, y0 + 70);
      ctx.fillStyle = txt; ctx.font = `700 ${F(50)} ${SANS}`; ctx.fillText(d.hero.label, W / 2, y0 + 70 + 65 * S);
      ctx.font = `600 ${F(46)} ${SANS}`; ctx.fillText(d.row.join("    "), W / 2, y0 + 70 + 150 * S);
      break;
    }
    case "corner": {
      ctx.textAlign = "right";
      ctx.fillStyle = txt; ctx.font = `800 ${F(90)} ${HERO}`; ctx.fillText(`${d.hero.v} ${d.hero.u}`.trim(), W - M, 220);
      ctx.fillStyle = sub; ctx.font = `600 ${F(36)} ${SANS}`;
      let y = 290; d.row.forEach((r) => { ctx.fillText(r, W - M, y); y += 52 * S; });
      ctx.font = `500 ${F(32)} ${SANS}`; ctx.fillText(d.meta, W - M, y + 10);
      if (opts.showMap) drawRoute(ctx, act.route, { x: M, y: 150, w: 220, h: 220 }, { color: acc, width: 7, glow: 10, progress: anim });
      break;
    }
    case "poster": {
      if (!sticker) wash(ctx, H - 900, H, light, 0.72);
      shadow(ctx, false);
      ctx.textAlign = "left";
      ctx.fillStyle = sub; ctx.font = `600 ${F(44)} ${SANS}`; ctx.fillText(d.meta.toUpperCase(), M, H - 560);
      ctx.fillStyle = accOrTxt; fitText(ctx, d.hero.v, W - 2 * M - (d.hero.u ? 220 : 0), 400, 420 * S, COND);
      ctx.fillText(d.hero.v, M - 10, H - 200);
      const bw = ctx.measureText(d.hero.v).width;
      ctx.fillStyle = txt; ctx.font = `400 ${F(150)} ${COND}`; ctx.fillText(d.hero.u.toUpperCase(), M + bw + 20, H - 200);
      ctx.font = `700 ${F(50)} ${SANS}`; ctx.fillText(d.row.join("    "), M, H - 110);
      if (opts.showMap) drawRoute(ctx, act.route, { x: W - 420, y: H - 1080, w: 340, h: 340 }, { color: txt, width: 8, progress: anim });
      break;
    }
    case "spine": {
      ctx.save(); ctx.translate(M + 40, H - 160); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "left"; ctx.fillStyle = accOrTxt; ctx.font = `800 ${F(260)} ${HERO}`; ctx.fillText(d.hero.v, 0, 0);
      const wdt = ctx.measureText(d.hero.v).width;
      ctx.fillStyle = txt; ctx.font = `700 ${F(80)} ${SANS}`; ctx.fillText(d.hero.u, wdt + 30, 0);
      ctx.restore();
      ctx.textAlign = "right"; ctx.fillStyle = txt; ctx.font = `700 ${F(52)} ${SANS}`;
      let y = H - 160; [...d.row].reverse().forEach((r) => { ctx.fillText(r, W - M, y); y -= 78 * S; });
      ctx.fillStyle = sub; ctx.font = `500 ${F(38)} ${SANS}`; ctx.fillText(d.meta, W - M, y - 10);
      break;
    }
    case "grid": {
      const tiles = [];
      if (d.hero.u) tiles.push([d.hero.label.toLowerCase(), d.hero.v]);
      tiles.push(["time", fmtTime(act.time * liveP)]);
      if (d.hasDist) tiles.push([d.paceLabel.toLowerCase(), d.paceStr]);
      if (act.hr) tiles.push(["avg heart rate", `${act.hr} bpm`]);
      if (act.elevation && d.hasDist) tiles.push(["elevation", `${Math.round(d.elevV)} ${d.elevU}`]);
      if (act.calories) tiles.push(["calories", `${act.calories}`]);
      const cols = 2, gap = 24, tw = (W - 2 * M - gap) / cols, th = 250;
      const shown = tiles.slice(0, 6), rows = Math.ceil(shown.length / cols);
      const y0 = opts.position === "top" ? 200 : H - 160 - rows * (th + gap) + gap;
      shown.forEach((tile, i) => {
        const x = M + (i % cols) * (tw + gap), y = y0 + Math.floor(i / cols) * (th + gap);
        frosted(ctx, sticker ? null : media, filter, zoom, x, y, tw, th, 28, light);
        ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(30)} ${SANS}`; ctx.fillText(tile[0], x + 32, y + 64);
        ctx.fillStyle = i === 0 ? accOrTxt : txt; fitText(ctx, tile[1], tw - 64, 800, 92 * S, SANS); ctx.fillText(tile[1], x + 32, y + th - 56);
      });
      shadow(ctx, light);
      ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(38)} ${SANS}`; ctx.fillText(d.meta, M, y0 - 40);
      break;
    }
    case "stack": {
      const items = [];
      if (d.hero.u) items.push([d.hero.v, d.hero.u]);
      items.push([fmtTime(act.time * liveP), ""]);
      if (d.hasDist) items.push([d.paceStr.split(" ")[0], d.paceStr.split(" ").slice(1).join(" ")]);
      if (act.hr) items.push([`${act.hr}`, "bpm"]);
      if (act.elevation && d.hasDist) items.push([`${Math.round(d.elevV)}`, d.elevU]);
      const n = Math.min(5, items.length), step = Math.min(235 * S, (H - 640) / n);
      ctx.textAlign = "left";
      let y = 400;
      items.slice(0, n).forEach(([v, u], i) => {
        ctx.fillStyle = i === 0 ? accOrTxt : txt; ctx.font = `800 ${Math.round(Math.min(200 * S, step * 0.85))}px ${HERO}`; ctx.fillText(v, M - 6, y);
        const wv = ctx.measureText(v).width;
        ctx.fillStyle = sub; ctx.font = `600 ${F(50)} ${SANS}`; ctx.fillText(u, M + wv + 20, y);
        y += step;
      });
      ctx.fillStyle = sub; ctx.font = `500 ${F(40)} ${SANS}`; ctx.fillText(d.meta, M, Math.min(H - 120, y - step + 90));
      break;
    }
    case "splits": {
      const splits = act.splits || [];
      ctx.textAlign = "left";
      ctx.fillStyle = txt; ctx.font = `800 ${F(170)} ${HERO}`; ctx.fillText(d.hero.v, M, 330);
      ctx.font = `600 ${F(50)} ${SANS}`; ctx.fillStyle = sub; ctx.fillText(`${d.hero.u}   ${d.row.join("   ")}`, M, 400);
      if (splits.length) {
        const min = Math.min(...splits), max = Math.max(...splits);
        const maxRows = Math.max(4, Math.floor((H - 760) / 34));
        const shownSplits = splits.slice(0, maxRows);
        const n = shownSplits.length, rowH = Math.min(58, (H - 760) / n), x0 = W - 600, barMax = 260;
        let y = 560;
        ctx.font = `600 ${Math.min(34, rowH * 0.6)}px ${SANS}`;
        if (splits.length > maxRows) { ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.fillText(`first ${maxRows} of ${splits.length}`, x0 + 70, 520); }
        shownSplits.forEach((s, i) => {
          const tt = max === min ? 1 : 1 - (s - min) / (max - min);
          const reveal = Math.min(1, Math.max(0, anim * n * 1.2 - i));
          ctx.fillStyle = light ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.15)"; ctx.fillRect(x0 + 70, y - rowH * 0.62, barMax + 60, rowH * 0.5);
          ctx.fillStyle = s === min ? acc : (light ? "rgba(255,255,255,0.85)" : "rgba(14,14,14,0.8)"); ctx.fillRect(x0 + 70, y - rowH * 0.62, (60 + tt * barMax) * reveal, rowH * 0.5);
          ctx.fillStyle = sub; ctx.textAlign = "right"; ctx.fillText(String(i + 1), x0 + 50, y);
          if (reveal >= 1) { ctx.fillStyle = txt; ctx.textAlign = "left"; ctx.fillText(fmtPace(s), x0 + 70 + barMax + 80, y); }
          y += rowH;
        });
      } else { ctx.fillStyle = sub; ctx.font = `500 ${F(36)} ${SANS}`; ctx.fillText("No split data for this activity", M, 560); }
      ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(40)} ${SANS}`; ctx.fillText(d.meta, M, H - 150);
      break;
    }
    case "pacewave": {
      const sp = act.splits || [];
      if (!sticker) wash(ctx, H - 820, H, light, 0.55);
      if (sp.length > 1) {
        drawArea(ctx, sp.map((s) => -s), { x: 0, y: H - 640, w: W, h: 300 }, acc, txt, anim);
        const best = Math.min(...sp), i = sp.indexOf(best);
        if (anim >= 1) { const x = (i / (sp.length - 1)) * W; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(x, H - 640, 12, 0, Math.PI * 2); ctx.fill(); ctx.textAlign = i > sp.length / 2 ? "right" : "left"; ctx.fillStyle = txt; ctx.font = `700 ${F(34)} ${SANS}`; ctx.fillText(`fastest ${fmtPace(best)}`, x + (i > sp.length / 2 ? -20 : 20), H - 665); }
      } else { ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(36)} ${SANS}`; ctx.fillText("No split data for this activity", M, H - 600); }
      ctx.textAlign = "left"; ctx.fillStyle = txt; ctx.font = `800 ${F(150)} ${SANS}`; ctx.fillText(d.paceStr.split(" ")[0], M, H - 190);
      const w1 = ctx.measureText(d.paceStr.split(" ")[0]).width;
      ctx.font = `700 ${F(50)} ${SANS}`; ctx.fillStyle = sub; ctx.fillText(d.paceStr.split(" ").slice(1).join(" "), M + w1 + 16, H - 190);
      ctx.font = `600 ${F(44)} ${SANS}`; ctx.fillText(`average over ${fmtDist(dFull.dist)} ${d.unit}`, M, H - 120);
      ctx.textAlign = "right"; ctx.fillStyle = txt; ctx.font = `700 ${F(44)} ${SANS}`; ctx.fillText(fmtTime(act.time), W - M, H - 190);
      ctx.fillStyle = sub; ctx.font = `500 ${F(40)} ${SANS}`; ctx.fillText(d.meta, W - M, H - 700);
      break;
    }
    case "ticker": {
      const y = opts.position === "top" ? 200 : H - 200;
      ctx.fillStyle = txt; ctx.fillRect(M, y - 70 * S, W - 2 * M, 3); ctx.fillRect(M, y + 40 * S, W - 2 * M, 3);
      ctx.textAlign = "left"; ctx.fillStyle = txt; ctx.font = `700 ${F(44)} ${SANS}`;
      const parts = [`${d.hero.v} ${d.hero.u}`.trim(), ...d.row];
      const lastW = ctx.measureText(parts[parts.length - 1]).width;
      const gap = parts.length > 1 ? (W - 2 * M - lastW) / (parts.length - 1) : 0;
      parts.forEach((p, i) => ctx.fillText(p, M + i * gap, y + 10 * S));
      ctx.fillStyle = sub; ctx.font = `500 ${F(34)} ${SERIF}`; ctx.fillText(d.meta, M, y - 100 * S);
      ctx.textAlign = "right"; ctx.fillText(fmtClock(act.date), W - M, y - 100 * S);
      break;
    }
    case "headline": {
      if (!sticker) { ctx.fillStyle = light ? "#141414" : "#F3EFE6"; ctx.fillRect(0, 0, W, H); }
      const ink = light ? "#F3EFE6" : "#141414", inkSub = light ? "rgba(243,239,230,0.7)" : "rgba(20,20,20,0.65)";
      const photoTop = 540, photoH = Math.max(260, H - photoTop - 200);
      ctx.textAlign = "center"; ctx.fillStyle = ink; ctx.font = `700 ${F(34)} ${SERIF}`; ctx.fillText("THE DAILY STRIDE", W / 2, 120);
      ctx.fillStyle = inkSub; ctx.font = `500 ${F(26)} ${SERIF}`; ctx.fillText(`${fmtDateLong(act.date).toUpperCase()}     ${fmtClock(act.date)}`, W / 2, 162);
      ctx.fillStyle = ink; ctx.fillRect(M, 186, W - 2 * M, 4); ctx.fillRect(M, 198, W - 2 * M, 2);
      const head = d.hasDist ? `${fmtDist(dFull.dist)} ${d.unit} before the day began.` : `${fmtTime(act.time)} of work, done.`;
      ctx.textAlign = "left"; ctx.fillStyle = ink; fitText(ctx, head, W - 2 * M, 700, 92 * S, SERIF); ctx.fillText(head, M, 320);
      ctx.fillStyle = inkSub; ctx.font = `italic 500 ${F(38)} ${SERIF}`; ctx.fillText(act.name, M, 390);
      ctx.fillStyle = ink; ctx.font = `600 ${F(32)} ${SANS}`; ctx.fillText(dFull.row.join("     "), M, 460);
      if (!sticker) { ctx.save(); ctx.beginPath(); ctx.rect(M, photoTop, W - 2 * M, photoH); ctx.clip(); if (media) drawCover(ctx, media, zoom, filter !== "none" ? filter : "grayscale(0.25) contrast(1.05)", { x: M, y: photoTop, w: W - 2 * M, h: photoH }); ctx.restore(); }
      ctx.fillStyle = inkSub; ctx.font = `italic 500 ${F(28)} ${SERIF}`; ctx.fillText(`Pictured: the ${d.sport.label.toLowerCase()} in question.`, M, photoTop + photoH + 50);
      if (opts.showMap) drawRoute(ctx, act.route, { x: W - M - 150, y: photoTop + photoH + 12, w: 150, h: 150 }, { color: ink, width: 5, progress: anim });
      break;
    }
    case "frame": {
      const pad = 70, top = 180, bottom = 420;
      if (!sticker) {
        ctx.fillStyle = light ? "#111111" : "#F4F1EA"; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.beginPath(); ctx.rect(pad, top, W - 2 * pad, H - top - bottom); ctx.clip();
        if (media) drawCover(ctx, media, zoom, filter, { x: pad, y: top, w: W - 2 * pad, h: H - top - bottom }); ctx.restore();
      }
      const ink = light ? "#FFFFFF" : "#111111", inkSub = light ? "rgba(255,255,255,0.65)" : "rgba(17,17,17,0.6)";
      ctx.textAlign = "left"; ctx.fillStyle = inkSub; ctx.font = `500 ${F(36)} ${SERIF}`; ctx.fillText(fmtDate(act.date), pad, 120);
      ctx.textAlign = "right"; ctx.fillText(fmtClock(act.date), W - pad, 120);
      ctx.textAlign = "left"; ctx.fillStyle = inkSub; ctx.font = `500 ${F(42)} ${SERIF}`; ctx.fillText(act.name, pad, H - 340);
      ctx.fillStyle = ink; ctx.font = `800 ${F(140)} ${HERO}`; ctx.fillText(`${d.hero.v} ${d.hero.u}`.trim(), pad, H - 190);
      ctx.font = `600 ${F(40)} ${SANS}`; ctx.fillText(d.row.join("    "), pad, H - 110);
      if (opts.showMap) drawRoute(ctx, act.route, { x: W - pad - 230, y: H - 370, w: 230, h: 230 }, { color: acc === "#FFFFFF" && !light ? ink : acc, width: 7, progress: anim });
      break;
    }
    case "polaroid": {
      const pw = Math.min(860, W - 140), ph = pw + 220, px = (W - pw) / 2, py = (H - ph) / 2 - 20;
      if (!sticker) {
        ctx.fillStyle = light ? "#1c1c1c" : "#e9e4d8"; ctx.fillRect(0, 0, W, H);
        if (media && "filter" in ctx) { ctx.save(); ctx.filter = "blur(40px) brightness(0.6)"; drawCover(ctx, media, 1.2, null); ctx.restore(); }
      }
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.03); ctx.translate(-W / 2, -H / 2);
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
      ctx.fillStyle = "#FBFAF6"; ctx.fillRect(px, py, pw, ph); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.save(); ctx.beginPath(); ctx.rect(px + 40, py + 40, pw - 80, pw - 80); ctx.clip();
      ctx.fillStyle = "#111"; ctx.fillRect(px + 40, py + 40, pw - 80, pw - 80);
      if (media && !sticker) drawCover(ctx, media, zoom, filter !== "none" ? filter : "contrast(1.05) saturate(1.1) sepia(0.1)", { x: px + 40, y: py + 40, w: pw - 80, h: pw - 80 });
      ctx.restore();
      ctx.textAlign = "left"; ctx.fillStyle = "#24242a"; fitText(ctx, `${d.hero.v} ${d.hero.u}  ·  ${act.name}`, pw - 100, 400, 60 * S, SCRIPT);
      ctx.fillText(`${d.hero.v} ${d.hero.u}  ·  ${act.name}`, px + 50, py + pw + 40);
      ctx.font = `${F(40)} ${SCRIPT}`; ctx.fillStyle = "#55555e"; ctx.fillText([fmtDate(act.date), ...d.row.slice(0, 2)].join("   "), px + 50, py + pw + 110);
      ctx.restore();
      if (opts.showMap) drawRoute(ctx, act.route, { x: W - 260, y: 100, w: 160, h: 160 }, { color: light ? "#FFFFFF" : "#111", width: 6, progress: anim });
      break;
    }
    case "receipt": {
      const rw = Math.min(700, W - 160), rx = (W - rw) / 2;
      if (!sticker) { ctx.fillStyle = light ? "#161616" : "#dcd6ca"; ctx.fillRect(0, 0, W, H); if (media && "filter" in ctx) { ctx.save(); ctx.filter = "blur(30px) brightness(0.55)"; drawCover(ctx, media, 1.2, null); ctx.restore(); } }
      const lines = [];
      if (d.hasDist) lines.push(["DISTANCE", `${fmtDist(dFull.dist)} ${d.unit}`]);
      lines.push(["MOVING TIME", fmtTime(act.time)]);
      if (d.hasDist) lines.push([d.paceLabel.toUpperCase(), d.paceStr]);
      if (act.elevation && d.hasDist) lines.push(["ELEVATION", `${Math.round(d.elevV)} ${d.elevU}`]);
      if (act.hr) lines.push(["AVG HR", `${act.hr} bpm`]);
      if (act.hrMax && act.hr) lines.push(["MAX HR", `${act.hrMax} bpm`]);
      if (act.calories) lines.push(["CALORIES", `${act.calories}`]);
      if (act.splits?.length) lines.push(["FASTEST KM", fmtPace(Math.min(...act.splits))]);
      const rh = Math.min(H - 120, 560 + lines.length * 56);
      const ry = (H - rh) / 2;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = "#FBFAF5"; ctx.fillRect(rx, ry, rw, rh); ctx.restore();
      ctx.fillStyle = "#FBFAF5"; ctx.beginPath(); ctx.moveTo(rx, ry + rh); for (let x = rx; x < rx + rw; x += 28) { ctx.lineTo(x + 14, ry + rh + 16); ctx.lineTo(x + 28, ry + rh); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#222"; ctx.textAlign = "center"; ctx.font = `700 ${F(42)} ${MONO}`; ctx.fillText("STRIDE STUDIO", W / 2, ry + 80);
      ctx.font = `400 ${F(24)} ${MONO}`; ctx.fillStyle = "#555"; ctx.fillText(`${fmtDateLong(act.date)}  ${fmtClock(act.date)}`, W / 2, ry + 122);
      ctx.fillText(act.name.toUpperCase().slice(0, 28), W / 2, ry + 156);
      ctx.fillStyle = "#222"; ctx.textAlign = "left"; ctx.font = `400 ${F(28)} ${MONO}`;
      let y = ry + 215; ctx.fillText("- ".repeat(Math.floor(rw / 24)), rx + 30, y); y += 48;
      lines.forEach(([k, v]) => { ctx.textAlign = "left"; ctx.fillText(k, rx + 46, y); ctx.textAlign = "right"; ctx.fillText(v, rx + rw - 46, y); y += 56; });
      ctx.textAlign = "left"; ctx.fillText("- ".repeat(Math.floor(rw / 24)), rx + 30, y); y += 66;
      ctx.font = `700 ${F(44)} ${MONO}`; ctx.fillText("TOTAL", rx + 46, y); ctx.textAlign = "right"; ctx.fillText(`${dFull.hero.v} ${dFull.hero.u}`.trim(), rx + rw - 46, y); y += 66;
      ctx.textAlign = "center"; ctx.font = `400 ${F(24)} ${MONO}`; ctx.fillStyle = "#555"; ctx.fillText("THANK YOU FOR SHOWING UP", W / 2, y); y += 36;
      ctx.fillText("NO REFUNDS ON EFFORT", W / 2, y); y += 50;
      let bx = rx + 90; for (let i = 0; i < 58 && bx < rx + rw - 90; i++) { const w = (i * 7) % 3 + 2; ctx.fillStyle = "#222"; ctx.fillRect(bx, y, w, 60); bx += w + 4 + (i % 4 === 0 ? 3 : 0); }
      break;
    }
    case "bib": {
      const bw = Math.min(720, W - 160), bh = 520, bx = (W - bw) / 2, by = opts.position === "top" ? 200 : H - bh - Math.min(260, (H - bh) / 2);
      ctx.save(); ctx.rotate(-0.035); ctx.translate(30, 30);
      ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
      roundRect(ctx, bx, by, bw, bh, 26); ctx.fillStyle = "#FAFAF7"; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      const band = acc === "#FFFFFF" ? "#111111" : acc;
      ctx.fillStyle = band; ctx.fillRect(bx, by, bw, 90);
      [[bx + 60, by + 45], [bx + bw - 60, by + 45], [bx + 60, by + bh - 45], [bx + bw - 60, by + bh - 45]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fill(); });
      ctx.textAlign = "center"; ctx.fillStyle = isDark(band) ? "#FFFFFF" : "#111111";
      ctx.font = `700 ${F(38)} ${SANS}`; ctx.fillText(d.meta.toUpperCase().slice(0, 40), bx + bw / 2, by + 62);
      ctx.fillStyle = "#111111"; fitText(ctx, d.hero.v, bw - 80, 400, 300 * S, COND); ctx.fillText(d.hero.v, bx + bw / 2, by + 380);
      ctx.font = `700 ${F(40)} ${SANS}`; ctx.fillStyle = "#333"; ctx.fillText([d.hero.u.toUpperCase(), ...d.row.slice(0, 3)].filter(Boolean).join("    "), bx + bw / 2, by + 460);
      ctx.restore();
      break;
    }
    case "retro": {
      const cream = "#F1E6C8", brown = "#3B2A1A";
      const stripes = ["#E4572E", "#F3A712", "#F9D66B", "#5E9E7A", "#2E6F95"];
      const photoH = Math.max(320, H - 720);
      if (!sticker) {
        ctx.fillStyle = cream; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.beginPath(); ctx.rect(60, 60, W - 120, photoH); ctx.clip();
        if (media) drawCover(ctx, media, zoom, filter !== "none" ? filter : "sepia(0.35) saturate(1.2) contrast(1.05)", { x: 60, y: 60, w: W - 120, h: photoH });
        ctx.restore();
        stripes.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(60, 60 + photoH + 20 + i * 22, (W - 120) * Math.min(1, Math.max(0, anim * 1.4 - i * 0.08)), 16); });
        grain(ctx, 0.08);
      }
      const base = 60 + photoH + 150;
      ctx.textAlign = "left"; ctx.fillStyle = brown; ctx.font = `400 ${F(200)} ${COND}`;
      ctx.fillText(d.hero.v, 60, base + 190);
      const w1 = ctx.measureText(d.hero.v).width;
      ctx.font = `400 ${F(90)} ${COND}`; ctx.fillText(d.hero.u.toUpperCase(), 60 + w1 + 18, base + 190);
      ctx.font = `700 ${F(40)} ${SANS}`; ctx.fillStyle = "#E4572E"; ctx.fillText(act.name.toUpperCase(), 60, base + 260);
      ctx.fillStyle = brown; ctx.font = `600 ${F(38)} ${SANS}`; ctx.fillText(dFull.row.join("     "), 60, base + 325);
      ctx.font = `500 ${F(30)} ${SERIF}`; ctx.fillStyle = "#6b5a45"; ctx.fillText(`${fmtDateLong(act.date)}   finisher`, 60, base + 380);
      if (opts.showMap) drawRoute(ctx, act.route, { x: W - 300, y: base + 60, w: 220, h: 220 }, { color: brown, width: 7, progress: anim });
      break;
    }
    case "tape": {
      const band = acc === "#FFFFFF" ? "#FFD23F" : acc, ink = isDark(band) ? "#FFFFFF" : "#111111";
      const draw = (yc, angle, text, size, dir) => {
        ctx.save(); ctx.translate(W / 2, yc); ctx.rotate(angle);
        ctx.fillStyle = band; ctx.fillRect(-W, -size * 0.8, 2 * W, size * 1.6);
        ctx.fillStyle = ink; ctx.font = `400 ${size}px ${COND}`; ctx.textAlign = "left";
        const unit = text + "      ", uw = ctx.measureText(unit).width;
        const shift = opts.animate ? ((t * uw * 1.5 * dir) % uw + uw) % uw : 0;
        for (let x = -W - uw + shift; x < W; x += uw) ctx.fillText(unit, x, size * 0.36);
        ctx.restore();
      };
      draw(H * 0.42, -0.14, `${d.hero.v} ${d.hero.u}   ${act.name.toUpperCase()}   `, 70 * S, 1);
      draw(H * 0.58, 0.1, (dFull.row.join("   ") || fmtTime(act.time)).toUpperCase(), 54 * S, -1);
      shadow(ctx, light);
      ctx.textAlign = "center"; ctx.fillStyle = txt; ctx.font = `600 ${F(40)} ${SANS}`; ctx.fillText(fmtDate(act.date), W / 2, H - 150);
      break;
    }
    case "neon": {
      const glow = acc === "#FFFFFF" ? "#FF2D95" : acc;
      const flicker = opts.animate ? 0.7 + 0.3 * Math.abs(Math.sin(t * Math.PI * 7)) : 1;
      const neonText = (text, x, y, size, family) => {
        ctx.textAlign = "center"; ctx.font = `${family === COND ? 400 : 700} ${Math.round(size)}px ${family}`;
        ctx.shadowColor = glow; ctx.shadowBlur = 60 * flicker; ctx.fillStyle = glow; ctx.fillText(text, x, y);
        ctx.shadowBlur = 24; ctx.fillText(text, x, y);
        ctx.shadowBlur = 0; ctx.fillStyle = "#FFFFFF"; ctx.fillText(text, x, y);
      };
      neonText(`${d.hero.v}${d.hero.u ? " " + d.hero.u : ""}`, W / 2, H / 2 + 40, 240 * S, COND);
      neonText(act.name.toUpperCase(), W / 2, H / 2 - 220, 56 * S, SANS);
      neonText(dFull.row.join("   "), W / 2, H / 2 + 160, 44 * S, SANS);
      if (opts.showMap && H > 1200) drawRoute(ctx, act.route, { x: W / 2 - 180, y: H / 2 + 230, w: 360, h: 360 }, { color: glow, width: 10, glow: 40, progress: anim, ghost: null });
      break;
    }
    case "noir": {
      drawRoute(ctx, act.route, { x: 150, y: 260, w: W - 300, h: Math.max(300, H - 820) }, { color: acc, width: 14, glow: 28, progress: anim, ghost: null });
      ctx.textAlign = "left";
      ctx.fillStyle = txt; ctx.font = `800 ${F(120)} ${HERO}`; ctx.fillText(`${d.hero.v} ${d.hero.u}`.trim(), M, H - 300);
      ctx.font = `600 ${F(48)} ${SANS}`; ctx.fillStyle = sub; ctx.fillText(d.row.join("   "), M, H - 220);
      ctx.font = `500 ${F(40)} ${SANS}`; ctx.fillText(d.meta, M, H - 150);
      break;
    }
    case "bigmap": {
      if (!sticker) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H); }
      drawRoute(ctx, act.route, { x: 60, y: 60, w: W - 120, h: H - 340 }, { color: acc, width: 22, glow: 30, progress: anim, ghost: "rgba(255,255,255,0.12)" });
      ctx.textAlign = "left"; ctx.fillStyle = txt; ctx.font = `800 ${F(150)} ${HERO}`; ctx.fillText(d.hero.v, M, H - 190);
      const w1 = ctx.measureText(d.hero.v).width;
      ctx.font = `700 ${F(60)} ${SANS}`; ctx.fillText(d.hero.u, M + w1 + 18, H - 190);
      ctx.fillStyle = sub; ctx.font = `600 ${F(42)} ${SANS}`; ctx.fillText(d.row.join("   "), M, H - 120);
      ctx.textAlign = "right"; ctx.font = `500 ${F(38)} ${SANS}`; ctx.fillText(d.meta, W - M, 120);
      break;
    }
    case "orbit": {
      const R = Math.min(380, W * 0.36, H * 0.24), cx = W / 2, cy = H / 2 - (H > 1500 ? 60 : 100);
      if (!sticker) { ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = light ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.5)"; ctx.fill(); }
      ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * anim); ctx.strokeStyle = acc; ctx.lineWidth = 8; ctx.stroke();
      drawRoute(ctx, act.route, { x: cx - R * 0.68, y: cy - R * 0.68, w: R * 1.36, h: R * 1.36 }, { color: acc, width: 10, glow: 18, progress: anim, ghost: null });
      ctx.textAlign = "center"; ctx.fillStyle = txt; ctx.font = `800 ${Math.round(R * 0.45 * S)}px ${HERO}`; ctx.fillText(d.hero.v, cx, cy + R * 0.16);
      ctx.font = `700 ${F(44)} ${SANS}`; ctx.fillText(d.hero.u.toUpperCase(), cx, cy + R * 0.34);
      ctx.fillStyle = sub; ctx.font = `600 ${F(44)} ${SANS}`; ctx.fillText(d.row.join("    "), cx, cy + R + 100);
      ctx.font = `500 ${F(38)} ${SANS}`; ctx.fillText(d.meta, cx, cy + R + 165);
      break;
    }
    case "stamp": {
      const R = 230, cx = opts.position === "top" ? W - 300 : 300, cy = opts.position === "top" ? 320 : H - 360;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.15 + (opts.animate ? 0.25 * (1 - anim) : 0));
      const ink = acc === "#FFFFFF" ? (light ? "#FFFFFF" : "#111") : acc;
      ctx.strokeStyle = ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R - 22, 0, Math.PI * 2); ctx.stroke();
      const words = `${act.name.toUpperCase()}   ${fmtDate(act.date).toUpperCase()}   `;
      ctx.fillStyle = ink; ctx.font = `700 ${F(30)} ${SANS}`; ctx.textAlign = "center";
      const total = words.length; for (let i = 0; i < total; i++) { const a = (i / total) * Math.PI * 2; ctx.save(); ctx.rotate(a); ctx.translate(0, -(R - 62)); ctx.fillText(words[i], 0, 0); ctx.restore(); }
      const hasRoute = act.route?.length > 1;
      if (hasRoute) drawRoute(ctx, act.route, { x: -95, y: -135, w: 190, h: 120 }, { color: ink, width: 5, progress: anim, ghost: null });
      ctx.font = `800 ${F(76)} ${SANS}`; ctx.fillText(d.hero.v, 0, hasRoute ? 75 : 25);
      ctx.font = `700 ${F(26)} ${SANS}`; ctx.fillText(`${d.hero.u.toUpperCase()}  ${dFull.row[0] || ""}`.trim(), 0, hasRoute ? 118 : 68);
      ctx.restore();
      break;
    }
    case "elevation": {
      if (!sticker) wash(ctx, H - 800, H, light, 0.55);
      if (act.elev?.length > 1) drawArea(ctx, act.elev, { x: 0, y: H - 620, w: W, h: 300 }, acc, txt, anim);
      else { ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(36)} ${SANS}`; ctx.fillText("No elevation data for this activity", M, H - 500); }
      ctx.textAlign = "left";
      ctx.fillStyle = txt; ctx.font = `800 ${F(150)} ${SANS}`; ctx.fillText(`${Math.round(d.elevV * anim)} ${d.elevU}`, M, H - 190);
      ctx.fillStyle = sub; ctx.font = `600 ${F(44)} ${SANS}`; ctx.fillText(d.hasDist ? `climbed over ${fmtDist(dFull.dist)} ${d.unit}` : `climbed in ${fmtTime(act.time)}`, M, H - 120);
      ctx.textAlign = "right"; ctx.fillStyle = txt; ctx.font = `700 ${F(44)} ${SANS}`; ctx.fillText(dFull.row.slice(0, 2).join("   "), W - M, H - 190);
      ctx.fillStyle = sub; ctx.font = `500 ${F(40)} ${SANS}`; ctx.fillText(d.meta, W - M, H - 680);
      break;
    }
    case "hrwave": {
      const hs = act.hrStream || [];
      const box = { x: 0, y: H - 760, w: W, h: 380 };
      if (!sticker) wash(ctx, H - 980, H, light, 0.6);
      if (hs.length > 1) {
        const min = Math.min(...hs) - 5, max = Math.max(...hs) + 5;
        shadow(ctx, false);
        ZONES.forEach((z) => {
          const lo = Math.max(min, z.lo * hrMax), hi = Math.min(max, z.hi * hrMax);
          if (hi <= lo) return;
          const y1 = box.y + box.h - ((hi - min) / (max - min)) * box.h, y2 = box.y + box.h - ((lo - min) / (max - min)) * box.h;
          ctx.fillStyle = hexAlpha(z.c, 0.16); ctx.fillRect(box.x, y1, box.w, y2 - y1);
          ctx.fillStyle = hexAlpha(z.c, 0.95); ctx.font = `700 ${F(24)} ${SANS}`; ctx.textAlign = "right"; ctx.fillText(`Z${z.n}`, W - 60, y2 - 8);
        });
        const n = Math.max(2, Math.floor(hs.length * anim));
        ctx.save(); ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.lineCap = "round";
        for (let i = 1; i < n; i++) {
          const x0 = box.x + ((i - 1) / (hs.length - 1)) * box.w, x1 = box.x + (i / (hs.length - 1)) * box.w;
          const y0 = box.y + box.h - ((hs[i - 1] - min) / (max - min)) * box.h, y1 = box.y + box.h - ((hs[i] - min) / (max - min)) * box.h;
          ctx.strokeStyle = zoneOf(hs[i], hrMax).c; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        ctx.restore();
        const cur = hs[n - 1], shown = anim < 1 ? cur : (act.hr || cur);
        shadow(ctx, light);
        ctx.textAlign = "left"; ctx.fillStyle = txt; ctx.font = `800 ${F(150)} ${SANS}`; ctx.fillText(`${shown}`, M, H - 190);
        const w1 = ctx.measureText(`${shown}`).width;
        ctx.fillStyle = zoneOf(shown, hrMax).c; ctx.font = `700 ${F(48)} ${SANS}`; ctx.fillText(`bpm avg   ${zoneOf(shown, hrMax).name.toLowerCase()}`, M + w1 + 18, H - 190);
        ctx.fillStyle = sub; ctx.font = `600 ${F(40)} ${SANS}`; ctx.fillText(`peak ${Math.max(...hs)} bpm   ${fmtTime(act.time)}${d.hasDist ? `   ${fmtDist(dFull.dist)} ${d.unit}` : ""}`, M, H - 120);
      } else { ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(36)} ${SANS}`; ctx.fillText("No heart rate data for this activity", M, H - 190); }
      ctx.textAlign = "right"; ctx.fillStyle = sub; ctx.font = `500 ${F(40)} ${SANS}`; ctx.fillText(d.meta, W - M, H - 820);
      break;
    }
    case "zones": {
      const shares = zoneShares(act.hrStream, hrMax);
      const x0 = M, barW = W - 2 * M, y0 = H / 2 - 140;
      if (act.hrStream?.length) {
        shadow(ctx, false);
        let x = x0;
        ZONES.forEach((z, i) => { const w = barW * shares[i] * anim; if (w > 6) { ctx.fillStyle = z.c; roundRect(ctx, x, y0, Math.max(0, w - 4), 70, 8); ctx.fill(); } x += barW * shares[i]; });
        let y = y0 + 150;
        ZONES.forEach((z, i) => {
          const secs = Math.round(shares[i] * act.time);
          ctx.fillStyle = z.c; roundRect(ctx, x0, y - 34, 18, 40, 5); ctx.fill();
          shadow(ctx, light); ctx.textAlign = "left"; ctx.fillStyle = txt; ctx.font = `700 ${F(42)} ${SANS}`; ctx.fillText(`Zone ${z.n}  ${z.name}`, x0 + 40, y);
          ctx.textAlign = "right"; ctx.fillText(fmtTime(secs * anim), W - M, y);
          ctx.fillStyle = sub; ctx.font = `500 ${F(30)} ${SANS}`; ctx.fillText(`${Math.round(shares[i] * 100 * anim)}%`, W - M - 190, y); shadow(ctx, false);
          y += 92 * S;
        });
        shadow(ctx, light);
        ctx.textAlign = "left"; ctx.fillStyle = txt; ctx.font = `800 ${F(110)} ${SANS}`; ctx.fillText(`${act.hr || Math.round(act.hrStream.reduce((a, b) => a + b, 0) / act.hrStream.length)} bpm`, M, y0 - 90);
        ctx.fillStyle = sub; ctx.font = `600 ${F(40)} ${SANS}`; ctx.fillText(`average   ${fmtTime(act.time)} in the zones   max ${hrMax}`, M, y0 - 30);
      } else { shadow(ctx, light); ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(36)} ${SANS}`; ctx.fillText("No heart rate data for this activity", M, y0); }
      ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(40)} ${SANS}`; ctx.fillText(d.meta, M, H - 150);
      break;
    }
    case "rings": {
      const k = Math.min(1, H / 1920), cx = W / 2, cy = H / 2 - 40 * k, radii = [300 * k, 230 * k, 160 * k];
      const vals = [
        { v: Math.min(1, act.time / 3600), c: acc === "#FFFFFF" ? "#FF2D95" : acc, label: fmtTime(act.time), name: "time" },
        { v: act.hr ? Math.min(1, act.hr / hrMax) : 0.5, c: "#7BE495", label: act.hr ? `${act.hr} bpm` : "no HR", name: "effort" },
        { v: d.hasDist ? Math.min(1, dFull.dist / (opts.units === "mi" ? 13.1 : 21.1)) : Math.min(1, (act.calories || 300) / 800), c: "#4FC1E9", label: d.hasDist ? `${fmtDist(dFull.dist)} ${d.unit}` : `${act.calories || ""} kcal`, name: d.hasDist ? "distance" : "burn" },
      ];
      shadow(ctx, false);
      vals.forEach((r, i) => {
        const R = radii[i];
        ctx.lineWidth = 46 * k; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = hexAlpha(r.c, 0.22); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, r.v) * anim); ctx.strokeStyle = r.c; ctx.shadowColor = r.c; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
      });
      shadow(ctx, light);
      ctx.textAlign = "center"; ctx.fillStyle = txt; ctx.font = `800 ${F(64 * k + 6)} ${SANS}`; ctx.fillText(d.hero.v, cx, cy + 22);
      ctx.fillStyle = sub; ctx.font = `600 ${F(28)} ${SANS}`; ctx.fillText(d.hero.u || "time", cx, cy + 60);
      let y = cy + 400 * k;
      vals.forEach((r) => { ctx.textAlign = "left"; ctx.fillStyle = r.c; ctx.beginPath(); ctx.arc(M + 14, y - 14, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = txt; ctx.font = `700 ${F(40)} ${SANS}`; ctx.fillText(r.name, M + 44, y); ctx.textAlign = "right"; ctx.fillText(r.label, W - M, y); y += 62 * S; });
      ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(40)} ${SANS}`; ctx.fillText(d.meta, M, H - 120);
      break;
    }
    case "hud": {
      ctx.textAlign = "left";
      const liveHr = act.hrStream?.length ? act.hrStream[Math.min(act.hrStream.length - 1, Math.floor(progress * act.hrStream.length))] : act.hr ? Math.round(act.hr + Math.sin(progress * 12) * 3) : null;
      const rows = [];
      if (d.hasDist) rows.push(["Distance", `${d.liveDist.toFixed(2)} ${d.unit}`]);
      if (opts.stats.time || !d.hasDist) rows.push(["Time", fmtTime(act.time * progress)]);
      if (opts.stats.pace && d.hasDist) rows.push([d.paceLabel, dFull.paceStr]);
      if ((opts.stats.hr || !d.hasDist) && liveHr) rows.push(["Heart rate", `${liveHr} bpm`]);
      let y = 240;
      rows.forEach(([label, value]) => { ctx.fillStyle = sub; ctx.font = `500 ${F(36)} ${SANS}`; ctx.fillText(label, M, y); ctx.fillStyle = txt; ctx.font = `800 ${F(96)} ${SANS}`; ctx.fillText(value, M, y + 100 * S); y += 200 * S; });
      if (opts.showMap) drawRoute(ctx, act.route, { x: W - 400, y: H - 620, w: 320, h: 320 }, { color: acc, width: 9, glow: 14, progress });
      ctx.textAlign = "left"; ctx.fillStyle = sub; ctx.font = `500 ${F(38)} ${SANS}`; ctx.fillText(d.meta, M, H - 170);
      break;
    }
    case "chase": {
      const box = { x: 120, y: 240, w: W - 240, h: Math.max(260, H - 860) };
      const head = drawRoute(ctx, act.route, box, { color: acc, width: 16, glow: 30, progress: Math.max(0.01, progress), ghost: "rgba(255,255,255,0.18)" });
      if (head) { ctx.save(); shadow(ctx, false); ctx.beginPath(); ctx.arc(head[0], head[1], 30 + 10 * Math.sin(progress * 40), 0, Math.PI * 2); ctx.strokeStyle = hexAlpha(acc, 0.6); ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
      ctx.textAlign = "center"; ctx.fillStyle = txt; ctx.font = `800 ${F(200)} ${HERO}`; ctx.fillText(d.hero.v, W / 2, H - 260);
      ctx.fillStyle = sub; ctx.font = `700 ${F(50)} ${SANS}`; ctx.fillText(d.hero.label, W / 2, H - 195);
      ctx.font = `600 ${F(44)} ${SANS}`; ctx.fillText(`${fmtTime(act.time * progress)}   ${d.hasDist ? dFull.paceStr : ""}`.trim(), W / 2, H - 130);
      ctx.font = `500 ${F(38)} ${SANS}`; ctx.fillText(d.meta, W / 2, 170);
      break;
    }
    default: break;
  }
  ctx.restore();
  // free text line (e.g. "First half marathon!")
  if (opts.tagline) {
    ctx.save(); shadow(ctx, light && !solidBg);
    const size = 56 * (opts.taglineSize || 1) * S;
    const tagtext = opts.uppercase ? opts.tagline.toUpperCase() : opts.tagline;
    const lines = wrapText(ctx, tagtext, W - 2 * M, 800, size, HERO);
    const lineHeight = size * 1.3;
    const totalHeight = lines.length * lineHeight;
    let y = opts.taglinePos === "top" ? 130 + size : opts.taglinePos === "middle" ? H / 2 - totalHeight / 2 : H - 60 - totalHeight;
    ctx.textAlign = "center"; ctx.fillStyle = txt; ctx.font = `800 ${Math.round(size)}px ${HERO}`;
    lines.forEach((line) => { ctx.fillText(line, W / 2, y); y += lineHeight; });
    ctx.restore();
  }
  shadow(ctx, false);
}
