/**
 * <ChecklistEditor> — the editable task list inside the note editor.
 * Controlled component: it never stores anything itself.
 *
 * Props:
 *   items     [{ text: string, done: boolean }, ...]
 *   onChange  called with the NEW array whenever the user edits, adds or removes an item
 */
export default function ChecklistEditor({ items, onChange }) {
  /** Change fields of one item, keeping the others as they are. */
  const update = (index, changes) =>
    onChange(items.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)));

  return (
    <section className="check-section">
      <div className="section-label">
        CHECKLIST <button type="button" onClick={() => onChange([...items, { text: 'New task', done: false }])}>＋ Add item</button>
      </div>
      {items.map((item, index) => (
        <div className="check-row" key={index}>
          <input
            type="checkbox" checked={!!item.done}
            aria-label={`Complete checklist item ${index + 1}: ${item.text}`}
            onChange={(event) => update(index, { done: event.target.checked })}
          />
          <input
            className="check-text-input" aria-label={`Checklist item ${index + 1} text`}
            value={item.text} onChange={(event) => update(index, { text: event.target.value })}
          />
          <button type="button" aria-label={`Remove checklist item ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>×</button>
        </div>
      ))}
    </section>
  );
}
