/**
 * <RegionProps> — right panel when ONE group or frame is selected.
 * Title, color, position/size, the notes inside it, and actions.
 *
 * Props: region, contained (notes whose groupId is this region), onChange(changes),
 *        onPinAll(), onUnpinAll(), onSelectContents(), onDelete()
 */
import { useEffect, useRef, useState } from 'react';
import { MIN_Y, REGION_MIN } from '../../lib/constants.js';
import { REGION_SWATCHES } from '../../lib/palette.js';
import ColorSwatches from '../ui/ColorSwatches.jsx';
import NumberField from '../ui/NumberField.jsx';
import PanelSection from './PanelSection.jsx';

export default function RegionProps({ region, contained, onChange, onPinAll, onUnpinAll, onSelectContents, onDelete }) {
  const [title, setTitle] = useState(region.title);
  const cancelled = useRef(false);
  useEffect(() => { setTitle(region.title); }, [region.id, region.title]);
  const pinned = contained.filter((note) => note.pinned).length;
  const label = region.kind === 'frame' ? 'Frame' : 'Group';

  const commitTitle = () => {
    if (cancelled.current) { cancelled.current = false; setTitle(region.title); return; }
    const next = title.trim();
    if (!next) { setTitle(region.title); return; }
    if (next !== region.title) onChange({ title: next });
  };

  return (
    <>
      <PanelSection title={label}>
        <input
          className="panel-input" aria-label={`${label} name`} value={title} maxLength={80}
          onChange={(event) => setTitle(event.target.value)} onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            else if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur(); }
          }}
        />
        <p className="panel-hint">{contained.length} {contained.length === 1 ? 'note' : 'notes'} inside{pinned ? `, ${pinned} pinned` : ''}. Moving it moves them too.</p>
      </PanelSection>

      <PanelSection title="Color">
        <ColorSwatches colors={REGION_SWATCHES} value={region.color} onPick={(color) => onChange({ color })} />
      </PanelSection>

      <PanelSection title="Position and size">
        <div className="num-grid">
          <NumberField label="X" value={region.x} min={0} onCommit={(x) => onChange({ x })} />
          <NumberField label="Y" value={region.y} min={MIN_Y} onCommit={(y) => onChange({ y })} />
          <NumberField label="W" value={region.w} min={REGION_MIN.w} onCommit={(w) => onChange({ w })} />
          <NumberField label="H" value={region.h} min={REGION_MIN.h} onCommit={(h) => onChange({ h })} />
        </div>
      </PanelSection>

      <PanelSection title="Actions">
        <button type="button" className="panel-button wide" disabled={!contained.length} onClick={onSelectContents}>Select contents</button>
        <div className="panel-buttons">
          <button type="button" className="panel-button" disabled={pinned === contained.length} onClick={onPinAll}>Pin all inside</button>
          <button type="button" className="panel-button" disabled={!pinned} onClick={onUnpinAll}>Unpin all inside</button>
        </div>
        <button type="button" className="panel-button wide danger" onClick={onDelete}>Delete {label.toLowerCase()} (notes are kept)</button>
      </PanelSection>
    </>
  );
}
