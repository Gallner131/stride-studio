// Bundles everything into dist/index.html (one self-contained file, no CDN, works offline)
//
// `node build.mjs`        one production build
// `node build.mjs --dev`  rebuild on change and serve on http://127.0.0.1:4173

import { mkdirSync, writeFileSync } from "node:fs";
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
    define: { "process.env.NODE_ENV": DEV ? '"development"' : '"production"' },
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
<style>${css}</style></head>
<body><div id="root"></div>
<script>${js.replace(/<\/script/g, "<\\/script")}</script>
</body></html>`;
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/index.html", html);
  console.log("dist/index.html", (html.length / 1024).toFixed(0), "KB");
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
