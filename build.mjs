// Bundles everything into dist/index.html (one self-contained file, no CDN, works offline)
//
// `node build.mjs`        one production build
// `node build.mjs --dev`  rebuild on change and serve on http://127.0.0.1:4173

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const DEV = process.argv.includes("--dev");

async function bundle() {
  const r = await build({
    entryPoints: ["src/main.jsx"],
    bundle: true,
    minify: !DEV,
    write: false,
    format: "iife",
    target: ["es2019"],
    jsx: "automatic",
    sourcemap: DEV ? "inline" : false,
    // A visible build stamp. Without one, "I refreshed and nothing is different" and "it is
    // deployed" are both unfalsifiable, and we spent days there.
    define: {
      "process.env.NODE_ENV": DEV ? '"development"' : '"production"',
      __BUILD_STAMP__: JSON.stringify(
        new Date().toISOString().slice(5, 16).replace("T", " ").replace("-", "/"),
      ),
    },
    loader: { ".css": "css" },
    outdir: "dist",
  });
  const js = r.outputFiles.find((f) => f.path.endsWith(".js")).text;
  const css = r.outputFiles.find((f) => f.path.endsWith(".css")).text;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Stride Studio</title>
<meta name="theme-color" content="#161616">
<meta name="description" content="Turn a run or workout into a post you're proud of.">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./icon.svg">
<style>${css}</style></head>
<body><div id="root"></div>
<script>${js.replace(/<\/script/g, "<\\/script")}</script>
</body></html>`;
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/index.html", html);

  // --- PWA (§9.5) -----------------------------------------------------------
  // The manifest, worker and icon sit alongside the single-file app, so the AirDrop-able
  // index.html still works entirely on its own (§1.3).
  const manifest = {
    name: "Stride Studio",
    short_name: "Stride",
    description: "Turn a run or workout into a post you're proud of.",
    start_url: "./index.html",
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#141414",
    theme_color: "#161616",
    icons: [
      { src: "./icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "./icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
  writeFileSync("dist/manifest.webmanifest", JSON.stringify(manifest, null, 2));

  // One scalable icon, drawn here so there is no binary asset to keep in sync.
  writeFileSync(
    "dist/icon.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#141414"/>
  <path d="M112 352 C112 352 168 208 256 208 C344 208 344 128 400 128" fill="none"
        stroke="#D8FF3A" stroke-width="44" stroke-linecap="round"/>
  <circle cx="112" cy="352" r="30" fill="#FFFFFF"/>
  <circle cx="400" cy="128" r="30" fill="#D8FF3A"/>
</svg>`,
  );

  writeFileSync("dist/sw.js", readFileSync("src/pwa/sw.js", "utf8"));

  console.log("dist/index.html", (html.length / 1024).toFixed(0), "KB  + manifest, sw.js, icon.svg");
}

await bundle();

if (DEV) {
  const { watch } = await import("node:fs");
  const { spawn } = await import("node:child_process");
  let rebuilding = false;
  watch("src", { recursive: true }, async () => {
    if (rebuilding) return;
    rebuilding = true;
    setTimeout(async () => {
      try {
        await bundle();
      } catch (e) {
        console.error("build failed:", e.message);
      }
      rebuilding = false;
    }, 60);
  });
  console.log("watching src/ — open http://127.0.0.1:4173/dist/index.html");
  spawn("node", ["scripts/serve.mjs", "4173"], { stdio: "inherit" });
}
