/**
 * useBoardData — loads all notes and regions from Rust and keeps them fresh.
 *
 * Rust emits a "notes-changed" event whenever a note is saved, so every open
 * window (workspace + pinned notes) reloads automatically and stays in sync.
 *
 * Returns:
 *   notes, regions            the current data
 *   setNotes, setRegions      raw setters (rarely needed)
 *   patchNote(id, changes)    update one note in memory only (used while dragging)
 *   patchRegion(id, changes)  same for a group/frame
 *   reload()                  re-fetch from Rust → resolves to [notes, regions]
 *   error                     text if the local database could not be read
 */
import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { listNotes } from '../api/notes.js';
import { listRegions } from '../api/regions.js';

export function useBoardData() {
  const [notes, setNotes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [nextNotes, nextRegions] = await Promise.all([listNotes(), listRegions()]);
      setNotes(nextNotes);
      setRegions(nextRegions);
      setError('');
      return [nextNotes, nextRegions];
    } catch (cause) {
      setError(String(cause));
      return [[], []];
    }
  }, []);

  const patchNote = useCallback((id, changes) => {
    setNotes((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const patchRegion = useCallback((id, changes) => {
    setRegions((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  useEffect(() => {
    reload();
    let unlisten;
    let cancelled = false;
    listen('notes-changed', () => reload()).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    }).catch(() => {});
    return () => { cancelled = true; unlisten?.(); };
  }, [reload]);

  return { notes, setNotes, regions, setRegions, patchNote, patchRegion, error, reload };
}
