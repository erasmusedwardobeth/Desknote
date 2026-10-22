/**
 * boards.js — which notes each tab (board) of the top bar shows. Pure functions.
 */
import { weekBounds } from './dates.js';

/** Notes visible on `board`. `dayKey` is today's "YYYY-MM-DD". */
export function filterNotes(notes, board, dayKey) {
  const [monday, sunday] = weekBounds(dayKey);
  return notes.filter((note) => {
    if (note.completed) return board === 'Completed';
    if (board === 'Completed') return false;
    if (board === 'Everything') return true;
    if (!note.due) return false;
    return board === 'Daily' ? note.due === dayKey : note.due >= monday && note.due <= sunday;
  });
}

/** The small title in the top-left corner of the canvas. */
export function boardHeading(board) {
  if (board === 'Daily') return `Today · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
  if (board === 'Weekly') return 'This week';
  if (board === 'Completed') return 'Completed tasks';
  return 'A place for all your thoughts';
}
