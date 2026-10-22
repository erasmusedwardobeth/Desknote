/**
 * <Workspace> — the main window: top bar, zoomable canvas, footer, and dialogs.
 *
 * This file is the "conductor": it owns the state and the actions (save, pin,
 * complete, delete, backup …) and hands them down to small display components.
 * Where to look when you want to change something:
 *   how a note looks            → NoteCard.jsx          how a group/frame looks → RegionBox.jsx
 *   the top bar / bottom bar    → TopBar.jsx / Footer.jsx
 *   dragging and panning        → hooks/useCanvasDrag.js
 *   zoom/camera                 → hooks/useWorkspaceView.js
 *   keyboard shortcuts          → hooks/useWorkspaceShortcuts.js
 *   which notes a tab shows     → lib/boards.js
 *   calls into Rust             → api/*.js
 */
import { useEffect, useRef, useState } from 'react';
import { open, save as chooseSavePath } from '@tauri-apps/plugin-dialog';
import { completeNote, deleteNote, saveNote } from '../../api/notes.js';
import { deleteRegion, saveRegion } from '../../api/regions.js';
import { exportBackup, getAutostart, importBackup, setAutostart } from '../../api/settings.js';
import { hideWorkspace, quitApp, setNotePinned, unpinNote } from '../../api/windows.js';
import { useBoardData } from '../../hooks/useBoardData.js';
import { useCanvasDrag } from '../../hooks/useCanvasDrag.js';
import { useToast } from '../../hooks/useToast.js';
import { useWorkspaceShortcuts } from '../../hooks/useWorkspaceShortcuts.js';
import { useWorkspaceView } from '../../hooks/useWorkspaceView.js';
import { boardHeading, filterNotes } from '../../lib/boards.js';
import { today, nextOccurrence } from '../../lib/dates.js';
import { defaultNote } from '../../lib/noteUtils.js';
import NoteEditor from '../editor/NoteEditor.jsx';
import SettingsPanel from '../settings/SettingsPanel.jsx';
import Toast from '../ui/Toast.jsx';
import Footer from './Footer.jsx';
import NoteCard from './NoteCard.jsx';
import RegionBox from './RegionBox.jsx';
import TopBar from './TopBar.jsx';
import SidebarTree from './SidebarTree.jsx';

export default function Workspace() {
  // ---- data and camera ----
  const { notes, regions, setRegions, patchNote, patchRegion, error, reload } = useBoardData();
  const { zoom, shift, setShift, zoomBy, reloadView, resetView } = useWorkspaceView();
  const { toast, notify } = useToast();

  // ---- UI state ----
  const [board, setBoard] = useState('Everything');
  const [dayKey, setDayKey] = useState(today);
  const [editing, setEditing] = useState(null);          // the note being edited, or null
  const [menuNoteId, setMenuNoteId] = useState(null);     // note whose "⋯" menu is open
  const [regionMenuId, setRegionMenuId] = useState(null); // group/frame whose menu is open
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autostart, setAutostartState] = useState(false);
  const shellRef = useRef(null);

  const drag = useCanvasDrag({ zoom, shift, setShift, notes, regions, patchNote, patchRegion, onError: notify });
  const visibleNotes = filterNotes(notes, board, dayKey);

  useEffect(() => { getAutostart().then(setAutostartState).catch(() => {}); }, []);

  // Keep "today" correct if the app stays open past midnight.
  useEffect(() => {
    const timer = setInterval(() => setDayKey(today()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hide = async () => {
    try { await hideWorkspace(); } catch { /* running in a plain browser */ }
  };

  const createNote = () => setEditing({ ...defaultNote(notes.length), due: board === 'Daily' ? dayKey : null });

  useWorkspaceShortcuts({
    onHide: hide,
    onNewNote: () => setEditing({ ...defaultNote(notes.length), due: board === 'Daily' ? today() : null }),
    onEscape: () => {
      if (settingsOpen) setSettingsOpen(false);
      else if (editing) setEditing(null);
      else if (menuNoteId !== null) setMenuNoteId(null);
      else if (regionMenuId !== null) setRegionMenuId(null);
    },
  });

  // ---- note actions ----
  /**
   * Saves a note. Only if its `pinned` value CHANGED does it also open/close the desktop
   * window (through the single Rust command setNotePinned), so ordinary edits never make
   * a pinned window blink.
   */
  const save = async (draft) => {
    try {
      const wasPinned = Boolean(notes.find((item) => item.id === draft.id)?.pinned);
      const saved = await saveNote(draft);
      if (Boolean(saved.pinned) !== wasPinned) await setNotePinned(saved.id, Boolean(saved.pinned));
      await reload();
      setEditing(null);
      return saved;
    } catch (cause) {
      await reload(); // show the true state (Rust undoes "pinned" if the window failed)
      notify(`Could not save note: ${cause}`);
      return null;
    }
  };

  /** Makes `note` pinned (true) or unpinned (false). */
  const setPinned = async (note, pinned) => {
    const saved = await save({ ...note, pinned });
    if (saved) notify(pinned ? 'Pinned note is now on your desktop.' : 'Note unpinned and kept in your workspace.');
  };

  /** Menu action: flip the note's current pin state. */
  const togglePin = (note) => setPinned(note, !note.pinned);

  const removeNote = async (note) => {
    if (!note.id) { setEditing(null); return; }
    try {
      await deleteNote(note.id);
      await unpinNote(note.id);
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
      const repeated = await completeNote(note, nextDue);
      await reload();
      setEditing(null);
      notify(repeated ? 'Completed and created the next occurrence.' : 'Moved to Completed.');
    } catch (cause) { notify(`Could not complete task: ${cause}`); }
  };

  const nudgeNote = (updated) => {
    patchNote(updated.id, updated);
    saveNote(updated).catch((cause) => notify(String(cause)));
  };

  const openEditor = (note) => { setMenuNoteId(null); setEditing({ ...note }); };

  // ---- group / frame actions ----
  const addRegion = async (kind) => {
    const title = window.prompt(`Name this ${kind}`);
    if (!title?.trim()) return;
    const region = {
      id: null, title: title.trim(),
      x: (shellRef.current.clientWidth / 2 - shift.x) / zoom,
      y: (shellRef.current.clientHeight / 2 - shift.y) / zoom,
      w: kind === 'group' ? 370 : 480, h: kind === 'group' ? 260 : 330,
      kind, color: '#e9e7dd',
    };
    try {
      await saveRegion(region);
      const [, nextRegions] = await reload();
      setRegions(nextRegions);
    } catch (cause) { notify(`Could not create ${kind}: ${cause}`); }
  };

  const persistRegion = async (region) => {
    try { await saveRegion(region); } catch (cause) { notify(String(cause)); }
  };

  const renameRegion = (region) => {
    const title = window.prompt(`Rename ${region.kind}`, region.title);
    if (!title?.trim()) return;
    const updated = { ...region, title: title.trim() };
    patchRegion(region.id, updated);
    persistRegion(updated);
    setRegionMenuId(null);
  };

  const removeRegion = async (region) => {
    if (!window.confirm(`Delete ${region.kind} “${region.title}”? Notes will remain in the workspace.`)) return;
    try { await deleteRegion(region.id); await reload(); }
    catch (cause) { notify(String(cause)); }
    setRegionMenuId(null);
  };

  const nudgeRegion = (updated) => {
    patchRegion(updated.id, updated);
    persistRegion(updated);
  };

  // ---- settings actions ----
  const toggleAutostart = async () => {
    try {
      const next = !autostart;
      await setAutostart(next);
      setAutostartState(next);
      notify(next ? 'Desknote will start at login.' : 'Login start is off.');
    } catch (cause) { notify(String(cause)); }
  };

  const doExportBackup = async () => {
    try {
      const path = await chooseSavePath({ defaultPath: `Desknote-backup-${today()}.json`, filters: [{ name: 'Desknote backup', extensions: ['json'] }] });
      if (!path) return;
      await exportBackup(path);
      notify('Backup saved. It includes your notes, pinned state, groups, and layout.');
    } catch (cause) { notify(`Could not export backup: ${cause}`); }
  };

  const doImportBackup = async () => {
    try {
      const path = await open({ multiple: false, directory: false, filters: [{ name: 'Desknote backup', extensions: ['json'] }] });
      if (!path || Array.isArray(path)) return;
      if (!window.confirm('Restore this backup? It will replace your current notes and groups. Desknote will save a recovery backup before restoring.')) return;
      const recoveryPath = await importBackup(path);
      await reload();
      await reloadView();
      setEditing(null);
      setSettingsOpen(false);
      notify(`Backup restored. Recovery copy: ${recoveryPath}`);
    } catch (cause) { notify(`Could not restore backup: ${cause}`); }
  };

  const doQuit = async () => {
    if (window.confirm('Quit Desknote? All pinned note windows will close until you launch the app again. Your changes are already saved.')) await quitApp();
  };

  // ---- canvas wheel zoom (Ctrl/⌘ + scroll) ----
  const navigateToItem = ({ type, item }) => {
    if (type === 'note') setBoard(item.completed ? 'Completed' : 'Everything');
    else setBoard('Everything');
    const shell = shellRef.current;
    if (!shell || !item) return;
    const width = type === 'region' ? item.w : item.w || 260;
    const height = type === 'region' ? item.h : item.h || 180;
    setShift({
      x: shell.clientWidth / 2 - (item.x + width / 2) * zoom,
      y: shell.clientHeight / 2 - (item.y + height / 2) * zoom,
    });
  };

  const handleWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.08 : 0.92);
  };

  return (
    <div className="workspace-app">
      <TopBar
        board={board} onBoardChange={setBoard}
        autostart={autostart} onToggleAutostart={toggleAutostart}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddRegion={addRegion} onCreateNote={createNote}
      />

      <div className="workspace-layout">
        <SidebarTree notes={notes} regions={regions} onNavigate={navigateToItem} onCreateNote={createNote} onCreateGroup={() => addRegion('group')} />
        <main
        id="board-shell" ref={shellRef} aria-label={`${board} notes workspace`}
        onPointerDown={drag.startPan} onPointerMove={drag.moveDrag}
        onPointerUp={drag.finishDrag} onPointerCancel={drag.finishDrag}
        onWheel={handleWheel}
      >
        <div className="board-heading">{boardHeading(board)}</div>
        <div id="world" style={{ transform: `translate(${shift.x}px, ${shift.y}px) scale(${zoom})` }}>
          {regions.map((region) => (
            <RegionBox
              key={region.id} region={region}
              menuOpen={regionMenuId === region.id}
              onToggleMenu={() => setRegionMenuId(regionMenuId === region.id ? null : region.id)}
              onRename={renameRegion} onRemove={removeRegion} onNudge={nudgeRegion}
              onDragStart={drag.startRegionDrag} onResizeStart={drag.startRegionResize}
            />
          ))}
          {visibleNotes.map((note) => (
            <NoteCard
              key={note.id ?? `draft-${note.title}`} note={note}
              groupTitle={regions.find((region) => region.id === note.groupId)?.title}
              menuOpen={menuNoteId === note.id}
              onToggleMenu={() => setMenuNoteId(menuNoteId === note.id ? null : note.id)}
              onEdit={openEditor} onPinToggle={togglePin} onUnpin={(item) => setPinned(item, false)} onComplete={toggleCompleted}
              onDelete={removeNote} onNudge={nudgeNote}
              onDragStart={drag.startNoteDrag} onDragMove={drag.moveDrag} onDragEnd={drag.finishDrag}
            />
          ))}
        </div>
        {!visibleNotes.length && (
          <div className="empty">
            <strong>{board === 'Completed' ? 'Nothing completed yet.' : 'No notes for this view yet.'}</strong>
            <span>{board === 'Completed' ? 'Completed task notes will appear here.' : 'Add a note here or give an existing note a date.'}</span>
          </div>
        )}
        </main>
      </div>

      <Footer zoom={zoom} onZoomIn={() => zoomBy(1.15)} onZoomOut={() => zoomBy(0.87)} onReset={resetView} />

      {error && <div className="error-banner" role="alert">Local data is unavailable: {error}</div>}
      <Toast message={toast} />

      {editing && (
        <NoteEditor
          note={editing} regions={regions}
          onCancel={() => setEditing(null)} onSave={save} onDelete={removeNote}
          onPin={(draft) => setPinned(draft, draft.pinned)} onComplete={toggleCompleted} onNotify={notify}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          autostart={autostart} setAutostart={setAutostartState}
          onClose={() => setSettingsOpen(false)}
          onExport={doExportBackup} onImport={doImportBackup} onNotify={notify} onQuit={doQuit}
        />
      )}
    </div>
  );
}
