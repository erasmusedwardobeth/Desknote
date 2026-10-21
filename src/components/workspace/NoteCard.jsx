/**
 * <NoteCard> — one sticky note on the canvas.
 *
 * Shows title, a text preview, group/due/reminder info, a "⋯" menu and a resize handle.
 * It does no saving itself: it reports what the user did through the props below.
 *
 * Props:
 *   note            the note object
 *   groupTitle      name of the group the note belongs to (or undefined)
 *   menuOpen        is this note's "⋯" menu open?
 *   onToggleMenu    open/close the menu
 *   onEdit(note)    open the editor
 *   onPinToggle(note), onComplete(note), onDelete(note)   menu actions
 *   onUnpin(note)   called after the user confirms the pin icon's "Unpin?" question
 *   onNudge(updatedNote)   keyboard move/resize finished
 *   onDragStart(event, note, mode), onDragMove, onDragEnd   from useCanvasDrag
 */
import { NOTE_MIN } from '../../lib/constants.js';
import { nudged } from '../../lib/nudge.js';
import { stripTags } from '../../lib/noteUtils.js';
import { confirmAction } from '../../lib/dialogs.js';
import PinIcon from '../ui/PinIcon.jsx';
import PopupMenu from '../ui/PopupMenu.jsx';

export default function NoteCard({ note, groupTitle, menuOpen, onToggleMenu, onEdit, onPinToggle, onUnpin, onComplete, onDelete, onNudge, onDragStart, onDragMove, onDragEnd }) {
  const title = note.title || 'Untitled';

  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onEdit(note);
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      onNudge(nudged(note, event.key, event.shiftKey, NOTE_MIN));
    }
  };

  return (
    <article
      className={`note-card ${note.pinned ? 'is-pinned' : ''} ${note.completed ? 'is-completed' : ''}`}
      role="group"
      tabIndex={0}
      aria-label={`Note: ${title}. Enter to edit; arrow keys to move; Shift plus arrow keys to resize.`}
      data-id={note.id}
      style={{ left: note.x, top: note.y, width: note.w, height: note.h, background: note.color }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => onDragStart(event, note)}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onDoubleClick={() => onEdit(note)}
      onContextMenu={(event) => { event.preventDefault(); onEdit(note); }}
    >
      <div className="card-title">
        {title}
        {note.completed && <span className="complete-label">Completed</span>}
      </div>
      <div className="card-body">{stripTags(note.body).slice(0, 150)}</div>
      <div className="card-meta">
        {groupTitle && <span>↗ {groupTitle}</span>}
        {note.due && <span>◷ {note.due}</span>}
        {note.reminderAt && (
          <span aria-label={`Reminder ${new Date(note.reminderAt).toLocaleString()}`}>
            ⏰ {new Date(note.reminderAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        )}
      </div>
      {note.pinned && (
        <button
          className="pin-toggle"
          title="Pinned to desktop — click to unpin"
          aria-label={`Unpin ${title} from the desktop`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={async (event) => {
            event.stopPropagation();
            if (await confirmAction(`Unpin “${title}” from the desktop?`)) onUnpin(note);
          }}
        ><PinIcon /></button>
      )}
      <button
        className="card-menu-trigger"
        aria-label={`Actions for ${title}`}
        aria-expanded={menuOpen}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onToggleMenu(); }}
      >⋯</button>
      {menuOpen && (
        <PopupMenu items={[
          { label: 'Edit note', onClick: () => onEdit(note) },
          { label: note.pinned ? 'Unpin from desktop' : 'Pin to desktop', onClick: () => onPinToggle(note) },
          { label: note.completed ? 'Reopen task' : 'Mark complete', onClick: () => onComplete(note) },
          { label: 'Delete note', onClick: () => { if (window.confirm(`Delete “${title}” permanently?`)) onDelete(note); } },
        ]} />
      )}
      <button className="resize-handle" aria-label={`Resize ${note.title || 'note'}`} onPointerDown={(event) => onDragStart(event, note, 'resize')} />
    </article>
  );
}
