import { openApp, test, expect } from './fixtures.js';

// Every sheet and card must hold on every phone, Android to iOS, at the largest text the person may use (150%).
// Chrome on Android scales px text with the system font size; this reproduces that by scaling every px font-size
// and line-height in the stylesheets, so the layout is tested under the same pressure as a real device.
const PHONES = [
  ['320x640 small Android / iPhone SE', 320, 640],
  ['360x740 common Android', 360, 740],
  ['390x844 iPhone 14', 390, 844],
  ['430x932 iPhone Pro Max', 430, 932],
  ['768x1024 tablet', 768, 1024],
];
const SCALES = [1, 1.5];

async function scaleText(page, factor) {
  if (factor === 1) return;
  await page.evaluate((f) => {
    const scale = (value) => (value.endsWith('px') ? `${parseFloat(value) * f}px` : value);
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules && !(rule instanceof CSSKeyframesRule)) walk(rule.cssRules);
        const st = rule.style;
        if (!st) continue;
        const fs = st.getPropertyValue('font-size');
        if (fs) st.setProperty('font-size', scale(fs), st.getPropertyPriority('font-size'));
        const lh = st.getPropertyValue('line-height');
        if (lh && lh.endsWith('px')) st.setProperty('line-height', scale(lh), st.getPropertyPriority('line-height'));
      }
    };
    for (const sheet of document.styleSheets) {
      try { walk(sheet.cssRules); } catch { /* cross-origin sheet */ }
    }
    document.documentElement.style.fontSize = `${16 * f}px`;
  }, factor);
}

/**
 * Problems that would show on a phone, anywhere on screen: sideways scroll, text cut off by its own box
 * (a fixed height or a nowrap with overflow hidden), controls pushed past the screen edge.
 */
async function problems(page) {
  return page.evaluate(() => {
    const out = [];
    const vw = window.innerWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
    const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.textContent || '').trim().slice(0, 28)}"`;
    const hasOwnText = (el) => (el.textContent || '').trim().length > 0 && !el.matches('.od-win, .od-cell, .od-strip, .swap-measure, .panel');
    for (const el of document.body.querySelectorAll('*')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[inert], [hidden], .maplibregl-map, .peek-line, .preview-controls, [aria-hidden="true"]')) continue;
      const clips = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
      const scroller = cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      const ellipsis = cs.textOverflow === 'ellipsis';
      if (hasOwnText(el) && clips && !scroller && !ellipsis) {
        if (el.scrollWidth > el.clientWidth + 1) out.push(`text clipped sideways: ${label(el)}`);
        if (el.scrollHeight > el.clientHeight + 1) out.push(`text clipped vertically: ${label(el)}`);
      }
      const inScroller = (() => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          const o = getComputedStyle(n).overflowX;
          if ((o === 'auto' || o === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
        }
        return false;
      })();
      if (el.matches('button, a.btn, [role=button]') && (box.right > vw + 1 || box.left < -1) && !inScroller && !el.closest('.maplibregl-ctrl')) out.push(`off screen: ${label(el)} (${Math.round(box.left)}..${Math.round(box.right)})`);
    }
    return [...new Set(out)];
  });
}

async function boot(page, width, height, scale) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => { try { localStorage.setItem('pd_explainerSeen', 'true'); } catch { /* no storage */ } });
  await openApp(page);
  await scaleText(page, scale);
  await page.waitForTimeout(300);
}

for (const [name, width, height] of PHONES) {
  for (const scale of SCALES) {
    test(`puja details hold on ${name} at ${scale * 100}% text`, async ({ page }) => {
      await boot(page, width, height, scale);
      await page.evaluate(() => window.__pd.openPuja('S001'));
      await expect(page.locator('.bento-card').first()).toBeVisible();
      await page.waitForTimeout(600);
      expect(await problems(page), 'shut').toEqual([]);

      const close = page.getByRole('button', { name: 'Close details' });
      const box = await close.boundingBox();
      expect(box.x + box.width, 'close button is at the right edge').toBeGreaterThan(width - 40);
      expect(box.x + box.width).toBeLessThanOrEqual(width);

      const shot = `/tmp/shots/r-${width}-${scale}`;
      await page.screenshot({ path: `${shot}-a.png` });
      for (const label of [/Getting there/, /Heritage/, /^Address/]) {
        await page.getByRole('button', { name: label }).click();
        await page.waitForTimeout(700);
      }
      expect(await problems(page), 'all open').toEqual([]);
      await page.screenshot({ path: `${shot}-b.png` });
    });
  }
}

for (const [name, width, height] of PHONES) {
  for (const scale of SCALES) {
    test(`list and filters hold on ${name} at ${scale * 100}% text`, async ({ page }) => {
      await boot(page, width, height, scale);
      const shot = `/tmp/shots/s-${width}-${scale}`;
      expect(await problems(page), 'map and list at rest').toEqual([]);
      await page.screenshot({ path: `${shot}-list.png` });
      await page.locator('.grab').click();
      await page.locator('.grab').click();
      await page.waitForTimeout(700);
      expect(await problems(page), 'list at half').toEqual([]);
      await page.getByRole('button', { name: /^Filters/ }).first().click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${shot}-filters.png` });
      expect(await problems(page), 'filters').toEqual([]);
    });
  }
}

// The sheets people use most. The list is the busiest, so it is checked at every resting height, scrolled, in light and dark.
for (const scheme of ['light', 'dark']) {
  for (const [name, width, height] of PHONES) {
    for (const scale of SCALES) {
      test(`puja list sheet holds on ${name} at ${scale * 100}% text, ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await boot(page, width, height, scale);
        const shot = `/tmp/shots/l-${scheme}-${width}-${scale}`;
        await page.locator('.grab').click(); // peek to initial
        await page.waitForTimeout(600);
        expect(await problems(page), 'list at 35%').toEqual([]);
        await page.screenshot({ path: `${shot}-a.png` });
        await page.locator('.grab').click(); // half
        await page.waitForTimeout(600);
        // The sort pill sits on the right edge of the "All Pujas" row (even when the heading wraps it), and is 40 px tall at normal text.
        const sortGeo = await page.evaluate(() => {
          const row = document.querySelector('.all-head').getBoundingClientRect();
          const b = document.querySelector('.sort-btn').getBoundingClientRect();
          return { gap: row.right - b.right, h: b.height, inside: b.left >= row.left - 0.5 };
        });
        expect(Math.abs(sortGeo.gap), 'sort pill at the right edge').toBeLessThan(1);
        expect(sortGeo.inside, 'sort pill inside the row').toBe(true);
        if (scale === 1) expect(sortGeo.h).toBeCloseTo(40, 0);
        await page.locator('.panel-body').evaluate((e) => e.scrollTo(0, 600));
        await page.waitForTimeout(300);
        expect(await problems(page), 'list scrolled at 57%').toEqual([]);
        await page.locator('.grab').click(); // full
        await page.waitForTimeout(600);
        await page.locator('.panel-body').evaluate((e) => e.scrollTo(0, 2400));
        await page.waitForTimeout(300);
        expect(await problems(page), 'list scrolled at 85%').toEqual([]);
        await page.screenshot({ path: `${shot}-b.png` });
      });
    }
  }
}

for (const [name, width, height] of PHONES) {
  for (const scale of SCALES) {
    test(`metro sheet holds on ${name} at ${scale * 100}% text`, async ({ page }) => {
      await boot(page, width, height, scale);
      const shot = `/tmp/shots/m-${width}-${scale}`;
      await page.getByRole('button', { name: /Metro stations near you/ }).click();
      await page.waitForTimeout(700);
      expect(await problems(page), 'metro').toEqual([]);
      await page.screenshot({ path: `${shot}-metro.png` });
      for (const label of [/Blue Line/, /Green Line/, /All timings/]) {
        await page.getByRole('button', { name: label }).first().click();
        await page.waitForTimeout(500);
      }
      expect(await problems(page), 'metro all open').toEqual([]);
      await page.screenshot({ path: `${shot}-metro-open.png` });
    });
  }
}

for (const [name, width, height] of PHONES) {
  for (const scale of SCALES) {
    test(`metro lines and station sheets hold on ${name} at ${scale * 100}% text`, async ({ page }) => {
      await boot(page, width, height, scale);
      await page.getByRole('button', { name: /^Blue line/ }).click();
      await page.waitForTimeout(700);
      expect(await problems(page), 'blue line stations').toEqual([]);
      await page.getByRole('button', { name: /Blue Line/ }).first().click();
      await page.waitForTimeout(500);
      expect(await problems(page), 'blue line tile open').toEqual([]);
      await page.evaluate(() => window.__pd.openStation('kalighat'));
      await page.waitForTimeout(700);
      expect(await problems(page), 'station results').toEqual([]);
    });
  }
}
