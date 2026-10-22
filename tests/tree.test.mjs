import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, filterTree, findNode, ancestorsOf, expandableIds, flattenVisible, nodeId, parseNodeId } from '../src/lib/tree.js';

const workspaces = [{ id: 1, name: 'Work' }, { id: 2, name: 'Home' }];
const regions = [
  { id: 10, title: 'Sprint', kind: 'frame', workspaceId: 1 },
  { id: 11, title: 'Ideas', kind: 'group', workspaceId: 1 },
  { id: 12, title: 'Chores', kind: 'group', workspaceId: 2 },
];
const notes = [
  { id: 1, title: 'Plan', groupId: 10, workspaceId: 1, pinned: true },
  { id: 2, title: 'Loose note', groupId: null, workspaceId: 1 },
  { id: 3, title: '', groupId: 12, workspaceId: 2 },
  { id: 4, title: 'Old note (no workspace yet)', groupId: null },                  // -> first workspace
  { id: 5, title: 'Points at a region of another workspace', groupId: 12, workspaceId: 1 }, // -> loose in ws 1
];

test('ids round-trip', () => {
  assert.equal(nodeId('note', 12), 'note:12');
  assert.deepEqual(parseNodeId('frame:3'), { type: 'frame', refId: 3 });
});

test('buildTree nests notes under their region and keeps others loose', () => {
  const tree = buildTree({ workspaces, regions, notes });
  assert.equal(tree.length, 2);
  const work = tree[0];
  assert.deepEqual(work.children.map((c) => c.id), ['frame:10', 'group:11', 'note:2', 'note:4', 'note:5']);
  assert.deepEqual(work.children[0].children.map((c) => c.id), ['note:1']);
  assert.equal(work.children[0].children[0].meta.pinned, true);
  const home = tree[1];
  assert.deepEqual(home.children.map((c) => c.id), ['group:12']);
  assert.equal(home.children[0].children[0].name, 'Untitled');
});

test('every note appears exactly once in the whole tree', () => {
  const tree = buildTree({ workspaces, regions, notes });
  const seen = [];
  const walk = (n) => { if (n.type === 'note') seen.push(n.id); n.children.forEach(walk); };
  tree.forEach(walk);
  assert.equal(seen.length, notes.length);
  assert.equal(new Set(seen).size, notes.length);
});

test('no workspaces -> empty tree, no crash', () => {
  assert.deepEqual(buildTree({ workspaces: [], regions, notes }), []);
});

test('filterTree keeps matches with their ancestors; a matching node keeps its children', () => {
  const tree = buildTree({ workspaces, regions, notes });
  const hit = filterTree(tree, 'plan');
  assert.deepEqual(hit.map((w) => w.id), ['workspace:1']);
  assert.deepEqual(hit[0].children.map((c) => c.id), ['frame:10']);
  assert.deepEqual(hit[0].children[0].children.map((c) => c.id), ['note:1']);
  const frame = filterTree(tree, 'sprint');
  assert.deepEqual(frame[0].children[0].children.map((c) => c.id), ['note:1']);
  assert.equal(filterTree(tree, '   '), tree);
  assert.deepEqual(filterTree(tree, 'zzz'), []);
});

test('findNode / ancestorsOf', () => {
  const tree = buildTree({ workspaces, regions, notes });
  assert.equal(findNode(tree, 'note:1').name, 'Plan');
  assert.equal(findNode(tree, 'note:999'), null);
  assert.deepEqual(ancestorsOf(tree, 'note:1'), ['workspace:1', 'frame:10']);
  assert.deepEqual(ancestorsOf(tree, 'workspace:2'), []);
  assert.equal(ancestorsOf(tree, 'nope'), null);
});

test('flattenVisible respects the expanded set', () => {
  const tree = buildTree({ workspaces, regions, notes });
  const closed = flattenVisible(tree, new Set());
  assert.deepEqual(closed.map((r) => r.node.id), ['workspace:1', 'workspace:2']);
  const open = flattenVisible(tree, new Set(['workspace:1', 'frame:10']));
  assert.deepEqual(open.map((r) => [r.node.id, r.depth]).slice(0, 4), [['workspace:1', 0], ['frame:10', 1], ['note:1', 2], ['group:11', 1]]);
  assert.ok(expandableIds(tree).includes('frame:10'));
  assert.ok(!expandableIds(tree).includes('group:11'));
});
