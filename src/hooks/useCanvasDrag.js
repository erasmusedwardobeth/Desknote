/**
 * useCanvasDrag — all mouse dragging on the workspace canvas.
 *
 * One drag at a time is tracked in `dragRef`. Its `mode` says what is happening:
 *   'move'     moving the selection (notes and groups/frames). A group/frame CARRIES the
 *              notes that belong to it.
 *   'resize'   dragging the corner grip of ONE note or group/frame
 *   'marquee'  dragging a selection rectangle on empty canvas
 *   'pan'      moving the camera: Space + drag, or the middle mouse button
 *
 * While dragging, only React state changes (smooth). Changes are written to the database once,
 * when the mouse is released (finishDrag).
 *
 * DROPPING A NOTE decides its group: the note joins the smallest group/frame it was dropped
 * into, or leaves its group when dropped on bare canvas (lib/scope.js → regionAt). Notes that
 * were only carried along by their group keep it.
 *
 * Distances are divided by `zoom` so dragging feels right at any zoom level.
 */
import { useEffect, useRef, useState } from 'react';
import { saveNote } from '../api/notes.js';
import { saveRegion } from '../api/regions.js';
import { MIN_Y, NOTE_MIN, REGION_MIN } from '../lib/constants.js';
import { centerOf, regionAt, screenToWorld } from '../lib/scope.js';
import { clickEmpty, pickInRect, rectFromPoints } from '../lib/selection.js';
import { nodeId, parseNodeId } from '../lib/tree.js';

const isTyping = (target) => !!target?.closest?.('input,textarea,select,button,[contenteditable="true"]');

/**
 * @param shellRef     ref of the canvas element
 * @param notes        notes of the OPEN workspace (not filtered by board)
 * @param regions      groups/frames of the open workspace
 * @param selection    current selection (array of node ids)
 * @param getPickItems () => [{ id: "note:1", x, y, w, h }]  items a marquee can select
 * @param onSelect(ids)  replace the selection
 * @param onMarquee(rect|null)  rectangle in canvas-element pixels, or null when finished
 * @param onError(text)
 */
export function useCanvasDrag({ shellRef, zoom, shift, setShift, notes, regions, selection, patchNote, patchRegion, getPickItems, onSelect, onMarquee, onError }) {
  const dragRef = useRef(null);
  const spaceRef = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);

  // Space held = pan mode.
  useEffect(() => {
    const down = (event) => {
      if (event.code !== 'Space' || isTyping(event.target)) return;
      event.preventDefault();
      spaceRef.current = true;
      setSpaceDown(true);
    };
    const up = (event) => {
      if (event.code !== 'Space') return;
      spaceRef.current = false;
      setSpaceDown(false);
    };
    const blur = () => { spaceRef.current = false; setSpaceDown(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  /**
   * Mouse down on a note or group/frame.
   * @param kind  'note' | 'region'      @param mode 'move' | 'resize'
   * @param selectionIds  the selection AFTER this click (so the first drag uses it)
   */
  const startItemDrag = (event, kind, item, mode, selectionIds) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    let members = [];
    if (mode === 'move') {
      const id = nodeId(kind === 'note' ? 'note' : item.kind, item.id);
      const ids = selectionIds.includes(id) ? selectionIds : [id];
      // Notes belonging to a selected group/frame travel with it.
      const carried = new Set();
      for (const selected of ids) {
        const { type, refId } = parseNodeId(selected);
        if (type === 'group' || type === 'frame') notes.filter((note) => note.groupId === refId).forEach((note) => carried.add(note.id));
      }
      for (const selected of ids) {
        const { type, refId } = parseNodeId(selected);
        if (type === 'note') {
          const note = notes.find((entry) => entry.id === refId);
          if (note) members.push({ kind: 'note', id: note.id, x: note.x, y: note.y, carried: carried.has(note.id) });
        } else if (type === 'group' || type === 'frame') {
          const region = regions.find((entry) => entry.id === refId);
          if (region) members.push({ kind: 'region', id: region.id, x: region.x, y: region.y, carried: false });
        }
      }
      for (const noteId of carried) {
        if (members.some((member) => member.kind === 'note' && member.id === noteId)) continue;
        const note = notes.find((entry) => entry.id === noteId);
        if (note) members.push({ kind: 'note', id: noteId, x: note.x, y: note.y, carried: true });
      }
    } else {
      members = [{ kind, id: item.id, w: item.w, h: item.h }];
    }
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, members, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** Mouse down on the empty canvas: marquee, or pan with Space / middle button. */
  const startPan = (event) => {
    if (event.target !== event.currentTarget) return;
    const box = shellRef.current.getBoundingClientRect();
    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      event.preventDefault();
      dragRef.current = { mode: 'pan', startX: event.clientX, startY: event.clientY, x: shift.x, y: shift.y, moved: false };
    } else if (event.button === 0) {
      dragRef.current = {
        mode: 'marquee', startX: event.clientX, startY: event.clientY, moved: false, shift: event.shiftKey,
        origin: { x: event.clientX - box.left, y: event.clientY - box.top }, rect: null,
      };
    } else {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 3) drag.moved = true;

    if (drag.mode === 'marquee') {
      if (!drag.moved) return;
      const box = shellRef.current.getBoundingClientRect();
      drag.rect = rectFromPoints(drag.origin, { x: event.clientX - box.left, y: event.clientY - box.top });
      onMarquee(drag.rect);
      return;
    }
    if (drag.mode === 'pan') {
      setShift({ x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY });
      return;
    }
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (drag.mode === 'resize') {
      const [member] = drag.members;
      const min = member.kind === 'note' ? NOTE_MIN : REGION_MIN;
      const changes = { w: Math.max(min.w, member.w + dx), h: Math.max(min.h, member.h + dy) };
      if (member.kind === 'note') patchNote(member.id, changes); else patchRegion(member.id, changes);
      return;
    }
    for (const member of drag.members) {
      const changes = { x: Math.max(0, member.x + dx), y: Math.max(MIN_Y, member.y + dy) };
      if (member.kind === 'note') patchNote(member.id, changes); else patchRegion(member.id, changes);
    }
  };

  /** Mouse released: finish marquee / save what was moved or resized. */
  const finishDrag = async () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.mode === 'marquee') {
      onMarquee(null);
      if (!drag.moved || !drag.rect) { onSelect(clickEmpty(selection, { shift: drag.shift })); return; }
      const view = { zoom, shiftX: shift.x, shiftY: shift.y };
      const topLeft = screenToWorld({ x: drag.rect.x, y: drag.rect.y }, view);
      const worldRect = { x: topLeft.x, y: topLeft.y, w: drag.rect.w / zoom, h: drag.rect.h / zoom };
      const ids = pickInRect(getPickItems(), worldRect);
      onSelect(drag.shift ? [...new Set([...selection, ...ids])] : ids);
      return;
    }
    if (drag.mode === 'pan' || !drag.moved) return;

    const saves = [];
    for (const member of drag.members) {
      if (member.kind === 'region') {
        const current = regions.find((region) => region.id === member.id);
        if (current) saves.push(saveRegion(current));
        continue;
      }
      const current = notes.find((note) => note.id === member.id);
      if (!current) continue;
      let groupId = current.groupId;
      if (drag.mode === 'move' && !member.carried) {
        groupId = regionAt(centerOf(current), regions)?.id ?? null;
        if (groupId !== current.groupId) patchNote(current.id, { groupId });
      }
      saves.push(saveNote({ ...current, groupId }));
    }
    await Promise.all(saves).catch((cause) => onError(String(cause)));
  };

  return { startItemDrag, startPan, moveDrag, finishDrag, spaceDown };
}
