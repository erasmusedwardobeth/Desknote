/**
 * <Footer> — shortcut hint on the left, WORKSPACE zoom controls on the right.
 * (The mouse wheel and Ctrl +/- zoom the selected object, or the workspace when nothing is selected;
 *  these buttons always zoom the workspace.)
 * Props: zoom (number, 1 = 100%), onZoomIn, onZoomOut, onFit, onReset
 */
export default function Footer({ zoom, onZoomIn, onZoomOut, onFit, onReset }) {
  return (
    <footer className="foot">
      <span id="hint">Wheel or Ctrl +/− zooms the selection (or the workspace) · Space + drag pans · Ctrl+A selects all · right-click for menus</span>
      <div className="zoom">
        <button aria-label="Zoom workspace out" onClick={onZoomOut}>−</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button aria-label="Zoom workspace in" onClick={onZoomIn}>＋</button>
        <button aria-label="Zoom to fit" title="Zoom to fit (Ctrl+1)" onClick={onFit}>⤢</button>
        <button aria-label="Reset to 100%" title="100% (Ctrl+0)" onClick={onReset}>⌖</button>
      </div>
    </footer>
  );
}
