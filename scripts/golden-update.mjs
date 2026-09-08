// Re-records the golden baseline (spec §12.2, §13 Phase 0 step 3).
//
// Refuses to run outside the pinned container, because goldens recorded against a laptop's
// system fonts fail every cell on a Linux CI runner, and the tempting fix for that is to
// loosen the diff threshold until it passes — which quietly removes the only thing stopping
// another silent 27-template regression (§1.4).
import { spawnSync } from "node:child_process";

const PLAYWRIGHT_IMAGE = "mcr.microsoft.com/playwright:v1.63.0-noble";

if (process.env.GOLDEN_ENV !== "pinned") {
  console.error(
    [
      "Refusing to record goldens: this is not the pinned environment.",
      "",
      "The legacy renderer draws with system fonts (§1.2 E3), so goldens are only",
      "comparable within one fixed OS + fontconfig. Record them in the container:",
      "",
      "  GitHub Actions (no local Docker needed):",
      "    run the `golden-update` workflow (Actions tab -> golden-update -> Run workflow).",
      "    It records inside the container and commits the PNGs to your branch.",
      "",
      "  Locally, with Docker:",
      `    docker run --rm -it -v "$PWD":/w -w /w -e GOLDEN_ENV=pinned ${PLAYWRIGHT_IMAGE} \\`,
      "      sh -c 'npm ci && npm run golden:update'",
      "",
      "Then open the PR with the `golden-update` label and a note on why the pixels changed.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("recording goldens in the pinned environment...");
const result = spawnSync("npx", ["playwright", "test", "--project=golden", "--grep", "record"], {
  stdio: "inherit",
  env: { ...process.env, GOLDEN_RECORD: "1" },
});
process.exit(result.status ?? 1);
