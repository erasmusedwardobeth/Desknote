import test from 'node:test';
import assert from 'node:assert/strict';
import { isDark, imageLayerStyle, gridLayerStyle, nextWorkspaceName, BG_FITS } from '../src/lib/background.js';

test('isDark', () => {
  assert.equal(isDark('#000000'), true);
  assert.equal(isDark('#0b1f3a'), true);
  assert.equal(isDark('#ffffff'), false);
  assert.equal(isDark('#fde68a'), false);
  assert.equal(isDark('nonsense'), false);
  assert.equal(isDark(undefined), false);
});
test('imageLayerStyle: null without an image or url', () => {
  assert.equal(imageLayerStyle({ bgImage: null }, 'asset://x'), null);
  assert.equal(imageLayerStyle({ bgImage: '/a.png' }, ''), null);
  assert.equal(imageLayerStyle(null, 'x'), null);
});
test('imageLayerStyle maps every fit mode', () => {
  const base = { bgImage: '/a.png', bgOpacity: 0.4 };
  const cover = imageLayerStyle({ ...base, bgFit: 'cover' }, 'u');
  assert.equal(cover.backgroundSize, 'cover'); assert.equal(cover.backgroundRepeat, 'no-repeat'); assert.equal(cover.opacity, 0.4);
  assert.equal(imageLayerStyle({ ...base, bgFit: 'contain' }, 'u').backgroundSize, 'contain');
  const tile = imageLayerStyle({ ...base, bgFit: 'tile' }, 'u');
  assert.equal(tile.backgroundRepeat, 'repeat'); assert.equal(tile.backgroundSize, 'auto');
  const center = imageLayerStyle({ ...base, bgFit: 'center' }, 'u');
  assert.equal(center.backgroundRepeat, 'no-repeat'); assert.equal(center.backgroundSize, 'auto');
  assert.equal(imageLayerStyle({ bgImage: '/a.png', bgFit: 'cover' }, 'u').opacity, 1);
  assert.deepEqual(BG_FITS.map((f) => f.id), ['cover', 'contain', 'tile', 'center']);
});
test('gridLayerStyle: off, light and dark', () => {
  assert.equal(gridLayerStyle({ grid: false, bgColor: '#fff' }), null);
  assert.match(gridLayerStyle({ grid: true, bgColor: '#ffffff' }).backgroundImage, /rgba\(0,0,0/);
  assert.match(gridLayerStyle({ grid: true, bgColor: '#000000' }).backgroundImage, /rgba\(255,255,255/);
});
test('nextWorkspaceName skips used names', () => {
  assert.equal(nextWorkspaceName([{ name: 'My workspace' }]), 'Workspace 2');
  assert.equal(nextWorkspaceName([{ name: 'A' }, { name: 'Workspace 3' }]), 'Workspace 4');
  assert.equal(nextWorkspaceName([{ name: 'Workspace 2' }]), 'Workspace 3');
});
