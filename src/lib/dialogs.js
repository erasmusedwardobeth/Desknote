/**
 * dialogs.js — yes/no confirmation that works inside the Tauri window.
 *
 * Uses the native dialog from the Tauri dialog plugin, and falls back to the browser's
 * window.confirm if the plugin is unavailable (for example in a plain browser).
 *
 *   if (await confirmAction('Delete this?')) { ... }
 */
import { ask } from '@tauri-apps/plugin-dialog';

export async function confirmAction(message, title = 'Desknote') {
  try {
    return await ask(message, { title, kind: 'warning' });
  } catch {
    return window.confirm(message);
  }
}
