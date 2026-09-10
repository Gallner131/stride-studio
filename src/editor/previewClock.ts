// The editing canvas's animation clock.
//
// This used to loop: `(elapsed % (animSeconds + 2.5)) / animSeconds`, so the count-up
// replayed every 8.5 seconds for as long as the tab was open. The hero number therefore
// showed a different distance every time you looked at it — reported twice, once as
// "I can't turn the animations off" and once as "the demo data is jittering". It was
// neither; it was a preview that never settled, which also made the canvas disagree with
// the exported image.
//
// The animation now plays once and holds at its final state. Replay (↻) restarts it by
// resetting the clock's origin, and the exported video is unaffected — it runs its own
// clock in src/export/video.ts.

/** Position in the animation, 0..1, clamped and monotonic. 1 means "settled". */
export function previewT(elapsedSeconds: number, animSeconds: number): number {
  // A non-finite or non-positive window has no meaningful midpoint; treat it as done.
  // This mirrors animAt()'s guard in src/engine/anim.ts, where t = Infinity is how
  // thumbnails, image export and "animation off" all ask for the settled state.
  if (!Number.isFinite(elapsedSeconds)) return elapsedSeconds < 0 ? 0 : 1;
  if (!(animSeconds > 0)) return 1;
  if (elapsedSeconds <= 0) return 0;
  return Math.min(1, elapsedSeconds / animSeconds);
}

/** True once the preview has stopped changing, so the render loop can stop redrawing. */
export function previewSettled(elapsedSeconds: number, animSeconds: number): boolean {
  return previewT(elapsedSeconds, animSeconds) >= 1;
}
