/**
 * <PinnedChecklist> — read-mostly checklist shown on a pinned desktop note.
 * Ticking a box calls onToggle(index, done).
 */
export default function PinnedChecklist({ items, onToggle }) {
  if (!items.length) return null;
  return (
    <ul className="pinned-checklist">
      {items.map((item, index) => (
        <li key={index} className={item.done ? 'done' : ''}>
          <label>
            <input type="checkbox" checked={!!item.done} onChange={(event) => onToggle(index, event.target.checked)} aria-label={`${item.done ? 'Reopen' : 'Complete'} ${item.text}`} />
            <span>{item.text}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
