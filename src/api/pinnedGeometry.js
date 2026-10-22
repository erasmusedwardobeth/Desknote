/**
 * api/pinnedGeometry.js — arranging a pinned note window (move / resize).
 * Rust side: src-tauri/src/pinned_edit_mode.rs and pinned_geometry.rs
 */
import { invoke } from '@tauri-apps/api/core';

/** true = unlock the note so it can be moved/resized; false = lock it back onto the desktop layer. */
export const setPinnedEditMode = (id, editing) => invoke('set_pinned_edit_mode', { id, editing });
/** Move by a CHANGE in logical pixels (only works in arrange mode). */
export const movePinnedWindowBy = (id, dx, dy) => invoke('move_pinned_window_by', { id, dx, dy });
/** Resize by a CHANGE in logical pixels (only works in arrange mode). */
export const resizePinnedWindowBy = (id, dw, dh) => invoke('resize_pinned_window_by', { id, dw, dh });
