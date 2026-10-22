/**
 * <PinnedNoteWindow> — what a pinned note shows on your desktop.
 * This is the whole content of the small borderless window the Rust side opens
 * (src-tauri/src/window_manager.rs → create_pinned_window).
 *
 * Header  = title + ✥ arrange + pin icon + "⋯" menu.   Body = text + checklist.
 *
 * MOVING / RESIZING = "ARRANGE MODE".
 *   A pinned note is a desktop-layer window, which window managers will not let you drag.
 *   Click ✥ (or "Move / resize" in the menu): Rust unlocks the window
 *   (pinned_edit_mode.rs), the header becomes a drag handle and edge handles appear
 *   (hooks/usePinnedWindowDrag.js → pinned_geometry.rs). Click Done (or press Esc) and the
 *   note goes back onto the desktop layer.
 *
 * UNPINNING: the pin icon asks "Unpin?" with <InlineConfirm> inside this window, because a
 * native dialog opened from a desktop-layer window can be hidden behind other windows.
 *
 * Prop: noteId — which note this window shows.
 */
import { useEffect, useMemo, useState } from 'react';
import { completeNote, deleteNote, saveNote } from '../../api/notes.js';
import { setPinnedEditMode } from '../../api/pinnedGeometry.js';
import { setNotePinned, setNoteTitle, showWorkspace, toggleAlwaysOnTop, unpinNote } from '../../api/windows.js';
import { useBoardData } from '../../hooks/useBoardData.js';
import { usePinnedWindowDrag } from '../../hooks/usePinnedWindowDrag.js';
import { nextOccurrence } from '../../lib/dates.js';
import { parseChecklist, stripTags } from '../../lib/noteUtils.js';
import NoteEditor from '../editor/NoteEditor.jsx';
import InlineConfirm from '../ui/InlineConfirm.jsx';
import PinIcon from '../ui/PinIcon.jsx';
import PopupMenu from '../ui/PopupMenu.jsx';
import Toast from '../ui/Toast.jsx';
import PinnedChecklist from './PinnedChecklist.jsx';
import '../../styles/pinned-interaction.css';

export default function PinnedNoteWindow({ noteId }) {
  const { notes, regions, error, reload } = useBoardData();
  const drag = usePinnedWindowDrag(noteId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [confirmingUnpin, setConfirmingUnpin] = useState(false);
  const [toast, setToast] = useState('');

  const note = notes.find((item) => item.id === noteId);
  const checks = useMemo(() => parseChecklist(note?.checklist), [note?.checklist]);

  // Keep the OS window title equal to the note title.
  useEffect(() => {
    if (note) setNoteTitle(noteId, note.title || 'Desknote note').catch(() => {});
  }, [note, noteId]);

  // Esc leaves arrange mode.
  useEffect(() => {
    if (!arranging) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') stopArranging(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Unlock the window so it can be moved and resized. */
  const startArranging = async () => {
    setMenuOpen(false);
    try {
      await setPinnedEditMode(noteId, true);
      setArranging(true);
    } catch (cause) { setToast(`Could not unlock the note for moving: ${cause}`); }
  };

  /** Lock the window back onto the desktop layer. */
  const stopArranging = async () => {
    setArranging(false);
    try { await setPinnedEditMode(noteId, false); }
    catch (cause) { setToast(`Could not return the note to the desktop layer: ${cause}`); }
  };

  const save = async (draft) => {
    try {
      const saved = await saveNote(draft);
      await reload();
      setEditing(false);
      return saved;
    } catch (cause) { setToast(`Could not save: ${cause}`); return null; }
  };

  /** Unpin = ONE state change in Rust (database + closing this window). */
  const unpin = async (draft = note) => {
    try {
      await saveNote({ ...draft, pinned: false }); // keep any edits from the editor
      await setNotePinned(noteId, false);          // closes this window
    } catch (cause) { setToast(`Could not unpin: ${cause}`); setConfirmingUnpin(false); }
  };

  const toggleChecklistItem = async (index, done) => {
    const updated = checks.map((item, itemIndex) => (itemIndex === index ? { ...item, done } : item));
    await save({ ...note, checklist: JSON.stringify(updated) });
  };

  /** "Mark complete" from the editor. */
  const complete = async (draft) => {
    if (draft.completed) { await save({ ...draft, completed: false }); return; }
    try {
      const nextDue = draft.recurrence && draft.due ? nextOccurrence(draft.due, draft.recurrence) : null;
      const repeated = await completeNote(draft, nextDue);
      await reload();
      setEditing(false);
      setToast(repeated ? 'Completed; next occurrence created.' : 'Moved to Completed.');
    } catch (cause) { setToast(`Could not complete task: ${cause}`); }
  };

  const remove = async () => {
    await deleteNote(noteId);
    await unpinNote(noteId);
  };

  if (!note) return <div className="pinned-note-window"><div className="pinned-note-loading">{error || 'Loading note…'}</div></div>;

  if (editing) {
    return (
      <div className="pinned-note-window">
        <NoteEditor note={note} regions={regions} onCancel={() => setEditing(false)} onSave={save} onDelete={remove} onPin={unpin} onComplete={complete} onNotify={setToast} />
        <Toast message={toast} />
      </div>
    );
  }

  const groupTitle = regions.find((item) => item.id === note.groupId)?.title;

  return (
    <article className={`pinned-note-window ${arranging ? 'arranging' : ''}`} style={{ background: note.color }}>
      <header className={`pinned-note-header ${arranging ? 'arranging' : ''}`} {...(arranging ? drag.move : {})}>
        <span className="pinned-note-title">{arranging ? 'Drag to move · drag edges to resize' : (note.title || 'Untitled')}</span>
        {arranging ? (
          <button className="primary pinned-done" onClick={stopArranging}>Done</button>
        ) : (
          <>
            <button className="pin-arrange" title="Move or resize this note" aria-label="Move or resize" onClick={startArranging}>✥</button>
            <button
              className="pin-toggle" title="Pinned to desktop — click to unpin" aria-label="Unpin from desktop"
              onClick={() => { setMenuOpen(false); setConfirmingUnpin(true); }}
            ><PinIcon /></button>
            <button className="note-ellipsis" aria-label="Note actions" onClick={() => setMenuOpen((value) => !value)}>⋯</button>
          </>
        )}
      </header>
      <div className="pinned-note-body">
        {stripTags(note.body)}
        <PinnedChecklist items={checks} onToggle={toggleChecklistItem} />
      </div>
      <footer className="pinned-note-footer">
        {note.due && <span>◷ {note.due}</span>}
        {note.reminderAt && <span>⏰ {new Date(note.reminderAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>}
        {groupTitle && <span>↗ {groupTitle}</span>}
        {note.completed && <span>Completed</span>}
      </footer>
      {menuOpen && (
        <PopupMenu className="pinned-note-menu" stopPointer={false} items={[
          { label: 'Move / resize', onClick: startArranging },
          { label: 'Open workspace', onClick: () => showWorkspace().catch((cause) => setToast(String(cause))) },
          { label: 'Edit note', onClick: () => { setMenuOpen(false); setEditing(true); } },
          { label: 'Unpin from desktop', onClick: () => { setMenuOpen(false); setConfirmingUnpin(true); } },
          {
            label: note.alwaysOnTop ? 'Sit on the desktop layer' : 'Float above windows',
            onClick: async () => { try { await toggleAlwaysOnTop(noteId); await reload(); } catch (cause) { setToast(String(cause)); } },
          },
        ]} />
      )}
      {arranging && (
        <>
          <div className="pinned-resize right" {...drag.resizeRight} />
          <div className="pinned-resize bottom" {...drag.resizeBottom} />
          <div className="pinned-resize corner" {...drag.resizeCorner} aria-label="Resize note" />
        </>
      )}
      {confirmingUnpin && (
        <InlineConfirm
          message={`Unpin “${note.title || 'Untitled'}” from the desktop?`}
          confirmLabel="Unpin" onCancel={() => setConfirmingUnpin(false)} onConfirm={() => unpin(note)}
        />
      )}
      <Toast message={toast} inline />
    </article>
  );
}
