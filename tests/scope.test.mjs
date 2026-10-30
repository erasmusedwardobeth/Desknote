import test from 'node:test';
import assert from 'node:assert/strict';
import { inWorkspace, regionAt, centerOf, placeInside, screenToWorld, centerOfView, resolveSelection } from '../src/lib/scope.js';

test('inWorkspace: items without a workspace belong to the first one', () => {
  assert.equal(inWorkspace({ workspaceId: 2 }, 2, 1), true);
  assert.equal(inWorkspace({ workspaceId: 2 }, 1, 1), false);
  assert.equal(inWorkspace({}, 1, 1), true);
  assert.equal(inWorkspace({ workspaceId: null }, 2, 1), false);
});
test('regionAt returns the smallest containing region, or null', () => {
  const big = { id: 1, x: 0, y: 0, w: 500, h: 500 };
  const small = { id: 2, x: 100, y: 100, w: 100, h: 100 };
  assert.equal(regionAt({ x: 150, y: 150 }, [big, small]).id, 2);
  assert.equal(regionAt({ x: 150, y: 150 }, [small, big]).id, 2);
  assert.equal(regionAt({ x: 400, y: 400 }, [big, small]).id, 1);
  assert.equal(regionAt({ x: 900, y: 900 }, [big, small]), null);
  assert.equal(regionAt({ x: 0, y: 0 }, [big]).id, 1);   // edges count as inside
  assert.equal(regionAt({ x: 1, y: 1 }, []), null);
});
test('centerOf and placeInside', () => {
  assert.deepEqual(centerOf({ x: 10, y: 20, w: 100, h: 50 }), { x: 60, y: 45 });
  assert.deepEqual(placeInside({}, { x: 100, y: 200, w: 300, h: 300 }), { x: 116, y: 240 });
});
test('screenToWorld inverts the canvas transform', () => {
  const view = { zoom: 2, shiftX: 40, shiftY: 10 };
  const world = screenToWorld({ x: 240, y: 110 }, view);
  assert.deepEqual(world, { x: 100, y: 50 });
  assert.equal(world.x * view.zoom + view.shiftX, 240);
  assert.deepEqual(centerOfView({ w: 400, h: 200 }, { zoom: 1, shiftX: 0, shiftY: 0 }), { x: 200, y: 100 });
});

test('resolveSelection maps node ids to objects and skips missing ones', () => {
  const notes = [{ id: 1, title: 'a' }, { id: 2, title: 'b' }];
  const regions = [{ id: 7, kind: 'frame' }, { id: 8, kind: 'group' }];
  const objects = resolveSelection(['note:2', 'frame:7', 'group:8', 'note:99', 'frame:99'], notes, regions);
  assert.deepEqual(objects.map((o) => [o.kind, o.id]), [['note', 'note:2'], ['region', 'frame:7'], ['region', 'group:8']]);
  assert.equal(objects[0].item, notes[1]);
  assert.deepEqual(resolveSelection([], notes, regions), []);
  assert.deepEqual(resolveSelection(['workspace:1'], notes, regions), []);
});
