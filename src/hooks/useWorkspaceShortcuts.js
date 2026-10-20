/**
 * useWorkspaceShortcuts — global keyboard shortcuts of the workspace window.
 *
 *   Ctrl/⌘ + D   hide the workspace (pinned notes stay)
 *   Ctrl/⌘ + N   new note (ignored while typing in a field)
 *   Escape       close the top-most open thing
 *
 * Pass handlers { onHide, onNewNote, onEscape }. They may change every render;
 * the latest ones are always used (no stale values).
 */
import { useEffect, useRef } from 'react';

export function useWorkspaceShortcuts(handlers) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const onKey = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'd') {
        event.preventDefault();
        latest.current.onHide();
      } else if (mod && key === 'n' && !event.target.closest('input,textarea,select,[contenteditable="true"]')) {
        event.preventDefault();
        latest.current.onNewNote();
      } else if (event.key === 'Escape') {
        latest.current.onEscape();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
