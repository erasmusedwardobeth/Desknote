/**
 * api/workspaces.js — calls to the Rust workspace commands.
 * Rust side: src-tauri/src/commands/workspaces.rs
 */
import { invoke } from '@tauri-apps/api/core';

export const listWorkspaces = () => invoke('list_workspaces');
/** Creates (id null) or updates (id set) a workspace's name/background/grid. Resolves to the saved one. */
export const saveWorkspace = (workspace) => invoke('save_workspace', { workspace });
/** Saves a workspace's own camera (zoom + pan). */
export const setWorkspaceView = (id, zoom, shiftX, shiftY) => invoke('set_workspace_view', { id, zoom, shiftX, shiftY });
/** Deletes a workspace AND everything in it. */
export const deleteWorkspace = (id) => invoke('delete_workspace', { id });
/** Copies a workspace with its groups/frames and notes. Resolves to the copy. */
export const duplicateWorkspace = (id) => invoke('duplicate_workspace', { id });
/** Copies an image file into the app's images folder (no size limit). Resolves to the NEW path. */
export const importImage = (sourcePath) => invoke('import_image', { sourcePath });
