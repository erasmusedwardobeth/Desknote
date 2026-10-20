/**
 * noteUtils.js — helpers about the shape of a note. Pure functions.
 *
 * IMPORTANT: the object returned by defaultNote() must match the Rust struct
 * `Note` in src-tauri/src/models.rs (camelCase here ↔ snake_case there).
 * Add a field in BOTH places or saving will fail.
 */
import { NOTE_COLORS } from './constants.js';

/** A brand-new, unsaved note. `index` staggers its position and picks its color. */
export const defaultNote = (index = 0) => ({
  id: null, title: '', body: '',
  x: 100 + (index % 4) * 40, y: 100 + (index % 3) * 40,
  w: 250, h: 210,
  color: NOTE_COLORS[index % NOTE_COLORS.length],
  pinned: false, due: null, recurrence: null,
  checklist: '[]', formatting: '{}', groupId: null,
  created: null, updated: null, reminderAt: null, reminderSent: false,
});

/** Removes HTML tags and extra whitespace — used for plain-text previews. */
export const stripTags = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Checklists are stored as a JSON string. This parses it safely: [{ text, done }]. */
export const parseChecklist = (json) => {
  try { return JSON.parse(json || '[]'); } catch { return []; }
};
