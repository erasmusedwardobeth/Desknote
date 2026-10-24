/**
 * <MultiProps> — right panel when SEVERAL objects are selected.
 * Align, distribute, color, pin/unpin the selected notes, delete.
 *
 * Props: objects [{ kind, id, item }], onAlign(mode), onDistribute('h'|'v'),
 *        onColor(color), onPin(true|false), onDelete()
 */
import { NOTE_SWATCHES } from '../../lib/palette.js';
import ColorSwatches from '../ui/ColorSwatches.jsx';
import PanelSection from './PanelSection.jsx';

const ALIGNS = [
  ['left', 'Align left', '⇤'], ['hcenter', 'Align horizontal centers', '↔'], ['right', 'Align right', '⇥'],
  ['top', 'Align top', '⤒'], ['vcenter', 'Align vertical centers', '↕'], ['bottom', 'Align bottom', '⤓'],
];

export default function MultiProps({ objects, onAlign, onDistribute, onColor, onPin, onDelete }) {
  const noteCount = objects.filter((object) => object.kind === 'note').length;
  return (
    <>
      <PanelSection title={`${objects.length} objects selected`}>
        <p className="panel-hint">{noteCount} notes, {objects.length - noteCount} groups or frames.</p>
      </PanelSection>
      <PanelSection title="Align">
        <div className="align-row">
          {ALIGNS.map(([mode, title, glyph]) => (
            <button key={mode} type="button" className="icon-tool" title={title} aria-label={title} onClick={() => onAlign(mode)}>{glyph}</button>
          ))}
        </div>
        <div className="panel-buttons">
          <button type="button" className="panel-button" disabled={objects.length < 3} onClick={() => onDistribute('h')}>Distribute ↔</button>
          <button type="button" className="panel-button" disabled={objects.length < 3} onClick={() => onDistribute('v')}>Distribute ↕</button>
        </div>
      </PanelSection>
      <PanelSection title="Color">
        <ColorSwatches colors={NOTE_SWATCHES} value={null} onPick={onColor} />
      </PanelSection>
      <PanelSection title="Actions">
        <div className="panel-buttons">
          <button type="button" className="panel-button" disabled={!noteCount} onClick={() => onPin(true)}>Pin notes</button>
          <button type="button" className="panel-button" disabled={!noteCount} onClick={() => onPin(false)}>Unpin notes</button>
        </div>
        <button type="button" className="panel-button wide danger" onClick={onDelete}>Delete {objects.length} objects</button>
      </PanelSection>
    </>
  );
}
