/**
 * tree.js — builds the outline shown in the left panel. Pure functions (no React, no Tauri).
 *
 *   workspace
 *     ├─ frame / group      (a region; notes whose groupId points at it are its children)
 *     │    └─ note
 *     └─ note               (a "loose" note that belongs to no region)
 *
 * Every node: { id, type, refId, name, children, meta }
 *   id     unique string such as "note:12" (also used as the SELECTION id, see selection.js)
 *   type   'workspace' | 'frame' | 'group' | 'note'
 *   refId  the database id of the thing
 *
 * `workspaceId` on a note/region may be missing (data created before workspaces existed);
 * such items belong to the FIRST workspace.
 */

/** "note" + 12 → "note:12". */
export const nodeId = (type, refId) => `${type}:${refId}`;

/** "note:12" → { type: 'note', refId: 12 }. */
export function parseNodeId(id) {
  const index = String(id).indexOf(':');
  return { type: String(id).slice(0, index), refId: Number(String(id).slice(index + 1)) };
}

const byId = (a, b) => (a.id ?? 0) - (b.id ?? 0);

const noteNode = (note) => ({
  id: nodeId('note', note.id), type: 'note', refId: note.id,
  name: note.title || 'Untitled', children: [],
  meta: { pinned: !!note.pinned, completed: !!note.completed },
});

/**
 * @param {{workspaces: Array, regions: Array, notes: Array}} data
 * @returns {Array} one workspace node per workspace, in the given order
 */
export function buildTree({ workspaces, regions, notes }) {
  const fallback = workspaces[0]?.id ?? null;
  const workspaceOf = (item) => item.workspaceId ?? fallback;

  return workspaces.map((workspace) => {
    const wsRegions = regions.filter((region) => workspaceOf(region) === workspace.id).sort(byId);
    const wsNotes = notes.filter((note) => workspaceOf(note) === workspace.id).sort(byId);
    const regionIds = new Set(wsRegions.map((region) => region.id));

    const regionNodes = wsRegions.map((region) => ({
      id: nodeId(region.kind, region.id), type: region.kind, refId: region.id,
      name: region.title || 'Untitled',
      children: wsNotes.filter((note) => note.groupId === region.id).map(noteNode),
      meta: {},
    }));
    const looseNodes = wsNotes.filter((note) => !regionIds.has(note.groupId)).map(noteNode);

    return {
      id: nodeId('workspace', workspace.id), type: 'workspace', refId: workspace.id,
      name: workspace.name || 'Untitled workspace',
      children: [...regionNodes, ...looseNodes],
      meta: {},
    };
  });
}

/**
 * Keeps nodes whose name contains `query` (case-insensitive) and the ancestors needed to
 * reach them. A node that matches itself keeps all of its children. Empty query = unchanged.
 */
export function filterTree(tree, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return tree;
  const walk = (node) => {
    if (node.name.toLowerCase().includes(needle)) return node;
    const children = node.children.map(walk).filter(Boolean);
    return children.length ? { ...node, children } : null;
  };
  return tree.map(walk).filter(Boolean);
}

/** The node with this id, or null. */
export function findNode(tree, id) {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Ids of every ancestor of `id`, outermost first (empty if not found or at the top). */
export function ancestorsOf(tree, id, trail = []) {
  for (const node of tree) {
    if (node.id === id) return trail;
    const found = ancestorsOf(node.children, id, [...trail, node.id]);
    if (found) return found;
  }
  return null;
}

/** Every node id that has children (used to "expand all", e.g. while searching). */
export function expandableIds(tree) {
  const ids = [];
  const walk = (node) => { if (node.children.length) ids.push(node.id); node.children.forEach(walk); };
  tree.forEach(walk);
  return ids;
}

/**
 * The rows currently visible, top to bottom: [{ node, depth }].
 * `expanded` is a Set of node ids that are open. Used for rendering and arrow-key navigation.
 */
export function flattenVisible(tree, expanded) {
  const rows = [];
  const walk = (node, depth) => {
    rows.push({ node, depth });
    if (expanded.has(node.id)) node.children.forEach((child) => walk(child, depth + 1));
  };
  tree.forEach((node) => walk(node, 0));
  return rows;
}
