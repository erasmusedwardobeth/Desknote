import test from 'node:test';
import assert from 'node:assert/strict';
import { noteMenu, regionMenu, canvasMenu, workspaceMenu, multiMenu } from '../src/lib/menus.js';

const calls = [];
const handlers = new Proxy({}, { get: (_t, name) => (...args) => calls.push([name, ...args]) });
const labels = (items) => items.filter((i) => i.type !== 'separator').map((i) => i.label);
const find = (items, label) => items.find((i) => i.label === label);

test('note menu: labels follow the note state', () => {
  const regions = [{ id: 1, title: 'Sprint', kind: 'frame' }, { id: 2, title: 'Ideas', kind: 'group' }];
  const plain = noteMenu({ note: { id: 5, pinned: false, completed: false, color: '#fff', groupId: null }, regions, handlers });
  assert.deepEqual(labels(plain), ['Edit…', 'Pin to desktop', 'Mark complete', 'Duplicate', 'Color', 'Move to group or frame', 'Delete']);
  const state = noteMenu({ note: { id: 5, pinned: true, completed: true, color: '#fff', groupId: 1 }, regions, handlers });
  assert.ok(find(state, 'Unpin from desktop')); assert.ok(find(state, 'Reopen task'));
  const move = find(state, 'Move to group or frame');
  assert.deepEqual(labels(move.items), ['Sprint', 'Ideas', 'Remove from group']);
  assert.equal(move.items[0].checked, true);
  assert.equal(find(noteMenu({ note: { id: 1, color: '#fff' }, regions: [], handlers }), 'Move to group or frame').disabled, true);
});
test('note menu actions call the handlers with the right arguments', () => {
  calls.length = 0;
  const note = { id: 5, pinned: false, completed: false, color: '#fff', groupId: null };
  const menu = noteMenu({ note, regions: [], handlers });
  find(menu, 'Edit…').onClick(); find(menu, 'Delete').onClick(); find(menu, 'Color').onPick('#abc');
  assert.deepEqual(calls[0], ['edit', note]);
  assert.deepEqual(calls[1], ['remove', [note]]);
  assert.deepEqual(calls[2], ['setColor', [note], '#abc']);
});
test('region menu counts and disables correctly', () => {
  const region = { id: 1, kind: 'frame', title: 'F', color: '#eee' };
  const empty = regionMenu({ region, contained: [], handlers });
  assert.equal(find(empty, 'Pin all inside (0)').disabled, true);
  assert.equal(find(empty, 'Select contents (0)').disabled, true);
  const mixed = regionMenu({ region, contained: [{ id: 1, pinned: true }, { id: 2, pinned: false }, { id: 3, pinned: false }], handlers });
  assert.equal(find(mixed, 'Pin all inside (2)').disabled, false);
  assert.equal(find(mixed, 'Unpin all inside (1)').disabled, false);
  assert.ok(find(mixed, 'Delete frame (notes are kept)').danger);
});
test('canvas menu passes the click point', () => {
  calls.length = 0;
  const menu = canvasMenu({ point: { x: 10, y: 20 }, hasNotes: false, handlers });
  find(menu, 'New note here').onClick();
  find(menu, 'New frame here').onClick();
  assert.deepEqual(calls[0], ['newNoteAt', { x: 10, y: 20 }]);
  assert.deepEqual(calls[1], ['newRegionAt', 'frame', { x: 10, y: 20 }]);
  assert.equal(find(menu, 'Select all').disabled, true);
});
test('workspace menu: delete disabled for the last workspace, open disabled for the current one', () => {
  const ws = { id: 1, name: 'A' };
  const only = workspaceMenu({ workspace: ws, isActive: true, canDelete: false, handlers });
  assert.equal(find(only, 'Delete workspace…').disabled, true);
  assert.equal(find(only, 'Current workspace').disabled, true);
  const other = workspaceMenu({ workspace: ws, isActive: false, canDelete: true, handlers });
  assert.equal(find(other, 'Delete workspace…').disabled, false);
  assert.equal(find(other, 'Open').disabled, false);
});
test('multi menu: distribute needs 3+, delete names the count', () => {
  const objects = (n) => Array.from({ length: n }, (_v, i) => ({ kind: 'note', id: i, item: { id: i, pinned: false } }));
  const two = multiMenu({ objects: objects(2), handlers });
  assert.equal(find(two, 'Distribute').disabled, true);
  assert.ok(find(two, 'Delete 2 objects'));
  const three = multiMenu({ objects: objects(3), handlers });
  assert.equal(find(three, 'Distribute').disabled, false);
  assert.equal(labels(three)[0], '3 selected');
});
