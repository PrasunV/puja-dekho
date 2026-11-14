/**
 * When the share button is on screen and when it shows its words. No React in here, so it can be tested with a fake clock.
 *
 * - On load, once the splash is gone and nothing else is open: the button fades in with its words, then shrinks to the icon.
 * - Any interaction (the map, the sheet, search, another sheet): the button goes away at once.
 * - When the interaction ends it comes back as the icon. If the person then rests for REST_MS, the words show once more and
 *   shrink again. One reminder per rest, never a loop.
 * - Reduced motion: the words never show.
 */
export const TEXT_MS = 3000;
export const REST_MS = 10000;

/**
 * @typedef {{ shown: boolean, expanded: boolean }} RevealState
 * @param {{ onChange: (s: RevealState) => void, reduced?: boolean, set?: typeof setTimeout, clear?: typeof clearTimeout }} opts
 */
export function createReveal({ onChange, reduced = false, set = setTimeout, clear = clearTimeout }) {
  let ready = false;
  let blocked = false;
  let introDone = false;
  /** @type {RevealState} */
  let state = { shown: false, expanded: false };
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let textTimer;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let restTimer;

  const emit = (/** @type {RevealState} */ next) => {
    if (next.shown === state.shown && next.expanded === state.expanded) return;
    state = next;
    onChange(state);
  };
  const stopTimers = () => {
    clear(textTimer);
    clear(restTimer);
  };
  const shrinkLater = () => {
    textTimer = set(() => emit({ shown: true, expanded: false }), TEXT_MS);
  };
  const sync = () => {
    stopTimers();
    if (!ready || blocked) return emit({ shown: false, expanded: false });
    if (!introDone) {
      introDone = true;
      emit({ shown: true, expanded: !reduced });
      if (!reduced) shrinkLater();
      return undefined;
    }
    emit({ shown: true, expanded: false });
    if (!reduced) {
      restTimer = set(() => {
        emit({ shown: true, expanded: true });
        shrinkLater();
      }, REST_MS);
    }
    return undefined;
  };

  return {
    setReady(/** @type {boolean} */ v) {
      if (v !== ready) {
        ready = v;
        sync();
      }
    },
    setBlocked(/** @type {boolean} */ v) {
      if (v !== blocked) {
        blocked = v;
        sync();
      }
    },
    destroy: stopTimers,
  };
}
