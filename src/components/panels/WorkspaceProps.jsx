/**
 * <WorkspaceProps> — right panel when NOTHING is selected: the open workspace itself.
 * Name, background color, background image (layout + opacity), grid, and workspace actions.
 *
 * Props: workspace, imageUrl (loadable URL of the background image, or ''), canDelete,
 *   noteCount, onChange(changes), onPickImage(), onRemoveImage(), onFit(),
 *   onPinAll(), onUnpinAll(), onDuplicate(), onDelete()
 */
import { useEffect, useRef, useState } from 'react';
import { BG_FITS } from '../../lib/background.js';
import { BACKGROUND_SWATCHES } from '../../lib/palette.js';
import ColorSwatches from '../ui/ColorSwatches.jsx';
import PanelSection from './PanelSection.jsx';

export default function WorkspaceProps({ workspace, imageUrl, canDelete, noteCount, onChange, onPickImage, onRemoveImage, onFit, onPinAll, onUnpinAll, onDuplicate, onDelete }) {
  const [name, setName] = useState(workspace.name);
  const [opacity, setOpacity] = useState(Math.round((workspace.bgOpacity ?? 1) * 100));
  const [imageFailed, setImageFailed] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => { setName(workspace.name); }, [workspace.id, workspace.name]);
  useEffect(() => { setOpacity(Math.round((workspace.bgOpacity ?? 1) * 100)); }, [workspace.id, workspace.bgOpacity]);
  useEffect(() => { setImageFailed(false); }, [imageUrl]);

  const commitName = () => {
    if (cancelled.current) { cancelled.current = false; setName(workspace.name); return; }
    const trimmed = name.trim();
    if (!trimmed) { setName(workspace.name); return; }
    if (trimmed !== workspace.name) onChange({ name: trimmed });
  };
  const commitOpacity = () => {
    const value = Math.max(0, Math.min(100, opacity)) / 100;
    if (value !== workspace.bgOpacity) onChange({ bgOpacity: value });
  };

  return (
    <>
      <PanelSection title="Workspace">
        <input
          className="panel-input" aria-label="Workspace name" value={name} maxLength={80}
          onChange={(event) => setName(event.target.value)} onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            else if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur(); }
          }}
        />
      </PanelSection>

      <PanelSection title="Background color">
        <ColorSwatches colors={BACKGROUND_SWATCHES} value={workspace.bgColor} onPick={(color) => onChange({ bgColor: color })} />
      </PanelSection>

      <PanelSection title="Background image">
        {!workspace.bgImage ? (
          <>
            <button type="button" className="panel-button wide" onClick={onPickImage}>Choose image…</button>
            <p className="panel-hint">The image is copied into Desknote’s own folder, so you can move or delete the original. There is no size limit.</p>
          </>
        ) : (
          <>
            <div className="bg-preview">
              {imageFailed || !imageUrl
                ? <span className="panel-hint">The image file could not be loaded.</span>
                : <img src={imageUrl} alt="Background preview" onError={() => setImageFailed(true)} />}
            </div>
            <label className="panel-row">
              <span>Layout</span>
              <select className="panel-select" value={workspace.bgFit} onChange={(event) => onChange({ bgFit: event.target.value })}>
                {BG_FITS.map((fit) => <option key={fit.id} value={fit.id}>{fit.label}</option>)}
              </select>
            </label>
            <label className="panel-row">
              <span>Opacity {opacity}%</span>
              <input
                type="range" min="0" max="100" value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
                onPointerUp={commitOpacity} onKeyUp={commitOpacity} onBlur={commitOpacity}
              />
            </label>
            <div className="panel-buttons">
              <button type="button" className="panel-button" onClick={onPickImage}>Replace…</button>
              <button type="button" className="panel-button" onClick={onRemoveImage}>Remove</button>
            </div>
          </>
        )}
      </PanelSection>

      <PanelSection title="Canvas">
        <label className="panel-check">
          <input type="checkbox" checked={!!workspace.grid} onChange={(event) => onChange({ grid: event.target.checked })} />
          <span>Show dot grid</span>
        </label>
        <button type="button" className="panel-button wide" onClick={onFit}>Zoom to fit</button>
      </PanelSection>

      <PanelSection title="This workspace">
        <div className="panel-buttons">
          <button type="button" className="panel-button" disabled={!noteCount} onClick={onPinAll}>Pin all notes</button>
          <button type="button" className="panel-button" disabled={!noteCount} onClick={onUnpinAll}>Unpin all</button>
        </div>
        <button type="button" className="panel-button wide" onClick={onDuplicate}>Duplicate workspace</button>
        <button type="button" className="panel-button wide danger" disabled={!canDelete} onClick={onDelete}>Delete workspace…</button>
        {!canDelete && <p className="panel-hint">You need at least one workspace.</p>}
      </PanelSection>
    </>
  );
}
