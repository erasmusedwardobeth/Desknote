/**
 * scope.js — which workspace an object belongs to, and where objects sit relative to
 * groups/frames. Pure functions.
 */
import { parseNodeId } from './tree.js';

/** Does `item` (a note or region) belong to workspace `workspaceId`?
 *  Items without a workspaceId (old data) belong to `firstId`, the first workspace. */
export const inWorkspace = (item, workspaceId, firstId) => (item.workspaceId ?? firstId) === workspaceId;

const contains = (rect, point) =>
  point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;

/** The centre point of a {x,y,w,h}. */
export const centerOf = (rect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

/**
 * The group/frame that contains `point`; when several do (nested), the SMALLEST one.
 * Returns null when the point is on bare canvas. Used when a note is dropped: the note joins
 * the region it was dropped into, or leaves its region when dropped outside.
 * @param regions [{ id, x, y, w, h }]
 */
export function regionAt(point, regions) {
  let best = null;
  for (const region of regions) {
    if (!contains(region, point)) continue;
    if (best === null || region.w * region.h < best.w * best.h) best = region;
  }
  return best;
}

/** Where to put a note so it sits inside `region` (below its title). */
export function placeInside(note, region) {
  return { x: region.x + 16, y: region.y + 40 };
}

/** Screen point (relative to the canvas element) → canvas (world) point. */
export function screenToWorld(point, view) {
  return { x: (point.x - view.shiftX) / view.zoom, y: (point.y - view.shiftY) / view.zoom };
}

/** The canvas point at the centre of a viewport {w, h}. */
export function centerOfView(viewport, view) {
  return screenToWorld({ x: viewport.w / 2, y: viewport.h / 2 }, view);
}

/**
 * Turns a selection (node ids such as "note:3", "frame:7") into the objects themselves:
 * [{ kind: 'note' | 'region', id, item }]. Ids that no longer exist are skipped.
 */
export function resolveSelection(ids, notes, regions) {
  const objects = [];
  for (const id of ids) {
    const { type, refId } = parseNodeId(id);
    if (type === 'note') {
      const item = notes.find((note) => note.id === refId);
      if (item) objects.push({ kind: 'note', id, item });
    } else if (type === 'group' || type === 'frame') {
      const item = regions.find((region) => region.id === refId);
      if (item) objects.push({ kind: 'region', id, item });
    }
  }
  return objects;
}
