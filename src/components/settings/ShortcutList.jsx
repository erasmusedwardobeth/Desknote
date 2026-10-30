/**
 * <ShortcutList> — the table of keyboard shortcuts shown in Settings.
 * To document a new shortcut, add a row to SHORTCUTS below.
 * (The shortcuts themselves live in hooks/useWorkspaceShortcuts.js, hooks/useCanvasDrag.js
 *  and in NoteCard.jsx / RegionBox.jsx.)
 */
const SHORTCUTS = [
  ['Ctrl/⌘ + N', 'Create a note'],
  ['Ctrl/⌘ + A', 'Select everything in the open workspace'],
  ['Delete', 'Delete the selection'],
  ['F2', 'Rename the selection (or the workspace)'],
  ['Ctrl/⌘ + F', 'Search the layers panel'],
  ['Mouse wheel · Ctrl/⌘ + + / −', 'Zoom the selected note/group/frame, or the workspace when nothing is selected'],
  ['Ctrl/⌘ + 0 · Ctrl/⌘ + 1', 'Workspace 100% · zoom to fit'],
  ['Space + drag · middle button', 'Pan the workspace'],
  ['Shift + click · drag on empty space', 'Add to the selection · rectangle select'],
  ['Right-click', 'Menu for the note, group, frame, workspace or canvas'],
  ['Ctrl/⌘ + D', 'Hide the workspace; pinned notes stay visible'],
  ['Enter', 'Edit the focused canvas note'],
  ['Arrow keys · Shift + Arrow keys', 'Move · resize the focused note or group/frame'],
];

export default function ShortcutList() {
  return (
    <dl className="shortcut-list">
      {SHORTCUTS.map(([keys, action]) => (
        <div key={keys}><dt>{keys}</dt><dd>{action}</dd></div>
      ))}
    </dl>
  );
}
