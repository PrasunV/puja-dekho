import { createContext, useCallback, useContext, useRef, useState } from 'react';

const TOAST_MS = 4500;
const MAX_VISIBLE = 3;

/** @typedef {{ id: number, message: string, kind: '' | 'ok' | 'err' }} ToastItem */

const ToastActions = createContext(/** @type {(message: string, kind?: '' | 'ok' | 'err') => void} */ (() => {}));
const ToastList = createContext(/** @type {ToastItem[]} */ ([]));

/**
 * Toasts live in their own context so a toast appearing does not re-render the whole app.
 * @param {{ children: React.ReactNode }} props
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState(/** @type {ToastItem[]} */ ([]));
  const nextId = useRef(0);
  /** @type {(message: string, kind?: ToastItem['kind']) => void} */
  const show = useCallback((message, kind = '') => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, message, kind }]);
    setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), TOAST_MS);
  }, []);
  return (
    <ToastActions.Provider value={show}>
      <ToastList.Provider value={toasts}>{children}</ToastList.Provider>
    </ToastActions.Provider>
  );
}

/** @returns {(message: string, kind?: '' | 'ok' | 'err') => void} */
export const useToast = () => useContext(ToastActions);
/** @returns {ToastItem[]} */
export const useToastList = () => useContext(ToastList);
