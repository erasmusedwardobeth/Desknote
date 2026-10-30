/**
 * menus.js — what each right-click menu contains. Pure functions: they only BUILD the list
 * of items; the actions come in through `handlers` (supplied by <Workspace>).
 *
 * Item kinds (rendered by components/ui/ContextMenu.jsx):
 *   { type: 'item',      label, onClick, danger?, disabled?, shortcut?, checked? }
 *   { type: 'separator' }
 *   { type: 'submenu',   label, items: [...], disabled? }
 *   { type: 'swatches',  label, colors, value, onPick }
 */
import { BACKGROUND_SWATCHES, NOTE_SWATCHES, REGION_SWATCHES } from './palette.js';

const item = (label, onClick, extra = {}) => ({ type: 'item', label, onClick, ...extra });
const separator = () => ({ type: 'separator' });
const submenu = (label, items, extra = {}) => ({ type: 'submenu', label, items, ...extra });
const swatches = (label, colors, value, onPick) => ({ type: 'swatches', label, colors, value, onPick });
const heading = (label) => item(label, () => {}, { disabled: true });

/** Right-click on a note. */
export function noteMenu({ note, regions, handlers: h }) {
  const targets = regions.filter((region) => region.kind === 'group' || region.kind === 'frame');
  const moveItems = targets.map((region) =>
    item(region.title || 'Untitled', () => h.moveToRegion(note, region), { checked: note.groupId === region.id }));
  if (note.groupId != null) moveItems.push(separator(), item('Remove from group', () => h.moveToRegion(note, null)));
  return [
    item('Edit…', () => h.edit(note), { shortcut: 'Enter' }),
    item(note.pinned ? 'Unpin from desktop' : 'Pin to desktop', () => h.togglePin(note)),
    item(note.completed ? 'Reopen task' : 'Mark complete', () => h.toggleComplete(note)),
    separator(),
    item('Duplicate', () => h.duplicate(note)),
    swatches('Color', NOTE_SWATCHES, note.color, (color) => h.setColor([note], color)),
    submenu('Move to group or frame', moveItems, { disabled: targets.length === 0 }),
    separator(),
    item('Delete', () => h.remove([note]), { danger: true, shortcut: 'Del' }),
  ];
}

/** Right-click on a group or frame. `contained` = the notes whose groupId is this region. */
export function regionMenu({ region, contained, handlers: h }) {
  const unpinned = contained.filter((note) => !note.pinned).length;
  const pinned = contained.length - unpinned;
  return [
    item(`Rename ${region.kind}`, () => h.renameRegion(region), { shortcut: 'F2' }),
    swatches('Color', REGION_SWATCHES, region.color, (color) => h.setColor([region], color)),
    separator(),
    item(`Select contents (${contained.length})`, () => h.selectContents(region), { disabled: contained.length === 0 }),
    item(`Pin all inside (${unpinned})`, () => h.pinMany(contained.filter((note) => !note.pinned), true), { disabled: unpinned === 0 }),
    item(`Unpin all inside (${pinned})`, () => h.pinMany(contained.filter((note) => note.pinned), false), { disabled: pinned === 0 }),
    separator(),
    item(`Delete ${region.kind} (notes are kept)`, () => h.remove([region]), { danger: true, shortcut: 'Del' }),
  ];
}

/** Right-click on empty canvas. `point` is the canvas position of the click. */
export function canvasMenu({ point, hasNotes, handlers: h }) {
  return [
    item('New note here', () => h.newNoteAt(point), { shortcut: 'Ctrl+N' }),
    item('New group here', () => h.newRegionAt('group', point)),
    item('New frame here', () => h.newRegionAt('frame', point)),
    separator(),
    item('Select all', () => h.selectAll(), { shortcut: 'Ctrl+A', disabled: !hasNotes }),
    item('Zoom to fit', () => h.zoomToFit(), { shortcut: 'Ctrl+1' }),
    item('Zoom to 100%', () => h.zoomReset(), { shortcut: 'Ctrl+0' }),
    separator(),
    item('Change background…', () => h.openBackground()),
    item('Pin all notes in this workspace', () => h.pinWorkspace(true), { disabled: !hasNotes }),
    item('Unpin all notes in this workspace', () => h.pinWorkspace(false), { disabled: !hasNotes }),
  ];
}

/** Right-click on a workspace row in the left panel. */
export function workspaceMenu({ workspace, isActive, canDelete, handlers: h }) {
  return [
    item(isActive ? 'Current workspace' : 'Open', () => h.switchWorkspace(workspace), { disabled: isActive }),
    item('Rename', () => h.renameWorkspace(workspace), { shortcut: 'F2' }),
    item('Duplicate', () => h.duplicateWorkspace(workspace)),
    item('Change background…', () => h.openBackgroundOf(workspace)),
    separator(),
    item('Pin all notes in it', () => h.pinWorkspace(true, workspace)),
    item('Unpin all notes in it', () => h.pinWorkspace(false, workspace)),
    separator(),
    item('Delete workspace…', () => h.deleteWorkspace(workspace), { danger: true, disabled: !canDelete }),
  ];
}

/** Right-click on one of several selected objects. */
export function multiMenu({ objects, handlers: h }) {
  const notes = objects.filter((object) => object.kind === 'note');
  const count = objects.length;
  const align = (mode) => () => h.align(objects, mode);
  return [
    heading(`${count} selected`),
    separator(),
    item('Pin selected notes', () => h.pinMany(notes.filter((n) => !n.item.pinned).map((n) => n.item), true), { disabled: notes.length === 0 }),
    item('Unpin selected notes', () => h.pinMany(notes.filter((n) => n.item.pinned).map((n) => n.item), false), { disabled: notes.length === 0 }),
    swatches('Color', BACKGROUND_SWATCHES.slice(6, 24), null, (color) => h.setColor(objects.map((object) => object.item), color)),
    submenu('Align', [
      item('Left', align('left')), item('Center', align('hcenter')), item('Right', align('right')),
      separator(),
      item('Top', align('top')), item('Middle', align('vcenter')), item('Bottom', align('bottom')),
    ]),
    submenu('Distribute', [
      item('Horizontally', () => h.distribute(objects, 'h')),
      item('Vertically', () => h.distribute(objects, 'v')),
    ], { disabled: count < 3 }),
    separator(),
    item(`Delete ${count} objects`, () => h.remove(objects.map((object) => object.item)), { danger: true, shortcut: 'Del' }),
  ];
}
