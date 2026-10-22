/**
 * <NoteEditor> — the dialog for creating/editing one note.
 * Used in the workspace AND inside a pinned note window.
 *
 * It edits a private copy (`draft`). Nothing is saved until "Save note".
 *
 * Props:
 *   note        the note to edit (a new note has id null)
 *   regions     groups/frames, for the Group picker
 *   onCancel()  close without saving
 *   onSave(draft)      resolves to the saved note, or null on failure
 *   onDelete(draft), onComplete(draft)   action buttons
 *   onPin(draft)  the pin button: `draft.pinned` is ALREADY flipped to the wanted value
 *   onNotify(text)     show a short message
 */
import { useState } from 'react';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { parseChecklist } from '../../lib/noteUtils.js';
import Modal from '../ui/Modal.jsx';
import ModalHeader from '../ui/ModalHeader.jsx';
import ChecklistEditor from './ChecklistEditor.jsx';
import ScheduleFields from './ScheduleFields.jsx';

export default function NoteEditor({ note, regions, onCancel, onSave, onDelete, onPin, onComplete, onNotify }) {
  const [draft, setDraft] = useState({ ...note });
  const [checklist, setChecklist] = useState(() => parseChecklist(note.checklist));
  const [busy, setBusy] = useState(false);

  /** Merge changes into the draft. */
  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }));
  /** The draft with the checklist array converted back to the JSON string Rust stores. */
  const withChecklist = (extra = {}) => ({ ...draft, ...extra, checklist: JSON.stringify(checklist) });

  /** Validates, asks notification permission if a reminder is set, then saves. */
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    if (draft.recurrence && !draft.due) {
      onNotify('Add a due date before setting this task to repeat.');
      setBusy(false);
      return;
    }
    if (draft.reminderAt) {
      try {
        let permission = await isPermissionGranted();
        if (!permission) permission = (await requestPermission()) === 'granted';
        if (!permission) {
          onNotify('Allow notifications in your system settings to use reminders.');
          setBusy(false);
          return;
        }
      } catch (cause) {
        onNotify(`Could not enable reminders: ${cause}`);
        setBusy(false);
        return;
      }
    }
    const saved = await onSave({
      ...draft,
      title: draft.title.trim() || 'Untitled',
      due: draft.due || null,
      recurrence: draft.recurrence || null,
      reminderAt: draft.reminderAt || null,
      checklist: JSON.stringify(checklist),
    });
    setBusy(false);
    if (!saved) onNotify('Your edits are still open; retry saving when ready.');
  };

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit}>
        <ModalHeader eyebrow="YOUR NOTE" closeLabel="Close editor" onClose={onCancel} />
        <input autoFocus className="title-input" aria-label="Note title" value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="A thought to keep" maxLength={120} />
        <div className="formatbar">
          <span className="editor-help">Note</span>
          <span className="bar-spacer" />
          <label className="color-pick" title="Note color"><input type="color" value={draft.color} onChange={(event) => patch({ color: event.target.value })} /></label>
        </div>
        <textarea className="note-body note-textarea" aria-label="Note body" value={draft.body.replace(/<[^>]*>/g, '')} onChange={(event) => patch({ body: event.target.value })} placeholder="Write it down…" />
        <ChecklistEditor items={checklist} onChange={setChecklist} />
        <ScheduleFields draft={draft} patch={patch} regions={regions} />
        <div className="editor-actions">
          <button type="button" className="danger" onClick={() => { if (!draft.id || window.confirm(`Delete “${draft.title || 'Untitled'}” permanently?`)) onDelete(draft); }}>Delete</button>
          {draft.id && onComplete && (
            <button type="button" className="quiet-btn" onClick={() => onComplete(withChecklist())}>{draft.completed ? 'Reopen task' : 'Mark complete'}</button>
          )}
          <span className="bar-spacer" />
          <button type="button" className="quiet-btn" onClick={() => onPin(withChecklist({ pinned: !draft.pinned }))}>{draft.pinned ? 'Unpin from desktop' : 'Pin to desktop'}</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button>
        </div>
      </form>
    </Modal>
  );
}
