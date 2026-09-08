// Generates the deterministic fixture photo used by the golden matrix (spec §12.2).
//
// Written as a committed PNG rather than drawn at test time so that the goldens depend on
// a byte-stable asset, and generated in pure Node (not a browser) so the bytes are the
// same whoever runs it. The image deliberately has a BRIGHT top third and a DARK bottom
// third, so light-on-photo and dark-on-photo text are both exercised. Phase 3's look
// linter (§12.7) adds five more fixture photos alongside it.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PNG } from "pngjs";

const W = 1080;
const H = 1920;
const OUT = resolve(import.meta.dirname, "../test/fixtures/media/fixture-photo.png");

// Deterministic PRNG (Lehmer / Park-Miller). Same sequence on every machine.
let seed = 20260904;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

// Pre-baked 4x4-block grain field, drawn from the same seeded PRNG.
const BLOCK = 4;
const GW = Math.ceil(W / BLOCK);
const GH = Math.ceil(H / BLOCK);
const grainField = new Float32Array(GW * GH);
for (let i = 0; i < grainField.length; i++) grainField[i] = (rnd() - 0.5) * 14;
const grainAt = (x, y) => grainField[((y / BLOCK) | 0) * GW + ((x / BLOCK) | 0)] ?? 0;

const png = new PNG({ width: W, height: H });

for (let y = 0; y < H; y++) {
  const ty = y / (H - 1);

  // Sky: bright, slightly warm at the horizon. Ground: deep and cool.
  const horizon = 0.52;
  let r;
  let g;
  let b;
  if (ty < horizon) {
    const t = ty / horizon;
    r = lerp(196, 244, t);
    g = lerp(214, 226, t);
    b = lerp(236, 198, t);
  } else {
    const t = (ty - horizon) / (1 - horizon);
    r = lerp(58, 16, t);
    g = lerp(62, 20, t);
    b = lerp(54, 22, t);
  }

  for (let x = 0; x < W; x++) {
    const tx = x / (W - 1);
    let rr = r;
    let gg = g;
    let bb = b;

    // Low sun: a soft warm disc in the upper right, so one corner is very bright.
    const dx = (tx - 0.72) * W;
    const dy = (ty - 0.3) * H;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.max(0, 1 - dist / 520) ** 2;
    rr += glow * 58;
    gg += glow * 44;
    bb += glow * 10;

    // Two ridge lines, so the middle band is visually busy (a real photo's worst case).
    const ridge1 = horizon - 0.05 + 0.028 * Math.sin(tx * 7.1) + 0.014 * Math.sin(tx * 17.3 + 1.2);
    const ridge2 = horizon + 0.07 + 0.02 * Math.sin(tx * 4.3 + 2.1);
    if (ty > ridge1 && ty < ridge2) {
      rr *= 0.42;
      gg *= 0.48;
      bb *= 0.44;
    } else if (ty >= ridge2) {
      const shade = 0.9 + 0.1 * Math.sin(tx * 23 + ty * 40);
      rr *= shade;
      gg *= shade;
      bb *= shade;
    }

    // Grain in 4x4 blocks so nothing is a flat colour, but the PNG still compresses.
    // (Per-pixel noise is incompressible and produced a 4.3 MB fixture.)
    const n = grainAt(x, y);

    const i = (y * W + x) << 2;
    png.data[i] = clamp255(rr + n);
    png.data[i + 1] = clamp255(gg + n);
    png.data[i + 2] = clamp255(bb + n);
    png.data[i + 3] = 255;
  }
}

mkdirSync(dirname(OUT), { recursive: true });
const buf = PNG.sync.write(png, { deflateLevel: 9, filterType: -1 });
writeFileSync(OUT, buf);
console.log(`wrote ${OUT} (${(buf.length / 1024).toFixed(0)} KB, ${W}x${H})`);
