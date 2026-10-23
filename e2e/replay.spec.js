import { expect, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });

const IST = (s) => new Date(`${s}+05:30`).getTime();
const open = async (page, { at, state = 'prompt', seen = false }) => {
  await page.addInitScript(
    ({ at, state, seen }) => {
      /** @type {any} */ (window).__PD_E2E_REPLAY__ = true;
      const real = Date.now;
      const offset = at - real();
      Date.now = () => real() + offset;
      if (seen) { try { localStorage.setItem('pd_explainerSeen', 'true'); localStorage.setItem('pd_outsideSeen', 'true'); localStorage.setItem('pd_reportHintSeen', 'true'); } catch { /* no storage */ } }
      const query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d) => (d.name === 'geolocation' ? Promise.resolve({ state }) : query(d));
    },
    { at, state, seen },
  );
  await page.goto('/');
};

for (const [name, state] of [['new visitor', 'prompt'], ['already allowed', 'granted'], ['already blocked', 'denied']]) {
  test(`${name} who has seen it all sees the welcome card again on 23 Oct`, async ({ page }) => {
    await open(page, { at: IST('2026-10-23T21:00:00'), state, seen: true });
    await expect(page.locator('.explainer')).toBeVisible();
    await expect(page.locator('.explainer h2')).toHaveText('Shubho Bijoya!');
  });
}

test('it comes back on every open, not once', async ({ page }) => {
  await open(page, { at: IST('2026-10-24T20:00:00'), seen: true });
  await page.locator('.explainer').getByRole('button', { name: 'Not now' }).click();
  await expect(page.locator('.explainer')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.explainer')).toBeVisible();
});

test('after 24 Oct 23:59 IST it is first-visit only and the words are the regular ones', async ({ page }) => {
  await open(page, { at: IST('2026-10-25T00:30:00'), seen: true });
  await page.waitForTimeout(800);
  await expect(page.locator('.explainer')).toHaveCount(0);
});

test('a first visit after the wish ends gets the regular card', async ({ page }) => {
  await open(page, { at: IST('2026-10-25T10:00:00'), seen: false });
  await expect(page.locator('.explainer h2')).toHaveText('See pujas near you');
  await expect(page.locator('.explainer')).not.toContainText('Bijoya');
});

test('a returning visitor far away: the welcome card stays put until answered, then the visitor card follows', async ({ page }) => {
  await page.context().setGeolocation({ latitude: 28.6139, longitude: 77.209 });
  await page.context().grantPermissions(['geolocation']);
  await open(page, { at: IST('2026-10-23T21:00:00'), state: 'granted', seen: true });
  const card = page.locator('.explainer');
  await expect(card).toBeVisible();
  await page.waitForTimeout(2500); // long enough for the location fix to land
  await expect(page.locator('#ex-title')).toBeVisible();
  await expect(card.locator('h2')).toHaveText('Shubho Bijoya!');
  await expect(page.locator('.outside')).toHaveCount(0);
  await card.getByRole('button', { name: 'Not now' }).click();
  await expect(page.locator('#ex-title')).toHaveCount(0);
  await expect(page.locator('.outside')).toBeVisible();
});
