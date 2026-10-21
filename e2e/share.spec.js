import { BHASAN } from '../src/data/bhasan.js';
import { expect, openApp, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });
const IST = (text) => new Date(`${text}+05:30`).getTime();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function ready(page) {
  await page.context().route('https://www.youtube.com/**', (route) => route.fulfill({ contentType: 'text/html', body: 'ok' }));
  await page.route('https://i.ytimg.com/**', (route) => route.fulfill({ contentType: 'image/png', body: png }));
  // Pretend it is the evening of 21 Oct, but keep time moving (Playwright's fixed clock would stall the timers the sheet uses).
  await page.addInitScript((target) => {
    const Real = Date;
    const offset = target - Real.now();
    // @ts-ignore
    globalThis.Date = class extends Real {
      constructor(...args) {
        if (args.length) super(...args);
        else super(Real.now() + offset);
      }
      static now() {
        return Real.now() + offset;
      }
    };
  }, IST('2026-10-21T18:00:00'));
  await openApp(page);
  for (let i = 0; i < 4 && (await page.locator('.panel').getAttribute('data-sheet')) !== 'half'; i += 1) await page.locator('.grab').click();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
}
const hold = async (page, locator, ms = 700) => {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
};

test.describe('share sheet', () => {
  test.beforeEach(async ({ page }) => ready(page));

  test('the share icon on a video card opens the sheet: picture, title, message, two buttons', async ({ page }) => {
    await page.getByTestId('video-0').locator('xpath=..').getByTestId('share-btn').click();
    const sheet = page.getByTestId('share-sheet');
    await expect(sheet.getByRole('heading', { name: 'Sharing…' })).toBeVisible();
    await expect(sheet.getByTestId('share-preview')).toContainText('Bijoya Dashami, live now');
    await expect(sheet.getByTestId('share-preview')).not.toContainText(/TV9|Zee|ABP/i);
    await expect(sheet.getByTestId('share-preview').locator('img')).toHaveAttribute('src', BHASAN.videos[0].thumb);
    await expect(sheet).toContainText('Watch Dashami immersion live with me');
    await expect(sheet).not.toContainText(/TV9|Zee|ABP/i);
    const wa = sheet.getByRole('link', { name: /Post on/ });
    const href = await wa.getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(href)).toContain('https://puja-dekho.vercel.app/api/share?v=04sRqedFlMk&s=wa');
    await expect(wa).toHaveAttribute('target', '_blank');
    await expect(wa).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(sheet.getByRole('button', { name: 'Copy link' })).toBeVisible();
  });

  test('Copy link copies our app link, tagged cp, and says so for two seconds', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('video-2').locator('xpath=..').getByTestId('share-btn').click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://puja-dekho.vercel.app/api/share?v=MB1a8UAA4bA&s=cp');
  });

  test('press and hold opens the sheet and does not open YouTube; a quick tap still opens YouTube', async ({ page }) => {
    const popups = [];
    page.on('popup', (p) => popups.push(p));
    await hold(page, page.getByTestId('video-1'));
    await expect(page.getByTestId('share-sheet').getByRole('heading', { name: 'Sharing…' })).toBeVisible();
    await page.waitForTimeout(300);
    expect(popups).toHaveLength(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('share-sheet')).toHaveCount(0);
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('video-1').click()]);
    expect(popup.url()).toContain('UxHc2lGvfiI');
  });

  test('scrolling past a card (finger moves) does not open the sheet', async ({ page }) => {
    await page.getByTestId('video-0').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await page.getByTestId('video-0').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 20, { steps: 4 });
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.getByTestId('share-sheet')).toHaveCount(0);
  });

  test('the ghat card has no share icon; its details sheet has "Share" (icon on the left) instead of "Show on map"', async ({ page }) => {
    await expect(page.getByTestId('ghat-card').locator('xpath=..').getByTestId('share-btn')).toHaveCount(0);
    await page.getByTestId('ghat-card').click();
    await expect(page.getByTestId('ghat-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show on map' })).toHaveCount(0);
    const share = page.getByTestId('ghat-share');
    await expect(share).toHaveText('Share');
    expect(await share.evaluate((b) => b.firstElementChild?.nodeName)).toBe('svg'); // icon first, then the words
    await share.click();
    const sheet = page.getByTestId('share-sheet');
    await expect(sheet.getByRole('heading', { name: 'Sharing…' })).toBeVisible();
    await expect(sheet).toContainText('Bhasan today at Baje Kadomtala Ghat');
    await expect(sheet).toContainText('Come with me to Baje Kadomtala Ghat today');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).toHaveCount(0);
  });

  for (const width of [320, 360, 390, 430]) {
    test(`ghat details: Get directions and Share sit in one row at ${width}px, 48 px tall`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.getByTestId('ghat-card').click();
      await expect(page.getByTestId('ghat-share')).toBeVisible();
      await page.waitForTimeout(700);
      const [a, b] = await page.evaluate(() => [...document.querySelectorAll('.actions .btn')].map((n) => n.getBoundingClientRect().toJSON()));
      expect(Math.abs(a.top - b.top)).toBeLessThan(1);
      expect(a.height).toBeGreaterThanOrEqual(47.5);
      expect(b.height).toBeGreaterThanOrEqual(47.5);
      expect(b.width).toBeLessThan(a.width);
    });
  }

  test('buttons read text first, then the icon', async ({ page }) => {
    await page.getByTestId('share-btn').first().click();
    const order = await page.evaluate(() => [...document.querySelectorAll('.share-actions .btn')].map((b) => [b.firstChild.nodeType === 3 ? 'text' : b.firstChild.nodeName, b.lastElementChild.nodeName]));
    for (const [first, last] of order) {
      expect(first).toBe('text');
      expect(last).toBe('svg');
    }
    await expect(page.getByRole('link', { name: /Post on/ })).toContainText('Post on');
  });

  test('closes with the scrim, and the share icons have a 48 px tap area', async ({ page }) => {
    const btn = page.getByTestId('share-btn').first();
    const b = await btn.boundingBox();
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(47.5);
    await btn.click();
    await expect(page.getByTestId('share-sheet')).toBeVisible();
    await page.getByTestId('share-scrim').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('share-sheet')).toHaveCount(0);
  });

  for (const width of [320, 360, 430]) {
    test(`sheet fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.getByTestId('share-btn').first().click();
      const sheet = page.getByTestId('share-sheet');
      await expect(sheet).toBeVisible();
      expect(await sheet.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
      const btns = await Promise.all([page.getByRole('link', { name: /Post on/ }).boundingBox(), page.getByRole('button', { name: 'Copy link' }).boundingBox()]);
      for (const x of btns) expect(x.height).toBeGreaterThanOrEqual(47.5);
    });
  }
});

test.describe('shared link address (/api/share)', () => {
  test('a video link answers with that video\'s picture and title, then sends people into the app', async ({ request }) => {
    const res = await request.get('/api/share?v=04sRqedFlMk&s=wa');
    const html = await res.text();
    expect(html).toContain('<meta property="og:image" content="https://i.ytimg.com/vi/04sRqedFlMk/hqdefault.jpg" />');
    expect(html).toContain('og:title" content="Bijoya Dashami, live now');
    expect(html).not.toMatch(/TV9|Zee|ABP/i);
    expect(html).toContain('twitter:card" content="summary_large_image');
    expect(html).toContain('location.replace("/?s=wa")');
  });
  test('the ghat link uses the Bijoya picture; unknown or hostile ids fall back to the plain app preview', async ({ request }) => {
    expect(await (await request.get('/api/share?v=ghat&s=cp')).text()).toContain('og/share.jpg');
    const bad = await (await request.get('/api/share?v="><script>alert(1)</script>&s=<b>')).text();
    expect(bad).not.toContain('<script>alert(1)');
    expect(bad).toContain('og:title" content="Puja Dekho"');
    expect(bad).toContain('location.replace("/?s=link")');
  });
});
