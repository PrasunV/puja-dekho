import { truncateName } from '../../lib/truncate.js';
import { el } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const PIN_NAME_MAX = 20;

/** The selected puja: a Google-style red pin with a tooltip above it. Text goes in as text nodes only. */
export function makePin(/** @type {string} */ name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 27 43');
  svg.setAttribute('width', '27');
  svg.setAttribute('height', '43');
  svg.setAttribute('aria-hidden', 'true');
  const body = document.createElementNS(SVG_NS, 'path');
  body.setAttribute('d', 'M13.5 0.5C6.3 0.5 0.5 6.3 0.5 13.5c0 9.6 13 28.7 13 28.7s13-19.1 13-28.7C26.5 6.3 20.7 0.5 13.5 0.5z');
  body.setAttribute('fill', '#EA4335');
  body.setAttribute('stroke', '#B31412');
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', '13.5');
  dot.setAttribute('cy', '13.5');
  dot.setAttribute('r', '5');
  dot.setAttribute('fill', '#fff');
  svg.append(body, dot);

  const short = truncateName(name, PIN_NAME_MAX);
  const text = el('span', { class: 'pin-text' }, short);
  const tip = el('button', { class: 'pin-tip', type: 'button' }, text);
  const cut = short !== name.trim();
  if (cut) {
    tip.setAttribute('aria-expanded', 'false');
    tip.setAttribute('aria-label', `${name}. Tap to ${'show the full name'}`);
    tip.addEventListener('click', (event) => {
      event.stopPropagation(); // a tap on the tooltip must not reach the map
      const open = tip.classList.toggle('open');
      text.textContent = open ? name.trim() : short;
      tip.setAttribute('aria-expanded', String(open));
    });
  } else {
    tip.tabIndex = -1;
    tip.setAttribute('aria-label', name);
    tip.addEventListener('click', (event) => event.stopPropagation());
  }
  tip.addEventListener('dblclick', (event) => event.stopPropagation()); // no zoom-on-double-tap through the tooltip

  const pin = el('div', { class: 'sel-pin', role: 'img', 'aria-label': `Selected: ${name}` }, tip, svg);
  return pin;
}
