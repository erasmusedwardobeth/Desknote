/**
 * useWorkspaceView — the workspace "camera": zoom level and pan offset.
 *
 * Loads the saved camera from Rust on start and saves it back 450ms after
 * the last change (so dragging does not write to the database every frame).
 *
 * Returns: zoom, shift {x,y}, setShift, zoomBy(factor), reloadView(), resetView()
 */
import { useCallback, useEffect, useState } from 'react';
import { getWorkspaceView, saveWorkspaceView } from '../api/settings.js';
import { DEFAULT_VIEW, ZOOM_MAX, ZOOM_MIN } from '../lib/constants.js';

export function useWorkspaceView() {
  const [zoom, setZoom] = useState(DEFAULT_VIEW.zoom);
  const [shift, setShift] = useState(DEFAULT_VIEW.shift);
  const [ready, setReady] = useState(false);

  /** (Re)load the saved camera from Rust. */
  const reloadView = useCallback(
    () => getWorkspaceView().then((view) => {
      setZoom(view.zoom);
      setShift({ x: view.shiftX, y: view.shiftY });
    }).catch(() => {}),
    []
  );

  useEffect(() => { reloadView().finally(() => setReady(true)); }, [reloadView]);

  // Debounced save. `ready` stops us overwriting the saved view with defaults on startup.
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(
      () => saveWorkspaceView({ zoom, shiftX: shift.x, shiftY: shift.y }).catch(() => {}),
      450
    );
    return () => clearTimeout(timer);
  }, [ready, zoom, shift]);

  /** Multiply zoom by `factor` (e.g. 1.15 = zoom in), clamped to the allowed range. */
  const zoomBy = useCallback(
    (factor) => setZoom((value) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value * factor))),
    []
  );

  const resetView = useCallback(() => { setZoom(DEFAULT_VIEW.zoom); setShift(DEFAULT_VIEW.shift); }, []);

  return { zoom, shift, setShift, zoomBy, reloadView, resetView };
}
