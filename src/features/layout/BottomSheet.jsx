import { motion } from 'motion/react';

export const SHEET_STATES = /** @type {const} */ (['peek', 'half', 'full']);
/** PRD section 3: a peek that fits the handle and one line, a mid state for summaries, and full height. */
export const SHEET_HEIGHT = { peek: '14%', half: '50%', full: 'calc(100% - 8px)' };
const DRAG_THRESHOLD_PX = 30;

/**
 * The list panel. A draggable bottom sheet on phones with three snap points; a fixed side panel on desktop.
 * At the peek only `peek` shows (one line). Above it `children` scroll and `footer` stays pinned at the bottom.
 *
 * @param {object} props
 * @param {'peek' | 'half' | 'full'} props.sheet
 * @param {(s: 'peek' | 'half' | 'full') => void} props.onSheetChange
 * @param {boolean} props.desktop
 * @param {React.ReactNode} props.peek  The one line shown at the peek
 * @param {React.ReactNode} [props.footer]  Buttons pinned at the bottom
 * @param {React.ReactNode} props.children
 */
export default function BottomSheet({ sheet, onSheetChange, desktop, peek, footer, children }) {
  const step = (delta) => SHEET_STATES[Math.max(0, Math.min(SHEET_STATES.length - 1, SHEET_STATES.indexOf(sheet) + delta))];
  const Panel = desktop ? 'section' : motion.section;
  const motionProps = desktop
    ? {}
    : {
        animate: { height: SHEET_HEIGHT[sheet] },
        initial: false,
        transition: /** @type {const} */ ({ type: 'spring', stiffness: 380, damping: 38 }),
      };
  const peeking = sheet === 'peek' && !desktop;
  return (
    <Panel className="panel" data-sheet={sheet} {...motionProps}>
      <motion.button
        type="button"
        className="grab"
        aria-label={peeking ? 'Open list' : 'Resize panel'}
        style={{ touchAction: 'none' }}
        onClick={() => onSheetChange(SHEET_STATES[(SHEET_STATES.indexOf(sheet) + 1) % SHEET_STATES.length])}
        onPanEnd={(event, info) => {
          if (info.offset.y < -DRAG_THRESHOLD_PX) onSheetChange(step(1));
          else if (info.offset.y > DRAG_THRESHOLD_PX) onSheetChange(step(-1));
        }}
      >
        <span />
      </motion.button>
      {peeking ? (
        <button type="button" className="peek-line" onClick={() => onSheetChange('half')}>
          {peek}
        </button>
      ) : (
        <>
          <motion.div
            className="panel-body"
            onPanEnd={(event, info) => {
              if (desktop) return;
              const body = /** @type {HTMLElement} */ (event.currentTarget ?? document.querySelector('.panel-body'));
              if (sheet === 'half') {
                if (info.offset.y < -DRAG_THRESHOLD_PX * 2) onSheetChange('full');
                else if (info.offset.y > DRAG_THRESHOLD_PX * 2) onSheetChange('peek');
              } else if (sheet === 'full' && info.offset.y > DRAG_THRESHOLD_PX * 2 && (body?.scrollTop ?? 0) <= 0) onSheetChange('half');
            }}
          >
            {children}
          </motion.div>
          {footer && <div className="panel-foot">{footer}</div>}
        </>
      )}
    </Panel>
  );
}
