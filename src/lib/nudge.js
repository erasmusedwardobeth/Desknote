/**
 * nudge.js — keyboard movement/resizing of notes, groups and frames.
 * Arrow keys move by 1px; Shift+Arrow resizes by 10px.
 */
import { MIN_Y } from './constants.js';

/**
 * @param {object} item      anything with x, y, w, h
 * @param {string} key       'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'
 * @param {boolean} shiftKey true = resize, false = move
 * @param {{w:number,h:number}} min  smallest allowed size
 * @returns a NEW object (the input is not changed)
 */
export function nudged(item, key, shiftKey, min) {
  const step = shiftKey ? 10 : 1;
  const dx = key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0;
  const dy = key === 'ArrowDown' ? step : key === 'ArrowUp' ? -step : 0;
  return shiftKey
    ? { ...item, w: Math.max(min.w, item.w + dx), h: Math.max(min.h, item.h + dy) }
    : { ...item, x: Math.max(0, item.x + dx), y: Math.max(MIN_Y, item.y + dy) };
}
