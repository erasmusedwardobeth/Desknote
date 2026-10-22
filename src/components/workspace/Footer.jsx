/**
 * <Footer> — shortcut hint on the left, zoom controls on the right.
 * Props: zoom (number, 1 = 100%), onZoomIn, onZoomOut, onReset
 */
export default function Footer({ zoom, onZoomIn, onZoomOut, onReset }) {
  return (
    <footer className="foot">
      <span id="hint">Ctrl+N creates a note · Ctrl+D hides this workspace · pinned notes stay visible</span>
      <div className="zoom">
        <button aria-label="Zoom out" onClick={onZoomOut}>−</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button aria-label="Zoom in" onClick={onZoomIn}>＋</button>
        <button aria-label="Center board" onClick={onReset}>⌖</button>
      </div>
    </footer>
  );
}
