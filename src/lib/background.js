/**
 * background.js — turns a workspace's background settings into CSS. Pure functions.
 *
 * A workspace has: bgColor "#RRGGBB", bgImage (file path or null), bgFit, bgOpacity 0..1, grid.
 * The canvas draws, bottom to top:  color  →  image (own layer, so opacity affects only it)
 *                                   →  dot grid  →  the notes.
 */

/** The ways a background image can be laid out (value is what is stored in bgFit). */
export const BG_FITS = [
  { id: 'cover', label: 'Fill' },
  { id: 'contain', label: 'Fit' },
  { id: 'tile', label: 'Tile' },
  { id: 'center', label: 'Center' },
];

/** Is a "#RRGGBB" color dark (so light dots / text read better on it)? */
export function isDark(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!match) return false;
  const value = parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 < 0.5;
}

/**
 * Style for the image layer, or null when there is no image.
 * @param url  a URL the webview can load (from convertFileSrc), or '' when not ready yet
 */
export function imageLayerStyle(workspace, url) {
  if (!workspace?.bgImage || !url) return null;
  const tile = workspace.bgFit === 'tile';
  const size = workspace.bgFit === 'cover' ? 'cover' : workspace.bgFit === 'contain' ? 'contain' : 'auto';
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: size,
    backgroundRepeat: tile ? 'repeat' : 'no-repeat',
    backgroundPosition: 'center',
    opacity: workspace.bgOpacity ?? 1,
  };
}

/** Style for the dot grid layer (dots turn light on dark backgrounds), or null when off. */
export function gridLayerStyle(workspace) {
  if (!workspace?.grid) return null;
  const dot = isDark(workspace.bgColor) ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)';
  return { backgroundImage: `radial-gradient(${dot} .75px, transparent .75px)`, backgroundSize: '22px 22px' };
}

/** "Workspace 2", "Workspace 3" … the first number not already used as "Workspace N". */
export function nextWorkspaceName(workspaces) {
  const used = new Set(workspaces.map((workspace) => workspace.name));
  let number = workspaces.length + 1;
  while (used.has(`Workspace ${number}`)) number += 1;
  return `Workspace ${number}`;
}
