import { expect, test } from './fixtures.js';

// The offline service worker would answer a blocked request itself, so keep it out of these tests.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });

const phase = (page) => page.locator('.greet').getAttribute('data-phase');
const counts = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pd_greeted') || '{}'));

/** What a first-time visitor in Kolkata sees: the location explainer comes first. The greeting is on (it is off for the other tests). */
const openFirstSheet = async (page) => {
  await page.addInitScript(() => {
    /** @type {any} */ (window).__PD_E2E_GREETING__ = true;
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => (d.name === 'geolocation' ? Promise.resolve({ state: 'prompt' }) : query(d));
  });
  await page.goto('/');
  await expect(page.locator('.explainer')).toBeVisible();
};

test('the first sheet plays the animation in place of the round icon, in a box held by a shimmer', async ({ page }) => {
  await openFirstSheet(page);
  const box = page.locator('.explainer .greet-box');
  await expect(box).toBeVisible();
  await expect(page.locator('.explainer .explainer-icon')).toHaveCount(0);
  await page.waitForTimeout(700); // the sheet has slid into place
  const before = await box.boundingBox();
  expect((before?.width ?? 0) / (before?.height ?? 1)).toBeCloseTo(400 / 140, 1);
  expect(before?.width).toBeCloseTo(260, 0); // a greeting, not a banner
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('still'); // played to the end and held
  const after = await box.boundingBox();
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0); // nothing moved when it arrived
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
  await expect(box).toHaveAttribute('aria-label', 'Shubho Maha Ashtami. Play again');
  expect(await counts(page)).toEqual({ 'maha-ashtami': 1 });
  // The sheet's own buttons were there from the start.
  await expect(page.locator('.explainer').getByRole('button', { name: 'Allow' })).toBeVisible();
});

test('it is drawn whole: the animation is not cut off at the top or bottom', async ({ page }) => {
  await openFirstSheet(page);
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('still');
  // Ink of the artwork reaches neither the top nor the bottom edge of its box.
  const edges = await page.locator('.greet-canvas').evaluate((c) => {
    const canvas = /** @type {HTMLCanvasElement} */ (c);
    const ctx = canvas.getContext('2d') ?? canvas.getContext('webgl2');
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const g = /** @type {CanvasRenderingContext2D} */ (copy.getContext('2d'));
    g.drawImage(canvas, 0, 0);
    const { data, width, height } = g.getImageData(0, 0, canvas.width, canvas.height);
    const inked = (y) => {
      for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 20) return true;
      return false;
    };
    return { top: inked(0), bottom: inked(height - 1), any: ctx !== null };
  });
  expect(edges.top).toBe(false);
  expect(edges.bottom).toBe(false);
});

test('only the first sheet of an open gets it; the next sheet keeps its icon', async ({ page }) => {
  await page.addInitScript(() => {
    /** @type {any} */ (window).__PD_E2E_GREETING__ = true;
  });
  await page.context().setGeolocation({ latitude: 28.6139, longitude: 77.209 });
  await page.context().grantPermissions(['geolocation']);
  await page.goto('/');
  const card = page.locator('.outside');
  await expect(card).toBeVisible();
  await expect(card.locator('.greet-box')).toBeVisible(); // far from Kolkata: the "664 pujas" sheet is the first one
  await expect(card.locator('.explainer-icon')).toHaveCount(0);
});

test('it plays for the first three opens only, counted across both sheets', async ({ page }) => {
  await openFirstSheet(page);
  await expect.poll(() => counts(page), { timeout: 15_000 }).toEqual({ 'maha-ashtami': 1 });
  await page.reload();
  await expect.poll(() => counts(page), { timeout: 15_000 }).toEqual({ 'maha-ashtami': 2 });
  await page.reload();
  await expect.poll(() => counts(page), { timeout: 15_000 }).toEqual({ 'maha-ashtami': 3 });
  await page.reload();
  await expect(page.locator('.explainer')).toBeVisible();
  await expect(page.locator('.greet')).toHaveCount(0);
  await expect(page.locator('.explainer .explainer-icon')).toBeVisible(); // back to the normal sheet
});

test('the installed app never gets it', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await openFirstSheet(page);
  await expect(page.locator('.greet')).toHaveCount(0);
  await expect(page.locator('.explainer .explainer-icon')).toBeVisible();
});

test('on a slow network the shimmer holds for eight seconds, then the icon takes over and the open is not counted', async ({ page }) => {
  await page.route('**/anim/maha-ashtami.lottie', async (route) => {
    await new Promise((r) => setTimeout(r, 14_000));
    await route.continue().catch(() => {});
  });
  await openFirstSheet(page);
  await expect(page.locator('.greet-shimmer')).toBeVisible();
  await page.waitForTimeout(6500);
  expect(await phase(page)).toBe('loading'); // still waiting at 6.5 s
  await expect.poll(() => phase(page), { timeout: 4000 }).toBe('gone');
  await expect(page.locator('.explainer .explainer-icon')).toBeVisible();
  await expect.poll(async () => (await page.locator('.greet').boundingBox())?.height ?? 0).toBeLessThan(2); // folded away
  expect(await counts(page)).toEqual({});
  await page.waitForTimeout(8000); // it arrives late and must not pop back in
  expect(await phase(page)).toBe('gone');
});

test('a failed load swaps to the icon quickly and is not counted', async ({ page }) => {
  await page.route('**/anim/maha-ashtami.lottie', (route) => route.abort());
  await openFirstSheet(page);
  await expect.poll(() => phase(page), { timeout: 5000 }).toBe('gone');
  await expect(page.locator('.explainer .explainer-icon')).toBeVisible();
  expect(await counts(page)).toEqual({});
});

test('with reduced motion it shows the finished frame without playing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFirstSheet(page);
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('still');
});

test('after it has played, a tap plays it again and is not counted as another open', async ({ page }) => {
  await openFirstSheet(page);
  const box = page.locator('.explainer .greet-box');
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('still');
  await expect(box).toHaveAttribute('role', 'button');
  await box.click();
  await expect.poll(() => phase(page), { timeout: 3000 }).toBe('playing');
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('still');
  expect(await counts(page)).toEqual({ 'maha-ashtami': 1 });
});

test("on a greeting's day, with no limit, every open plays it, in the installed app too", async ({ page }) => {
  await page.addInitScript(() => {
    /** @type {any} */ (window).__PD_E2E_GREETING__ = { maxShows: null, installedToo: true };
    Object.defineProperty(navigator, 'standalone', { value: true });
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => (d.name === 'geolocation' ? Promise.resolve({ state: 'prompt' }) : query(d));
  });
  for (let open = 1; open <= 4; open++) {
    await page.goto('/');
    await expect(page.locator('.explainer')).toBeVisible();
    await expect.poll(() => counts(page), { timeout: 15_000 }).toEqual({ 'maha-ashtami': open });
  }
});

test('someone who has been here before gets it at the top of the main list sheet, once', async ({ page }) => {
  await page.addInitScript(() => {
    /** @type {any} */ (window).__PD_E2E_GREETING__ = true;
    localStorage.setItem('pd_explainerSeen', 'true');
  });
  await page.goto('/');
  await expect(page.locator('.explainer')).toHaveCount(0);
  await expect(page.locator('.greet-box')).toHaveCount(1);
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('still');
  expect(await counts(page)).toEqual({ 'maha-ashtami': 1 });
});

// ---- Shubho Bijoya: a still picture, not an animation ----
test.describe('shubho bijoya (still picture)', () => {
  const openForced = async (page, scheme = 'light') => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => {
      const query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d) => (d.name === 'geolocation' ? Promise.resolve({ state: 'prompt' }) : query(d));
    });
    await page.goto('/?greeting=shubho-bijoya');
    await expect(page.locator('.explainer')).toBeVisible();
  };

  for (const scheme of ['light', 'dark']) {
    test(`shows the picture whole, 260 wide, 3:1, no player, ${scheme}`, async ({ page }) => {
      await openForced(page, scheme);
      const box = page.locator('.explainer .greet-box');
      await expect(box).toBeVisible();
      await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('still');
      await expect(box).toHaveAttribute('aria-label', 'Shubho Bijoya');
      const img = box.locator('img.greet-image');
      await expect(img).toHaveAttribute('data-shown', 'true');
      expect(await img.evaluate((e) => e.naturalWidth > 0)).toBe(true); // it really decoded
      await expect(box.locator('canvas')).toHaveCount(0);
      const b = await box.boundingBox();
      expect(b.width).toBeCloseTo(260, 0);
      expect(b.width / b.height).toBeCloseTo(3, 1);
      await expect(page.locator('.explainer .explainer-icon')).toHaveCount(0);
      await expect(page.locator('.explainer').getByRole('button', { name: 'Allow' })).toBeVisible();
      await expect(box).not.toHaveAttribute('role', 'button'); // nothing to replay
    });
  }

  test('when the file cannot load, the box folds away and the normal icon appears', async ({ page }) => {
    await page.route('**/anim/shubho-bijoya.svg', (route) => route.abort());
    await openForced(page);
    await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('gone');
    await expect(page.locator('.explainer .explainer-icon')).toBeVisible();
  });

  test('asked for by id on a normal open (not forced), it shows, is counted, and the installed-app rule is on', async ({ page }) => {
    await page.addInitScript(() => {
      /** @type {any} */ (window).__PD_E2E_GREETING__ = { id: 'shubho-bijoya', maxShows: null, installedToo: true };
      const query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d) => (d.name === 'geolocation' ? Promise.resolve({ state: 'prompt' }) : query(d));
    });
    await page.goto('/');
    await expect(page.locator('.explainer .greet-box')).toHaveAttribute('aria-label', 'Shubho Bijoya');
    await expect.poll(() => counts(page), { timeout: 15_000 }).toEqual({ 'shubho-bijoya': 1 });
    await page.reload();
    await expect.poll(() => counts(page), { timeout: 15_000 }).toEqual({ 'shubho-bijoya': 2 }); // every open counts, none is held back
  });

  test('its rule: any day, every open, browser and installed app', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../src/features/greeting/greetings.js', import.meta.url), 'utf8');
    const block = src.slice(src.indexOf("id: 'shubho-bijoya'"));
    expect(block).toMatch(/kind: 'image'/);
    expect(block).toMatch(/days: null/);
    expect(block).toMatch(/maxShows: null/);
    expect(block).toMatch(/installedToo: true/);
  });
});
