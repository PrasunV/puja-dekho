import { BHASAN, bhasanActive, ghatDirectionsUrl, ghatStatus } from '../src/data/bhasan.js';
import { expect, openApp, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });

const IST = (text) => new Date(`${text}+05:30`).getTime();
const toHalf = async (page) => {
  for (let i = 0; i < 4 && (await page.locator('.panel').getAttribute('data-sheet')) !== 'half'; i += 1) await page.locator('.grab').click();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
};

test.describe('status and expiry logic (India time)', () => {
  test('no confirmed window: only "Bhasan today", no time anywhere', () => {
    expect(BHASAN.ghat.window).toBeNull();
    expect(ghatStatus(IST('2026-10-21T10:00:00'))).toEqual({ key: 'today', label: 'Bhasan today' });
    expect(ghatStatus(IST('2026-10-21T23:00:00')).label).toBe('Bhasan today');
  });
  test('with a window the chip follows India time: starts, on now, ended', () => {
    const window = { start: '17:00', end: '21:00' };
    expect(ghatStatus(IST('2026-10-21T15:30:00'), window)).toEqual({ key: 'soon', label: 'Starts at 5:00 PM' });
    expect(ghatStatus(IST('2026-10-21T17:00:00'), window).key).toBe('on');
    expect(ghatStatus(IST('2026-10-21T20:59:00'), window).label).toBe('Bhasan on now');
    expect(ghatStatus(IST('2026-10-21T21:00:00'), window)).toEqual({ key: 'ended', label: 'Ended for today' });
    // 11:30 UTC is 17:00 IST: the answer must not depend on the machine's own zone.
    expect(ghatStatus(Date.UTC(2026, 9, 21, 11, 30), window).key).toBe('on');
  });
  test('expires after 23 Oct 2026 23:59:59 IST', () => {
    expect(bhasanActive(IST('2026-10-23T23:59:58'))).toBe(true);
    expect(bhasanActive(IST('2026-10-24T00:00:01'))).toBe(false);
  });
  test('directions use the Place ID and no forced travel mode', () => {
    const url = ghatDirectionsUrl();
    expect(url).toContain('destination=22.564652,88.33875');
    expect(url).toContain('destination_place_id=ChIJswI8CZ53AjoRtMSihiLpT6c');
    expect(url).not.toContain('travelmode');
  });
});

test.describe('while it is on', () => {
  test.beforeEach(async ({ page }) => {
    // The sandbox has no internet: answer the YouTube thumbnail with a 1 px picture.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    await page.route('https://i.ytimg.com/**', (route) => route.fulfill({ contentType: 'image/png', body: png }));
    await page.clock.setFixedTime(IST('2026-10-21T18:00:00'));
    await openApp(page);
    await toHalf(page);
  });

  test('order: ghat card, then the video cards (newest first), then Must-visit', async ({ page }) => {
    const ghat = page.getByTestId('ghat-card');
    const live = page.getByTestId('video-0');
    const second = page.getByTestId('video-1');
    const replay = page.getByTestId('video-2');
    await expect(ghat).toContainText('Baje Kadomtala Ghat');
    await expect(ghat).toContainText('Strand Rd, B.B.D. Bagh');
    await expect(ghat).toContainText('Bhasan today');
    await expect(ghat).not.toContainText(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    await expect(ghat).toContainText(/\d+(\.\d)? ?(km|m)\b/); // location is on in this test
    // One synchronous read, so a moving sheet cannot skew the comparison.
    const m = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel)?.getBoundingClientRect();
      const [g, l, r, p] = ['[data-testid=ghat-card]', '[data-testid=video-0]', '[data-testid=video-1]', '.popular'].map(box);
      return { g, l, r, p };
    });
    expect(m.g.bottom).toBeLessThanOrEqual(m.l.top);
    expect(Math.abs(m.l.width - m.r.width)).toBeLessThan(1.5);
    expect(Math.abs(m.l.top - m.r.top)).toBeLessThan(1.5);
    if (m.p) expect(m.p.top).toBeGreaterThanOrEqual(m.l.bottom - 1);
    expect(m.g.height).toBeLessThan(130);
  });

  test('video cards open YouTube in a new tab; LIVE badge only when switched on; replay has its thumbnail', async ({ page }) => {
    const live = page.getByTestId('video-0');
    const second = page.getByTestId('video-1');
    const replay = page.getByTestId('video-2');
    await expect(live).toHaveAttribute('href', 'https://www.youtube.com/live/04sRqedFlMk');
    await expect(second).toHaveAttribute('href', 'https://www.youtube.com/live/UxHc2lGvfiI');
    await expect(second).toContainText('Zee 24 Ghanta');
    await expect(replay).toHaveAttribute('href', 'https://www.youtube.com/watch?v=MB1a8UAA4bA');
    for (const card of [live, second, replay]) {
      await expect(card).toHaveAttribute('target', '_blank');
      await expect(card).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await expect(live).toContainText('Watch live');
    await expect(replay).toContainText('Replay');
    await expect(page.getByTestId('live-badge')).toHaveCount(BHASAN.videos.filter((v) => v.live).length); // the badge follows the `live` switch in the config
    await expect(live.locator('img')).toHaveAttribute('src', 'https://i.ytimg.com/vi/04sRqedFlMk/hqdefault.jpg');
    await expect(replay.locator('img')).toHaveAttribute('src', 'https://i.ytimg.com/vi/MB1a8UAA4bA/hqdefault.jpg');
    expect(await page.locator('.vid-card iframe, .vid-card video').count()).toBe(0);
  });

  test('titles clamp to two lines', async ({ page }) => {
    for (const id of ['video-0', 'video-1', 'video-2']) {
      const title = page.getByTestId(id).locator('.vid-title');
      expect(await title.evaluate((node) => getComputedStyle(node).webkitLineClamp)).toBe('2');
    }
  });

  test('tapping the card opens the ghat details; Directions and Share; Close returns to the list', async ({ page }) => {
    await page.getByTestId('ghat-card').click();
    const sheet = page.getByTestId('ghat-page');
    await expect(sheet.getByRole('heading', { name: 'Baje Kadomtala Ghat' })).toBeVisible();
    await expect(sheet).toContainText('Bhasan today');
    await expect(sheet).toContainText('Known for its evening Ganga Aarti.');
    // Area and distance read as one line of text under the name; the only chip is the status.
    await expect(sheet.getByTestId('ghat-where')).toHaveText(/^Strand Rd, B\.B\.D\. Bagh · \d+(\.\d)? ?(km|m) away$/);
    await expect(sheet.locator('.tag')).toHaveCount(1);
    await expect(sheet).toContainText('not confirmed');
    const directions = page.getByRole('link', { name: 'Get directions' });
    await expect(directions).toHaveAttribute('href', ghatDirectionsUrl());
    await expect(directions).toHaveAttribute('target', '_blank');
    await expect(page.getByTestId('ghat-share')).toHaveText('Share');
    // Opening the details already flies the map to the ghat.
    await expect.poll(() => page.evaluate(() => window.__pdMap.isMoving())).toBe(false);
    const centre = await page.evaluate(() => window.__pdMap.getCenter());
    expect(Math.abs(centre.lng - 88.33875)).toBeLessThan(0.01);
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(page.getByTestId('ghat-card')).toBeVisible();
  });

  test('the ghat is marked on the map; tapping the marker opens its details', async ({ page }) => {
    await page.evaluate(() => window.__pdMap.jumpTo({ center: [88.33875, 22.564652], zoom: 16 }));
    const marker = page.locator('.ghat-pin');
    await expect(marker).toBeVisible();
    await marker.click();
    await expect(page.getByTestId('ghat-page')).toBeVisible();
    await expect(page.locator('.sel-pin')).toBeVisible(); // red pin once opened
  });

  for (const width of [320, 360, 390, 430]) {
    test(`fits at ${width}px: nothing sideways, cards the width of the sheet`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.reload();
      await toHalf(page);
      const body = page.locator('.panel-body');
      expect(await body.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
      const [box, ghat, live, replay] = await Promise.all([
        page.getByTestId('bhasan').boundingBox(),
        page.getByTestId('ghat-card').boundingBox(),
        page.getByTestId('video-0').boundingBox(),
        page.getByTestId('video-1').boundingBox(),
      ]);
      expect(Math.abs(ghat.width - box.width)).toBeLessThan(1);
      expect(Math.abs(live.width + replay.width + 12 - box.width)).toBeLessThan(1.5);
    });
  }
});

test.describe('after the end date', () => {
  test('nothing shows and no marker: the list is where it was', async ({ page }) => {
    await page.clock.setFixedTime(IST('2026-10-24T00:30:00'));
    await openApp(page);
    await toHalf(page);
    await expect(page.getByTestId('bhasan')).toHaveCount(0);
    await expect(page.locator('.ghat-pin')).toHaveCount(0);
  });
  test('last evening still shows', async ({ page }) => {
    await page.clock.setFixedTime(IST('2026-10-23T23:00:00'));
    await openApp(page);
    await expect(page.getByTestId('bhasan')).toBeAttached();
  });
});

test.describe('location off', () => {
  test.use({ permissions: [] });
  test('no distance, no error text', async ({ page }) => {
    await page.clock.setFixedTime(IST('2026-10-21T18:00:00'));
    await openApp(page);
    await toHalf(page);
    const ghat = page.getByTestId('ghat-card');
    await expect(ghat).toContainText('Bhasan today');
    await expect(ghat).not.toContainText(/\b\d+(\.\d)? ?(km|m)\b/);
    await expect(ghat).not.toContainText(/location|denied|error/i);
  });
});

test.describe('copy', () => {
  test('header, subheading, VIP chip and live section label', async ({ page }) => {
    await page.clock.setFixedTime(IST('2026-10-21T18:00:00'));
    await openApp(page);
    await toHalf(page);
    await expect(page.locator('.head h2')).toHaveText('Bijoya Bhasan happening…');
    await expect(page.locator('.head .sub')).toHaveText('Visit ghats near you');
    await expect(page.getByTestId('ghat-card')).toContainText('CM S.Adhikari visiting');
    await expect(page.getByRole('heading', { name: 'View live at' })).toBeVisible();
    const same = await page.evaluate(() => {
      const chip = getComputedStyle(document.querySelector('.ghat-vip'));
      const ic = getComputedStyle(document.querySelector('.ghat-ic'));
      return chip.backgroundColor === ic.backgroundColor;
    });
    expect(same).toBe(true);
  });
  test('after the end date the normal header returns', async ({ page }) => {
    await page.clock.setFixedTime(IST('2026-10-24T00:30:00'));
    await openApp(page);
    await expect(page.locator('.head h2')).not.toHaveText('Bijoya Bhasan happening…');
  });
});

test.describe('ghat details without location', () => {
  test.use({ permissions: [] });
  test('the area stays, with no distance and no leftover dot', async ({ page }) => {
    await page.clock.setFixedTime(IST('2026-10-21T18:00:00'));
    await openApp(page);
    await toHalf(page);
    await page.getByTestId('ghat-card').click();
    await expect(page.getByTestId('ghat-where')).toHaveText('Strand Rd, B.B.D. Bagh');
  });
});
