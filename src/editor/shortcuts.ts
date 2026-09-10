// Desktop keyboard shortcuts — Appendix D.
//
// Registered on the window, but deliberately inert while the user is typing: an editor that
// deletes your selected layer because you pressed Backspace in a text field is worse than
// one with no shortcuts at all.
import type { Measure } from "../model/reflow";
import type { EditorState } from "./store";

export interface ShortcutContext {
  store: () => EditorState;
  measure: Measure;
  undo: () => void;
  redo: () => void;
  onExportImage: () => void;
  onAddText: () => void;
  onAddStat: () => void;
  onAddRoute: () => void;
  onToggleShortcutHelp: () => void;
  onFit: () => void;
  onZoom: (delta: number) => void;
  /**
   * Canvas units per CSS pixel of the stage, so a nudge can be expressed in what the user
   * can see. The document is 1000 units wide but the stage is about 330 px on a phone, so
   * nudging by one unit moved a layer a third of a pixel — recorded in the document, and
   * invisible. Reported, reasonably, as "the arrow keys do nothing".
   */
  unitsPerPx: () => number;
}

/** True when a keystroke belongs to whatever the user is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export interface Shortcut {
  keys: string;
  action: string;
}

/** Shown by the "?" overlay. Mirrors Appendix D. */
export const SHORTCUTS: Shortcut[] = [
  { keys: "T", action: "Add text" },
  { keys: "S", action: "Add stat" },
  { keys: "R", action: "Add route" },
  { keys: "⌘Z / ⇧⌘Z", action: "Undo / redo" },
  { keys: "⌘D", action: "Duplicate" },
  { keys: "⌫", action: "Delete layer" },
  { keys: "⌘A", action: "Select all" },
  { keys: "Arrows", action: "Nudge by a pixel" },
  { keys: "⇧Arrows", action: "Nudge by ten pixels" },
  { keys: "⌘] / ⌘[", action: "Bring forward / send back" },
  { keys: "⌘⇧] / ⌘⇧[", action: "To front / to back" },
  { keys: "⌘L", action: "Lock / unlock" },
  { keys: "⌘E", action: "Export image" },
  { keys: "⌘0 / ⌘+ / ⌘−", action: "Fit / zoom in / zoom out" },
  { keys: ";", action: "Toggle safe zones" },
  { keys: "Enter", action: "Edit text inline" },
  { keys: "Esc", action: "Deselect" },
  { keys: "?", action: "This list" },
];

export function handleShortcut(event: KeyboardEvent, ctx: ShortcutContext): boolean {
  const state = ctx.store();

  // While the inline text editor is open, only Escape means anything here.
  if (state.editingTextId !== null) return false;
  if (isTypingTarget(event.target)) return false;

  const mod = event.metaKey || event.ctrlKey;
  const shift = event.shiftKey;
  const key = event.key;
  const selected = state.selection;
  const single = selected[0];

  const consume = (fn: () => void): boolean => {
    event.preventDefault();
    fn();
    return true;
  };

  // --- with modifier ---
  if (mod) {
    switch (key.toLowerCase()) {
      case "z":
        return consume(() => (shift ? ctx.redo() : ctx.undo()));
      case "d":
        return selected.length > 0 ? consume(() => state.duplicateSelection()) : false;
      case "a":
        return consume(() => state.selectAll());
      case "e":
        return consume(ctx.onExportImage);
      case "l":
        return single
          ? consume(() =>
              state.patchLayer(single, (l) => {
                l.locked = !l.locked;
              }),
            )
          : false;
      case "]":
        return single ? consume(() => (shift ? state.toFront(single) : state.bringForward(single))) : false;
      case "[":
        return single ? consume(() => (shift ? state.toBack(single) : state.sendBackward(single))) : false;
      case "0":
        return consume(ctx.onFit);
      case "+":
      case "=":
        return consume(() => ctx.onZoom(0.2));
      case "-":
        return consume(() => ctx.onZoom(-0.2));
      default:
        return false;
    }
  }

  // --- without modifier ---
  switch (key) {
    case "Escape":
      return selected.length > 0 ? consume(() => state.clearSelection()) : false;
    case "Backspace":
    case "Delete":
      return selected.length > 0 ? consume(() => state.deleteSelection()) : false;
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowDown": {
      if (selected.length === 0) return false;
      // One press ≈ one pixel of the stage as displayed, ten with shift. Never zero: on a
      // wide desktop stage a screen pixel is worth less than a unit, and flooring the step
      // would make the keys dead again on exactly the displays that want precision.
      const step = Math.max(1, Math.round(ctx.unitsPerPx())) * (shift ? 10 : 1);
      const [dx, dy] =
        key === "ArrowLeft"
          ? [-step, 0]
          : key === "ArrowRight"
            ? [step, 0]
            : key === "ArrowUp"
              ? [0, -step]
              : [0, step];
      return consume(() => state.nudge(dx, dy));
    }
    case "Enter": {
      if (!single) return false;
      const layer = state.doc.layers.find((l) => l.id === single);
      return layer?.type === "text" ? consume(() => state.setEditingText(single)) : false;
    }
    case ";":
      return consume(() => state.toggleSafeZones());
    case "?":
      return consume(ctx.onToggleShortcutHelp);
    case "t":
    case "T":
      return consume(ctx.onAddText);
    case "s":
    case "S":
      return consume(ctx.onAddStat);
    case "r":
    case "R":
      return consume(ctx.onAddRoute);
    default:
      return false;
  }
}
