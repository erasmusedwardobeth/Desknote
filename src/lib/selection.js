/**
 * selection.js — which objects are selected. Pure functions.
 *
 * A selection is a plain array of node ids ("note:12", "frame:3" …, same ids as tree.js).
 * Functions never change their input; they return a new array.
 */

/** Selection after a plain click (shift = false) or shift-click (shift = true) on `id`.
 *  Clicking an object that is ALREADY part of a multi-selection keeps the selection,
 *  so the whole group can then be dragged. */
export function clickItem(selection, id, { shift = false } = {}) {
  if (shift) return selection.includes(id) ? selection.filter((item) => item !== id) : [...selection, id];
  if (selection.includes(id) && selection.length > 1) return selection;
  return [id];
}

/** Selection after clicking empty space: cleared, unless shift is held. */
export function clickEmpty(selection, { shift = false } = {}) {
  return shift ? selection : [];
}

/** Drops ids that no longer exist (call after deletes or workspace switches). */
export function prune(selection, validIds) {
  const valid = new Set(validIds);
  return selection.filter((id) => valid.has(id));
}

/** A rectangle with positive w/h from two corner points (a drag can go in any direction). */
export function rectFromPoints(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Do two {x,y,w,h} rectangles overlap (touching edges do not count)? */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Ids of the items touched by a marquee rectangle. items: [{ id, x, y, w, h }] */
export function pickInRect(items, rect) {
  return items.filter((item) => rectsOverlap(item, rect)).map((item) => item.id);
}

/** Shift-click range in the tree: every id between `anchor` and `target` in `orderedIds`. */
export function rangeBetween(orderedIds, anchor, target) {
  const from = orderedIds.indexOf(anchor);
  const to = orderedIds.indexOf(target);
  if (from === -1 || to === -1) return target == null ? [] : [target];
  const [start, end] = from <= to ? [from, to] : [to, from];
  return orderedIds.slice(start, end + 1);
}
