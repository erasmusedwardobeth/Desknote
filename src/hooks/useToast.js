/**
 * useToast — a short message that disappears after ~2.6 seconds.
 * `notify('Saved')` shows it; render it with <Toast message={toast} />.
 */
import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState('');
  const timer = useRef(null);
  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2600);
  }, []);
  return { toast, notify };
}
