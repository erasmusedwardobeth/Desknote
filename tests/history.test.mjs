import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../src/lib/history.js';

const move = (from, to, key) => ({ label: 'Move', mergeKey: key,
  before: [{ op: 'update', kind: 'note', id: 1, props: { x: from } }],
  after: [{ op: 'update', kind: 'note', id: 1, props: { x: to } }] });

test('undo / redo walk the stack in order', () => {
  const h = createHistory();
  h.push({ label: 'A', before: [], after: [] }, 0);
  h.push({ label: 'B', before: [], after: [] }, 10_000);
  assert.equal(h.nextUndoLabel(), 'B');
  assert.equal(h.undo().label, 'B');
  assert.equal(h.undo().label, 'A');
  assert.equal(h.undo(), null);
  assert.equal(h.canUndo(), false);
  assert.equal(h.redo().label, 'A');
  assert.equal(h.redo().label, 'B');
  assert.equal(h.redo(), null);
});
test('a new action clears the redo stack', () => {
  const h = createHistory();
  h.push({ label: 'A', before: [], after: [] }, 0);
  h.undo();
  assert.equal(h.canRedo(), true);
  h.push({ label: 'B', before: [], after: [] }, 10_000);
  assert.equal(h.canRedo(), false);
});
test('drag moves with the same key collapse into one step (oldest before, newest after)', () => {
  const h = createHistory({ mergeWindowMs: 600 });
  h.push(move(0, 5, 'drag'), 0);
  h.push(move(5, 9, 'drag'), 100);
  h.push(move(9, 20, 'drag'), 200);
  const entry = h.undo();
  assert.equal(entry.before[0].props.x, 0);
  assert.equal(entry.after[0].props.x, 20);
  assert.equal(h.canUndo(), false);
});
test('different key or a long pause starts a new step', () => {
  const h = createHistory({ mergeWindowMs: 600 });
  h.push(move(0, 5, 'a'), 0);
  h.push(move(5, 9, 'b'), 100);
  h.push(move(9, 12, 'b'), 5000);
  assert.equal(h.undo().after[0].props.x, 12);
  assert.equal(h.undo().after[0].props.x, 9);
  assert.equal(h.undo().after[0].props.x, 5);
});
test('limit drops the oldest entries', () => {
  const h = createHistory({ limit: 3 });
  for (let i = 0; i < 5; i += 1) h.push({ label: `E${i}`, before: [], after: [] }, i * 10_000);
  assert.equal(h.undo().label, 'E4');
  assert.equal(h.undo().label, 'E3');
  assert.equal(h.undo().label, 'E2');
  assert.equal(h.undo(), null);
});
