import test from 'node:test';
import assert from 'node:assert/strict';
import { clickItem, clickEmpty, prune, rectFromPoints, rectsOverlap, pickInRect, rangeBetween } from '../src/lib/selection.js';

test('plain click selects only that item', () => {
  assert.deepEqual(clickItem([], 'note:1'), ['note:1']);
  assert.deepEqual(clickItem(['note:2'], 'note:1'), ['note:1']);
});
test('clicking a member of a multi-selection keeps it (so it can be dragged)', () => {
  const sel = ['note:1', 'note:2'];
  assert.equal(clickItem(sel, 'note:2'), sel);
});
test('shift-click toggles and never mutates', () => {
  const sel = ['note:1'];
  assert.deepEqual(clickItem(sel, 'note:2', { shift: true }), ['note:1', 'note:2']);
  assert.deepEqual(clickItem(['note:1', 'note:2'], 'note:1', { shift: true }), ['note:2']);
  assert.deepEqual(sel, ['note:1']);
});
test('clicking empty space clears, except with shift', () => {
  assert.deepEqual(clickEmpty(['note:1']), []);
  assert.deepEqual(clickEmpty(['note:1'], { shift: true }), ['note:1']);
});
test('prune drops ids that no longer exist', () => {
  assert.deepEqual(prune(['a', 'b', 'c'], ['b']), ['b']);
});
test('rectFromPoints works in every drag direction', () => {
  assert.deepEqual(rectFromPoints({ x: 10, y: 20 }, { x: 4, y: 50 }), { x: 4, y: 20, w: 6, h: 30 });
});
test('overlap: touching edges do not count', () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }), false);
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 }), true);
});
test('pickInRect returns the touched items', () => {
  const items = [{ id: 'a', x: 0, y: 0, w: 10, h: 10 }, { id: 'b', x: 100, y: 100, w: 10, h: 10 }];
  assert.deepEqual(pickInRect(items, { x: 5, y: 5, w: 20, h: 20 }), ['a']);
});
test('rangeBetween is order independent and safe on unknown ids', () => {
  const ids = ['a', 'b', 'c', 'd'];
  assert.deepEqual(rangeBetween(ids, 'b', 'd'), ['b', 'c', 'd']);
  assert.deepEqual(rangeBetween(ids, 'd', 'b'), ['b', 'c', 'd']);
  assert.deepEqual(rangeBetween(ids, 'zzz', 'c'), ['c']);
});
