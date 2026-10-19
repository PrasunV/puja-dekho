import { expect, openApp, test } from './fixtures.js';

// Real touch input: events go through the browser's own touch pipeline (CDP), so native scrolling,
// touch-action and cancelable-ness behave as on a phone.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const sheetState = (page) => page.locator('.panel').getAttribute('data-sheet');
const panelBox = async (page) => await page.locator('.panel').boundingBox();
const stageHeight = async (page) => (await page.locator('.stage').boundingBox()).height;
const restingHeight = async (page, share) => {
  const stage = await stageHeight(page);
  return share === 'full' ? stage - 8 : stage * share;
};
const settledAt = (page, share) =>
  expect.poll(async () => Math.abs((await panelBox(page)).height - (await restingHeight(page, share))), { timeout: 4000 }).toBeLessThan(2);

/**
 * A finger: down at `from`, moves in `steps` equal steps over `ms`, lifts. With `holdMs` it rests before lifting
 * (a slow, deliberate drag has no release velocity). `during` runs while the finger is still down.
 */
async function swipe(page, from, to, { ms = 300, steps = 12, holdMs = 0, during, fast = false } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const t0 = Date.now();
  const send = (type, x, y, at) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }], timestamp: at / 1000 });
  if (fast) {
    // A flick is queued in one go with exact event times, so the test controls the speed and the machine's load cannot.
    const sends = [send('touchStart', from.x, from.y, t0)];
    for (let i = 1; i <= steps; i++) {
      sends.push(send('touchMove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, t0 + (ms * i) / steps));
    }
    sends.push(send('touchEnd', to.x, to.y, t0 + ms + 4));
    await Promise.all(sends);
    await cdp.detach();
    return;
  }
  await send('touchStart', from.x, from.y, Date.now());
  for (let i = 1; i <= steps; i++) {
    await send('touchMove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, Date.now());
    if (ms / steps >= 4) await page.waitForTimeout(ms / steps);
  }
  if (holdMs) await page.waitForTimeout(holdMs);
  if (during) await during();
  await send('touchEnd', to.x, to.y, Date.now());
  await cdp.detach();
}
const FLICK = { ms: 60, steps: 6, fast: true }; // fast and short: 45px in about 50 ms
const SLOW = { ms: 900, steps: 18, holdMs: 250 };

async function openAt(page, state) {
  await openApp(page);
  while ((await sheetState(page)) !== state) await page.locator('.grab').click();
  await settledAt(page, { peek: 0.14, half: 0.5, full: 'full' }[state]);
}
const bodyPoint = async (page) => {
  const box = await panelBox(page);
  return { x: 200, y: box.y + box.height * 0.55 };
};

test('a short, fast flick up from the peek line opens to half', async ({ page }) => {
  await openAt(page, 'peek');
  const box = await panelBox(page);
  await swipe(page, { x: 120, y: box.y + 50 }, { x: 120, y: box.y + 5 }, FLICK);
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
  await settledAt(page, 0.5);
});

test('a flick from the middle of the list at half jumps straight to full', async ({ page }) => {
  await openAt(page, 'half');
  const at = await bodyPoint(page);
  await swipe(page, at, { x: at.x, y: at.y - 60 }, FLICK);
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'full');
  await settledAt(page, 'full');
});

test('a hard flick from the peek goes past half to full', async ({ page }) => {
  await openAt(page, 'peek');
  const box = await panelBox(page);
  await swipe(page, { x: 120, y: box.y + 60 }, { x: 120, y: box.y - 160 }, { ms: 80, steps: 9, fast: true });
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'full');
});

test('a slow short drag settles back on the nearest state', async ({ page }) => {
  await openAt(page, 'peek');
  const box = await panelBox(page);
  await swipe(page, { x: 120, y: box.y + 40 }, { x: 120, y: box.y + 40 - 45 }, SLOW);
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'peek');
  await settledAt(page, 0.14);
});

test('a slow drag past the midpoint settles on the nearest state, not the next', async ({ page }) => {
  await openAt(page, 'peek');
  const box = await panelBox(page);
  await swipe(page, { x: 120, y: box.y + 40 }, { x: 120, y: box.y + 40 - 260 }, SLOW);
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
  await settledAt(page, 0.5);
});

test('swiping down from anywhere on the sheet closes it a state, and the sheet follows the finger', async ({ page }) => {
  await openAt(page, 'half');
  const at = await bodyPoint(page);
  const before = (await panelBox(page)).height;
  let mid = 0;
  await swipe(
    page,
    at,
    { x: at.x, y: at.y + 230 },
    {
      ...SLOW,
      during: async () => {
        mid = (await panelBox(page)).height;
      },
    },
  );
  expect(before - mid).toBeGreaterThan(190); // it tracked the drag
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'peek');
  await settledAt(page, 0.14);
});

test('the map buttons and the people pill ride the sheet while it is dragged', async ({ page }) => {
  await openAt(page, 'half');
  const at = await bodyPoint(page);
  const gap = async () => {
    const panel = await panelBox(page);
    const tools = await page.locator('.map-tools').boundingBox();
    const pill = await page.locator('.view-pill').boundingBox();
    return { tools: panel.y - (tools.y + tools.height), pill: panel.y - (pill.y + pill.height) };
  };
  const resting = await gap();
  let held = { tools: 0, pill: 0 };
  await swipe(
    page,
    at,
    { x: at.x, y: at.y + 150 },
    {
      ...SLOW,
      during: async () => {
        held = await gap();
      },
    },
  );
  expect(Math.abs(held.tools - resting.tools)).toBeLessThan(4);
  expect(Math.abs(held.pill - resting.pill)).toBeLessThan(4);
});

test('the map buttons fade out as the sheet opens to full and return when it closes', async ({ page }) => {
  await openAt(page, 'half');
  await page.locator('.grab').click();
  await expect(page.locator('.map-tools')).toBeHidden();
  await expect(page.locator('.view-pill')).toBeVisible();
  await page.locator('.grab').click();
  await expect(page.locator('.map-tools')).toBeVisible();
});

test('at full height the list scrolls; a downward drag at its top closes the sheet', async ({ page }) => {
  await openAt(page, 'full');
  const body = page.locator('.panel-body');
  const at = await bodyPoint(page);
  // Scrolling up the page (finger up) scrolls the list and leaves the sheet alone.
  await swipe(page, at, { x: at.x, y: at.y - 250 }, { ms: 250, steps: 12 });
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
  expect(await sheetState(page)).toBe('full');
  // Scrolled down the list, a downward drag scrolls it back before the sheet moves.
  await swipe(page, { x: at.x, y: at.y - 100 }, { x: at.x, y: at.y - 100 + 60 }, { ms: 300, steps: 12, holdMs: 200 });
  expect(await sheetState(page)).toBe('full');
  // At the top, the same drag closes the sheet.
  await body.evaluate((el) => (el.scrollTop = 0));
  await swipe(page, at, { x: at.x, y: at.y + 260 }, { ms: 120, steps: 10 });
  await expect(page.locator('.panel')).not.toHaveAttribute('data-sheet', 'full');
});

test('one continuous drag down hands over from list scrolling to closing the sheet', async ({ page }) => {
  await openAt(page, 'full');
  const body = page.locator('.panel-body');
  await body.evaluate((el) => (el.scrollTop = 80));
  const at = await bodyPoint(page);
  let seen = { top: 99, height: 0 };
  await swipe(
    page,
    at,
    { x: at.x, y: at.y + 260 },
    {
      ms: 700,
      steps: 28,
      holdMs: 250,
      during: async () => {
        seen = { top: await body.evaluate((el) => el.scrollTop), height: (await panelBox(page)).height };
      },
    },
  );
  expect(seen.top).toBe(0); // the list went to its top first
  expect(seen.height).toBeLessThan((await restingHeight(page, 'full')) - 60); // and then the sheet followed the finger
});

test('a sideways swipe on the carousel scrolls the carousel and never moves the sheet', async ({ page }) => {
  await openAt(page, 'full');
  const track = page.locator('.popular-track');
  await expect(track).toBeVisible();
  const box = await track.boundingBox();
  const y = box.y + box.height / 2;
  const heightBefore = (await panelBox(page)).height;
  await swipe(page, { x: 330, y }, { x: 60, y: y + 18 }, { ms: 250, steps: 12 });
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(40);
  expect(await sheetState(page)).toBe('full');
  expect(Math.abs((await panelBox(page)).height - heightBefore)).toBeLessThan(2);
});

test('a vertical swipe that starts on the carousel still moves the sheet', async ({ page }) => {
  await openAt(page, 'half');
  const track = page.locator('.popular-track');
  if (!(await track.isVisible())) await page.locator('.panel-body').evaluate((el) => (el.scrollTop = 0));
  const box = await track.boundingBox();
  const y = box.y + box.height / 2;
  const left = await track.evaluate((el) => el.scrollLeft);
  await swipe(page, { x: 200, y }, { x: 208, y: y - 70 }, FLICK);
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'full');
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(left);
});

test('dragging past the ends stretches with resistance and springs back', async ({ page }) => {
  await openAt(page, 'full');
  const full = await restingHeight(page, 'full');
  const grab = await page.locator('.grab').boundingBox();
  let top = 0;
  await swipe(
    page,
    { x: 200, y: grab.y + 10 },
    { x: 200, y: grab.y - 120 },
    {
      ms: 300,
      steps: 12,
      holdMs: 200,
      during: async () => {
        top = (await panelBox(page)).height;
      },
    },
  );
  expect(top).toBeGreaterThan(full); // pulled beyond full height...
  expect(top).toBeLessThan(full + 100); // ...but with resistance
  expect(await sheetState(page)).toBe('full');
  await settledAt(page, 'full');

  await openAt(page, 'peek');
  const peek = await restingHeight(page, 0.14);
  const box = await panelBox(page);
  let low = 0;
  await swipe(
    page,
    { x: 200, y: box.y + 10 },
    { x: 200, y: box.y + 130 },
    {
      ms: 300,
      steps: 12,
      holdMs: 200,
      during: async () => {
        low = (await panelBox(page)).height;
      },
    },
  );
  expect(low).toBeLessThan(peek);
  expect(low).toBeGreaterThan(peek - 100);
  expect(await sheetState(page)).toBe('peek');
  await settledAt(page, 0.14);
});

const flickToHalf = async (page) => {
  await page.evaluate(() => {
    window.__heights = [];
    const tick = () => {
      window.__heights.push(document.querySelector('.panel').getBoundingClientRect().height);
      requestAnimationFrame(tick);
    };
    tick();
  });
  const box = await panelBox(page);
  await swipe(page, { x: 120, y: box.y + 50 }, { x: 120, y: box.y + 5 }, FLICK);
  await page.waitForTimeout(900);
  const heights = await page.evaluate(() => window.__heights);
  const half = await restingHeight(page, 0.5);
  const travel = half - (await restingHeight(page, 0.14));
  return { heights, half, travel };
};

test('the default (iOS-style) motion carries the flick, gives a hint at the end and settles', async ({ page }) => {
  await openAt(page, 'peek');
  const { heights, half, travel } = await flickToHalf(page);
  expect(Math.max(...heights) - half).toBeLessThan(travel * 0.03); // a hint of give, never a bounce
  expect(Math.abs(heights.at(-1) - half)).toBeLessThan(1);
});

test('the soft spring (?sheetMotion=spring) overshoots about 3% and settles', async ({ page }) => {
  await page.goto('/?sheetMotion=spring');
  await page.waitForFunction(() => window.__pdMap?.isStyleLoaded());
  const { heights, half, travel } = await flickToHalf(page);
  expect(Math.max(...heights)).toBeGreaterThan(half);
  expect(Math.max(...heights) - half).toBeLessThan(travel * 0.08);
  expect(Math.abs(heights.at(-1) - half)).toBeLessThan(1);
});

test('tapping empty map collapses the sheet to the peek; tapping the sheet does not', async ({ page }) => {
  await openAt(page, 'half');
  await page.locator('.panel-body').click({ position: { x: 20, y: 6 } });
  expect(await sheetState(page)).toBe('half');
  await page.mouse.click(30, 40);
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'peek');
});

test('a drag that starts on a puja card does not open it', async ({ page }) => {
  await openAt(page, 'half');
  const card = page.locator('.pcard').first();
  const box = await card.boundingBox();
  await swipe(page, { x: box.x + 60, y: box.y + box.height / 2 }, { x: box.x + 60, y: box.y + box.height / 2 - 80 }, FLICK);
  await page.waitForTimeout(300);
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'full');
  await expect(page.locator('.puja-page, .pp')).toHaveCount(0);
});

test('the handle still works as a button: tap cycles peek, half, full', async ({ page }) => {
  await openAt(page, 'peek');
  await page.locator('.grab').click();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
  await page.locator('.grab').click();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'full');
  await page.locator('.grab').click();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'peek');
});

test('with a mouse, dragging the sheet works too', async ({ page }) => {
  await openAt(page, 'peek');
  const box = await panelBox(page);
  await page.mouse.move(120, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(120, box.y + 40 - 250, { steps: 12 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
});

test.describe('motion lab', () => {
  const sampleHeights = (page) =>
    page.evaluate(() => {
      window.__heights = [];
      const tick = () => {
        window.__heights.push(document.querySelector('.panel').getBoundingClientRect().height);
        requestAnimationFrame(tick);
      };
      tick();
    });

  test('is hidden unless asked for; with ?motionlab it lists the styles and applies a choice to the next gesture', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.motion-lab')).toHaveCount(0);
    await page.goto('/?motionlab');
    await page.waitForFunction(() => window.__pdMap?.isStyleLoaded());
    await page.locator('.motion-lab-chip').click();
    await expect(page.getByRole('radio')).toHaveCount(6);
    await page.getByRole('radio', { name: /Quick ease-out/ }).click();
    await expect(page.locator('.motion-lab-chip')).toContainText('Quick ease-out');
    await sampleHeights(page);
    const box = await panelBox(page);
    await swipe(page, { x: 120, y: box.y + 50 }, { x: 120, y: box.y + 5 }, FLICK);
    await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
    await page.waitForTimeout(700);
    const heights = await page.evaluate(() => window.__heights);
    const half = await restingHeight(page, 0.5);
    expect(Math.max(...heights)).toBeLessThan(half + 1); // an ease-out never overshoots
    expect(Math.abs(heights.at(-1) - half)).toBeLessThan(1);
    await expect(page.locator('.motion-lab-read')).toContainText(/settled \(Quick ease-out\)/);
  });

  test('?sheetMotion=bouncy sets the style without the switcher, and it visibly overshoots', async ({ page }) => {
    await page.goto('/?sheetMotion=bouncy');
    await page.waitForFunction(() => window.__pdMap?.isStyleLoaded());
    await expect(page.locator('.motion-lab')).toHaveCount(0);
    await sampleHeights(page);
    const box = await panelBox(page);
    await swipe(page, { x: 120, y: box.y + 50 }, { x: 120, y: box.y + 5 }, FLICK);
    await page.waitForTimeout(1200);
    const heights = await page.evaluate(() => window.__heights);
    const half = await restingHeight(page, 0.5);
    const travel = half - (await restingHeight(page, 0.14));
    expect(Math.max(...heights) - half).toBeGreaterThan(travel * 0.05);
  });
});
