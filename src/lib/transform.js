/**
 * transform.js — geometry of resizing, snapping, aligning. Pure functions.
 * A rect is { x, y, w, h } in canvas (world) coordinates.
 */

/**
 * Resizes `rect` by dragging one of its 8 handles by (dx, dy).
 * @param handle  'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
 * @param options { minW, minH, keepAspect }  — the opposite edge stays fixed at the minimum size.
 *   keepAspect: corners scale uniformly; edge handles change the other side around the centre.
 */
export function resizeRect(rect, handle, dx, dy, { minW = 1, minH = 1, keepAspect = false } = {}) {
  const { x, y, w, h } = rect;
  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');

  let nw = east ? w + dx : west ? w - dx : w;
  let nh = south ? h + dy : north ? h - dy : h;

  if (keepAspect) {
    const ratio = w / h;
    const corner = (west || east) && (north || south);
    if (corner) {
      const scale = Math.max(nw / w, nh / h, minW / w, minH / h);
      nw = w * scale;
      nh = h * scale;
    } else if (west || east) {
      nw = Math.max(nw, minW, minH * ratio);
      nh = nw / ratio;
    } else {
      nh = Math.max(nh, minH, minW / ratio);
      nw = nh * ratio;
    }
  } else {
    nw = Math.max(nw, minW);
    nh = Math.max(nh, minH);
  }

  // Keep the edge/corner opposite to the handle where it was.
  let nx = west ? x + w - nw : x;
  let ny = north ? y + h - nh : y;
  // Edge handles with keepAspect grow the other axis around the centre.
  if (keepAspect && !((west || east) && (north || south))) {
    if (west || east) ny = y + (h - nh) / 2;
    else nx = x + (w - nw) / 2;
  }
  return { x: nx, y: ny, w: nw, h: nh };
}

/** The three x-lines (left, centre, right) or y-lines (top, middle, bottom) of a rect. */
const linesX = (r) => [r.x, r.x + r.w / 2, r.x + r.w];
const linesY = (r) => [r.y, r.y + r.h / 2, r.y + r.h];

/** Best correction (smallest distance within threshold) so one of `mine` lines meets one of `theirs`. */
function bestSnap(mine, theirs, threshold) {
  let best = null;
  for (const a of mine) {
    for (const b of theirs) {
      const delta = b - a;
      if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, line: b };
      }
    }
  }
  return best;
}

/**
 * Snaps a moving rect to the edges and centres of other rects.
 * @returns { dx, dy, guides } — add dx/dy to the rect's position; `guides` are the alignment
 *          lines to draw: [{ axis: 'x', pos }] (a vertical line) / [{ axis: 'y', pos }].
 */
export function snapMove(rect, others, threshold = 6) {
  const xs = others.flatMap(linesX);
  const ys = others.flatMap(linesY);
  const snapX = bestSnap(linesX(rect), xs, threshold);
  const snapY = bestSnap(linesY(rect), ys, threshold);
  const guides = [];
  if (snapX) guides.push({ axis: 'x', pos: snapX.line });
  if (snapY) guides.push({ axis: 'y', pos: snapY.line });
  return { dx: snapX ? snapX.delta : 0, dy: snapY ? snapY.delta : 0, guides };
}

/** Bounding box of several rects, or null if there are none. */
export function boundsOf(rects) {
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * New positions that align rects to each other.
 * @param mode 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
 * @param rects [{ id, x, y, w, h }]  → returns [{ id, x, y }]
 */
export function alignRects(rects, mode) {
  const box = boundsOf(rects);
  if (!box) return [];
  return rects.map((r) => {
    let { x, y } = r;
    if (mode === 'left') x = box.x;
    else if (mode === 'hcenter') x = box.x + (box.w - r.w) / 2;
    else if (mode === 'right') x = box.x + box.w - r.w;
    else if (mode === 'top') y = box.y;
    else if (mode === 'vcenter') y = box.y + (box.h - r.h) / 2;
    else if (mode === 'bottom') y = box.y + box.h - r.h;
    return { id: r.id, x, y };
  });
}

/**
 * Spaces rects evenly between the first and last (needs 3 or more).
 * @param axis 'h' (left to right) | 'v' (top to bottom)  → returns [{ id, x, y }]
 */
export function distributeRects(rects, axis) {
  if (rects.length < 3) return rects.map((r) => ({ id: r.id, x: r.x, y: r.y }));
  const horizontal = axis === 'h';
  const sorted = [...rects].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const size = (r) => (horizontal ? r.w : r.h);
  const start = horizontal ? sorted[0].x : sorted[0].y;
  const last = sorted[sorted.length - 1];
  const end = (horizontal ? last.x : last.y) + size(last);
  const gap = (end - start - sorted.reduce((sum, r) => sum + size(r), 0)) / (sorted.length - 1);
  let cursor = start;
  return sorted.map((r) => {
    const position = cursor;
    cursor += size(r) + gap;
    return horizontal ? { id: r.id, x: position, y: r.y } : { id: r.id, x: r.x, y: position };
  });
}
