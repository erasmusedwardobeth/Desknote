/**
 * usePinnedWindowDrag — mouse handlers that move/resize a pinned note window.
 *
 * Returns four sets of handlers. Spread one onto an element:
 *   <header {...drag.move}>            drag the window by its header
 *   <div {...drag.resizeCorner}>       resize both width and height
 *   <div {...drag.resizeRight}>        resize width only
 *   <div {...drag.resizeBottom}>       resize height only
 *
 * HOW IT WORKS
 *   The mouse position is read in SCREEN coordinates (screenX/screenY). Window-relative
 *   coordinates would be wrong, because the window itself moves under the mouse.
 *   Mouse movement is added up in `pending` and sent to Rust in batches, one request at a
 *   time, so a fast mouse never floods the app with calls.
 *
 * Rust side: src-tauri/src/pinned_geometry.rs (via api/pinnedGeometry.js)
 */
import { useMemo } from 'react';
import { movePinnedWindowBy, resizePinnedWindowBy } from '../api/pinnedGeometry.js';

/**
 * Builds the pointer handlers for one kind of drag.
 * @param send(dx, dy)   async function that applies a change (calls Rust)
 * @param options.ignoreButtons  true = do not start a drag when the press lands on a button
 */
function makeDragger(send, { ignoreButtons = false } = {}) {
  let last = null; // previous mouse position, or null when no drag is active
  let pendingX = 0;
  let pendingY = 0;
  let busy = false;

  /** Sends everything accumulated so far; repeats until nothing is left. */
  const pump = async () => {
    if (busy) return;
    busy = true;
    while (pendingX !== 0 || pendingY !== 0) {
      const dx = pendingX;
      const dy = pendingY;
      pendingX = 0;
      pendingY = 0;
      try { await send(dx, dy); } catch { /* window closed mid-drag: ignore */ }
    }
    busy = false;
  };

  const end = (event) => {
    last = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return {
    onPointerDown(event) {
      if (event.button !== 0) return;
      if (ignoreButtons && event.target.closest('button,input,label')) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      last = { x: event.screenX, y: event.screenY };
    },
    onPointerMove(event) {
      if (!last) return;
      pendingX += event.screenX - last.x;
      pendingY += event.screenY - last.y;
      last = { x: event.screenX, y: event.screenY };
      pump();
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}

export function usePinnedWindowDrag(noteId) {
  return useMemo(() => ({
    move: makeDragger((dx, dy) => movePinnedWindowBy(noteId, dx, dy), { ignoreButtons: true }),
    resizeCorner: makeDragger((dx, dy) => resizePinnedWindowBy(noteId, dx, dy)),
    resizeRight: makeDragger((dx) => resizePinnedWindowBy(noteId, dx, 0)),
    resizeBottom: makeDragger((_dx, dy) => resizePinnedWindowBy(noteId, 0, dy)),
  }), [noteId]);
}
