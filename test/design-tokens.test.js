// Design gate: the Jagadhatri CSS must stay on the App_DESIGN.md v1.0.0 tokens.
// A value that has a real reason to be off-token carries `token-ok: <reason>` in a comment on the same line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILES = ['src/jagadhatri/jg.css', 'src/jagadhatri/loader/loader.css'];

// Design section 3: size / line height, in px. Weights are 400, 500 or 700 (design 7.3 also allows 600 on a selected chip).
const TYPE_STYLES = new Set(['24/28', '17/22', '17/20', '15/20', '14/16', '14/20', '13/16']);
const WEIGHTS = new Set(['400', '500', '700']);
// Design section 4: spacing 4, 8, 12, 16, 20, 24. Layout offsets above 24 stay on the 4 px grid.
const SPACING = new Set([0, 4, 8, 12, 16, 20, 24]);
const RADII = new Set([0, 4, 12, 16, 24, 999]);

/** @param {string} v */
const px = (v) => {
  const m = /^(-?[\d.]+)(px|rem)$/.exec(v);
  return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null;
};

/** @param {string} file */
function violations(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  /** @type {string[]} */
  const out = [];
  // Rule bodies: everything between a `{` and the next `}` that holds declarations.
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().split('*/').pop()?.trim() ?? '';
    const bodyStart = text.slice(0, m.index + m[0].indexOf('{') + 1).split('\n').length;
    /** @type {Record<string, { value: string, line: number, ok: boolean }>} */
    const decl = {};
    m[2].split('\n').forEach((raw, i) => {
      const d = /^\s*([\w-]+):\s*(.+?);/.exec(raw);
      if (d) decl[d[1]] = { value: d[2], line: bodyStart + i, ok: raw.includes('token-ok') };
    });
    const bad = (/** @type {number} */ line, /** @type {string} */ msg) => out.push(`${file}:${line} ${selector.slice(0, 50)} → ${msg}`);
    for (const [prop, { value, line, ok }] of Object.entries(decl)) {
      if (ok) continue;
      if (prop === 'font-weight' && !WEIGHTS.has(value) && value !== 'inherit') {
        bad(line, `font-weight ${value} (use 400, 500 or 700)`);
      }
      if (/^(padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(row-|column-)?gap$/.test(prop)) {
        for (const t of value.split(/\s+/)) {
          const n = px(t);
          if (n === null) continue;
          const a = Math.abs(n);
          if (!SPACING.has(a) && !(a > 24 && a % 4 === 0)) bad(line, `${prop} ${t} (use 4, 8, 12, 16, 20, 24)`);
        }
      }
      if (prop === 'border-radius') {
        for (const t of value.split(/\s+/)) {
          const n = px(t);
          if (n !== null && !RADII.has(n)) bad(line, `border-radius ${t} (use 4, 12, 16, 24 or 999)`);
        }
      }
    }
    const fs = decl['font-size'];
    if (fs && !fs.ok && fs.value !== 'inherit') {
      const lh = decl['line-height'];
      const size = px(fs.value);
      const lineH = lh ? px(lh.value) : null;
      if (!lh) bad(fs.line, `font-size ${fs.value} without a line-height (set both from the type scale)`);
      else if (!lh.ok && !TYPE_STYLES.has(`${size}/${lineH}`)) {
        bad(fs.line, `type ${size}/${lineH} is not in the scale (24/28, 17/22, 17/20, 15/20, 14/16, 14/20, 13/16)`);
      }
    }
  }
  void lines;
  return out;
}

for (const file of FILES) {
  test(`${file} stays on the design tokens`, () => {
    const found = violations(file);
    assert.equal(found.length, 0, `\n${found.join('\n')}\n\nSnap to a token, or add "token-ok: <reason>" in a comment on that line.`);
  });
}
