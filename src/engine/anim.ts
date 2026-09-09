// Animation model — §5.8. Per-layer presets resolved to a transform at time t.
import type { Anim, Layer } from "../model/types";

export type Ease = Anim["ease"];

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

export const EASES: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  // A settled approximation of a spring: overshoots once, then resolves.
  spring: (t) => {
    if (t >= 1) return 1;
    return 1 - 2 ** (-8 * t) * Math.cos(t * Math.PI * 2.2);
  },
};

export interface AnimState {
  opacity: number;
  dx: number;
  dy: number;
  scale: number;
  /** 0..1 progress for count-up and typewriter. */
  progress: number;
}

export const STATIC_ANIM: AnimState = { opacity: 1, dx: 0, dy: 0, scale: 1, progress: 1 };

/** Stagger for `delay: "auto"` — index x 0.12s. §5.8 */
export const autoDelay = (index: number): number => index * 0.12;

export function animAt(layer: Layer, index: number, t: number, reducedMotion = false): AnimState {
  const { anim } = layer;
  if (anim.preset === "none" || reducedMotion) return STATIC_ANIM;

  const delay = anim.delay === "auto" ? autoDelay(index) : anim.delay;
  const duration = Math.max(0.001, anim.duration);
  const raw = clamp01((t - delay) / duration);
  const e = EASES[anim.ease](raw);

  const SLIDE = 60;

  switch (anim.preset) {
    case "fadeIn":
      return { ...STATIC_ANIM, opacity: e, progress: raw };
    case "slideUp":
      return { opacity: e, dx: 0, dy: (1 - e) * SLIDE, scale: 1, progress: raw };
    case "slideDown":
      return { opacity: e, dx: 0, dy: -(1 - e) * SLIDE, scale: 1, progress: raw };
    case "slideLeft":
      return { opacity: e, dx: (1 - e) * SLIDE, dy: 0, scale: 1, progress: raw };
    case "slideRight":
      return { opacity: e, dx: -(1 - e) * SLIDE, dy: 0, scale: 1, progress: raw };
    case "scaleIn":
      return { opacity: e, dx: 0, dy: 0, scale: 0.85 + 0.15 * e, progress: raw };
    case "countUp":
    case "typewriter":
      return { ...STATIC_ANIM, progress: e };
    case "pulse": {
      // Entrance first, then a slow loop from 2.5s.
      if (t < 2.5) return { ...STATIC_ANIM, opacity: e, progress: raw };
      const phase = (t - 2.5) * 1.6;
      return { ...STATIC_ANIM, scale: 1 + 0.03 * Math.sin(phase) };
    }
    default:
      return STATIC_ANIM;
  }
}

/** Applies typewriter progress to a resolved string. */
export const typewriter = (text: string, progress: number): string =>
  progress >= 1 ? text : text.slice(0, Math.ceil(text.length * progress));
