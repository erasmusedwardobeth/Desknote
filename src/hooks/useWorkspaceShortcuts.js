/**
 * useWorkspaceShortcuts — global keyboard shortcuts of the workspace window.
 *
 *   Ctrl/⌘ + D          hide the workspace (pinned notes stay)
 *   Ctrl/⌘ + N          new note                 Ctrl/⌘ + A   select all
 *   Ctrl/⌘ + + / − / 0  zoom in / out / 100%     Ctrl/⌘ + 1   zoom to fit
 *   Ctrl/⌘ + F          focus the search box
 *   Delete / Backspace  delete the selection     F2           rename the selection
 *   Escape              close the top-most open thing / clear the selection
 *
 * Shortcuts that would hijack typing (N, A, Delete, F2) are ignored while a text field has focus.
 * Pass any of the handlers { onHide, onNewNote, onSelectAll, onZoomIn, onZoomOut, onZoomReset,
 * onZoomFit, onSearch, onDelete, onRename, onEscape }; missing ones are skipped. The latest
 * handlers are always used (no stale values).
 */
import { useEffect, useRef } from 'react';

export function useWorkspaceShortcuts(handlers) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const onKey = (event) => {
      const call = (name) => { event.preventDefault(); latest.current[name]?.(); };
      const typing = !!event.target?.closest?.('input,textarea,select,[contenteditable="true"]');
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'd') call('onHide');
      else if (mod && key === 'n' && !typing) call('onNewNote');
      else if (mod && key === 'a' && !typing) call('onSelectAll');
      else if (mod && (event.key === '+' || event.key === '=')) call('onZoomIn');
      else if (mod && (event.key === '-' || event.key === '_')) call('onZoomOut');
      else if (mod && event.key === '0') call('onZoomReset');
      else if (mod && event.key === '1') call('onZoomFit');
      else if (mod && key === 'f') call('onSearch');
      else if (!typing && !mod && (event.key === 'Delete' || event.key === 'Backspace')) call('onDelete');
      else if (!typing && event.key === 'F2') call('onRename');
      else if (event.key === 'Escape') latest.current.onEscape?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
