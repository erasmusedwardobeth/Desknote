import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import './style.css';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const escapeText = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const defaultNote = (index = 0) => ({
  id: null, title: '', body: '', x: 100 + (index % 4) * 40, y: 100 + (index % 3) * 40,
  w: 250, h: 210, color: ['#fff1a8', '#ffd9cf', '#d9f2df', '#dce9ff', '#f0ddff'][index % 5],
  pinned: false, due: null, recurrence: null, checklist: '[]', formatting: '{}', groupId: null,
  created: null, updated: null,
});
const noteWindowId = Number(new URLSearchParams(location.search).get('note')) || null;

function useBoardData() {
  const [notes, setNotes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      const [nextNotes, nextRegions] = await Promise.all([invoke('list_notes'), invoke('list_regions')]);
      setNotes(nextNotes);
      setRegions(nextRegions);
      setError('');
      return [nextNotes, nextRegions];
    } catch (cause) {
      setError(String(cause));
      return [[], []];
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { notes, setNotes, regions, setRegions, error, reload };
}

function App() {
  return noteWindowId ? <PinnedNoteWindow noteId={noteWindowId} /> : <Workspace />;
}

function Workspace() {
  const { notes, setNotes, regions, setRegions, error, reload } = useBoardData();
  const [board, setBoard] = useState('Everything');
  const [zoom, setZoom] = useState(1);
  const [shift, setShift] = useState({ x: 40, y: 45 });
  const [editing, setEditing] = useState(null);
  const [menuNoteId, setMenuNoteId] = useState(null);
  const [toast, setToast] = useState('');
  const [autostart, setAutostart] = useState(false);
  const shellRef = useRef(null);
  const dragRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    invoke('get_autostart').then(setAutostart).catch(() => {});
    const onKey = (event) => {
      if (event.key.toLowerCase() === 'v' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (event.target.closest('input,textarea,select,[contenteditable="true"],dialog[open]')) return;
        event.preventDefault();
        notify('Desknote stays in the background while notes are pinned. Unpin each note to dismiss it.');
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        hideWorkspace();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };
  const hideWorkspace = async () => {
    try { await invoke('hide_workspace'); } catch { /* browser preview */ }
  };
  const weekBounds = useMemo(() => {
    const date = new Date();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const format = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    return [format(monday), format(sunday)];
  }, []);
  const visibleNotes = notes.filter((note) => {
    if (note.completed) return board === 'Completed';
    if (board === 'Completed') return false;
    if (board === 'Everything') return true;
    if (!note.due) return false;
    return board === 'Daily' ? note.due === today() : note.due >= weekBounds[0] && note.due <= weekBounds[1];
  });

  const save = async (draft) => {
    try {
      const saved = await invoke('save_note', { note: draft });
      if (saved.pinned) await invoke('pin_note', { note: saved });
      else if (saved.id) await invoke('unpin_note', { id: saved.id });
      await reload();
      setEditing(null);
      return saved;
    } catch (cause) {
      notify(`Could not save note: ${cause}`);
      return null;
    }
  };
  const createNote = async () => {
    const due = board === 'Daily' ? today() : null;
    setEditing({ ...defaultNote(notes.length), due });
  };
  const pinOrUnpin = async (note) => {
    const updated = { ...note, pinned: !note.pinned };
    const saved = await save(updated);
    if (saved) notify(saved.pinned ? 'Pinned note is now on your desktop.' : 'Note unpinned and kept in your workspace.');
  };
  const deleteNote = async (note) => {
    if (!note.id) { setEditing(null); return; }
    try {
      await invoke('delete_note', { id: note.id });
      await invoke('unpin_note', { id: note.id });
      await reload();
      setEditing(null);
    } catch (cause) { notify(`Could not delete note: ${cause}`); }
  };
  const toggleCompleted = async (note) => {
    const saved = await save({ ...note, completed: !note.completed });
    if (saved) notify(saved.completed ? 'Moved to Completed.' : 'Task reopened.');
  };
  const updateNote = (id, update) => setNotes((items) => items.map((item) => item.id === id ? { ...item, ...update } : item));
  const addRegion = async (kind) => {
    const title = window.prompt(`Name this ${kind}`);
    if (!title?.trim()) return;
    const region = { id: null, title: title.trim(), x: (shellRef.current.clientWidth / 2 - shift.x) / zoom, y: (shellRef.current.clientHeight / 2 - shift.y) / zoom, w: kind === 'group' ? 370 : 480, h: kind === 'group' ? 260 : 330, kind, color: '#e9e7dd' };
    try {
      await invoke('save_region', { region });
      const [, nextRegions] = await reload();
      setRegions(nextRegions);
    } catch (cause) { notify(`Could not create ${kind}: ${cause}`); }
  };
  const saveRegion = async (region) => {
    try { await invoke('save_region', { region }); } catch (cause) { notify(String(cause)); }
  };
  const openEditor = (note) => { setMenuNoteId(null); setEditing({ ...note }); };
  const startDrag = (event, note, mode = 'move') => {
    if (event.button !== 0) return;
    event.stopPropagation();
    dragRef.current = { mode, noteId: note.id, startX: event.clientX, startY: event.clientY, x: note.x, y: note.y, w: note.w, h: note.h, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.mode === 'pan') {
      setShift({ x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY });
      return;
    }
    const changes = drag.mode === 'resize'
      ? { w: Math.max(170, drag.w + dx), h: Math.max(120, drag.h + dy) }
      : { x: Math.max(0, drag.x + dx), y: Math.max(25, drag.y + dy) };
    updateNote(drag.noteId, changes);
  };
  const finishDrag = async () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved && drag.noteId) {
      const current = notes.find((item) => item.id === drag.noteId);
      if (current) await invoke('save_note', { note: current }).catch((cause) => notify(String(cause)));
    }
  };
  const startPan = (event) => {
    if (event.target !== event.currentTarget) return;
    dragRef.current = { mode: 'pan', startX: event.clientX, startY: event.clientY, x: shift.x, y: shift.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const wheelZoom = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom((value) => Math.max(0.4, Math.min(2.2, value * (event.deltaY < 0 ? 1.08 : 0.92))));
  };

  return (
    <div className="workspace-app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">d</span><span>Desknote</span></div>
        <nav className="views" aria-label="Boards">{['Everything', 'Daily', 'Weekly', 'Completed'].map((name) => <button key={name} className={`view ${board === name ? 'active' : ''}`} onClick={() => setBoard(name)}>{name}</button>)}</nav>
        <div className="top-actions">
          <button className={`quiet ${autostart ? 'enabled' : ''}`} onClick={async () => { try { const next = !autostart; await invoke('set_autostart', { enabled: next }); setAutostart(next); notify(next ? 'Desknote will start at login.' : 'Login start is off.'); } catch (cause) { notify(String(cause)); } }} title="Start when I log in">◷ <span>{autostart ? 'Starts at login' : 'Start on login'}</span></button>
          <button className="quiet" onClick={() => addRegion('group')}>＋ Group</button>
          <button className="quiet" onClick={() => addRegion('frame')}>＋ Frame</button>
          <button className="primary" onClick={createNote}>＋ <span>Note</span></button>
        </div>
      </header>
      <main id="board-shell" ref={shellRef} onPointerDown={startPan} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onWheel={wheelZoom}>
        <div className="board-heading">{board === 'Daily' ? `Today · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}` : board === 'Weekly' ? 'This week' : board === 'Completed' ? 'Completed tasks' : 'A place for all your thoughts'}</div>
        <div id="world" style={{ transform: `translate(${shift.x}px, ${shift.y}px) scale(${zoom})` }}>
          {regions.map((region) => <div key={region.id} className={`region ${region.kind}`} style={{ left: region.x, top: region.y, width: region.w, height: region.h, '--region-color': region.color }} onPointerDown={(event) => { event.stopPropagation(); dragRef.current = { mode: 'region', id: region.id, startX: event.clientX, startY: event.clientY, x: region.x, y: region.y, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const drag = dragRef.current; if (!drag || drag.mode !== 'region' || drag.id !== region.id) return; const dx = (event.clientX - drag.startX) / zoom, dy = (event.clientY - drag.startY) / zoom; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; const moved = { ...region, x: Math.max(0, drag.x + dx), y: Math.max(25, drag.y + dy) }; setRegions((items) => items.map((item) => item.id === region.id ? moved : item)); }} onPointerUp={async () => { const drag = dragRef.current; dragRef.current = null; if (drag?.moved) { const current = regions.find((item) => item.id === region.id); if (current) await saveRegion(current); } }}><span className="region-title">{region.title}</span></div>)}
          {visibleNotes.map((note) => <article key={note.id ?? `draft-${note.title}`} className={`note-card ${note.pinned ? 'is-pinned' : ''} ${note.completed ? 'is-completed' : ''}`} data-id={note.id} style={{ left: note.x, top: note.y, width: note.w, height: note.h, background: note.color }} onPointerDown={(event) => startDrag(event, note)} onPointerMove={moveDrag} onPointerUp={finishDrag} onDoubleClick={() => openEditor(note)} onContextMenu={(event) => { event.preventDefault(); openEditor(note); }}>
            <div className="card-title">{note.pinned && <span className="pin" aria-label="Pinned">⌖</span>}{note.title || 'Untitled'}{note.completed && <span className="complete-label">Completed</span>}</div>
            <div className="card-body">{escapeText(note.body).slice(0, 150)}</div>
            <div className="card-meta">{regions.find((region) => region.id === note.groupId)?.title && <span>↗ {regions.find((region) => region.id === note.groupId).title}</span>}{note.due && <span>◷ {note.due}</span>}</div>
            {note.pinned && <button className="card-menu-trigger" aria-label={`Actions for ${note.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setMenuNoteId(menuNoteId === note.id ? null : note.id); }}>⋯</button>}
            {menuNoteId === note.id && <div className="card-menu" onPointerDown={(event) => event.stopPropagation()}><button onClick={() => invoke('show_workspace').catch((cause) => notify(String(cause)))}>Open workspace</button><button onClick={() => openEditor(note)}>Edit note</button><button onClick={() => pinOrUnpin(note)}>Unpin from desktop</button></div>}
            <button className="resize-handle" aria-label={`Resize ${note.title || 'note'}`} onPointerDown={(event) => startDrag(event, note, 'resize')} />
          </article>)}
        </div>
        {!visibleNotes.length && <div className="empty"><strong>{board === 'Completed' ? 'Nothing completed yet.' : 'No notes for this view yet.'}</strong><span>{board === 'Completed' ? 'Completed task notes will appear here.' : 'Add a note here or give an existing note a date.'}</span></div>}
      </main>
      <footer className="foot"><span id="hint">Ctrl+D hides this workspace · pinned notes stay visible · double-click a note to edit</span><div className="zoom"><button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.4, value * 0.87))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2.2, value * 1.15))}>＋</button><button aria-label="Center board" onClick={() => { setZoom(1); setShift({ x: 40, y: 45 }); }}>⌖</button></div></footer>
      {error && <div className="error-banner" role="alert">Local data is unavailable: {error}</div>}
      {toast && <div id="toast" className="show" role="status">{toast}</div>}
      {editing && <NoteEditor note={editing} regions={regions} onCancel={() => setEditing(null)} onSave={save} onDelete={deleteNote} onPin={pinOrUnpin} onComplete={toggleCompleted} onNotify={notify} />}
    </div>
  );
}

function NoteEditor({ note, regions, onCancel, onSave, onDelete, onPin, onComplete, onNotify }) {
  const [draft, setDraft] = useState({ ...note });
  const [checklist, setChecklist] = useState(() => { try { return JSON.parse(note.checklist || '[]'); } catch { return []; } });
  const [busy, setBusy] = useState(false);
  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    const saved = await onSave({ ...draft, title: draft.title.trim() || 'Untitled', due: draft.due || null, recurrence: draft.recurrence || null, checklist: JSON.stringify(checklist) });
    setBusy(false);
    if (!saved) onNotify('Your edits are still open; retry saving when ready.');
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><dialog className="editor" open><form onSubmit={submit}>
    <div className="editor-head"><span className="eyebrow">YOUR NOTE</span><button type="button" className="icon-btn" onClick={onCancel} aria-label="Close editor">×</button></div>
    <input autoFocus className="title-input" value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="A thought to keep" maxLength={120} />
    <div className="formatbar"><span className="editor-help">Note</span><span className="bar-spacer"/><label className="color-pick" title="Note color"><input type="color" value={draft.color} onChange={(event) => patch({ color: event.target.value })}/></label></div>
    <textarea className="note-body note-textarea" value={draft.body.replace(/<[^>]*>/g, '')} onChange={(event) => patch({ body: event.target.value })} placeholder="Write it down…" />
    <section className="check-section"><div className="section-label">CHECKLIST <button type="button" onClick={() => setChecklist((items) => [...items, { text: 'New task', done: false }])}>＋ Add item</button></div>
      {checklist.map((item, index) => <label className="check-row" key={index}><input type="checkbox" checked={!!item.done} onChange={(event) => setChecklist((items) => items.map((entry, i) => i === index ? { ...entry, done: event.target.checked } : entry))}/><input className="check-text-input" value={item.text} onChange={(event) => setChecklist((items) => items.map((entry, i) => i === index ? { ...entry, text: event.target.value } : entry))}/><button type="button" aria-label="Remove checklist item" onClick={() => setChecklist((items) => items.filter((_, i) => i !== index))}>×</button></label>)}
    </section>
    <section className="schedule"><label>Due<input type="date" value={draft.due || ''} onChange={(event) => patch({ due: event.target.value || null })}/></label><label>Repeat<select value={draft.recurrence || ''} onChange={(event) => patch({ recurrence: event.target.value || null })}><option value="">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label>Group<select value={draft.groupId || ''} onChange={(event) => patch({ groupId: event.target.value ? Number(event.target.value) : null })}><option value="">No group</option>{regions.filter((item) => item.kind === 'group').map((region) => <option key={region.id} value={region.id}>{region.title}</option>)}</select></label></section>
    <div className="editor-actions"><button type="button" className="danger" onClick={() => onDelete(draft)}>Delete</button>{draft.id && onComplete && <button type="button" className="quiet-btn" onClick={() => onComplete({ ...draft, checklist: JSON.stringify(checklist) })}>{draft.completed ? 'Reopen task' : 'Mark complete'}</button>}<span className="bar-spacer"/><button type="button" className="quiet-btn" onClick={() => onPin({ ...draft, pinned: !draft.pinned, checklist: JSON.stringify(checklist) })}>{draft.pinned ? 'Unpin from desktop' : 'Pin to desktop'}</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button></div>
  </form></dialog></div>;
}

function PinnedNoteWindow({ noteId }) {
  const { notes, regions, error, reload } = useBoardData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');
  const note = notes.find((item) => item.id === noteId);
  const checks = useMemo(() => { try { return JSON.parse(note?.checklist || '[]'); } catch { return []; } }, [note?.checklist]);
  useEffect(() => {
    if (note) invoke('set_note_title', { id: noteId, title: note.title || 'Desknote note' }).catch(() => {});
  }, [note, noteId]);
  const save = async (draft) => {
    try {
      const saved = await invoke('save_note', { note: draft });
      await reload();
      setEditing(false);
      return saved;
    } catch (cause) { setToast(`Could not save: ${cause}`); return null; }
  };
  const unpin = async () => {
    try {
      await invoke('save_note', { note: { ...note, pinned: false } });
      await invoke('unpin_note', { id: noteId });
    } catch (cause) { setToast(String(cause)); }
  };
  if (!note) return <div className="pinned-note-window"><div className="pinned-note-loading">{error || 'Loading note…'}</div></div>;
  if (editing) return <div className="pinned-note-window"><NoteEditor note={note} regions={regions} onCancel={() => setEditing(false)} onSave={save} onDelete={async () => { await invoke('delete_note', { id: noteId }); await invoke('unpin_note', { id: noteId }); }} onPin={unpin} onComplete={async (draft) => { await save({ ...draft, completed: !draft.completed }); }} onNotify={setToast}/>{toast && <div id="toast" className="show">{toast}</div>}</div>;
  return <article className="pinned-note-window" style={{ background: note.color }}>
    <header className="pinned-note-header" data-tauri-drag-region><span className="pinned-note-title">{note.title || 'Untitled'}</span><button className="note-ellipsis" aria-label="Note actions" onClick={() => setMenuOpen((value) => !value)}>⋯</button></header>
    <div className="pinned-note-body">{escapeText(note.body)}{checks.length > 0 && <ul className="pinned-checklist">{checks.map((item, index) => <li key={index} className={item.done ? 'done' : ''}>{item.done ? '☑' : '☐'} {item.text}</li>)}</ul>}</div>
    <footer className="pinned-note-footer">{note.due && <span>◷ {note.due}</span>}{regions.find((item) => item.id === note.groupId)?.title && <span>↗ {regions.find((item) => item.id === note.groupId).title}</span>}</footer>
    {menuOpen && <div className="pinned-note-menu"><button onClick={() => invoke('show_workspace').catch((cause) => setToast(String(cause)))}>Open workspace</button><button onClick={() => setEditing(true)}>Edit note</button><button onClick={unpin}>Unpin from desktop</button><button onClick={async () => { try { await invoke('toggle_always_on_top', { id: noteId }); await reload(); } catch (cause) { setToast(String(cause)); } }}>{note.alwaysOnTop === false ? 'Keep above windows' : 'Allow other windows above'}</button></div>}
    {toast && <div className="note-toast" role="status">{toast}</div>}
  </article>;
}

createRoot(document.getElementById('app')).render(<React.StrictMode><App /></React.StrictMode>);
