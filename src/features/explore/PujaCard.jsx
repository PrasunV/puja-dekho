import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext.js';
import { formatDistance, walkMinutes } from '../../lib/geo.js';

/**
 * One row in the puja list: name, area, distance and the since-year. (No crowd dot: it was a grey dot that told nobody anything.)
 * @param {{ puja: import('../../lib/types.js').Puja, index: number, note?: string }} props
 */
function PujaCard({ puja, index, note }) {
  const { openPuja, filters } = useApp();
  const distance = filters.distances?.get(puja.id);
  return (
    <motion.div
      className="pcard"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.025, duration: 0.2 }}
    >
      <button type="button" className="pcard-main" onClick={() => openPuja(puja.id)}>
        <div className="row">
          <div className="pname grow">{puja.n}</div>
          {distance != null && (
            <span className="dist-pill">
              {`~${formatDistance(distance)}`}
              <small>{`~${walkMinutes(distance)} min`}</small>
            </span>
          )}
        </div>
        <div className="pmeta">
          <span className="tag">{puja.ar}</span>
          {puja.h && <span className="tag accent">{puja.e ? `Since ${puja.e}` : 'Heritage'}</span>}
          {note && <span className="sub">{note}</span>}
        </div>
      </button>
    </motion.div>
  );
}

export default React.memo(PujaCard);
