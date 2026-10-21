import { useCallback, useRef } from 'react';

const HOLD_MS = 500;
const MOVE_PX = 10;

/**
 * Press and hold (about half a second) on a link or card to open its share sheet.
 * - A finger that moves (scrolling) cancels it, so scrolling the list never opens the sheet.
 * - After a hold, the tap that follows is swallowed, so the link does not also open.
 * - Where the phone sends its own long-press menu (`contextmenu`: Android, desktop right click, the menu key), that opens the sheet too.
 * @param {() => void} onHold
 */
export function useLongPress(onHold) {
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const start = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const fire = useCallback(() => {
    clear();
    if (held.current) return;
    held.current = true;
    navigator.vibrate?.(10);
    onHold();
  }, [clear, onHold]);
  return {
    onPointerDown: (/** @type {import('react').PointerEvent} */ event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      held.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      clear();
      timer.current = setTimeout(fire, HOLD_MS);
    },
    onPointerMove: (/** @type {import('react').PointerEvent} */ event) => {
      if (timer.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > MOVE_PX) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (/** @type {import('react').MouseEvent} */ event) => {
      event.preventDefault();
      fire();
    },
    onClick: (/** @type {import('react').MouseEvent} */ event) => {
      if (held.current) {
        event.preventDefault();
        event.stopPropagation();
        held.current = false;
      }
    },
    onDragStart: (/** @type {import('react').DragEvent} */ event) => event.preventDefault(),
  };
}
