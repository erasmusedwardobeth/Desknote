import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { open, save as chooseSavePath } from '@tauri-apps/plugin-dialog';
import './style.css';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const fromLocalDateTime = (value) => value ? new Date(value).toISOString() : null;
const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const nextOccurrence = (due, recurrence) => {
  const [year, month, day] = due.split('-').map(Number);
  let nextYear = year;
  let nextMonth = month - 1;
  let nextDay = day;
  if (recurrence === 'daily' || recurrence === 'weekly') {
    const next = new Date(year, month - 1, day, 12);
    next.setDate(next.getDate() + (recurrence === 'weekly' ? 7 : 1));
    return formatLocalDate(next);
  }
  if (recurrence === 'monthly') {
    nextMonth += 1;
    if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
  } else if (recurrence === 'yearly') nextYear += 1;
  const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
  nextDay = Math.min(nextDay, lastDay);
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
};
const escapeText = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const defaultNote = (index = 0) => ({
  id: null, title: '', body: '', x: 100 + (index % 4) * 40, y: 100 + (index % 3) * 40,
  w: 250, h: 210, color: ['#fff1a8', '#ffd9cf', '#d9f2df', '#dce9ff', '#f0ddff'][index % 5],
  pinned: false, due: null, recurrence: null, checklist: '[]', formatting: '{}', groupId: null,
  created: null, updated: null, reminderAt: null, reminderSent: false,
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
  useEffect(() => {
    reload();
    let unlisten;
    let cancelled = false;
    listen('notes-changed', () => reload()).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    }).catch(() => {});
    return () => { cancelled = true; unlisten?.(); };
  }, [reload]);
  return { notes, setNotes, regions, setRegions, error, reload };
}

function App() {
  return noteWindowId ? <PinnedNoteWindow noteId={noteWindowId} /> : <Workspace />;
}

function Workspace() {
  const { notes, setNotes, regions, setRegions, error, reload } = useBoardData();
  const [board, setBoard] = useState('Everything');
  const [dayKey, setDayKey] = useState(today);
  const [zoom, setZoom] = useState(1);
  const [shift, setShift] = useState({ x: 40, y: 45 });
  const [viewReady, setViewReady] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuNoteId, setMenuNoteId] = useState(null);
  const [regionMenuId, setRegionMenuId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [autostart, setAutostart] = useState(false);
  const shellRef = useRef(null);
  const dragRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    invoke('get_autostart').then(setAutostart).catch(() => {});
    invoke('get_workspace_view').then((view) => {
      setZoom(view.zoom);
      setShift({ x: view.shiftX, y: view.shiftY });
    }).catch(() => {}).finally(() => setViewReady(true));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setDayKey(today()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!viewReady) return undefined;
    const timer = setTimeout(() => invoke('save_workspace_view', { view: { zoom, shiftX: shift.x, shiftY: shift.y } }).catch(() => {}), 450);
    return () => clearTimeout(timer);
  }, [viewReady, zoom, shift]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        hideWorkspace();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n' && !event.target.closest('input,textarea,select,[contenteditable="true"]')) {
        event.preventDefault();
        setEditing({ ...defaultNote(notes.length), due: board === 'Daily' ? today() : null });
      } else if (event.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        else if (editing) setEditing(null);
        else if (menuNoteId !== null) setMenuNoteId(null);
        else if (regionMenuId !== null) setRegionMenuId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [board, editing, menuNoteId, notes.length, regionMenuId, settingsOpen]);

  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };
  const hideWorkspace = async () => {
    try { await invoke('hide_workspace'); } catch { /* browser preview */ }
  };
  const weekBounds = useMemo(() => {
    const date = new Date(`${dayKey}T12:00:00`);
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const format = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    return [format(monday), format(sunday)];
  }, [dayKey]);
  const visibleNotes = notes.filter((note) => {
    if (note.completed) return board === 'Completed';
    if (board === 'Completed') return false;
    if (board === 'Everything') return true;
    if (!note.due) return false;
    return board === 'Daily' ? note.due === dayKey : note.due >= weekBounds[0] && note.due <= weekBounds[1];
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
    const due = board === 'Daily' ? dayKey : null;
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
    if (note.completed) {
      const saved = await save({ ...note, completed: false });
      if (saved) notify('Task reopened.');
      return;
    }
    const nextDue = note.recurrence && note.due ? nextOccurrence(note.due, note.recurrence) : null;
    try {
      const repeated = await invoke('complete_note', { note, nextDue });
      await reload();
      setEditing(null);
      notify(repeated ? 'Completed and created the next occurrence.' : 'Moved to Completed.');
    } catch (cause) { notify(`Could not complete task: ${cause}`); }
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
  const renameRegion = (region) => {
    const title = window.prompt(`Rename ${region.kind}`, region.title);
    if (!title?.trim()) return;
    const updated = { ...region, title: title.trim() };
    setRegions((items) => items.map((item) => item.id === region.id ? updated : item));
    saveRegion(updated);
    setRegionMenuId(null);
  };
  const removeRegion = async (region) => {
    if (!window.confirm(`Delete ${region.kind} “${region.title}”? Notes will remain in the workspace.`)) return;
    try { await invoke('delete_region', { id: region.id }); await reload(); }
    catch (cause) { notify(String(cause)); }
    setRegionMenuId(null);
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
    if (drag.mode === 'region' || drag.mode === 'region-resize') {
      const changes = drag.mode === 'region-resize'
        ? { w: Math.max(220, drag.w + dx), h: Math.max(150, drag.h + dy) }
        : { x: Math.max(0, drag.x + dx), y: Math.max(25, drag.y + dy) };
      setRegions((items) => items.map((item) => item.id === drag.id ? { ...item, ...changes } : item));
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
    if (drag?.moved && drag.id && (drag.mode === 'region' || drag.mode === 'region-resize')) {
      const current = regions.find((item) => item.id === drag.id);
      if (current) await saveRegion(current);
    } else if (drag?.moved && drag.noteId) {
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
  const exportBackup = async () => {
    try {
      const path = await chooseSavePath({ defaultPath: `Desknote-backup-${today()}.json`, filters: [{ name: 'Desknote backup', extensions: ['json'] }] });
      if (!path) return;
      await invoke('export_backup', { path });
      notify('Backup saved. It includes your notes, pinned state, groups, and layout.');
    } catch (cause) { notify(`Could not export backup: ${cause}`); }
  };
  const importBackup = async () => {
    try {
      const path = await open({ multiple: false, directory: false, filters: [{ name: 'Desknote backup', extensions: ['json'] }] });
      if (!path || Array.isArray(path)) return;
      if (!window.confirm('Restore this backup? It will replace your current notes and groups. Desknote will save a recovery backup before restoring.')) return;
      const recoveryPath = await invoke('import_backup', { path });
      await reload();
      const view = await invoke('get_workspace_view');
      setZoom(view.zoom);
      setShift({ x: view.shiftX, y: view.shiftY });
      setEditing(null);
      setSettingsOpen(false);
      notify(`Backup restored. Recovery copy: ${recoveryPath}`);
    } catch (cause) { notify(`Could not restore backup: ${cause}`); }
  };

  return (
    <div className="workspace-app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">d</span><span>Desknote</span></div>
        <nav className="views" aria-label="Boards">{['Everything', 'Daily', 'Weekly', 'Completed'].map((name) => <button key={name} className={`view ${board === name ? 'active' : ''}`} aria-pressed={board === name} onClick={() => setBoard(name)}>{name}</button>)}</nav>
        <div className="top-actions">
          <button className={`quiet ${autostart ? 'enabled' : ''}`} onClick={async () => { try { const next = !autostart; await invoke('set_autostart', { enabled: next }); setAutostart(next); notify(next ? 'Desknote will start at login.' : 'Login start is off.'); } catch (cause) { notify(String(cause)); } }} title="Start when I log in">◷ <span>{autostart ? 'Starts at login' : 'Start on login'}</span></button>
          <button className="quiet" onClick={() => setSettingsOpen(true)}>Settings</button>
          <button className="quiet" onClick={() => addRegion('group')}>＋ Group</button>
          <button className="quiet" onClick={() => addRegion('frame')}>＋ Frame</button>
          <button className="primary" onClick={createNote}>＋ <span>Note</span></button>
        </div>
      </header>
      <main id="board-shell" ref={shellRef} aria-label={`${board} notes workspace`} onPointerDown={startPan} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onWheel={wheelZoom}>
        <div className="board-heading">{board === 'Daily' ? `Today · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}` : board === 'Weekly' ? 'This week' : board === 'Completed' ? 'Completed tasks' : 'A place for all your thoughts'}</div>
        <div id="world" style={{ transform: `translate(${shift.x}px, ${shift.y}px) scale(${zoom})` }}>
          {regions.map((region) => (
            <div
              key={region.id}
              className={`region ${region.kind}`}
              role="group"
              tabIndex={0}
              aria-label={`${region.kind}: ${region.title}. Arrow keys move; Shift plus arrow keys resize; Enter renames.`}
              style={{ left: region.x, top: region.y, width: region.w, height: region.h, '--region-color': region.color }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter') { event.preventDefault(); renameRegion(region); }
                else if (event.key.startsWith('Arrow')) {
                  event.preventDefault();
                  const step = event.shiftKey ? 10 : 1;
                  const changes = event.shiftKey
                    ? { w: Math.max(220, region.w + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)), h: Math.max(150, region.h + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)) }
                    : { x: Math.max(0, region.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)), y: Math.max(25, region.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)) };
                  const updated = { ...region, ...changes };
                  setRegions((items) => items.map((item) => item.id === region.id ? updated : item));
                  saveRegion(updated);
                }
              }}
              onPointerDown={(event) => {
                if (event.target.closest('.region-resize-handle,.region-menu-trigger,.region-menu')) return;
                event.stopPropagation();
                dragRef.current = { mode: 'region', id: region.id, startX: event.clientX, startY: event.clientY, x: region.x, y: region.y, moved: false };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onDoubleClick={(event) => { event.stopPropagation(); renameRegion(region); }}
              onContextMenu={(event) => { event.preventDefault(); removeRegion(region); }}
            >
              <span className="region-title">{region.title}</span>
              <button className="region-menu-trigger" aria-label={`Actions for ${region.title}`} aria-expanded={regionMenuId === region.id} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setRegionMenuId(regionMenuId === region.id ? null : region.id); }}>⋯</button>
              {regionMenuId === region.id && <div className="card-menu region-menu" role="menu" onPointerDown={(event) => event.stopPropagation()}><button role="menuitem" onClick={() => renameRegion(region)}>Rename {region.kind}</button><button role="menuitem" onClick={() => removeRegion(region)}>Delete {region.kind}</button></div>}
              <button className="region-resize-handle" aria-label={`Resize ${region.title}`} onPointerDown={(event) => { event.stopPropagation(); dragRef.current = { mode: 'region-resize', id: region.id, startX: event.clientX, startY: event.clientY, w: region.w, h: region.h, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }} />
            </div>
          ))}
          {visibleNotes.map((note) => <article key={note.id ?? `draft-${note.title}`} className={`note-card ${note.pinned ? 'is-pinned' : ''} ${note.completed ? 'is-completed' : ''}`} role="group" tabIndex={0} aria-label={`Note: ${note.title || 'Untitled'}. Enter to edit; arrow keys to move; Shift plus arrow keys to resize.`} data-id={note.id} style={{ left: note.x, top: note.y, width: note.w, height: note.h, background: note.color }} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter') { event.preventDefault(); openEditor(note); } else if (event.key.startsWith('Arrow')) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; const updated = { ...note, ...(event.shiftKey ? { w: Math.max(170, note.w + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)), h: Math.max(120, note.h + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)) } : { x: Math.max(0, note.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)), y: Math.max(25, note.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)) }) }; updateNote(note.id, updated); invoke('save_note', { note: updated }).catch((cause) => notify(String(cause))); } }} onPointerDown={(event) => startDrag(event, note)} onPointerMove={moveDrag} onPointerUp={finishDrag} onDoubleClick={() => openEditor(note)} onContextMenu={(event) => { event.preventDefault(); openEditor(note); }}>
            <div className="card-title">{note.pinned && <span className="pin" aria-label="Pinned">⌖</span>}{note.title || 'Untitled'}{note.completed && <span className="complete-label">Completed</span>}</div>
            <div className="card-body">{escapeText(note.body).slice(0, 150)}</div>
            <div className="card-meta">{regions.find((region) => region.id === note.groupId)?.title && <span>↗ {regions.find((region) => region.id === note.groupId).title}</span>}{note.due && <span>◷ {note.due}</span>}{note.reminderAt && <span aria-label={`Reminder ${new Date(note.reminderAt).toLocaleString()}`}>⏰ {new Date(note.reminderAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>}</div>
            <button className="card-menu-trigger" aria-label={`Actions for ${note.title || 'Untitled'}`} aria-expanded={menuNoteId === note.id} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setMenuNoteId(menuNoteId === note.id ? null : note.id); }}>⋯</button>
            {menuNoteId === note.id && <div className="card-menu" role="menu" onPointerDown={(event) => event.stopPropagation()}><button role="menuitem" onClick={() => openEditor(note)}>Edit note</button><button role="menuitem" onClick={() => pinOrUnpin(note)}>{note.pinned ? 'Unpin from desktop' : 'Pin to desktop'}</button><button role="menuitem" onClick={() => toggleCompleted(note)}>{note.completed ? 'Reopen task' : 'Mark complete'}</button><button role="menuitem" onClick={() => { if (window.confirm(`Delete “${note.title || 'Untitled'}” permanently?`)) deleteNote(note); }}>Delete note</button></div>}
            <button className="resize-handle" aria-label={`Resize ${note.title || 'note'}`} onPointerDown={(event) => startDrag(event, note, 'resize')} />
          </article>)}
        </div>
        {!visibleNotes.length && <div className="empty"><strong>{board === 'Completed' ? 'Nothing completed yet.' : 'No notes for this view yet.'}</strong><span>{board === 'Completed' ? 'Completed task notes will appear here.' : 'Add a note here or give an existing note a date.'}</span></div>}
      </main>
      <footer className="foot"><span id="hint">Ctrl+N creates a note · Ctrl+D hides this workspace · pinned notes stay visible</span><div className="zoom"><button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.4, value * 0.87))}>−</button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2.2, value * 1.15))}>＋</button><button aria-label="Center board" onClick={() => { setZoom(1); setShift({ x: 40, y: 45 }); }}>⌖</button></div></footer>
      {error && <div className="error-banner" role="alert">Local data is unavailable: {error}</div>}
      {toast && <div id="toast" className="show" role="status">{toast}</div>}
      {editing && <NoteEditor note={editing} regions={regions} onCancel={() => setEditing(null)} onSave={save} onDelete={deleteNote} onPin={pinOrUnpin} onComplete={toggleCompleted} onNotify={notify} />}
      {settingsOpen && <SettingsPanel autostart={autostart} setAutostart={setAutostart} onClose={() => setSettingsOpen(false)} onExport={exportBackup} onImport={importBackup} onNotify={notify} onQuit={async () => { if (window.confirm('Quit Desknote? All pinned note windows will close until you launch the app again. Your changes are already saved.')) await invoke('quit_app'); }} />}
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
    const saved = await onSave({ ...draft, title: draft.title.trim() || 'Untitled', due: draft.due || null, recurrence: draft.recurrence || null, reminderAt: draft.reminderAt || null, checklist: JSON.stringify(checklist) });
    setBusy(false);
    if (!saved) onNotify('Your edits are still open; retry saving when ready.');
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><dialog className="editor" open><form onSubmit={submit}>
    <div className="editor-head"><span className="eyebrow">YOUR NOTE</span><button type="button" className="icon-btn" onClick={onCancel} aria-label="Close editor">×</button></div>
    <input autoFocus className="title-input" aria-label="Note title" value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="A thought to keep" maxLength={120} />
    <div className="formatbar"><span className="editor-help">Note</span><span className="bar-spacer"/><label className="color-pick" title="Note color"><input type="color" value={draft.color} onChange={(event) => patch({ color: event.target.value })}/></label></div>
    <textarea className="note-body note-textarea" aria-label="Note body" value={draft.body.replace(/<[^>]*>/g, '')} onChange={(event) => patch({ body: event.target.value })} placeholder="Write it down…" />
    <section className="check-section"><div className="section-label">CHECKLIST <button type="button" onClick={() => setChecklist((items) => [...items, { text: 'New task', done: false }])}>＋ Add item</button></div>
      {checklist.map((item, index) => <div className="check-row" key={index}><input type="checkbox" checked={!!item.done} aria-label={`Complete checklist item ${index + 1}: ${item.text}`} onChange={(event) => setChecklist((items) => items.map((entry, i) => i === index ? { ...entry, done: event.target.checked } : entry))}/><input className="check-text-input" aria-label={`Checklist item ${index + 1} text`} value={item.text} onChange={(event) => setChecklist((items) => items.map((entry, i) => i === index ? { ...entry, text: event.target.value } : entry))}/><button type="button" aria-label={`Remove checklist item ${index + 1}`} onClick={() => setChecklist((items) => items.filter((_, i) => i !== index))}>×</button></div>)}
    </section>
    <section className="schedule"><label>Due<input type="date" value={draft.due || ''} onChange={(event) => patch({ due: event.target.value || null })}/></label><label>Reminder<input type="datetime-local" value={toLocalDateTime(draft.reminderAt)} onChange={(event) => patch({ reminderAt: fromLocalDateTime(event.target.value) })}/></label><label>Repeat<select value={draft.recurrence || ''} onChange={(event) => patch({ recurrence: event.target.value || null })}><option value="">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label>Group<select value={draft.groupId || ''} onChange={(event) => patch({ groupId: event.target.value ? Number(event.target.value) : null })}><option value="">No group</option>{regions.filter((item) => item.kind === 'group').map((region) => <option key={region.id} value={region.id}>{region.title}</option>)}</select></label></section>
    <div className="editor-actions"><button type="button" className="danger" onClick={() => { if (!draft.id || window.confirm(`Delete “${draft.title || 'Untitled'}” permanently?`)) onDelete(draft); }}>Delete</button>{draft.id && onComplete && <button type="button" className="quiet-btn" onClick={() => onComplete({ ...draft, checklist: JSON.stringify(checklist) })}>{draft.completed ? 'Reopen task' : 'Mark complete'}</button>}<span className="bar-spacer"/><button type="button" className="quiet-btn" onClick={() => onPin({ ...draft, pinned: !draft.pinned, checklist: JSON.stringify(checklist) })}>{draft.pinned ? 'Unpin from desktop' : 'Pin to desktop'}</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button></div>
  </form></dialog></div>;
}

function SettingsPanel({ autostart, setAutostart, onClose, onExport, onImport, onNotify, onQuit }) {
  const [busy, setBusy] = useState(false);
  const toggleAutostart = async () => {
    setBusy(true);
    try {
      const next = !autostart;
      await invoke('set_autostart', { enabled: next });
      setAutostart(next);
      onNotify(next ? 'Desknote will start at login.' : 'Login start is off.');
    } catch (cause) { onNotify(`Could not change login start: ${cause}`); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><dialog className="editor settings-panel" open aria-modal="true" aria-labelledby="settings-title">
    <div className="editor-head"><div><span className="eyebrow">DESKNOTE</span><h2 id="settings-title">Settings and backup</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">×</button></div>
    <section className="settings-section"><h3>Startup</h3><p>Desknote can start in the background and restore your pinned notes when you sign in.</p><button className="quiet-btn settings-action" disabled={busy} onClick={toggleAutostart}>{autostart ? 'Turn off launch at login' : 'Launch Desknote at login'}</button></section>
    <section className="settings-section"><h3>Backup and restore</h3><p>Export stores notes, checklist state, reminder settings, groups, completion history, and workspace and desktop positions in a local JSON file.</p><div className="settings-buttons"><button className="quiet-btn settings-action" onClick={onExport}>Export backup…</button><button className="quiet-btn settings-action" onClick={onImport}>Restore backup…</button></div><p className="settings-note">Restore replaces the current collection. Desknote first saves an automatic recovery copy in its local data folder.</p></section>
    <section className="settings-section"><h3>Keyboard</h3><dl className="shortcut-list"><div><dt>Ctrl/⌘ + N</dt><dd>Create a note</dd></div><div><dt>Ctrl/⌘ + D</dt><dd>Hide the workspace; pinned notes stay visible</dd></div><div><dt>Enter</dt><dd>Edit the focused canvas note</dd></div><div><dt>Arrow keys</dt><dd>Move the focused note or group/frame</dd></div><div><dt>Shift + Arrow keys</dt><dd>Resize the focused note or group/frame</dd></div></dl></section>
    <div className="editor-actions"><button className="danger" onClick={onQuit}>Quit Desknote</button><span className="bar-spacer"/><button className="primary" onClick={onClose}>Done</button></div>
  </dialog></div>;
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
  const unpin = async (draft = note) => {
    try {
      await invoke('save_note', { note: { ...draft, pinned: false } });
      await invoke('unpin_note', { id: noteId });
    } catch (cause) { setToast(String(cause)); }
  };
  const toggleChecklistItem = async (index, done) => {
    const updated = checks.map((item, itemIndex) => itemIndex === index ? { ...item, done } : item);
    await save({ ...note, checklist: JSON.stringify(updated) });
  };
  if (!note) return <div className="pinned-note-window"><div className="pinned-note-loading">{error || 'Loading note…'}</div></div>;
  if (editing) return <div className="pinned-note-window"><NoteEditor note={note} regions={regions} onCancel={() => setEditing(false)} onSave={save} onDelete={async () => { await invoke('delete_note', { id: noteId }); await invoke('unpin_note', { id: noteId }); }} onPin={unpin} onComplete={async (draft) => {
    if (draft.completed) { await save({ ...draft, completed: false }); return; }
    try {
      const nextDue = draft.recurrence && draft.due ? nextOccurrence(draft.due, draft.recurrence) : null;
      const repeated = await invoke('complete_note', { note: { ...draft, checklist: JSON.stringify(checklist) }, nextDue });
      await reload();
      setEditing(false);
      setToast(repeated ? 'Completed; next occurrence created.' : 'Moved to Completed.');
    } catch (cause) { setToast(`Could not complete task: ${cause}`); }
  }} onNotify={setToast}/>{toast && <div id="toast" className="show">{toast}</div>}</div>;
  return <article className="pinned-note-window" style={{ background: note.color }}>
    <header className="pinned-note-header" data-tauri-drag-region><span className="pinned-note-title">{note.title || 'Untitled'}</span><button className="note-ellipsis" aria-label="Note actions" onClick={() => setMenuOpen((value) => !value)}>⋯</button></header>
    <div className="pinned-note-body">{escapeText(note.body)}{checks.length > 0 && <ul className="pinned-checklist">{checks.map((item, index) => <li key={index} className={item.done ? 'done' : ''}><label><input type="checkbox" checked={!!item.done} onChange={(event) => toggleChecklistItem(index, event.target.checked)} aria-label={`${item.done ? 'Reopen' : 'Complete'} ${item.text}`}/><span>{item.text}</span></label></li>)}</ul>}</div>
    <footer className="pinned-note-footer">{note.due && <span>◷ {note.due}</span>}{note.reminderAt && <span>⏰ {new Date(note.reminderAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>}{regions.find((item) => item.id === note.groupId)?.title && <span>↗ {regions.find((item) => item.id === note.groupId).title}</span>}{note.completed && <span>Completed</span>}</footer>
    {menuOpen && <div className="pinned-note-menu"><button onClick={() => invoke('show_workspace').catch((cause) => setToast(String(cause)))}>Open workspace</button><button onClick={() => setEditing(true)}>Edit note</button><button onClick={() => unpin(note)}>Unpin from desktop</button><button onClick={async () => { try { await invoke('toggle_always_on_top', { id: noteId }); await reload(); } catch (cause) { setToast(String(cause)); } }}>{note.alwaysOnTop === false ? 'Keep above windows' : 'Allow other windows above'}</button></div>}
    {toast && <div className="note-toast" role="status">{toast}</div>}
  </article>;
}

createRoot(document.getElementById('app')).render(<React.StrictMode><App /></React.StrictMode>);
