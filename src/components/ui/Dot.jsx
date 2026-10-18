/**
 * Coloured status dot: metro line (`blue`, `green`, ...) or queue level (`q0` to `q3`).
 * @param {{ tone: string, big?: boolean }} props
 */
export function Dot({ tone, big = false }) {
  return <i className={`dot ${tone}`} style={big ? { width: 16, height: 16 } : undefined} />;
}
