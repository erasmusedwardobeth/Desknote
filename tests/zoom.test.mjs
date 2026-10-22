import test from 'node:test';
import assert from 'node:assert/strict';
import { clampZoom, wheelFactor, zoomAbout, fitView, scaleRectAbout } from '../src/lib/zoom.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const toScreen = (v, p) => ({ x: p.x * v.zoom + v.shiftX, y: p.y * v.zoom + v.shiftY });

test('clampZoom', () => {
  assert.equal(clampZoom(0.1), 0.4);
  assert.equal(clampZoom(9), 2.2);
  assert.equal(clampZoom(1), 1);
});
test('wheelFactor: up zooms in, down zooms out, one notch is limited', () => {
  assert.ok(wheelFactor(-100) > 1);
  assert.ok(wheelFactor(100) < 1);
  assert.equal(wheelFactor(-100000), 1.25);
  assert.equal(wheelFactor(100000), 0.8);
  assert.equal(wheelFactor(0), 1);
});
test('zoomAbout keeps the point under the cursor fixed', () => {
  const view = { zoom: 1, shiftX: 40, shiftY: 45 };
  const cursor = { x: 300, y: 200 };
  const worldBefore = { x: (cursor.x - view.shiftX) / view.zoom, y: (cursor.y - view.shiftY) / view.zoom };
  const next = zoomAbout(view, 1.5, cursor);
  near(next.zoom, 1.5);
  const after = toScreen(next, worldBefore);
  near(after.x, cursor.x); near(after.y, cursor.y);
});
test('zoomAbout at the limit does not drift', () => {
  const view = { zoom: 2.2, shiftX: 10, shiftY: 10 };
  const next = zoomAbout(view, 1.25, { x: 100, y: 100 });
  assert.deepEqual(next, view);
});
test('fitView centres the rects and never zooms past 100%', () => {
  const rects = [{ x: 0, y: 0, w: 100, h: 50 }];
  const v = fitView(rects, { w: 1000, h: 600 }, { padding: 50 });
  assert.equal(v.zoom, 1);
  const centre = toScreen(v, { x: 50, y: 25 });
  near(centre.x, 500); near(centre.y, 300);
  const big = fitView([{ x: 0, y: 0, w: 4000, h: 2000 }], { w: 1000, h: 600 }, { padding: 0 });
  near(big.zoom, 0.4);
  assert.deepEqual(fitView([], { w: 1, h: 1 }), { zoom: 1, shiftX: 40, shiftY: 45 });
});
test('scaleRectAbout scales around the centre and respects limits', () => {
  const r = { x: 100, y: 100, w: 200, h: 100 };
  const up = scaleRectAbout(r, 1.5);
  near(up.w, 300); near(up.h, 150);
  near(up.x + up.w / 2, 200); near(up.y + up.h / 2, 150);
  const floor = scaleRectAbout(r, 0.1, { minW: 170, minH: 120 });
  near(floor.h, 120); near(floor.w / floor.h, 2);
  const cap = scaleRectAbout(r, 10, { maxW: 400, maxH: 400 });
  near(cap.w, 400);
});
