import { describe, expect, it } from "vitest";
import { handleShortcut, type ShortcutContext } from "../../src/editor/shortcuts";
import type { EditorState } from "../../src/editor/store";

// Arrow-key nudge was reported as "doesn't work". It did work — it moved the layer by one
// canvas unit, which is 1/1000 of the canvas width. On a phone the stage is about 330 CSS
// px wide, so one press moved the layer a third of a pixel: real, recorded in the document,
// and completely invisible. The tell was in the e2e suite, where the existing nudge test had
// to press Shift+ArrowRight twelve times (120 units) before it could detect any change.
//
// The step is now defined in screen pixels and converted, so one press always moves the
// layer about one pixel of the stage as the user actually sees it.

// The unit suite runs in node (vitest.config.mts), where HTMLElement does not exist, and
// isTypingTarget does an `instanceof HTMLElement` check. Shim the constructor so that check
// runs for real and returns false for these plain event objects, rather than throwing.
// Adding jsdom instead would mean a new dependency and a §11.1 row for one branch.
(globalThis as { HTMLElement?: unknown }).HTMLElement ??= class {};

function keyEvent(key: string, mods: { shift?: boolean } = {}): KeyboardEvent {
  return {
    key,
    shiftKey: mods.shift ?? false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

function contextWith(unitsPerPx: number) {
  const nudges: Array<[number, number]> = [];
  const state = {
    editingTextId: null,
    selection: ["ly_one"],
    doc: { layers: [{ id: "ly_one", type: "text" }] },
    nudge: (dx: number, dy: number) => nudges.push([dx, dy]),
  } as unknown as EditorState;

  const ctx = {
    store: () => state,
    unitsPerPx: () => unitsPerPx,
  } as unknown as ShortcutContext;

  return { ctx, nudges };
}

describe("arrow-key nudge", () => {
  // 1000 canvas units across a ~330 px stage is roughly 3 units per screen pixel.
  const PHONE = 1000 / 330;

  it("moves about one screen pixel per press, not one canvas unit", () => {
    const { ctx, nudges } = contextWith(PHONE);
    handleShortcut(keyEvent("ArrowRight"), ctx);
    expect(nudges).toEqual([[3, 0]]);
  });

  it("moves about ten screen pixels with shift", () => {
    const { ctx, nudges } = contextWith(PHONE);
    handleShortcut(keyEvent("ArrowRight", { shift: true }), ctx);
    expect(nudges).toEqual([[30, 0]]);
  });

  it("nudges the other three directions with the same step", () => {
    const { ctx, nudges } = contextWith(PHONE);
    handleShortcut(keyEvent("ArrowLeft"), ctx);
    handleShortcut(keyEvent("ArrowUp"), ctx);
    handleShortcut(keyEvent("ArrowDown"), ctx);
    expect(nudges).toEqual([
      [-3, 0],
      [0, -3],
      [0, 3],
    ]);
  });

  // On a large desktop stage a screen pixel is worth less than one canvas unit. Rounding
  // must not floor the step to zero, or the keys go dead again on exactly the displays
  // where people expect precision.
  it("never rounds the step down to nothing on a wide display", () => {
    const { ctx, nudges } = contextWith(0.4);
    handleShortcut(keyEvent("ArrowRight"), ctx);
    expect(nudges).toEqual([[1, 0]]);
  });

  it("still does nothing when there is no selection", () => {
    const { ctx, nudges } = contextWith(PHONE);
    const state = ctx.store() as unknown as { selection: string[] };
    state.selection = [];
    expect(handleShortcut(keyEvent("ArrowRight"), ctx)).toBe(false);
    expect(nudges).toEqual([]);
  });
});
