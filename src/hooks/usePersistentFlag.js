/**
 * usePersistentFlag — a true/false UI setting remembered between launches (localStorage).
 *   const [showLeft, setShowLeft] = usePersistentFlag('desknote.showLeft', true);
 */
import { useCallback, useState } from 'react';

export function usePersistentFlag(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === '1';
    } catch { return initial; }
  });
  const set = useCallback((next) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      try { localStorage.setItem(key, resolved ? '1' : '0'); } catch { /* storage unavailable */ }
      return resolved;
    });
  }, [key]);
  return [value, set];
}
