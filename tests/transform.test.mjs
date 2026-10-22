import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeRect, snapMove, boundsOf, alignRects, distributeRects } from '../src/lib/transform.js';

const R = { x: 100, y: 100, w: 200, h: 100 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('east/south handles grow; west/north handles move the origin', () => {
  assert.deepEqual(resizeRect(R, 'e', 20, 0), { x: 100, y: 100, w: 220, h: 100 });
  assert.deepEqual(resizeRect(R, 's', 0, 10), { x: 100, y: 100, w: 200, h: 110 });
  assert.deepEqual(resizeRect(R, 'w', -30, 0), { x: 70, y: 100, w: 230, h: 100 });
  assert.deepEqual(resizeRect(R, 'n', 0, -10), { x: 100, y: 90, w: 200, h: 110 });
  assert.deepEqual(resizeRect(R, 'se', 5, 5), { x: 100, y: 100, w: 205, h: 105 });
  assert.deepEqual(resizeRect(R, 'nw', -10, -10), { x: 90, y: 90, w: 210, h: 110 });
});
test('minimum size is enforced and the opposite edge stays put', () => {
  const small = resizeRect(R, 'w', 500, 0, { minW: 50 });   // drag far past the right edge
  assert.equal(small.w, 50);
  assert.equal(small.x + small.w, 300);
  const top = resizeRect(R, 'n', 0, 500, { minH: 40 });
  assert.equal(top.h, 40);
  assert.equal(top.y + top.h, 200);
});
test('keepAspect corners scale uniformly and anchor the opposite corner', () => {
  const r = resizeRect(R, 'se', 100, 0, { keepAspect: true });
  near(r.w / r.h, 2);
  assert.equal(r.x, 100); assert.equal(r.y, 100);
  const nw = resizeRect(R, 'nw', -100, 0, { keepAspect: true });
  near(nw.w / nw.h, 2);
  near(nw.x + nw.w, 300); near(nw.y + nw.h, 200);
});
test('keepAspect edges change the other side around the centre', () => {
  const r = resizeRect(R, 'e', 100, 0, { keepAspect: true });
  near(r.w, 300); near(r.h, 150); near(r.y, 75);
});
test('snapMove snaps to the nearest edge/centre within the threshold', () => {
  const moving = { x: 103, y: 0, w: 50, h: 50 };
  const other = { x: 100, y: 200, w: 80, h: 40 };
  const s = snapMove(moving, [other], 6);
  assert.equal(s.dx, -3);
  assert.deepEqual(s.guides.find((g) => g.axis === 'x'), { axis: 'x', pos: 100 });
  const far = snapMove({ x: 500, y: 500, w: 10, h: 10 }, [other], 6);
  assert.deepEqual(far, { dx: 0, dy: 0, guides: [] });
});
test('boundsOf', () => {
  assert.equal(boundsOf([]), null);
  assert.deepEqual(boundsOf([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 30 }]), { x: 0, y: 0, w: 30, h: 35 });
});
test('alignRects', () => {
  const rects = [{ id: 1, x: 0, y: 0, w: 10, h: 10 }, { id: 2, x: 50, y: 20, w: 30, h: 20 }];
  assert.deepEqual(alignRects(rects, 'left'), [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 20 }]);
  assert.deepEqual(alignRects(rects, 'right'), [{ id: 1, x: 70, y: 0 }, { id: 2, x: 50, y: 20 }]);
  assert.deepEqual(alignRects(rects, 'hcenter'), [{ id: 1, x: 35, y: 0 }, { id: 2, x: 25, y: 20 }]);
  assert.deepEqual(alignRects(rects, 'bottom'), [{ id: 1, x: 0, y: 30 }, { id: 2, x: 50, y: 20 }]);
});
test('distributeRects gives equal gaps and keeps the ends fixed', () => {
  const rects = [{ id: 'a', x: 0, y: 0, w: 10, h: 10 }, { id: 'b', x: 15, y: 0, w: 10, h: 10 }, { id: 'c', x: 100, y: 0, w: 10, h: 10 }];
  const out = distributeRects(rects, 'h');
  assert.deepEqual(out.map((o) => o.x), [0, 50, 100]);
  assert.deepEqual(distributeRects(rects.slice(0, 2), 'h').map((o) => o.x), [0, 15]);
});
