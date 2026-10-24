/**
 * <NoteProps> — right panel when ONE note is selected.
 * Title, color, position/size, the task list (tick tasks off here), and actions.
 *
 * Props: note, groupTitle, onChange(changes), onEdit(), onTogglePin(), onToggleComplete(),
 *        onToggleTask(index, done), onDelete()
 */
import { useEffect, useRef, useState } from 'react';
import { MIN_Y, NOTE_MIN } from '../../lib/constants.js';
import { parseChecklist } from '../../lib/noteUtils.js';
import { NOTE_SWATCHES } from '../../lib/palette.js';
import ColorSwatches from '../ui/ColorSwatches.jsx';
import NumberField from '../ui/NumberField.jsx';
import PanelSection from './PanelSection.jsx';

export default function NoteProps({ note, groupTitle, onChange, onEdit, onTogglePin, onToggleComplete, onToggleTask, onDelete }) {
  const [title, setTitle] = useState(note.title);
  const cancelled = useRef(false);
  useEffect(() => { setTitle(note.title); }, [note.id, note.title]);
  const tasks = parseChecklist(note.checklist);
  const done = tasks.filter((task) => task.done).length;

  const commitTitle = () => {
    if (cancelled.current) { cancelled.current = false; setTitle(note.title); return; }
    const next = title.trim() || 'Untitled';
    if (next !== note.title) onChange({ title: next });
  };

  return (
    <>
      <PanelSection title="Note">
        <input
          className="panel-input" aria-label="Note title" value={title} maxLength={120}
          onChange={(event) => setTitle(event.target.value)} onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            else if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur(); }
          }}
        />
        {groupTitle && <p className="panel-hint">In “{groupTitle}”</p>}
      </PanelSection>

      <PanelSection title="Color">
        <ColorSwatches colors={NOTE_SWATCHES} value={note.color} onPick={(color) => onChange({ color })} />
      </PanelSection>

      <PanelSection title="Position and size">
        <div className="num-grid">
          <NumberField label="X" value={note.x} min={0} onCommit={(x) => onChange({ x })} />
          <NumberField label="Y" value={note.y} min={MIN_Y} onCommit={(y) => onChange({ y })} />
          <NumberField label="W" value={note.w} min={NOTE_MIN.w} onCommit={(w) => onChange({ w })} />
          <NumberField label="H" value={note.h} min={NOTE_MIN.h} onCommit={(h) => onChange({ h })} />
        </div>
      </PanelSection>

      <PanelSection title={tasks.length ? `Tasks  ${done}/${tasks.length}` : 'Tasks'}>
        {tasks.length === 0 && <p className="panel-hint">No tasks yet. Use “Edit details…” to add some.</p>}
        <ul className="task-list">
          {tasks.map((task, index) => (
            <li key={index} className={task.done ? 'done' : ''}>
              <label>
                <input type="checkbox" checked={!!task.done} onChange={(event) => onToggleTask(index, event.target.checked)} />
                <span>{task.text}</span>
              </label>
            </li>
          ))}
        </ul>
        {(note.due || note.reminderAt) && (
          <p className="panel-hint">
            {note.due && <>Due {note.due}. </>}
            {note.reminderAt && <>Reminder {new Date(note.reminderAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}.</>}
          </p>
        )}
      </PanelSection>

      <PanelSection title="Actions">
        <button type="button" className="panel-button wide" onClick={onEdit}>Edit details…</button>
        <div className="panel-buttons">
          <button type="button" className="panel-button" onClick={onTogglePin}>{note.pinned ? 'Unpin' : 'Pin to desktop'}</button>
          <button type="button" className="panel-button" onClick={onToggleComplete}>{note.completed ? 'Reopen' : 'Complete'}</button>
        </div>
        <button type="button" className="panel-button wide danger" onClick={onDelete}>Delete note</button>
      </PanelSection>
    </>
  );
}
