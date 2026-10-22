/**
 * constants.js — every "magic number" of the app in one place.
 * Change a limit here and it changes everywhere.
 */

/** Smallest and largest workspace zoom. Rust also enforces 0.4–2.2 (commands/settings.rs). */
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 2.2;

/** Where the workspace camera starts: zoom 100% and a small offset from the top-left. */
export const DEFAULT_VIEW = { zoom: 1, shift: { x: 40, y: 45 } };

/** Smallest size a note card / group / frame can be resized to. */
export const NOTE_MIN = { w: 170, h: 120 };
export const REGION_MIN = { w: 220, h: 150 };

/** Items cannot be dragged above this y (keeps them below the board heading). */
export const MIN_Y = 25;

/** The board tabs in the top bar. */
export const BOARDS = ['Everything', 'Daily', 'Weekly', 'Completed'];

/** Pastel colors that new notes cycle through. */
export const NOTE_COLORS = ['#fff1a8', '#ffd9cf', '#d9f2df', '#dce9ff', '#f0ddff'];
