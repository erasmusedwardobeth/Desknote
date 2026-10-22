/**
 * zoom.js — camera and object zoom math. Pure functions.
 *
 * A VIEW is { zoom, shiftX, shiftY }: a canvas point (wx, wy) is drawn at the screen point
 *   (wx * zoom + shiftX,  wy * zoom + shiftY)   — same convention as the #world transform.
 */
import { ZOOM_MAX, ZOOM_MIN } from './constants.js';

/** Keeps a zoom value inside the allowed range. */
export const clampZoom = (zoom, min = ZOOM_MIN, max = ZOOM_MAX) => Math.max(min, Math.min(max, zoom));

/**
 * Multiplier for one mouse-wheel event: scrolling up zooms in, down zooms out, and the
 * result is limited so one fast notch can never jump more than about 25%.
 */
export function wheelFactor(deltaY) {
  return Math.max(0.8, Math.min(1.25, Math.pow(1.0015, -deltaY)));
}

/**
 * Zooms the view by `factor` while the canvas point under `point` (screen coordinates,
 * relative to the canvas element) stays exactly where it is — "zoom toward the cursor".
 */
export function zoomAbout(view, factor, point, { min = ZOOM_MIN, max = ZOOM_MAX } = {}) {
  const zoom = clampZoom(view.zoom * factor, min, max);
  const worldX = (point.x - view.shiftX) / view.zoom;
  const worldY = (point.y - view.shiftY) / view.zoom;
  return { zoom, shiftX: point.x - worldX * zoom, shiftY: point.y - worldY * zoom };
}

/**
 * A view that shows all `rects` centred in a viewport {w, h}, with `padding` pixels around.
 * Never zooms in past 100% (so a single small note does not become huge).
 */
export function fitView(rects, viewport, { padding = 48, min = ZOOM_MIN, max = 1 } = {}) {
  if (!rects.length) return { zoom: 1, shiftX: 40, shiftY: 45 };
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  const width = right - left;
  const height = bottom - top;
  const zoom = clampZoom(Math.min((viewport.w - padding * 2) / width, (viewport.h - padding * 2) / height), min, max);
  return {
    zoom,
    shiftX: (viewport.w - width * zoom) / 2 - left * zoom,
    shiftY: (viewport.h - height * zoom) / 2 - top * zoom,
  };
}

/**
 * Object zoom: scales a rect by `factor` around its CENTRE, staying within the size limits.
 * (Used when a note/group/frame is selected and the wheel or Ctrl +/- is used.)
 */
export function scaleRectAbout(rect, factor, { minW = 1, minH = 1, maxW = Infinity, maxH = Infinity } = {}) {
  // One uniform factor so the shape is kept; limits are applied to the factor, not per axis.
  const lowest = Math.max(minW / rect.w, minH / rect.h);
  const highest = Math.min(maxW / rect.w, maxH / rect.h);
  const applied = Math.max(lowest, Math.min(highest, factor));
  const w = rect.w * applied;
  const h = rect.h * applied;
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}
