/**
 * useCanvasDrag — all mouse dragging on the workspace canvas.
 *
 * One drag at a time is tracked in `dragRef`. Its `mode` says what is dragged:
 *   'move'          a note card            'resize'         a note card corner
 *   'region'        a group/frame          'region-resize'  a group/frame corner
 *   'pan'           the empty canvas (moves the camera)
 *
 * While dragging, only React state changes (smooth). The change is written to
 * the database once, when the mouse is released (finishDrag).
 *
 * Distances are divided by `zoom` so dragging feels right at any zoom level.
 */
import { useRef } from 'react';
import { saveNote } from '../api/notes.js';
import { saveRegion } from '../api/regions.js';
import { MIN_Y, NOTE_MIN, REGION_MIN } from '../lib/constants.js';

export function useCanvasDrag({ zoom, shift, setShift, notes, regions, patchNote, patchRegion, onError }) {
  const dragRef = useRef(null);

  /** Mouse down on a note (mode 'move') or its resize handle (mode 'resize'). */
  const startNoteDrag = (event, note, mode = 'move') => {
    if (event.button !== 0) return;
    event.stopPropagation();
    dragRef.current = { mode, noteId: note.id, startX: event.clientX, startY: event.clientY, x: note.x, y: note.y, w: note.w, h: note.h, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** Mouse down on a group/frame body. */
  const startRegionDrag = (event, region) => {
    event.stopPropagation();
    dragRef.current = { mode: 'region', id: region.id, startX: event.clientX, startY: event.clientY, x: region.x, y: region.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** Mouse down on a group/frame resize handle. */
  const startRegionResize = (event, region) => {
    event.stopPropagation();
    dragRef.current = { mode: 'region-resize', id: region.id, startX: event.clientX, startY: event.clientY, w: region.w, h: region.h, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** Mouse down on the empty canvas itself → start panning. */
  const startPan = (event) => {
    if (event.target !== event.currentTarget) return;
    dragRef.current = { mode: 'pan', startX: event.clientX, startY: event.clientY, x: shift.x, y: shift.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;

    if (drag.mode === 'pan') {
      setShift({ x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY });
    } else if (drag.mode === 'region' || drag.mode === 'region-resize') {
      patchRegion(drag.id, drag.mode === 'region-resize'
        ? { w: Math.max(REGION_MIN.w, drag.w + dx), h: Math.max(REGION_MIN.h, drag.h + dy) }
        : { x: Math.max(0, drag.x + dx), y: Math.max(MIN_Y, drag.y + dy) });
    } else {
      patchNote(drag.noteId, drag.mode === 'resize'
        ? { w: Math.max(NOTE_MIN.w, drag.w + dx), h: Math.max(NOTE_MIN.h, drag.h + dy) }
        : { x: Math.max(0, drag.x + dx), y: Math.max(MIN_Y, drag.y + dy) });
    }
  };

  /** Mouse released: save the dragged item (if it really moved). */
  const finishDrag = async () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved && drag.id && (drag.mode === 'region' || drag.mode === 'region-resize')) {
      const current = regions.find((item) => item.id === drag.id);
      if (current) await saveRegion(current).catch((cause) => onError(String(cause)));
    } else if (drag?.moved && drag.noteId) {
      const current = notes.find((item) => item.id === drag.noteId);
      if (current) await saveNote(current).catch((cause) => onError(String(cause)));
    }
  };

  return { startNoteDrag, startRegionDrag, startRegionResize, startPan, moveDrag, finishDrag };
}
