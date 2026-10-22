/**
 * <RegionBox> — a "group" (filled box) or "frame" (dashed outline) on the canvas.
 * Notes can be assigned to a group in the note editor.
 *
 * Props:
 *   region          { id, title, kind: 'group'|'frame', x, y, w, h, color }
 *   menuOpen / onToggleMenu     its "⋯" menu
 *   onRename(region), onRemove(region)
 *   onNudge(updatedRegion)      keyboard move/resize finished
 *   onDragStart(event, region)  from useCanvasDrag.startRegionDrag
 *   onResizeStart(event, region) from useCanvasDrag.startRegionResize
 */
import { REGION_MIN } from '../../lib/constants.js';
import { nudged } from '../../lib/nudge.js';
import PopupMenu from '../ui/PopupMenu.jsx';

export default function RegionBox({ region, menuOpen, onToggleMenu, onRename, onRemove, onNudge, onDragStart, onResizeStart }) {
  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onRename(region);
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      onNudge(nudged(region, event.key, event.shiftKey, REGION_MIN));
    }
  };

  return (
    <div
      className={`region ${region.kind}`}
      role="group"
      tabIndex={0}
      aria-label={`${region.kind}: ${region.title}. Arrow keys move; Shift plus arrow keys resize; Enter renames.`}
      style={{ left: region.x, top: region.y, width: region.w, height: region.h, '--region-color': region.color }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        // Clicks on the resize handle or menu must not start dragging the whole box.
        if (event.target.closest('.region-resize-handle,.region-menu-trigger,.region-menu')) return;
        onDragStart(event, region);
      }}
      onDoubleClick={(event) => { event.stopPropagation(); onRename(region); }}
      onContextMenu={(event) => { event.preventDefault(); onRemove(region); }}
    >
      <span className="region-title">{region.title}</span>
      <button
        className="region-menu-trigger"
        aria-label={`Actions for ${region.title}`}
        aria-expanded={menuOpen}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onToggleMenu(); }}
      >⋯</button>
      {menuOpen && (
        <PopupMenu className="card-menu region-menu" items={[
          { label: `Rename ${region.kind}`, onClick: () => onRename(region) },
          { label: `Delete ${region.kind}`, onClick: () => onRemove(region) },
        ]} />
      )}
      <button className="region-resize-handle" aria-label={`Resize ${region.title}`} onPointerDown={(event) => onResizeStart(event, region)} />
    </div>
  );
}
