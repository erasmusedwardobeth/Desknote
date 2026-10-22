/**
 * <PopupMenu> — the small floating "⋯" menu (note card, group/frame, pinned note).
 *
 * Props:
 *   items       [{ label: 'Edit note', onClick: fn }, ...]
 *   className   'card-menu' (default) or 'pinned-note-menu' … picks the CSS look/position
 *   stopPointer true (default) = clicks inside do not start a drag on the canvas behind
 */
export default function PopupMenu({ items, className = 'card-menu', stopPointer = true }) {
  return (
    <div
      className={className}
      role="menu"
      onPointerDown={stopPointer ? (event) => event.stopPropagation() : undefined}
    >
      {items.map((item) => (
        <button key={item.label} role="menuitem" onClick={item.onClick}>{item.label}</button>
      ))}
    </div>
  );
}
