/**
 * <ShortcutList> — the table of keyboard shortcuts shown in Settings.
 * To document a new shortcut, add a row to SHORTCUTS below.
 * (The shortcuts themselves are implemented in hooks/useWorkspaceShortcuts.js
 *  and in NoteCard.jsx / RegionBox.jsx.)
 */
const SHORTCUTS = [
  ['Ctrl/⌘ + N', 'Create a note'],
  ['Ctrl/⌘ + D', 'Hide the workspace; pinned notes stay visible'],
  ['Enter', 'Edit the focused canvas note'],
  ['Arrow keys', 'Move the focused note or group/frame'],
  ['Shift + Arrow keys', 'Resize the focused note or group/frame'],
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
