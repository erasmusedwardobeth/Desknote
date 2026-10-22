/**
 * api/settings.js — app settings, saved camera position, and backups.
 * Rust side: src-tauri/src/commands/settings.rs and commands/backup.rs
 */
import { invoke } from '@tauri-apps/api/core';

export const getAutostart = () => invoke('get_autostart');
export const setAutostart = (enabled) => invoke('set_autostart', { enabled });
/** Resolves to { zoom, shiftX, shiftY }. */
export const getWorkspaceView = () => invoke('get_workspace_view');
export const saveWorkspaceView = (view) => invoke('save_workspace_view', { view });
export const exportBackup = (path) => invoke('export_backup', { path });
/** Resolves to the path of the automatic recovery copy made before restoring. */
export const importBackup = (path) => invoke('import_backup', { path });
