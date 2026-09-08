// Bundle size budget (spec §2.6, §12.4).
//
// Budget: dist/index.html <= 450 KB gzipped, excluding fonts. Fonts arrive in Phase 2
// (§5.6: 4 core families inlined, <= 220 KB) and get their own line then.
//
// Also fails on a regression of more than 5 % against the committed baseline, so the bundle
// creeps up deliberately rather than by accident. Refresh the baseline with `--write` in the
// same PR that justifies the increase.

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const BUNDLE = resolve(ROOT, "dist/index.html");
const BASELINE = resolve(ROOT, ".size-baseline.json");

const BUDGET_GZIP = 450 * 1024;
const REGRESSION_TOLERANCE = 0.05;

if (!existsSync(BUNDLE)) {
  console.error("dist/index.html not found — run `npm run build` first.");
  process.exit(1);
}

const raw = readFileSync(BUNDLE);
const gzip = gzipSync(raw, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

console.log(`dist/index.html  raw ${kb(statSync(BUNDLE).size)}  gzipped ${kb(gzip)}`);
console.log(
  `budget           gzipped ${kb(BUDGET_GZIP)}  (${((gzip / BUDGET_GZIP) * 100).toFixed(1)} % used)`,
);

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify({ gzip, recordedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`baseline written: ${kb(gzip)}`);
  process.exit(0);
}

const failures = [];

if (gzip > BUDGET_GZIP) {
  failures.push(`over budget: ${kb(gzip)} gzipped > ${kb(BUDGET_GZIP)}`);
}

if (existsSync(BASELINE)) {
  const base = JSON.parse(readFileSync(BASELINE, "utf8"));
  const delta = (gzip - base.gzip) / base.gzip;
  const sign = delta >= 0 ? "+" : "";
  console.log(`baseline         gzipped ${kb(base.gzip)}  (${sign}${(delta * 100).toFixed(1)} %)`);
  if (delta > REGRESSION_TOLERANCE) {
    failures.push(
      `regression: ${kb(gzip)} is ${(delta * 100).toFixed(1)} % over the baseline ${kb(base.gzip)} ` +
        `(tolerance ${REGRESSION_TOLERANCE * 100} %). If intended, run \`node scripts/size.mjs --write\`.`,
    );
  }
} else {
  console.log("no baseline yet — run `node scripts/size.mjs --write` to record one.");
}

if (failures.length) {
  console.error(`\n${failures.map((f) => `FAIL ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("size OK");
