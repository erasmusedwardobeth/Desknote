/**
 * <Workspace> — the main window: top bar, left panel (layers), canvas, right panel (properties),
 * footer and dialogs.
 *
 * This file is the "conductor": it owns the state and the actions (select, save, pin, delete,
 * zoom, workspaces, backup …) and hands them down to small display components.
 * Where to look when you want to change something:
 *   the layers tree (left)       → panels/LeftPanel.jsx       lib/tree.js
 *   the properties (right)       → panels/RightPanel.jsx      panels/*Props.jsx
 *   right-click menus            → lib/menus.js (contents)    ui/ContextMenu.jsx (drawing)
 *   how a note / group looks     → NoteCard.jsx / RegionBox.jsx
 *   background color / image     → lib/background.js          panels/WorkspaceProps.jsx
 *   dragging, marquee, panning   → hooks/useCanvasDrag.js
 *   zoom of the camera           → hooks/useWorkspaceView.js  lib/zoom.js
 *   keyboard shortcuts           → hooks/useWorkspaceShortcuts.js
 *   which notes a tab shows      → lib/boards.js
 *   workspaces list / switching  → hooks/useWorkspaces.js
 *   calls into Rust              → api/*.js
 *
 * ZOOM RULE: the mouse wheel and Ctrl +/- zoom the selected note/group/frame when EXACTLY ONE is
 * selected (it is scaled around its centre); otherwise they zoom the workspace camera.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open as chooseOpenPath, save as chooseSavePath } from '@tauri-apps/plugin-dialog';
import { completeNote, deleteNote, saveNote } from '../../api/notes.js';
import { deleteRegion, saveRegion } from '../../api/regions.js';
import { exportBackup, getAutostart, importBackup, setAutostart } from '../../api/settings.js';
import { hideWorkspace, quitApp, setNotePinned, unpinNote } from '../../api/windows.js';
import { importImage } from '../../api/workspaces.js';
import { useBoardData } from '../../hooks/useBoardData.js';
import { useCanvasDrag } from '../../hooks/useCanvasDrag.js';
import { useContextMenu } from '../../hooks/useContextMenu.js';
import { usePersistentFlag } from '../../hooks/usePersistentFlag.js';
import { useToast } from '../../hooks/useToast.js';
import { useWorkspaces } from '../../hooks/useWorkspaces.js';
import { useWorkspaceShortcuts } from '../../hooks/useWorkspaceShortcuts.js';
import { useWorkspaceView } from '../../hooks/useWorkspaceView.js';
import { gridLayerStyle, imageLayerStyle, isDark } from '../../lib/background.js';
import { boardHeading, filterNotes } from '../../lib/boards.js';
import { MIN_Y, NOTE_MIN, REGION_MIN } from '../../lib/constants.js';
import { nextOccurrence, today } from '../../lib/dates.js';
import { confirmAction } from '../../lib/dialogs.js';
import { canvasMenu, multiMenu, noteMenu, regionMenu, workspaceMenu } from '../../lib/menus.js';
import { defaultNote } from '../../lib/noteUtils.js';
import { centerOfView, inWorkspace, placeInside, resolveSelection, screenToWorld } from '../../lib/scope.js';
import { clickItem, prune } from '../../lib/selection.js';
import { alignRects, distributeRects } from '../../lib/transform.js';
import { ancestorsOf, buildTree, expandableIds, filterTree, nodeId, parseNodeId } from '../../lib/tree.js';
import { fitView, scaleRectAbout, wheelFactor } from '../../lib/zoom.js';
import NoteEditor from '../editor/NoteEditor.jsx';
import LeftPanel from '../panels/LeftPanel.jsx';
import RightPanel from '../panels/RightPanel.jsx';
import SettingsPanel from '../settings/SettingsPanel.jsx';
import ContextMenu from '../ui/ContextMenu.jsx';
import SplashScreen from '../ui/SplashScreen.jsx';
import Toast from '../ui/Toast.jsx';
import Footer from './Footer.jsx';
import NoteCard from './NoteCard.jsx';
import RegionBox from './RegionBox.jsx';
import TopBar from './TopBar.jsx';

/** A group or frame (notes have no `kind`). */
const isRegion = (item) => item.kind === 'group' || item.kind === 'frame';
/** The selection id of a note or region object. */
const idOf = (item) => (isRegion(item) ? nodeId(item.kind, item.id) : nodeId('note', item.id));

export default function Workspace() {
  // ================= data =================
  const { notes: allNotes, regions: allRegions, patchNote, patchRegion, error, loading: dataLoading, reload } = useBoardData();
  const wsApi = useWorkspaces();
  const { workspaces, active, loading: workspacesLoading } = wsApi;
  const activeId = active?.id ?? null;
  const firstId = workspaces[0]?.id ?? null;
  const view = useWorkspaceView(active, wsApi.patchLocal);
  const { toast, notify } = useToast();

  // ================= UI state =================
  const [boardTab, setBoardTab] = useState('Everything');
  const [dayKey, setDayKey] = useState(today);
  const [editing, setEditing] = useState(null);            // the note in the editor dialog, or null
  const [menuNoteId, setMenuNoteId] = useState(null);       // note whose small "⋯" menu is open
  const [regionMenuId, setRegionMenuId] = useState(null);   // group/frame whose "⋯" menu is open
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autostart, setAutostartState] = useState(false);
  const [selection, setSelection] = useState([]);           // node ids: "note:3", "frame:7" …
  const [expanded, setExpanded] = useState(() => new Set()); // open rows of the layers tree
  const [query, setQuery] = useState('');                   // layers search text
  const [renamingId, setRenamingId] = useState(null);       // node id being renamed in the tree
  const [marquee, setMarquee] = useState(null);             // selection rectangle (canvas pixels)
  const [busy, setBusy] = useState('');                     // text of a long-running action
  const [showLeft, setShowLeft] = usePersistentFlag('desknote.showLeft', true);
  const [showRight, setShowRight] = usePersistentFlag('desknote.showRight', true);
  const shellRef = useRef(null);
  const searchRef = useRef(null);
  const latest = useRef({});
  const pendingSelect = useRef(null);   // item to select right after a workspace switch
  const saveTimer = useRef(null);
  const pendingScaled = useRef(new Set());
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();

  // ================= derived =================
  const notes = useMemo(() => allNotes.filter((note) => inWorkspace(note, activeId, firstId)), [allNotes, activeId, firstId]);
  const regions = useMemo(() => allRegions.filter((region) => inWorkspace(region, activeId, firstId)), [allRegions, activeId, firstId]);
  const visibleNotes = filterNotes(notes, boardTab, dayKey);
  const tree = useMemo(() => buildTree({ workspaces, regions: allRegions, notes: allNotes }), [workspaces, allRegions, allNotes]);
  const shownTree = useMemo(() => filterTree(tree, query), [tree, query]);
  const searching = query.trim() !== '';
  const shownExpanded = useMemo(() => (searching ? new Set(expandableIds(shownTree)) : expanded), [searching, shownTree, expanded]);
  const objects = useMemo(() => resolveSelection(selection, notes, regions), [selection, notes, regions]);
  const ready = !workspacesLoading && !dataLoading && active !== null;
  latest.current = { allNotes, allRegions };

  // ================= small helpers =================
  const viewport = () => ({ w: shellRef.current?.clientWidth ?? 800, h: shellRef.current?.clientHeight ?? 600 });
  const currentView = () => ({ zoom: view.zoom, shiftX: view.shift.x, shiftY: view.shift.y });
  const failure = (prefix) => (cause) => notify(`${prefix}: ${cause}`);
  const getPickItems = () => [
    ...visibleNotes.map((note) => ({ id: nodeId('note', note.id), x: note.x, y: note.y, w: note.w, h: note.h })),
    ...regions.map((region) => ({ id: nodeId(region.kind, region.id), x: region.x, y: region.y, w: region.w, h: region.h })),
  ];

  // ================= effects =================
  useEffect(() => { getAutostart().then(setAutostartState).catch(() => {}); }, []);

  // Keep "today" correct if the app stays open past midnight.
  useEffect(() => {
    const timer = setInterval(() => setDayKey(today()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Opening another workspace clears the selection (or selects the item that was asked for).
  useEffect(() => {
    setSelection(pendingSelect.current ? [pendingSelect.current] : []);
    pendingSelect.current = null;
    setMarquee(null);
    if (activeId !== null) {
      const key = nodeId('workspace', activeId);
      setExpanded((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));
    }
  }, [activeId]);

  // Forget selected objects that were deleted.
  useEffect(() => {
    const valid = new Set([...notes.map((note) => nodeId('note', note.id)), ...regions.map((region) => nodeId(region.kind, region.id))]);
    setSelection((current) => {
      const next = prune(current, valid);
      return next.length === current.length ? current : next;
    });
  }, [notes, regions]);

  // Selecting on the canvas opens the matching rows of the tree.
  useEffect(() => {
    if (!selection.length || searching) return;
    const trail = ancestorsOf(tree, selection[selection.length - 1]);
    if (!trail || !trail.length) return;
    setExpanded((previous) => (trail.every((id) => previous.has(id)) ? previous : new Set([...previous, ...trail])));
  }, [selection, tree, searching]);

  // ================= canvas dragging =================
  const drag = useCanvasDrag({
    shellRef, zoom: view.zoom, shift: view.shift, setShift: view.setShift, notes, regions, selection,
    patchNote, patchRegion, getPickItems, onSelect: setSelection, onMarquee: setMarquee, onError: notify,
  });

  /** Mouse down on a note or group/frame: update the selection, then start the drag. */
  const itemPointerDown = (event, kind, item, mode = 'move') => {
    if (event.button !== 0) return;
    const next = mode === 'resize' ? [idOf(item)] : clickItem(selection, idOf(item), { shift: event.shiftKey });
    setSelection(next);
    closeMenu();
    setMenuNoteId(null);
    setRegionMenuId(null);
    drag.startItemDrag(event, kind, item, mode, next);
  };

  // ================= saving objects =================
  /** Changes fields of a note or group/frame: shows them now, saves in the background. */
  const applyChanges = (item, changes) => {
    if (isRegion(item)) {
      patchRegion(item.id, changes);
      saveRegion({ ...item, ...changes }).catch(failure('Could not save'));
    } else {
      patchNote(item.id, changes);
      saveNote({ ...item, ...changes }).catch(failure('Could not save'));
    }
  };
  const setColor = (items, color) => items.forEach((item) => applyChanges(item, { color }));

  /**
   * Saves a note from the editor. Only if its `pinned` value CHANGED does it also open/close the
   * desktop window (through the single Rust command setNotePinned).
   */
  const save = async (draft) => {
    try {
      const wasPinned = Boolean(allNotes.find((item) => item.id === draft.id)?.pinned);
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

  const setPinned = async (note, pinned) => {
    const saved = await save({ ...note, pinned });
    if (saved) notify(pinned ? 'Pinned note is now on your desktop.' : 'Note unpinned and kept in your workspace.');
  };
  const togglePin = (note) => setPinned(note, !note.pinned);

  /** Pins/unpins several notes (asks first when more than one). */
  const pinMany = async (items, pinned) => {
    const list = items.filter((note) => Boolean(note.pinned) !== pinned);
    if (!list.length) return;
    if (list.length > 1 && !(await confirmAction(`${pinned ? 'Pin' : 'Unpin'} ${list.length} notes ${pinned ? 'to' : 'from'} the desktop?`))) return;
    let failed = 0;
    for (const note of list) {
      try { await setNotePinned(note.id, pinned); } catch { failed += 1; }
    }
    await reload();
    notify(failed
      ? `${failed} of ${list.length} notes could not be ${pinned ? 'pinned' : 'unpinned'}.`
      : `${list.length} ${list.length === 1 ? 'note' : 'notes'} ${pinned ? 'pinned' : 'unpinned'}.`);
  };
  const pinWorkspace = (pinned, target = active) => pinMany(allNotes.filter((note) => inWorkspace(note, target.id, firstId)), pinned);

  /** Delete one note (the editor / card already asked for confirmation). */
  const removeNote = async (note) => {
    if (!note.id) { setEditing(null); return; }
    try {
      await deleteNote(note.id);
      await unpinNote(note.id);
      await reload();
      setEditing(null);
    } catch (cause) { notify(`Could not delete note: ${cause}`); }
  };

  /** Delete notes and/or groups/frames after asking (deleting a group keeps its notes). */
  const removeObjects = async (items) => {
    if (!items.length) return;
    const label = items.length === 1 ? `“${items[0].title || 'Untitled'}”` : `${items.length} objects`;
    const regionNote = items.some(isRegion) ? ' Notes inside a deleted group or frame are kept.' : '';
    if (!(await confirmAction(`Delete ${label}?${regionNote}`))) return;
    try {
      await Promise.all(items.map((item) => (isRegion(item) ? deleteRegion(item.id) : deleteNote(item.id))));
      setSelection([]);
      await reload();
    } catch (cause) { notify(`Could not delete: ${cause}`); }
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

  const duplicateNote = async (note) => {
    try {
      const copy = await saveNote({
        ...note, id: null, x: note.x + 24, y: note.y + 24, pinned: false, completed: false, completedAt: null,
        reminderAt: null, reminderSent: false, created: null, updated: null,
        desktopX: null, desktopY: null, desktopW: null, desktopH: null,
      });
      await reload();
      setSelection([nodeId('note', copy.id)]);
    } catch (cause) { notify(`Could not duplicate: ${cause}`); }
  };

  /** Moves a note into a group/frame (placing it inside), or out of its group (region = null). */
  const moveToRegion = (note, region) => {
    if (!region) { applyChanges(note, { groupId: null }); return; }
    const at = placeInside(note, region);
    applyChanges(note, { groupId: region.id, x: at.x, y: at.y });
  };
  const selectContents = (region) => setSelection(notes.filter((note) => note.groupId === region.id).map((note) => nodeId('note', note.id)));
  const nudgeNote = (updated) => applyChanges(allNotes.find((note) => note.id === updated.id) ?? updated, updated);
  const nudgeRegion = (updated) => applyChanges(allRegions.find((region) => region.id === updated.id) ?? updated, updated);
  const openEditor = (note) => { setMenuNoteId(null); setEditing({ ...note }); };

  // ================= creating things =================
  const newNoteAt = (point) => {
    const at = point ?? centerOfView(viewport(), currentView());
    setEditing({
      ...defaultNote(notes.length),
      x: Math.max(0, Math.round(at.x - 125)), y: Math.max(MIN_Y, Math.round(at.y - 105)),
      workspaceId: activeId, due: boardTab === 'Daily' ? dayKey : null,
    });
  };

  /** Creates a group or frame, selects it and opens its name for typing in the layers tree. */
  const addRegion = async (kind, point) => {
    const at = point ?? centerOfView(viewport(), currentView());
    const w = kind === 'group' ? 370 : 480;
    const h = kind === 'group' ? 260 : 330;
    const title = `${kind === 'group' ? 'Group' : 'Frame'} ${regions.filter((region) => region.kind === kind).length + 1}`;
    try {
      const saved = await saveRegion({
        id: null, title, kind, color: '#e9e7dd', workspaceId: activeId,
        x: Math.max(0, Math.round(at.x - w / 2)), y: Math.max(MIN_Y, Math.round(at.y - h / 2)), w, h,
      });
      await reload();
      const id = nodeId(saved.kind, saved.id);
      setSelection([id]);
      setShowLeft(true);
      setRenamingId(id);
    } catch (cause) { notify(`Could not create ${kind}: ${cause}`); }
  };

  // ================= align / distribute =================
  const rectsOf = (list) => list.map((object) => ({ id: object.id, x: object.item.x, y: object.item.y, w: object.item.w, h: object.item.h }));
  const applyPositions = (list, positions) => positions.forEach((position) => {
    const object = list.find((entry) => entry.id === position.id);
    if (object) applyChanges(object.item, { x: Math.max(0, Math.round(position.x)), y: Math.max(MIN_Y, Math.round(position.y)) });
  });
  const align = (list, mode) => applyPositions(list, alignRects(rectsOf(list), mode));
  const distribute = (list, axis) => applyPositions(list, distributeRects(rectsOf(list), axis));

  // ================= zoom =================
  const centerPoint = () => ({ x: viewport().w / 2, y: viewport().h / 2 });

  /** Saves the objects that were scaled by zoom, 400 ms after the last change. */
  const flushScaled = () => {
    for (const id of pendingScaled.current) {
      const { type, refId } = parseNodeId(id);
      if (type === 'note') {
        const note = latest.current.allNotes.find((entry) => entry.id === refId);
        if (note) saveNote(note).catch(failure('Could not save'));
      } else {
        const region = latest.current.allRegions.find((entry) => entry.id === refId);
        if (region) saveRegion(region).catch(failure('Could not save'));
      }
    }
    pendingScaled.current.clear();
  };

  /** Wheel / Ctrl +/-: scales the single selected object, else zooms the workspace camera. */
  const zoomTarget = (factor, point) => {
    if (objects.length === 1) {
      const { item } = objects[0];
      const limits = isRegion(item) ? REGION_MIN : NOTE_MIN;
      const rect = scaleRectAbout(item, factor, { minW: limits.w, minH: limits.h, maxW: 3000, maxH: 3000 });
      const changes = { x: Math.max(0, rect.x), y: Math.max(MIN_Y, rect.y), w: rect.w, h: rect.h };
      if (isRegion(item)) patchRegion(item.id, changes); else patchNote(item.id, changes);
      pendingScaled.current.add(idOf(item));
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushScaled, 400);
      return;
    }
    view.zoomAt(factor, point);
  };

  const zoomToFit = () => {
    const rects = [...visibleNotes, ...regions].map(({ x, y, w, h }) => ({ x, y, w, h }));
    view.setCamera(fitView(rects, viewport()));
  };

  /** Scrolls the camera so `item` is visible (does nothing if it already is). */
  const centerOn = (item) => {
    const box = viewport();
    const left = item.x * view.zoom + view.shift.x;
    const top = item.y * view.zoom + view.shift.y;
    if (left >= 0 && top >= 0 && left + item.w * view.zoom <= box.w && top + item.h * view.zoom <= box.h) return;
    view.setShift({ x: box.w / 2 - (item.x + item.w / 2) * view.zoom, y: box.h / 2 - (item.y + item.h / 2) * view.zoom });
  };

  // ================= workspaces =================
  const switchWorkspace = (workspace) => {
    if (!workspace) return;
    if (workspace.id !== activeId) wsApi.setActive(workspace.id);
    setSelection([]);
  };

  const createWorkspace = async () => {
    try {
      const created = await wsApi.create();
      setShowLeft(true);
      setExpanded((previous) => new Set(previous).add(nodeId('workspace', created.id)));
      setRenamingId(nodeId('workspace', created.id));
    } catch (cause) { notify(`Could not create a workspace: ${cause}`); }
  };

  const duplicateWorkspace = async (workspace) => {
    setBusy('Duplicating workspace…');
    try { await wsApi.duplicate(workspace.id); await reload(); notify('Workspace duplicated.'); }
    catch (cause) { notify(`Could not duplicate: ${cause}`); }
    finally { setBusy(''); }
  };

  const deleteWorkspace = async (workspace) => {
    const noteCount = allNotes.filter((note) => inWorkspace(note, workspace.id, firstId)).length;
    const regionCount = allRegions.filter((region) => inWorkspace(region, workspace.id, firstId)).length;
    const question = `Delete workspace “${workspace.name}” and everything in it (${noteCount} notes, ${regionCount} groups or frames)? This cannot be undone.`;
    if (!(await confirmAction(question))) return;
    try { await wsApi.remove(workspace.id); await reload(); notify('Workspace deleted.'); }
    catch (cause) { notify(`Could not delete: ${cause}`); }
  };

  const changeWorkspace = (changes) => wsApi.update(activeId, changes).catch(failure('Could not save the workspace'));

  const pickImage = async () => {
    try {
      const path = await chooseOpenPath({
        multiple: false, directory: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'] }],
      });
      if (!path || Array.isArray(path)) return;
      setBusy('Copying image…');
      const stored = await importImage(path);
      await wsApi.update(activeId, { bgImage: stored });
    } catch (cause) { notify(`Could not use that image: ${cause}`); }
    finally { setBusy(''); }
  };
  const removeImage = () => wsApi.update(activeId, { bgImage: null }).catch(failure('Could not save the workspace'));
  const openBackground = () => { setSelection([]); setShowRight(true); };
  const openBackgroundOf = (workspace) => { switchWorkspace(workspace); setShowRight(true); };

  // ================= layers tree =================
  const toggleExpand = (id) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const startRename = (id) => { setShowLeft(true); setRenamingId(id); };

  const commitRename = (id, text) => {
    setRenamingId(null);
    const name = text.trim();
    if (!name) return;
    const { type, refId } = parseNodeId(id);
    if (type === 'workspace') {
      wsApi.update(refId, { name }).catch(failure('Could not rename'));
    } else if (type === 'note') {
      const note = allNotes.find((entry) => entry.id === refId);
      if (note && note.title !== name) applyChanges(note, { title: name });
    } else {
      const region = allRegions.find((entry) => entry.id === refId);
      if (region && region.title !== name) applyChanges(region, { title: name });
    }
  };

  /** Click on a row of the tree. */
  const selectNode = (node, event) => {
    if (node.type === 'workspace') { switchWorkspace(workspaces.find((workspace) => workspace.id === node.refId)); return; }
    const item = node.type === 'note' ? allNotes.find((note) => note.id === node.refId) : allRegions.find((region) => region.id === node.refId);
    if (!item) return;
    const itemWorkspace = item.workspaceId ?? firstId;
    if (itemWorkspace !== activeId) { pendingSelect.current = node.id; wsApi.setActive(itemWorkspace); return; }
    if (node.type === 'note') {
      if (item.completed) setBoardTab('Completed');
      else if (boardTab !== 'Everything' && !filterNotes([item], boardTab, dayKey).length) setBoardTab('Everything');
    }
    setSelection(event.shiftKey ? clickItem(selection, node.id, { shift: true }) : [node.id]);
    centerOn(item);
  };

  // ================= context menus =================
  const menuHandlers = {
    edit: openEditor, togglePin, toggleComplete: toggleCompleted, duplicate: duplicateNote, setColor, moveToRegion,
    remove: removeObjects, renameRegion: (region) => startRename(nodeId(region.kind, region.id)), selectContents, pinMany,
    newNoteAt, newRegionAt: addRegion,
    selectAll: () => setSelection(getPickItems().map((entry) => entry.id)),
    zoomToFit, zoomReset: view.resetView, openBackground, pinWorkspace,
    switchWorkspace, renameWorkspace: (workspace) => startRename(nodeId('workspace', workspace.id)),
    duplicateWorkspace, openBackgroundOf, deleteWorkspace, align, distribute,
  };

  /** Right-click on a note / group: keeps a multi-selection if the item is part of it. */
  const openObjectMenu = (event, kind, item) => {
    const id = idOf(item);
    const next = selection.includes(id) ? selection : [id];
    if (!selection.includes(id)) setSelection(next);
    if (next.length > 1) {
      openMenu(event, multiMenu({ objects: resolveSelection(next, notes, regions), handlers: menuHandlers }));
    } else if (kind === 'note') {
      openMenu(event, noteMenu({ note: item, regions, handlers: menuHandlers }));
    } else {
      openMenu(event, regionMenu({ region: item, contained: notes.filter((note) => note.groupId === item.id), handlers: menuHandlers }));
    }
  };

  const openCanvasMenu = (event) => {
    if (event.target !== event.currentTarget) return;
    setSelection([]);
    const box = shellRef.current.getBoundingClientRect();
    const point = screenToWorld({ x: event.clientX - box.left, y: event.clientY - box.top }, currentView());
    openMenu(event, canvasMenu({ point, hasNotes: notes.length > 0, handlers: menuHandlers }));
  };

  /** Right-click on a row of the layers tree. */
  const openNodeMenu = (event, node) => {
    if (node.type === 'workspace') {
      const workspace = workspaces.find((entry) => entry.id === node.refId);
      if (workspace) openMenu(event, workspaceMenu({ workspace, isActive: workspace.id === activeId, canDelete: workspaces.length > 1, handlers: menuHandlers }));
      return;
    }
    const item = node.type === 'note' ? allNotes.find((note) => note.id === node.refId) : allRegions.find((region) => region.id === node.refId);
    if (!item) return;
    const sameWorkspaceRegions = allRegions.filter((region) => (region.workspaceId ?? firstId) === (item.workspaceId ?? firstId));
    if (node.type === 'note') openMenu(event, noteMenu({ note: item, regions: sameWorkspaceRegions, handlers: menuHandlers }));
    else openMenu(event, regionMenu({ region: item, contained: allNotes.filter((note) => note.groupId === item.id), handlers: menuHandlers }));
  };

  // ================= settings / backup =================
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
      notify('Backup saved. It includes your workspaces, notes, pinned state and groups.');
    } catch (cause) { notify(`Could not export backup: ${cause}`); }
  };

  const doImportBackup = async () => {
    try {
      const path = await chooseOpenPath({ multiple: false, directory: false, filters: [{ name: 'Desknote backup', extensions: ['json'] }] });
      if (!path || Array.isArray(path)) return;
      if (!(await confirmAction('Restore this backup? It will replace ALL your workspaces and notes. Desknote saves a recovery backup before restoring.'))) return;
      const recoveryPath = await importBackup(path);
      const list = await wsApi.reload();
      await reload();
      view.applyCamera(list.find((workspace) => workspace.id === activeId) ?? list[0]);
      setEditing(null);
      setSettingsOpen(false);
      notify(`Backup restored. Recovery copy: ${recoveryPath}`);
    } catch (cause) { notify(`Could not restore backup: ${cause}`); }
  };

  const doQuit = async () => {
    if (await confirmAction('Quit Desknote? All pinned note windows will close until you launch the app again. Your changes are already saved.')) await quitApp();
  };

  // ================= keyboard and wheel =================
  const hide = async () => {
    try { await hideWorkspace(); } catch { /* running in a plain browser */ }
  };
  const modalOpen = Boolean(editing || settingsOpen || renamingId);

  useWorkspaceShortcuts({
    onHide: hide,
    onNewNote: () => newNoteAt(),
    onSelectAll: () => menuHandlers.selectAll(),
    onZoomIn: () => zoomTarget(1.15, centerPoint()),
    onZoomOut: () => zoomTarget(0.87, centerPoint()),
    onZoomReset: () => view.resetView(),
    onZoomFit: () => zoomToFit(),
    onSearch: () => { setShowLeft(true); setTimeout(() => searchRef.current?.focus(), 0); },
    onDelete: () => { if (!modalOpen) removeObjects(objects.map((object) => object.item)); },
    onRename: () => { if (!modalOpen) startRename(selection.length === 1 ? selection[0] : nodeId('workspace', activeId)); },
    onEscape: () => {
      if (renamingId) setRenamingId(null);
      else if (settingsOpen) setSettingsOpen(false);
      else if (editing) setEditing(null);
      else if (menuNoteId !== null) setMenuNoteId(null);
      else if (regionMenuId !== null) setRegionMenuId(null);
      else if (selection.length) setSelection([]);
    },
  });

  // The wheel listener must be NON-passive to be allowed to stop the page from scrolling.
  const zoomTargetRef = useRef(zoomTarget);
  zoomTargetRef.current = zoomTarget;
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const box = shell.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      zoomTargetRef.current(wheelFactor(delta), { x: event.clientX - box.left, y: event.clientY - box.top });
    };
    shell.addEventListener('wheel', onWheel, { passive: false });
    return () => shell.removeEventListener('wheel', onWheel);
  }, [ready]);

  // ================= render =================
  if (!ready) {
    return <SplashScreen message={workspacesLoading || dataLoading ? 'Loading your workspace…' : 'No workspace could be loaded. Check the terminal for errors.'} />;
  }

  const imageUrl = active.bgImage ? convertFileSrc(active.bgImage) : '';
  const imageStyle = imageLayerStyle(active, imageUrl);
  const gridStyle = gridLayerStyle(active);
  const onDark = isDark(active.bgColor);

  const panelHandlers = {
    changeWorkspace, pickImage, removeImage, zoomToFit, pinWorkspace, duplicateWorkspace, deleteWorkspace,
    applyChanges, edit: openEditor, togglePin, toggleComplete: toggleCompleted, remove: removeObjects,
    selectContents, pinMany, align, distribute, setColor,
  };

  return (
    <div className="workspace-app">
      <TopBar
        showLeft={showLeft} showRight={showRight}
        onToggleLeft={() => setShowLeft((value) => !value)} onToggleRight={() => setShowRight((value) => !value)}
        board={boardTab} onBoardChange={setBoardTab}
        autostart={autostart} onToggleAutostart={toggleAutostart}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddRegion={(kind) => addRegion(kind)} onCreateNote={() => newNoteAt()}
      />

      <div className="workspace-layout">
        {showLeft && (
          <LeftPanel
            tree={shownTree} expanded={shownExpanded} onToggleExpand={toggleExpand}
            activeWorkspaceId={activeId} selection={selection}
            query={query} onQuery={setQuery} searchRef={searchRef}
            renamingId={renamingId} onRenameCommit={commitRename} onRenameCancel={() => setRenamingId(null)}
            onSelectNode={selectNode} onStartRename={startRename} onContextMenuNode={openNodeMenu}
            onCreateWorkspace={createWorkspace}
          />
        )}

        <main
          id="board-shell" ref={shellRef} aria-label={`${active.name} — ${boardTab} notes`}
          className={drag.spaceDown ? 'space-pan' : ''} style={{ backgroundColor: active.bgColor }}
          onPointerDown={drag.startPan} onPointerMove={drag.moveDrag}
          onPointerUp={drag.finishDrag} onPointerCancel={drag.finishDrag}
          onContextMenu={openCanvasMenu}
        >
          {imageStyle && <div className="canvas-bg" style={imageStyle} />}
          {gridStyle && <div className="canvas-grid" style={gridStyle} />}
          <div className="board-heading" style={onDark ? { color: '#cbd5e1' } : undefined}>{boardHeading(boardTab)}</div>
          <div id="world" style={{ transform: `translate(${view.shift.x}px, ${view.shift.y}px) scale(${view.zoom})` }}>
            {regions.map((region) => (
              <RegionBox
                key={region.id} region={region} selected={selection.includes(nodeId(region.kind, region.id))}
                onContextMenu={(event) => openObjectMenu(event, 'region', region)}
                menuOpen={regionMenuId === region.id}
                onToggleMenu={() => setRegionMenuId(regionMenuId === region.id ? null : region.id)}
                onRename={(item) => { setRegionMenuId(null); startRename(nodeId(item.kind, item.id)); }}
                onRemove={(item) => { setRegionMenuId(null); removeObjects([item]); }}
                onNudge={nudgeRegion}
                onDragStart={(event, item) => itemPointerDown(event, 'region', item, 'move')}
                onResizeStart={(event, item) => itemPointerDown(event, 'region', item, 'resize')}
              />
            ))}
            {visibleNotes.map((note) => (
              <NoteCard
                key={note.id ?? `draft-${note.title}`} note={note} selected={selection.includes(nodeId('note', note.id))}
                groupTitle={regions.find((region) => region.id === note.groupId)?.title}
                onContextMenu={(event) => openObjectMenu(event, 'note', note)}
                menuOpen={menuNoteId === note.id}
                onToggleMenu={() => setMenuNoteId(menuNoteId === note.id ? null : note.id)}
                onEdit={openEditor} onPinToggle={togglePin} onUnpin={(item) => setPinned(item, false)} onComplete={toggleCompleted}
                onDelete={removeNote} onNudge={nudgeNote}
                onDragStart={(event, item, mode) => itemPointerDown(event, 'note', item, mode)}
                onDragMove={drag.moveDrag} onDragEnd={drag.finishDrag}
              />
            ))}
          </div>
          {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
          {!visibleNotes.length && (
            <div className="empty">
              <strong>{boardTab === 'Completed' ? 'Nothing completed yet.' : 'No notes for this view yet.'}</strong>
              <span>{boardTab === 'Completed' ? 'Completed task notes will appear here.' : 'Right-click the canvas, press Ctrl+N, or give an existing note a date.'}</span>
            </div>
          )}
        </main>

        {showRight && (
          <RightPanel
            workspace={active} imageUrl={imageUrl} canDelete={workspaces.length > 1}
            objects={objects} regions={regions} notes={notes} handlers={panelHandlers}
          />
        )}
      </div>

      <Footer
        zoom={view.zoom} onZoomIn={() => view.zoomAt(1.15, centerPoint())} onZoomOut={() => view.zoomAt(0.87, centerPoint())}
        onFit={zoomToFit} onReset={view.resetView}
      />

      {error && <div className="error-banner" role="alert">Local data is unavailable: {error}</div>}
      <Toast message={toast} />
      {busy && <div className="busy-pill" role="status"><span className="splash-spinner small" aria-hidden="true" />{busy}</div>}

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
      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
    </div>
  );
}
