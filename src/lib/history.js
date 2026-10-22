/**
 * history.js — undo / redo. Pure (no React, no Tauri).
 *
 * Every user action is recorded as an ENTRY:
 *   { label: 'Move note', before: [patch…], after: [patch…], mergeKey?: 'move:note:5' }
 * A PATCH describes one change to one object:
 *   { op: 'update', kind: 'note'|'region', id, props: { x: 10, y: 20 } }
 *   { op: 'create', kind, id, props: { …full object… } }
 *   { op: 'delete', kind, id }
 * Undo applies `before`, redo applies `after`. This module only keeps the stacks;
 * the caller applies the patches (and saves them through api/*.js).
 *
 * MERGING: while dragging, many small moves arrive. Entries with the same `mergeKey`
 * pushed within `mergeWindowMs` of each other collapse into ONE undo step (the oldest
 * `before` and the newest `after` are kept).
 */
export function createHistory({ limit = 100, mergeWindowMs = 600 } = {}) {
  let undoStack = [];
  let redoStack = [];

  return {
    /** Records a new action. `now` is only injectable for tests. */
    push(entry, now = Date.now()) {
      const top = undoStack[undoStack.length - 1];
      redoStack = [];
      if (top && entry.mergeKey && top.mergeKey === entry.mergeKey && now - top.at <= mergeWindowMs) {
        top.after = entry.after;
        top.at = now;
        return;
      }
      undoStack.push({ ...entry, at: now });
      if (undoStack.length > limit) undoStack = undoStack.slice(undoStack.length - limit);
    },
    /** Takes the latest entry off the undo stack (caller applies entry.before), or null. */
    undo() {
      const entry = undoStack.pop();
      if (!entry) return null;
      redoStack.push(entry);
      return entry;
    },
    /** Takes the latest undone entry back (caller applies entry.after), or null. */
    redo() {
      const entry = redoStack.pop();
      if (!entry) return null;
      undoStack.push(entry);
      return entry;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    /** Label of the action Ctrl+Z would undo (for the menu "Undo Move note"). */
    nextUndoLabel: () => undoStack[undoStack.length - 1]?.label ?? null,
    nextRedoLabel: () => redoStack[redoStack.length - 1]?.label ?? null,
    clear() { undoStack = []; redoStack = []; },
  };
}
