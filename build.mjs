// Bundles everything into dist/index.html (one self-contained file, no CDN, works offline)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
const r = await build({
  entryPoints: ["src/main.jsx"], bundle: true, minify: true, write: false,
  format: "iife", target: ["es2019"], jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".css": "css" }, outdir: "dist",
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
