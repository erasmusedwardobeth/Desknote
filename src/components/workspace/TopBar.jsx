/**
 * <TopBar> — logo, the board tabs, and the action buttons.
 * Pure display: every action is passed in from <Workspace>.
 *
 * Props: board, onBoardChange(name), autostart, onToggleAutostart,
 *        onOpenSettings, onAddRegion('group'|'frame'), onCreateNote,
 *        showLeft / showRight (is each side panel visible?), onToggleLeft(), onToggleRight()
 */
import { BOARDS } from '../../lib/constants.js';

export default function TopBar({ showLeft, showRight, onToggleLeft, onToggleRight, board, onBoardChange, autostart, onToggleAutostart, onOpenSettings, onAddRegion, onCreateNote }) {
  return (
    <header className="topbar">
      <button className={`panel-toggle ${showLeft ? 'on' : ''}`} onClick={onToggleLeft} aria-pressed={showLeft} aria-label="Show or hide the layers panel" title="Layers panel">◧</button>
      <div className="brand"><span className="brand-mark">d</span><span>Desknote</span></div>
      <nav className="views" aria-label="Boards">
        {BOARDS.map((name) => (
          <button key={name} className={`view ${board === name ? 'active' : ''}`} aria-pressed={board === name} onClick={() => onBoardChange(name)}>{name}</button>
        ))}
      </nav>
      <div className="top-actions">
        <button className={`quiet ${autostart ? 'enabled' : ''}`} onClick={onToggleAutostart} title="Start when I log in">◷ <span>{autostart ? 'Starts at login' : 'Start on login'}</span></button>
        <button className="quiet" onClick={onOpenSettings}>Settings</button>
        <button className="quiet" onClick={() => onAddRegion('group')}>＋ Group</button>
        <button className="quiet" onClick={() => onAddRegion('frame')}>＋ Frame</button>
        <button className="primary" onClick={onCreateNote}>＋ <span>Note</span></button>
        <button className={`panel-toggle ${showRight ? 'on' : ''}`} onClick={onToggleRight} aria-pressed={showRight} aria-label="Show or hide the properties panel" title="Properties panel">◨</button>
      </div>
    </header>
  );
}
