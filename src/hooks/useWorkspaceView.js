/**
 * useWorkspaceView — the "camera" (zoom + pan) of the OPEN workspace.
 *
 * Every workspace remembers its own camera. When another workspace is opened its camera is
 * loaded; changes are saved 450 ms after the last one (so dragging does not write every frame).
 *
 * Returns:
 *   zoom, shift {x,y}, setShift
 *   zoomAt(factor, point)  zoom toward a screen point (point stays under the cursor)
 *   setCamera({zoom, shiftX, shiftY})
 *   resetView()            100% and the default offset
 *   applyCamera(workspace) load the camera stored in `workspace` (after a backup restore)
 *
 * Rust side: set_workspace_view (via api/workspaces.js)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { setWorkspaceView } from '../api/workspaces.js';
import { DEFAULT_VIEW } from '../lib/constants.js';
import { zoomAbout } from '../lib/zoom.js';

/** @param workspace the open workspace (or null while loading)
 *  @param onSaved(id, camera) called after a camera was stored (keeps the in-memory list fresh) */
export function useWorkspaceView(workspace, onSaved) {
  const [zoom, setZoom] = useState(DEFAULT_VIEW.zoom);
  const [shift, setShift] = useState(DEFAULT_VIEW.shift);
  const loadedFor = useRef(null);            // id of the workspace whose camera is shown
  const workspaceId = workspace?.id ?? null;
  const latest = useRef({ zoom, shift });
  latest.current = { zoom, shift };

  // Load the camera when ANOTHER workspace is opened (not when its colors etc. change).
  useEffect(() => {
    if (!workspace || loadedFor.current === workspace.id) return;
    loadedFor.current = workspace.id;
    setZoom(workspace.zoom);
    setShift({ x: workspace.shiftX, y: workspace.shiftY });
  }, [workspace]);

  // Debounced save.
  useEffect(() => {
    if (workspaceId === null || loadedFor.current !== workspaceId) return undefined;
    const timer = setTimeout(() => {
      if (loadedFor.current !== workspaceId) return;
      setWorkspaceView(workspaceId, zoom, shift.x, shift.y)
        .then(() => onSaved?.(workspaceId, { zoom, shiftX: shift.x, shiftY: shift.y }))
        .catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [workspaceId, zoom, shift, onSaved]);

  const setCamera = useCallback((view) => {
    setZoom(view.zoom);
    setShift({ x: view.shiftX, y: view.shiftY });
  }, []);

  const zoomAt = useCallback((factor, point) => {
    const { zoom: currentZoom, shift: currentShift } = latest.current;
    const next = zoomAbout({ zoom: currentZoom, shiftX: currentShift.x, shiftY: currentShift.y }, factor, point);
    setZoom(next.zoom);
    setShift({ x: next.shiftX, y: next.shiftY });
  }, []);

  const resetView = useCallback(() => { setZoom(DEFAULT_VIEW.zoom); setShift(DEFAULT_VIEW.shift); }, []);

  const applyCamera = useCallback((target) => {
    if (!target) return;
    loadedFor.current = target.id;
    setZoom(target.zoom);
    setShift({ x: target.shiftX, y: target.shiftY });
  }, []);

  return { zoom, shift, setShift, zoomAt, setCamera, resetView, applyCamera };
}
