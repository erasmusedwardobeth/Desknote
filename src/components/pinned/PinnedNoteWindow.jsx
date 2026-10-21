/**
 * <PinnedNoteWindow> — what a pinned note shows on your desktop.
 * This is the whole content of the small borderless window the Rust side opens
 * (src-tauri/src/window_manager.rs → create_pinned_window).
 *
 * Header = drag handle + "⋯" menu. Body = text + checklist. Footer = due / reminder / group.
 * "Edit note" swaps the view for the same <NoteEditor> used in the workspace.
 *
 * Prop: noteId — which note this window shows.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { completeNote, deleteNote, saveNote } from '../../api/notes.js';
import { setNotePinned, setNoteTitle, showWorkspace, toggleAlwaysOnTop, unpinNote } from '../../api/windows.js';
import { useBoardData } from '../../hooks/useBoardData.js';
import { nextOccurrence } from '../../lib/dates.js';
import { confirmAction } from '../../lib/dialogs.js';
import { parseChecklist, stripTags } from '../../lib/noteUtils.js';
import NoteEditor from '../editor/NoteEditor.jsx';
import PinIcon from '../ui/PinIcon.jsx';
import PopupMenu from '../ui/PopupMenu.jsx';
import Toast from '../ui/Toast.jsx';
import PinnedChecklist from './PinnedChecklist.jsx';

export default function PinnedNoteWindow({ noteId }) {
  const { notes, regions, error, reload } = useBoardData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');
  const dragRef = useRef(null);

  // Pinned windows are borderless, so provide explicit move and resize handles.
  // Geometry APIs use physical pixels; pointer screen coordinates use CSS pixels.
  const beginHeaderDrag = async (event) => {
    if (event.button !== 0 || event.target.closest('button, a, input, textarea, select')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = getCurrentWindow();
    const drag = {
      mode: 'move', pointerId: event.pointerId,
      startX: event.screenX, startY: event.screenY,
      latestX: event.screenX, latestY: event.screenY,
      originX: 0, originY: 0, scale: 1, current, ready: false, moved: false,
    };
    dragRef.current = drag;
    try {
      const [position, scale] = await Promise.all([current.outerPosition(), current.scaleFactor()]);
      if (dragRef.current !== drag) return;
      drag.originX = position.x;
      drag.originY = position.y;
      drag.scale = scale;
      drag.ready = true;
      moveWindowFromPointer(drag, drag.latestX, drag.latestY);
    } catch (cause) {
      if (dragRef.current === drag) dragRef.current = null;
      setToast(`Could not start moving note: ${cause}`);
    }
  };

  const beginResize = async (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = getCurrentWindow();
    const drag = {
      mode: 'resize', pointerId: event.pointerId,
      startX: event.screenX, startY: event.screenY,
      latestX: event.screenX, latestY: event.screenY,
      originW: 0, originH: 0, scale: 1, current, ready: false,
    };
    dragRef.current = drag;
    try {
      const [size, scale] = await Promise.all([current.outerSize(), current.scaleFactor()]);
      if (dragRef.current !== drag) return;
      drag.originW = size.width;
      drag.originH = size.height;
      drag.scale = scale;
      drag.ready = true;
      resizeWindowFromPointer(drag, drag.latestX, drag.latestY);
    } catch (cause) {
      if (dragRef.current === drag) dragRef.current = null;
      setToast(`Could not start resizing note: ${cause}`);
    }
  };

  const moveWindowFromPointer = (drag, screenX, screenY) => {
    const dx = screenX - drag.startX;
    const dy = screenY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (!drag.ready || !drag.moved) return;
    drag.current.setPosition(new PhysicalPosition(
      Math.round(drag.originX + dx * drag.scale),
      Math.round(drag.originY + dy * drag.scale),
    )).catch((cause) => setToast(`Could not move note: ${cause}`));
  };

  const resizeWindowFromPointer = (drag, screenX, screenY) => {
    if (!drag.ready) return;
    const dx = screenX - drag.startX;
    const dy = screenY - drag.startY;
    const minW = Math.round(250 * drag.scale);
    const minH = Math.round(180 * drag.scale);
    drag.current.setSize(new PhysicalSize(
      Math.max(minW, Math.round(drag.originW + dx * drag.scale)),
      Math.max(minH, Math.round(drag.originH + dy * drag.scale)),
    )).catch((cause) => setToast(`Could not resize note: ${cause}`));
  };

  const moveHeaderDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.latestX = event.screenX;
    drag.latestY = event.screenY;
    if (drag.mode === 'resize') resizeWindowFromPointer(drag, event.screenX, event.screenY);
    else moveWindowFromPointer(drag, event.screenX, event.screenY);
  };

  const endHeaderDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const note = notes.find((item) => item.id === noteId);
  const checks = useMemo(() => parseChecklist(note?.checklist), [note?.checklist]);

  // Keep the OS window title equal to the note title.
  useEffect(() => {
    if (note) setNoteTitle(noteId, note.title || 'Desknote note').catch(() => {});
  }, [note, noteId]);

  const save = async (draft) => {
    try {
      const saved = await saveNote(draft);
      await reload();
      setEditing(false);
      return saved;
    } catch (cause) { setToast(`Could not save: ${cause}`); return null; }
  };

  const unpin = async (draft = note) => {
    try {
      await saveNote({ ...draft, pinned: false });
      await setNotePinned(noteId, false); // also closes this window
    } catch (cause) { setToast(String(cause)); }
  };

  const toggleChecklistItem = async (index, done) => {
    const updated = checks.map((item, itemIndex) => (itemIndex === index ? { ...item, done } : item));
    await save({ ...note, checklist: JSON.stringify(updated) });
  };

  /** "Mark complete" from the editor. (Fixed: the old version used an undefined `checklist` variable.) */
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
    <article className="pinned-note-window" style={{ background: note.color }}>
      <header
        className="pinned-note-header"
        onPointerDown={beginHeaderDrag}
        onPointerMove={moveHeaderDrag}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <span className="pinned-note-title">{note.title || 'Untitled'}</span>
        <button
          className="pin-toggle" title="Pinned to desktop — click to unpin" aria-label="Unpin from desktop"
          onClick={async () => { if (await confirmAction(`Unpin “${note.title || 'Untitled'}” from the desktop?`)) unpin(note); }}
        ><PinIcon /></button>
        <button className="note-ellipsis" aria-label="Note actions" onClick={() => setMenuOpen((value) => !value)}>⋯</button>
      </header>
      <div className="pinned-note-body">
        {stripTags(note.body)}
        <PinnedChecklist items={checks} onToggle={toggleChecklistItem} />
      </div>
      <button
        className="pinned-note-resize-handle"
        aria-label="Resize pinned note"
        title="Drag to resize"
        onPointerDown={beginResize}
        onPointerMove={moveHeaderDrag}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      />
      <footer className="pinned-note-footer">
        {note.due && <span>◷ {note.due}</span>}
        {note.reminderAt && <span>⏰ {new Date(note.reminderAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>}
        {groupTitle && <span>↗ {groupTitle}</span>}
        {note.completed && <span>Completed</span>}
      </footer>
      {menuOpen && (
        <PopupMenu className="pinned-note-menu" stopPointer={false} items={[
          { label: 'Open workspace', onClick: () => showWorkspace().catch((cause) => setToast(String(cause))) },
          { label: 'Edit note', onClick: () => setEditing(true) },
          { label: 'Unpin from desktop', onClick: () => unpin(note) },
          {
            label: note.alwaysOnTop ? 'Sit on the desktop layer' : 'Float above windows',
            onClick: async () => { try { await toggleAlwaysOnTop(noteId); await reload(); } catch (cause) { setToast(String(cause)); } },
          },
        ]} />
      )}
      <Toast message={toast} inline />
    </article>
  );
}
