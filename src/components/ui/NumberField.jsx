/**
 * <NumberField> — a small labelled number box (X, Y, W, H …).
 * Typing does nothing until you press Enter or leave the box; Esc puts the old value back.
 *
 * Props: label, value (number), onCommit(number), min (optional lowest allowed value)
 */
import { useEffect, useRef, useState } from 'react';

export default function NumberField({ label, value, onCommit, min }) {
  const shown = String(Math.round(value));
  const [text, setText] = useState(shown);
  const cancelled = useRef(false);
  useEffect(() => { setText(shown); }, [shown]);

  const commit = () => {
    if (cancelled.current) { cancelled.current = false; setText(shown); return; }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) { setText(shown); return; }
    const next = min != null ? Math.max(min, parsed) : parsed;
    setText(String(Math.round(next)));
    if (Math.round(next) !== Math.round(value)) onCommit(Math.round(next));
  };

  return (
    <label className="num-field">
      <span>{label}</span>
      <input
        type="text" inputMode="numeric" value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          else if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur(); }
        }}
      />
    </label>
  );
}
