import { useCallback, useEffect, useRef, useState } from 'react';

const UNDO_MS = 6000;

// Holds one undoable action for a few seconds.
export default function useUndo() {
  const [undo, setUndo] = useState(null); // { label, onUndo }
  const timer = useRef(null);

  const offer = useCallback((label, restore) => {
    if (timer.current) clearTimeout(timer.current);
    setUndo({
      label,
      onUndo: () => {
        restore();
        setUndo(null);
      },
    });
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  return { undo, offer };
}
