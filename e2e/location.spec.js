import { expect, firstPujaOnScreen, openApp, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });

/** Wait until the map camera has stopped moving. */
const settled = (page) => page.waitForFunction(() => window.__pdMap && !window.__pdMap.isMoving(), null, { timeout: 10_000 });

test('the location dot is a real 22 px blue dot, not a collapsed sliver', async ({ page }) => {
  await openApp(page);
  await page.waitForSelector('.me-dot');
  const box = await page.locator('.me-dot').boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(20);
  expect(box?.height).toBeGreaterThanOrEqual(20);
  await expect.poll(() => page.evaluate(() => Boolean(window.__pdMap.getLayer('me-accuracy-fill')))).toBe(true);
});

test('the location button flies back to you from anywhere, zoomed in, clear of the list sheet', async ({ page }) => {
  await openApp(page);
  await page.waitForSelector('.me-dot');
  // Pan to another city, zoomed far out.
  await page.evaluate(() => window.__pdMap.jumpTo({ center: [77.2, 28.6], zoom: 7 }));
  await settled(page);
  const button = page.locator('.fab.loc');
  await expect(button).not.toHaveClass(/centred/);

  await button.click();
  await page.waitForFunction(() => window.__pdMap.getZoom() >= 15 && !window.__pdMap.isMoving(), null, { timeout: 15_000 });
  await expect(button).toHaveClass(/centred/);
  await expect(button).toHaveAccessibleName(/^You are here/);

  // The dot sits above the sheet, not underneath it.
  const dot = await page.locator('.me-dot').boundingBox();
  const sheet = await page.locator('.panel').boundingBox();
  expect(dot && sheet && dot.y + dot.height < sheet.y).toBe(true);

  // Dragging the map away turns the button grey again.
  await page.evaluate(() => window.__pdMap.panBy([260, 0], { duration: 0 }, { originalEvent: true }));
  await settled(page);
  await expect(button).not.toHaveClass(/centred/);
});

test('a first fix does not yank the map away from someone who is already exploring', async ({ page }) => {
  await page.addInitScript(() => {
    // Hold the first GPS answer back so the person can start panning first.
    const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (ok, fail, opts) => setTimeout(() => real(ok, fail, opts), 2500);
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__pdMap?.getLayer('pujas'));
  const box = await page.locator('#map').boundingBox();
  await page.mouse.move(box.x + 150, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 190, { steps: 6 });
  await page.mouse.up();
  const before = await page.evaluate(() => window.__pdMap.getCenter().lng);
  await page.waitForSelector('.me-dot', { timeout: 10_000 });
  await settled(page);
  const after = await page.evaluate(() => window.__pdMap.getCenter().lng);
  expect(Math.abs(after - before)).toBeLessThan(0.02);
});

test('a second tap follows you, and dragging the map stops it', async ({ page }) => {
  await openApp(page);
  await page.waitForSelector('.me-dot');
  const button = page.locator('.fab.loc');
  await button.click();
  await expect(button).toHaveClass(/centred/, { timeout: 15_000 });
  await button.click();
  await expect(button).toHaveClass(/following/);
  await expect(button).toHaveAccessibleName(/Following you/);
  await page.evaluate(() => window.__pdMap.panBy([200, 0], { duration: 0 }, { originalEvent: true }));
  await settled(page);
  await expect(button).not.toHaveClass(/following/);
});

test.describe('far from Kolkata', () => {
  test.use({ geolocation: { latitude: 28.6139, longitude: 77.209 } });

  test('a one-time card, then a banner; the map stays on Kolkata and the button still flies to you', async ({ page }) => {
    await openApp(page);
    await page.waitForSelector('.me-dot');
    const card = page.locator('.outside');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading')).toContainText(/\d+ pujas in Kolkata/);
    await card.getByRole('button', { name: 'Show Kolkata' }).click();
    await expect(card).toHaveCount(0);
    await page.locator('.peek-line').click();
    await expect(page.locator('.visitor-chip')).toContainText(/km away/);
    await expect(page.locator('.show-kolkata')).toBeVisible();
    const lng = await page.evaluate(() => window.__pdMap.getCenter().lng);
    expect(lng).toBeLessThan(89);
    await page.locator('.fab.loc').click();
    await page.waitForFunction(
      () => window.__pdMap.getCenter().lng > 77 && window.__pdMap.getCenter().lng < 78 && !window.__pdMap.isMoving(),
      null,
      { timeout: 15_000 },
    );
  });

  test('the card is shown on the first visit only', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.outside')).toBeVisible();
    await page.locator('.outside').getByRole('button', { name: 'Keep both in view' }).click();
    await page.reload();
    await page.waitForSelector('.me-dot');
    await expect(page.locator('.outside')).toHaveCount(0);
    await page.locator('.peek-line').click();
    await expect(page.locator('.visitor-chip')).toContainText(/km away/);
    await expect(page.locator('.show-kolkata')).toBeVisible();
  });
});

test.describe('a couple of hundred km away (Durgapur)', () => {
  test.use({ geolocation: { latitude: 23.52, longitude: 87.31 } });

  test('the map frames the whole city and the person together; Show Kolkata drops the dot from the frame', async ({ page }) => {
    await openApp(page);
    await page.waitForSelector('.me-dot');
    await page.locator('.outside').getByRole('button', { name: 'Keep both in view' }).click();
    await settled(page);
    const both = await page.evaluate(() => {
      const b = window.__pdMap.getBounds();
      return { you: b.contains([87.31, 23.52]), city: b.contains([88.36, 22.57]) };
    });
    expect(both).toEqual({ you: true, city: true });
    await page.locator('.show-kolkata').click();
    await settled(page);
    const city = await page.evaluate(() => window.__pdMap.getBounds().contains([87.31, 23.52]));
    expect(city).toBe(false);
  });
});

test.describe('tap area', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('tapping a little beside a dot still opens that puja', async ({ page }) => {
    await openApp(page);
    const { x, y } = await firstPujaOnScreen(page);
    const box = await page.locator('#map').boundingBox();
    await page.mouse.click(box.x + x + 10, box.y + y + 6);
    await expect(page.locator('.panel .back')).toBeVisible();
  });
});

test.describe('location card states', () => {
  /** A phone whose location lookup fails with this error code (1 blocked, 2 no signal, 3 timeout). */
  const failWith = (code) => async ({ page }) => {
    await page.addInitScript((errorCode) => {
      try {
        localStorage.setItem('pd_explainerSeen', 'true');
      } catch {
        /* ignore */
      }
      const state = { state: 'prompt', onchange: null, addEventListener() {}, removeEventListener() {} };
      navigator.permissions.query = () => Promise.resolve(state);
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_ok, fail) => setTimeout(() => fail({ code: errorCode }), 150),
          watchPosition: () => 1,
          clearWatch: () => {},
        },
      });
    }, code);
  };

  test('default: names the benefit and the scope, answers where the location goes', async ({ page }) => {
    await failWith(1)({ page });
    await openApp(page);
    await page.locator('.grab').click();
    const card = page.locator('.loc-card');
    await expect(card).toContainText('Find pujas near you in Kolkata');
    await expect(card).toContainText('Your location never leaves your phone.');
    await expect(card.getByRole('button', { name: 'Show pujas near me' })).toBeVisible();
    expect((await card.locator('.loc-card-btn').boundingBox()).height).toBeGreaterThanOrEqual(39.5);
  });

  test('blocked, then still blocked after a retry', async ({ page }) => {
    await failWith(1)({ page });
    await openApp(page);
    await page.locator('.grab').click();
    const card = page.locator('.loc-card');
    await card.getByRole('button', { name: 'Show pujas near me' }).click();
    await expect(card).toContainText('Location is blocked for this site');
    await expect(card).toContainText('Allow it in site settings, then retry.');
    await card.getByRole('button', { name: 'Retry' }).click();
    await expect(card).toContainText('Still blocked. Check site settings.');
  });

  test('no signal: says it could not find you and to check GPS', async ({ page }) => {
    await failWith(2)({ page });
    await openApp(page);
    await page.locator('.grab').click();
    const card = page.locator('.loc-card');
    await card.getByRole('button', { name: 'Show pujas near me' }).click();
    await expect(card).toContainText("Couldn't find your location");
    await expect(card).toContainText('Check that GPS is on, then retry.');
  });

  test('with the card out of view (peek) a failure shows a neutral dark toast with Retry, never red', async ({ page }) => {
    await failWith(1)({ page });
    await openApp(page);
    await page.locator('.fab.loc').click();
    const toast = page.locator('.toast');
    await expect(toast).toContainText('Location is blocked. Allow it in site settings.');
    await expect(toast).toHaveClass(/dark/);
    await expect(toast.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(await toast.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(43, 37, 39)');
  });
});
