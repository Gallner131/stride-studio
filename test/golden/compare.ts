import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/** Spec §12.2: pixelmatch threshold 0.1, allow <= 0.5 % differing pixels (anti-aliasing). */
export const PIXELMATCH_THRESHOLD = 0.1;
export const MAX_DIFF_RATIO = 0.005;

export const SNAPSHOT_DIR = resolve(import.meta.dirname, "__snapshots__");
export const DIFF_DIR = resolve(import.meta.dirname, "diffs");

/**
 * Goldens are only meaningful in one pinned environment.
 *
 * The legacy renderer draws with system fonts (spec §1.2 E3: `system-ui`, `Impact`,
 * `Georgia`, `SF Mono`...). macOS and Linux rasterise those completely differently — not
 * marginally, but different typefaces at different metrics. Goldens recorded on a laptop
 * would fail every cell in CI, and the reflex fix would be to loosen MAX_DIFF_RATIO until
 * it passed, which silently disables the safety net that the whole v2 plan rests on
 * (§0.3, §1.4).
 *
 * So: record and compare ONLY inside the pinned Playwright container. CI sets
 * GOLDEN_ENV=pinned in the container job; nothing else may.
 */
export const isPinnedEnv = (): boolean => process.env.GOLDEN_ENV === "pinned";

export const PINNED_ENV_HINT = [
  "Goldens run only in the pinned Playwright container (fonts differ per OS).",
  "  In CI:    the `golden` job runs inside mcr.microsoft.com/playwright:v1.63.0-noble.",
  '  Locally:  docker run --rm -it -v "$PWD":/w -w /w \\',
  "              -e GOLDEN_ENV=pinned mcr.microsoft.com/playwright:v1.63.0-noble \\",
  "              npm run test:golden",
  "  To re-record: run the `golden-update` workflow (workflow_dispatch) and commit the",
  "  artifact it produces, in a PR labelled `golden-update` (§12.2).",
].join("\n");

export const snapshotPath = (name: string): string => resolve(SNAPSHOT_DIR, `${name}.png`);

export function writeSnapshot(name: string, png: Buffer): void {
  const p = snapshotPath(name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, png);
}

export interface CompareResult {
  ok: boolean;
  /** Missing golden on disk — a new cell, not a regression. */
  missing: boolean;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  reason?: string;
  diffPath?: string;
}

/**
 * Compares a freshly rendered cell against its committed golden. On failure, writes a
 * three-panel side-by-side (golden | actual | diff) to test/golden/diffs/ so the CI
 * artifact shows what moved rather than just a number (§12.2).
 */
export function compareToGolden(name: string, actualPng: Buffer): CompareResult {
  const goldenFile = snapshotPath(name);
  if (!existsSync(goldenFile)) {
    return {
      ok: false,
      missing: true,
      diffPixels: 0,
      totalPixels: 0,
      diffRatio: 1,
      reason: "no golden on disk",
    };
  }

  const golden = PNG.sync.read(readFileSync(goldenFile));
  const actual = PNG.sync.read(actualPng);

  if (golden.width !== actual.width || golden.height !== actual.height) {
    return {
      ok: false,
      missing: false,
      diffPixels: 0,
      totalPixels: 0,
      diffRatio: 1,
      reason: `size changed: golden ${golden.width}x${golden.height}, actual ${actual.width}x${actual.height}`,
    };
  }

  const { width, height } = golden;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(golden.data, actual.data, diff.data, width, height, {
    threshold: PIXELMATCH_THRESHOLD,
    includeAA: false,
  });

  const totalPixels = width * height;
  const diffRatio = diffPixels / totalPixels;
  const ok = diffRatio <= MAX_DIFF_RATIO;

  if (ok) return { ok, missing: false, diffPixels, totalPixels, diffRatio };

  const panel = new PNG({ width: width * 3, height });
  PNG.bitblt(golden, panel, 0, 0, width, height, 0, 0);
  PNG.bitblt(actual, panel, 0, 0, width, height, width, 0);
  PNG.bitblt(diff, panel, 0, 0, width, height, width * 2, 0);
  const diffPath = resolve(DIFF_DIR, `${name}.png`);
  mkdirSync(DIFF_DIR, { recursive: true });
  writeFileSync(diffPath, PNG.sync.write(panel));

  return { ok, missing: false, diffPixels, totalPixels, diffRatio, diffPath };
}
