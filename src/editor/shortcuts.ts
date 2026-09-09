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
  { keys: "Arrows", action: "Nudge 1 unit" },
  { keys: "⇧Arrows", action: "Nudge 10 units" },
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
      return selected.length > 0 ? consume(() => state.nudge(shift ? -10 : -1, 0)) : false;
    case "ArrowRight":
      return selected.length > 0 ? consume(() => state.nudge(shift ? 10 : 1, 0)) : false;
    case "ArrowUp":
      return selected.length > 0 ? consume(() => state.nudge(0, shift ? -10 : -1)) : false;
    case "ArrowDown":
      return selected.length > 0 ? consume(() => state.nudge(0, shift ? 10 : 1)) : false;
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
