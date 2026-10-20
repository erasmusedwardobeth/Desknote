/**
 * api/notes.js — calls to the Rust note commands.
 * Rust side: src-tauri/src/commands/notes.rs
 * (Argument names here must match the Rust parameter names, camelCase ↔ snake_case.)
 */
import { invoke } from '@tauri-apps/api/core';

export const listNotes = () => invoke('list_notes');
/** Creates (id null) or updates a note; resolves to the saved note (with its id). */
export const saveNote = (note) => invoke('save_note', { note });
/** Marks complete; creates the next occurrence if `nextDue` is given. Resolves to true if repeated. */
export const completeNote = (note, nextDue) => invoke('complete_note', { note, nextDue });
export const deleteNote = (id) => invoke('delete_note', { id });
