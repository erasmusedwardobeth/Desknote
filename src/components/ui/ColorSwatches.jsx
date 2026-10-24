/**
 * <ColorSwatches> — a grid of color buttons plus a "+" button for any custom color.
 *
 * Props:
 *   colors   array of "#RRGGBB" (see lib/palette.js)
 *   value    the current color (its swatch gets a ring)
 *   onPick   called with the chosen "#rrggbb"
 *   custom   show the "+" custom-color button (default true)
 *   size     'md' (default) or 'sm' (inside menus)
 */
export default function ColorSwatches({ colors, value, onPick, custom = true, size = 'md' }) {
  const current = String(value || '').toLowerCase();
  const validCustom = /^#[0-9a-f]{6}$/i.test(current) ? current : '#ffffff';
  return (
    <div className={`swatches ${size}`}>
      {colors.map((color) => (
        <button
          key={color} type="button" title={color} aria-label={`Color ${color}`}
          className={`swatch ${current === color.toLowerCase() ? 'active' : ''}`}
          style={{ background: color }} onClick={() => onPick(color)}
        />
      ))}
      {custom && (
        <label className="swatch custom" title="Custom color">
          +<input type="color" value={validCustom} onChange={(event) => onPick(event.target.value)} />
        </label>
      )}
    </div>
  );
}
