/**
 * useContextMenu — state of the one right-click menu that can be open.
 *   const { menu, open, close } = useContextMenu();
 *   onContextMenu={(event) => open(event, itemsBuiltByLib/menus.js)}
 *   {menu && <ContextMenu menu={menu} onClose={close} />}
 * `menu` is { x, y, items } (x/y = where the mouse was, in window pixels) or null.
 */
import { useCallback, useState } from 'react';

export function useContextMenu() {
  const [menu, setMenu] = useState(null);
  const open = useCallback((event, items) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items });
  }, []);
  const close = useCallback(() => setMenu(null), []);
  return { menu, open, close };
}
