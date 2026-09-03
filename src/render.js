export const FORMATS = {
  story: { id: "story", name: "Story", w: 1080, h: 1920 },
  post: { id: "post", name: "Post", w: 1080, h: 1350 },
  square: { id: "square", name: "Square", w: 1080, h: 1080 },
};
export let W = 1080, H = 1920;
export function setFormat(id) {
  const f = FORMATS[id] || FORMATS.story;
  W = f.w;
  H = f.h;
  return f;
}

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
export const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch { return ""; }
};
export function fmtDist(d) { return d >= 100 ? d.toFixed(0) : d >= 10 ? d.toFixed(1) : d.toFixed(2); }

export const DEMO = {
  id: "demo", sport: "run", name: "Sunday long run", date: new Date().toISOString(),
  distance: 21100, time: 6135, elevation: 84, hr: 158, hrMax: 178, calories: 1420,
};
export const DEMO_WORKOUT = {
  id: "demo-workout", sport: "workout", name: "Strength + core", date: new Date().toISOString(),
  distance: 0, time: 2700, elevation: 0, hr: 132, hrMax: 171, calories: 410,
};

export const SPORTS = {
  run: { label: "Run", pace: true }, trailrun: { label: "Trail run", pace: true },
  walk: { label: "Walk", pace: true }, hike: { label: "Hike", pace: true },
  ride: { label: "Ride", speed: true }, swim: { label: "Swim", per100: true },
  workout: { label: "Workout", noDistance: true },
};
export function sportFromStrava(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("trail")) return "trailrun";
  if (t.includes("run")) return "run";
  if (t.includes("ride") || t.includes("cycl") || t.includes("bike")) return "ride";
  if (t.includes("swim")) return "swim";
  if (t.includes("hike")) return "hike";
  if (t.includes("walk")) return "walk";
  return "workout";
}

export const PALETTE = [
  { c: "#111111", name: "Black" }, { c: "#FFFFFF", name: "White" }, { c: "#FF5722", name: "Orange" },
  { c: "#4CAF50", name: "Green" }, { c: "#2196F3", name: "Blue" }, { c: "#E91E63", name: "Pink" },
  { c: "#FFC107", name: "Amber" }, { c: "#00BCD4", name: "Cyan" }, { c: "#FF1744", name: "Red" },
];
export const FILTERS = [
  { id: "none", name: "None" }, { id: "sepia", name: "Sepia" }, { id: "grayscale", name: "B&W" },
  { id: "saturate", name: "Vivid" }, { id: "contrast", name: "Contrast" },
];
export const FONTS = [
  { id: "sans", name: "Sans", css: "system-ui" }, { id: "serif", name: "Serif", css: "Georgia, serif" },
  { id: "mono", name: "Mono", css: "monospace" },
];
export const BACKGROUNDS = [
  { id: "grad1", name: "Ocean", stops: ["#0066cc", "#00ccff"] },
  { id: "grad2", name: "Sunset", stops: ["#ff6b00", "#ffcc00"] },
  { id: "grad3", name: "Forest", stops: ["#1a4d2e", "#55a630"] },
];

export function derive(act, opts = {}) {
  const sport = SPORTS[act.sport] || SPORTS.run;
  const mi = opts.units === "mi";
  const kmRaw = (act.distance || 0) / 1000;
  const km = kmRaw || 0.001;
  const dist = mi ? kmRaw * 0.621371 : kmRaw;
  const unit = mi ? "mi" : "km";
  const paceSec = act.time / (km || 0.001);
  const speed = dist / (act.time / 3600 || 1);
  const elevV = mi ? (act.elevation || 0) * 3.28084 : (act.elevation || 0);
  const elevU = mi ? "ft" : "m";
  const hasDist = !sport.noDistance && kmRaw > 0;
  const paceStr = sport.speed ? `${speed.toFixed(1)} ${unit}/h` : `${fmtPace(paceSec)} /${unit}`;
  return { hasDist, dist, unit, paceSec, paceStr, elevV, elevU };
}

export function renderCanvas(ctx, elements, media, act, preset) {
  // Background
  ctx.fillStyle = preset.bg;
  ctx.fillRect(0, 0, W, H);

  // Draw media if present
  if (media) {
    ctx.globalAlpha = 0.3;
    if (media.type === "image") {
      ctx.drawImage(media.el, 0, 0, W, H);
    } else if (media.type === "video" && media.el.readyState >= 2) {
      ctx.drawImage(media.el, 0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }

  // Draw elements
  const d = derive(act);
  elements.forEach((el) => {
    ctx.save();
    ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-(el.w / 2), -(el.h / 2));

    if (el.type === "stat") {
      drawStatBlock(ctx, el, act, d, preset);
    } else if (el.type === "text") {
      drawTextBlock(ctx, el, preset);
    } else if (el.type === "shape") {
      drawShape(ctx, el, preset);
    }

    ctx.restore();
  });
}

function drawStatBlock(ctx, el, act, d, preset) {
  const padding = 12;
  ctx.fillStyle = preset.accent;
  ctx.globalAlpha = 0.15;
  roundRect(ctx, 0, 0, el.w, el.h, 8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = preset.accent;
  ctx.lineWidth = 2;
  roundRect(ctx, 0, 0, el.w, el.h, 8);
  ctx.stroke();

  ctx.fillStyle = preset.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let statValue = "";
  let statLabel = "";

  switch (el.stat) {
    case "distance":
      statValue = d.hasDist ? fmtDist(d.dist) : "—";
      statLabel = d.unit.toUpperCase();
      break;
    case "time":
      statValue = fmtTime(act.time);
      statLabel = "TIME";
      break;
    case "pace":
      statValue = d.paceStr.split("/")[0];
      statLabel = "PACE";
      break;
    case "elevation":
      statValue = d.hasDist ? Math.round(d.elevV) : "0";
      statLabel = d.elevU.toUpperCase();
      break;
    case "hr":
      statValue = act.hr || "—";
      statLabel = "BPM";
      break;
  }

  ctx.font = `bold ${Math.round(el.h * 0.5)}px system-ui`;
  ctx.fillText(statValue, el.w / 2, el.h * 0.35);
  ctx.font = `600 ${Math.round(el.h * 0.25)}px system-ui`;
  ctx.fillText(statLabel, el.w / 2, el.h * 0.75);
}

function drawTextBlock(ctx, el, preset) {
  ctx.fillStyle = el.color || preset.text;
  ctx.font = `${el.fontSize}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Simple word wrap
  const words = el.text.split(" ");
  const lineHeight = el.fontSize * 1.2;
  let lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    const width = ctx.measureText(test).width;
    if (width < el.w - 8) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  const totalHeight = lines.length * lineHeight;
  let y = (el.h - totalHeight) / 2 + el.fontSize / 2;
  lines.forEach((l) => {
    ctx.fillText(l, el.w / 2, y);
    y += lineHeight;
  });
}

function drawShape(ctx, el, preset) {
  ctx.fillStyle = preset.accent;
  ctx.globalAlpha = 0.2;
  roundRect(ctx, 0, 0, el.w, el.h, 8);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function captionFor(act, opts) {
  const d = derive(act, opts);
  const bits = [];
  if (d.hasDist) bits.push(`${fmtDist(d.dist)} ${d.unit}`);
  bits.push(fmtTime(act.time));
  if (d.hasDist) bits.push(d.paceStr);
  return bits.join(" • ");
}
