/**
 * <ContextMenu> — the right-click menu, drawn at the mouse position and kept on screen.
 *
 * Props:
 *   menu     { x, y, items }  (from useContextMenu; items are built by lib/menus.js)
 *   onClose  called when it should disappear
 * Closes on: choosing an item, clicking elsewhere, Esc, window resize or losing focus.
 * Keyboard: Up / Down move between items, Enter chooses.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ColorSwatches from './ColorSwatches.jsx';

function MenuItems({ items, onClose }) {
  return items.map((entry, index) => {
    if (entry.type === 'separator') return <div key={`sep-${index}`} className="cm-separator" role="separator" />;
    if (entry.type === 'swatches') {
      return (
        <div key={`sw-${index}`} className="cm-swatches">
          <span className="cm-label">{entry.label}</span>
          <ColorSwatches colors={entry.colors} value={entry.value} size="sm" onPick={(color) => { onClose(); entry.onPick(color); }} />
        </div>
      );
    }
    if (entry.type === 'submenu') return <SubMenu key={`sub-${index}`} entry={entry} onClose={onClose} />;
    return (
      <button
        key={`item-${index}`} role="menuitem" disabled={entry.disabled}
        className={`cm-item ${entry.danger ? 'danger' : ''}`}
        onClick={() => { onClose(); entry.onClick(); }}
      >
        <span className="cm-check">{entry.checked ? '✓' : ''}</span>
        <span className="cm-text">{entry.label}</span>
        {entry.shortcut && <span className="cm-shortcut">{entry.shortcut}</span>}
      </button>
    );
  });
}

function SubMenu({ entry, onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cm-sub-wrap" onMouseEnter={() => !entry.disabled && setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button role="menuitem" aria-haspopup="menu" aria-expanded={open} disabled={entry.disabled} className="cm-item" onClick={() => setOpen((value) => !value)}>
        <span className="cm-check" />
        <span className="cm-text">{entry.label}</span>
        <span className="cm-shortcut">▸</span>
      </button>
      {open && <div className="cm-menu cm-sub" role="menu"><MenuItems items={entry.items} onClose={onClose} /></div>}
    </div>
  );
}

export default function ContextMenu({ menu, onClose }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ left: menu.x, top: menu.y });

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const box = ref.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - box.width - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - box.height - 8)),
    });
  }, [menu]);

  useEffect(() => {
    const outside = (event) => { if (!ref.current?.contains(event.target)) onClose(); };
    const key = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const buttons = [...ref.current.querySelectorAll('button[role="menuitem"]:not(:disabled)')];
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="cm-menu" role="menu" style={{ left: position.left, top: position.top }} onContextMenu={(event) => event.preventDefault()}>
      <MenuItems items={menu.items} onClose={onClose} />
    </div>
  );
}
