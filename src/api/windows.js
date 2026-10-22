/**
 * api/windows.js — calls that control OS windows (pinned notes, the workspace).
 * Rust side: src-tauri/src/window_manager.rs
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * THE way to pin/unpin: updates the database and opens/closes the desktop window as one
 * operation (Rust: set_note_pinned). Resolves to the updated note; rejects with a readable
 * message if the desktop window could not be created.
 */
export const setNotePinned = (id, pinned) => invoke('set_note_pinned', { id, pinned });
/** Opens (or refreshes) the desktop window of a note. (Prefer setNotePinned.) */
export const pinNote = (note) => invoke('pin_note', { note });
/** Closes the desktop window of a note (the note itself is kept). */
export const unpinNote = (id) => invoke('unpin_note', { id });
export const setNoteTitle = (id, title) => invoke('set_note_title', { id, title });
/** Temporarily enables pointer-driven move/resize for a pinned desktop window. */
export const setPinnedWindowInteractive = (id, active) => invoke('set_pinned_window_interactive', { id, active });
export const toggleAlwaysOnTop = (id) => invoke('toggle_always_on_top', { id });
/** Hides the workspace window. Pinned notes stay visible. */
export const hideWorkspace = () => invoke('hide_workspace');
export const showWorkspace = () => invoke('show_workspace');
/** Quits the whole app, closing every pinned note too. */
export const quitApp = () => invoke('quit_app');
