/**
 * useWorkspaces — the list of workspaces and which one is open.
 *
 * The ACTIVE workspace is remembered in localStorage (it is a per-window view choice, not data).
 * If the remembered one no longer exists, the first workspace is used.
 *
 * Returns:
 *   workspaces, active, loading
 *   setActive(id)
 *   create()                     → new workspace (named "Workspace N"), becomes active
 *   update(id, changes)          → changes name / bgColor / bgImage / bgFit / bgOpacity / grid
 *   remove(id), duplicate(id)
 *   patchLocal(id, changes)      → update the in-memory copy only (used for the camera)
 *   reload()
 * Rust side: src-tauri/src/commands/workspaces.rs (via api/workspaces.js)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteWorkspace, duplicateWorkspace, listWorkspaces, saveWorkspace } from '../api/workspaces.js';
import { nextWorkspaceName } from '../lib/background.js';

const STORAGE_KEY = 'desknote.activeWorkspace';

const readStored = () => {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch { return null; }
};
const writeStored = (id) => {
  try { localStorage.setItem(STORAGE_KEY, String(id)); } catch { /* storage unavailable */ }
};

/** A brand-new workspace (sent to Rust, which assigns the id and the order). */
const blankWorkspace = (name) => ({
  id: null, name, bgColor: '#f8f7f3', bgImage: null, bgFit: 'cover', bgOpacity: 1,
  grid: true, zoom: 1, shiftX: 40, shiftY: 45, sortOrder: 0,
});

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const listRef = useRef([]); // always the newest list, even before React has re-rendered
  const setList = useCallback((list) => { listRef.current = list; setWorkspaces(list); }, []);
  const [storedId, setStoredId] = useState(readStored);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const list = await listWorkspaces();
      setList(list);
      return list;
    } finally {
      setLoading(false);
    }
  }, [setList]);

  useEffect(() => { reload().catch(() => {}); }, [reload]);

  const active = workspaces.find((workspace) => workspace.id === storedId) ?? workspaces[0] ?? null;

  const setActive = useCallback((id) => { setStoredId(id); writeStored(id); }, []);

  const create = useCallback(async () => {
    const created = await saveWorkspace(blankWorkspace(nextWorkspaceName(listRef.current)));
    await reload();
    setActive(created.id);
    return created;
  }, [reload, setActive]);

  const patchLocal = useCallback((id, changes) => {
    setList(listRef.current.map((workspace) => (workspace.id === id ? { ...workspace, ...changes } : workspace)));
  }, [setList]);

  /** Shows the change immediately, saves it, and rolls back to the stored state on failure. */
  const update = useCallback(async (id, changes) => {
    const current = listRef.current.find((workspace) => workspace.id === id);
    if (!current) return null;
    patchLocal(id, changes);
    try {
      return await saveWorkspace({ ...current, ...changes });
    } catch (cause) {
      await reload();
      throw cause;
    }
  }, [patchLocal, reload]);

  const remove = useCallback(async (id) => {
    await deleteWorkspace(id);
    await reload();
  }, [reload]);

  const duplicate = useCallback(async (id) => {
    const copy = await duplicateWorkspace(id);
    await reload();
    setActive(copy.id);
    return copy;
  }, [reload, setActive]);

  return { workspaces, active, loading, setActive, create, update, remove, duplicate, patchLocal, reload };
}
