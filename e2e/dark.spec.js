import { openApp, test, expect } from './fixtures.js';

// Dark theme guard: the surfaces added in the overhaul once hard-coded light
// colours, so their text vanished in dark. This checks real computed contrast.
test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Computed colours come back as rgb()/color(srgb ...); read them through a canvas.
async function colours(page, selector) {
  return page.locator(selector).first().evaluate((el) => {
    const px = (c) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1;
      const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1);
      return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const cs = getComputedStyle(el);
    return { fg: px(cs.color), bg: px(cs.backgroundColor) };
  });
}

test('puja detail bento cards are dark with readable text', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pd_explainerSeen', 'true'); } catch {} });
  await openApp(page);
  await page.evaluate(() => window.__pd.openPuja('S001'));
  await expect(page.locator('.bento-card').first()).toBeVisible();
  const card = await colours(page, '.bento-card');
  expect(lum(card.bg), 'card surface must be dark').toBeLessThan(0.1);
  const head = await colours(page, '.bento-title');
  expect(ratio(head.fg, card.bg)).toBeGreaterThanOrEqual(4.5);
  const body = await colours(page, '.bento-preview');
  expect(ratio(body.fg, card.bg)).toBeGreaterThanOrEqual(4.5);
});

test('sheet, toast surfaces follow the theme', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pd_explainerSeen', 'true'); } catch {} });
  await openApp(page);
  const panel = await colours(page, '.panel');
  expect(lum(panel.bg)).toBeLessThan(0.1);
});
