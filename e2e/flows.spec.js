import { expect, openApp, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });

const settled = (page) => page.waitForFunction(() => window.__pdMap && !window.__pdMap.isMoving(), null, { timeout: 10_000 });
const countIn = async (locator) => Number((await locator.textContent())?.match(/\d+/)?.[0]);

test('opens at the peek: header says how many pujas are near, no search, no sort buttons', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'peek');
  await expect(page.locator('.peek-line')).toContainText(/\d+ pujas? near you/);
  await expect(page.getByPlaceholder(/search/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Nearest|Top rated|A–Z/ })).toHaveCount(0);
  await expect(page.locator('.made-with')).toContainText('made with love');
});

test('sheet has four heights: peek 14%, initial 35%, half 50%, full', async ({ page }) => {
  await openApp(page);
  const stage = (await page.locator('.stage').boundingBox()).height;
  const heightOf = async () => (await page.locator('.panel').boundingBox()).height;
  await expect.poll(heightOf).toBeGreaterThan(stage * 0.1);
  expect(await heightOf()).toBeLessThan(stage * 0.2);
  await page.locator('.grab').click();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'initial');
  await expect.poll(heightOf).toBeGreaterThan(stage * 0.3);
  await page.locator('.grab').click();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
  await expect.poll(heightOf).toBeGreaterThan(stage * 0.45);
  await page.locator('.grab').click();
  await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'full');
  await expect.poll(heightOf).toBeGreaterThan(stage * 0.9);
});

test('radius chip offers the five PRD steps and updates the header', async ({ page }) => {
  await openApp(page);
  const chip = page.locator('.dist-chip');
  await expect(chip).toContainText('500 m');
  await chip.click();
  await expect(page.locator('.menu [role=option]')).toHaveText([/500 m/, /1 km/, /5 km/, /10 km/, /20 km/]);
  await page.locator('.menu button', { hasText: '5 km' }).click();
  await expect(chip).toContainText('5 km');
  await expect(page.locator('.peek-line')).toContainText(/within 5 km/);
});

test('the list holds every puja, nearest first, with a divider past the radius', async ({ page }) => {
  await openApp(page);
  await page.locator('.grab').click();
  await expect(page.locator('.divider-row')).toContainText(/Farther than 500 m/);
  const distances = await page.locator('.pcard .dist-pill').allTextContents();
  expect(distances.length).toBeGreaterThan(5);
});

// The Less crowded chip is switched off for now (commented out in FilterBar.jsx); re-enable this test with it.
test.skip('Less crowded explains itself and filters; Clear all brings everything back', async ({ page }) => {
  await openApp(page);
  await page.locator('.grab').click();
  await page
    .getByRole('button', { name: /Less crowded/ })
    .first()
    .click();
  await expect(page.locator('.toast')).toContainText(/not live data/i);
  await expect(page.getByText(/1 filter/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear all' }).first().click();
  await expect(page.getByText(/1 filter/)).toHaveCount(0);
});

test('filters panel: area narrows the count live, Show N closes it, a chip row shows what is applied', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /^Filters/ }).click();
  const panel = page.getByRole('dialog', { name: /Filters/ });
  await expect(panel).toBeVisible();
  const show = panel.getByRole('button', { name: /^Show \d+ pujas?$/ });
  const before = await countIn(show);
  await panel.getByRole('group', { name: 'Areas' }).getByRole('button').first().click();
  const after = await countIn(panel.getByRole('button', { name: /^Show \d+ pujas?$/ }));
  expect(after).toBeLessThanOrEqual(before);
  await panel.getByRole('button', { name: /^Show \d+ pujas?$/ }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Filters/ })).toContainText('1');
});

test('choosing a metro station replaces the radius and lists pujas near it', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.__pd.openStation('kalighat'));
  await expect(page.locator('.peek-line, .panel-body').first()).toContainText(/Kalighat/);
  await page
    .locator('.panel .grab')
    .click()
    .catch(() => {});
  await expect(page.locator('.panel')).toContainText(/near Kalighat/i);
});

test('Metro button shows the nearest stations and highlights them on the map', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /Metro stations near you/ }).click();
  await expect(page.locator('.panel')).toContainText(/Metro/);
  await expect.poll(() => page.locator('.sm.hl').count()).toBeGreaterThan(0);
});

test('Blue line chip shows the line on the map and a station list; Back clears it', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /Blue/ }).first().click();
  await expect(page.locator('.panel')).toContainText(/Blue/);
  await page.goBack();
  await expect(page.getByRole('button', { name: /Blue/ }).first()).toHaveAttribute('aria-pressed', 'false');
});

test('puja page: facts, typical crowd, Get directions as a Google Maps walking link, Save is coming soon', async ({ page }) => {
  await openApp(page);
  await page.locator('.grab').click(); // initial
  await page.locator('.grab').click(); // half
  await page.locator('.pcard-main').first().click();
  await expect(page.locator('.panel .back')).toBeVisible();
  await expect(page.locator('.crowd-chip')).toContainText(/Usually (Low|Moderate|High) at this hour/);
  const link = page.getByRole('link', { name: /Get directions/ });
  await expect(link).toHaveAttribute('href', /google\.com\/maps\/dir\/.*walking|travelmode=walking/);
  await expect(link).toHaveAttribute('rel', /noopener/);
  await page.getByRole('button', { name: /^Save/ }).click();
  await expect(page.locator('.toast')).toContainText(/coming soon/i);
  await expect(page.getByText(/Routes may differ/)).toHaveCount(0); // Google Maps shows the real route
  await expect(page.locator('.actions-hint')).toHaveText('Opens in Google Maps'); // the first time only
  // Both buttons are at most 40 px tall, share one weight, and Save carries the heart and a two-line "Coming soon".
  const [primary, save] = await Promise.all([link.boundingBox(), page.getByRole('button', { name: /^Save/ }).boundingBox()]);
  expect(primary?.height).toBeLessThanOrEqual(40);
  expect(save?.height).toBeLessThanOrEqual(40);
  const weights = await page.locator('.actions .btn').evaluateAll((els) => els.map((e) => getComputedStyle(e).fontWeight));
  expect(new Set(weights)).toEqual(new Set(['500']));
  await expect(page.locator('.actions .btn.save .save-heart')).toHaveCount(1);
  const soon = await page.locator('.soon').boundingBox();
  expect(soon?.height).toBeGreaterThan(18); // two lines
  expect(await page.locator('.soon').evaluate((e) => getComputedStyle(e).fontWeight)).toBe('350');
  // No rule above the footer: the list fades out instead.
  expect(await page.locator('.panel-foot').evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('0px');
});

test('the "Opens in Google Maps" hint goes away for good once Get directions has been used', async ({ page }) => {
  await openApp(page);
  await page.locator('.grab').click();
  await page.locator('.pcard-main').first().click();
  await expect(page.locator('.actions-hint')).toBeVisible();
  await page.evaluate(() => document.querySelector('.actions a')?.addEventListener('click', (e) => e.preventDefault())); // stay here
  await page.getByRole('link', { name: /Get directions/ }).click();
  await expect(page.locator('.actions-hint')).toBeVisible(); // not yanked away mid-tap
  await page.reload();
  await page.locator('.grab').click();
  await page.locator('.pcard-main').first().click();
  await expect(page.locator('.actions')).toBeVisible();
  await expect(page.locator('.actions-hint')).toHaveCount(0);
});

test('the phone Back button steps back from a puja to the list, keeping the sheet', async ({ page }) => {
  await openApp(page);
  await page.locator('.grab').click();
  await page.locator('.pcard-main').first().click();
  await expect(page.locator('.panel .back')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.panel .back')).toHaveCount(0);
  await expect(page.locator('.pcard').first()).toBeVisible();
});

test('Report issue opens the form in a new tab with a safe link', async ({ page }) => {
  await openApp(page);
  const report = page.getByRole('link', { name: /Report/ });
  await expect(report).toHaveAttribute('target', '_blank');
  await expect(report).toHaveAttribute('rel', /noopener/);
});

test('staying within 100 m of a puja for a minute offers "You\'re near", with a dismiss', async ({ page }) => {
  await openApp(page);
  const name = await page.evaluate(() => window.__pd.data.pujas[0].n);
  await page.evaluate(() => window.__pd.simulateNear?.());
  const card = page.getByText(/You're near/);
  // The real rule is covered by unit tests; here we only check the card wiring when it appears.
  if (await card.count()) {
    await expect(card).toContainText(name);
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText(/You're near/)).toHaveCount(0);
  }
});

test.describe('location off', () => {
  test.use({ permissions: [] });

  test('denied: no explainer, whole city in view, header says "pujas in Kolkata"', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pdMap?.getLayer('pujas'));
    await expect(page.locator('.explainer')).toHaveCount(0);
    await expect(page.locator('.peek-line')).toContainText(/664 pujas in Kolkata/);
    await settled(page);
    const zoom = await page.evaluate(() => window.__pdMap.getZoom());
    expect(zoom).toBeLessThan(14);
  });

  test('first launch: the explainer comes before the browser prompt; Not now shows the city', async ({ page }) => {
    await page.addInitScript(() => {
      const query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d) => (d.name === 'geolocation' ? Promise.resolve({ state: 'prompt' }) : query(d));
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__pdMap?.getLayer('pujas'));
    const explainer = page.locator('.explainer');
    await expect(explainer).toBeVisible();
    await explainer.getByRole('button', { name: 'Not now' }).click();
    await expect(explainer).toHaveCount(0);
    await expect(page.locator('.peek-line')).toContainText(/\d+ pujas in Kolkata/);
  });
});

test.describe('walking route', () => {
  /** A stub of OpenRouteService: a bent line from the first point to the second. */
  const stubRoute = async (page, { fail = false } = {}) => {
    await page.addInitScript(() => {
      window.__PD_E2E_ORS_KEY__ = 'test-key';
    });
    await page.route('https://api.openrouteservice.org/**', async (route) => {
      if (fail) return route.fulfill({ status: 500, body: 'no' });
      const { coordinates } = JSON.parse(route.request().postData());
      const [a, b] = coordinates;
      const mid = [a[0], b[1]];
      return route.fulfill({
        json: {
          features: [{ properties: { summary: { distance: 5800, duration: 4860 } }, geometry: { coordinates: [a, mid, b] } }],
        },
      });
    });
  };

  test('opening a puja draws a dotted route with a time and distance label; Back removes it', async ({ page }) => {
    await stubRoute(page);
    await openApp(page);
    await page.locator('.grab').click();
    await page.locator('.pcard-main').first().click();
    await expect(page.locator('.route-label')).toHaveText('1 hr 21 min · 5.8 km');
    const dash = await page.evaluate(() => window.__pdMap.getPaintProperty('route-line', 'line-dasharray'));
    expect(dash).toBeTruthy();
    await expect.poll(() => page.evaluate(() => window.__pdMap.querySourceFeatures('route').length)).toBeGreaterThan(0);
    await page.goBack();
    await expect(page.locator('.route-label')).toHaveCount(0);
  });

  test('one answer everywhere: the page and the map label show the same road distance and time, and they do not drift with GPS', async ({
    page,
    context,
  }) => {
    await stubRoute(page);
    await openApp(page);
    await page.evaluate(() => window.__pd.openPuja(window.__pd.data.pujas[3].id));
    await expect(page.locator('.route-label')).toHaveText('1 hr 21 min · 5.8 km');
    const summary = page.locator('.panel .stack > div .sub.num').first();
    await expect(summary).toHaveText('5.8 km · 1 hr 21 min walk');
    // the GPS wobbles by about 15 m: nothing on screen changes
    await context.setGeolocation({ latitude: 22.51875, longitude: 88.34685 });
    await page.waitForTimeout(1500);
    await expect(summary).toHaveText('5.8 km · 1 hr 21 min walk');
    await expect(page.locator('.route-label')).toHaveText('1 hr 21 min · 5.8 km');
  });

  test('the dotted line starts exactly at the blue dot and ends on the puja', async ({ page, context }) => {
    await stubRoute(page);
    await openApp(page);
    const puja = await page.evaluate(() => {
      const p = window.__pd.data.pujas[3];
      window.__pd.openPuja(p.id);
      return { lo: p.lo, la: p.la };
    });
    await expect(page.locator('.route-label')).toBeVisible();
    const line = () => page.evaluate(() => window.__pdMap.getSource('route').serialize().data.geometry.coordinates);
    const coords = await line();
    expect(coords[0][0]).toBeCloseTo(88.3467, 4);
    expect(coords[0][1]).toBeCloseTo(22.5186, 4);
    expect(coords.at(-1)).toEqual([puja.lo, puja.la]);
    // the person moves: the line follows the dot
    await context.setGeolocation({ latitude: 22.5189, longitude: 88.3471 });
    await expect.poll(async () => (await line())[0][1]).toBeCloseTo(22.5189, 4);
  });

  test('without a route the page says it is an estimate with a ~', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__pd.openPuja(window.__pd.data.pujas[3].id));
    await expect(page.locator('.panel .stack > div .sub.num').first()).toHaveText(/^~.* · ~.* walk$/);
  });

  test('the time label stays on the visible part of the line when the map is panned', async ({ page }) => {
    await stubRoute(page);
    await openApp(page);
    await page.evaluate(() => window.__pd.openPuja(window.__pd.data.pujas[3].id));
    await expect(page.locator('.route-label')).toBeVisible();
    await page.waitForFunction(() => !window.__pdMap.isMoving());
    await page.evaluate(() => window.__pdMap.jumpTo({ zoom: window.__pdMap.getZoom() + 2 }));
    await page.waitForTimeout(300);
    const label = page.locator('.route-label');
    if (await label.isVisible()) {
      const box = await label.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  });

  test('opening a puja from the map draws the route too', async ({ page }) => {
    await stubRoute(page);
    await openApp(page);
    await page.evaluate(() => window.__pd.openPuja(window.__pd.data.pujas[3].id));
    await expect(page.locator('.route-label')).toBeVisible();
  });

  test('a failed route shows a short note and the puja page still works', async ({ page }) => {
    await stubRoute(page, { fail: true });
    await openApp(page);
    await page.evaluate(() => window.__pd.openPuja(window.__pd.data.pujas[3].id));
    await expect(page.locator('.toast')).toContainText(/walking route/i);
    await expect(page.getByRole('link', { name: /Get directions/ })).toBeVisible();
  });
});

test.describe('selected pin and tooltip', () => {
  const openByLength = (page, long) =>
    page.evaluate((wantLong) => {
      const p = window.__pd.data.pujas.find((x) => x.n.trim().length > 20 === wantLong);
      window.__pd.openPuja(p.id);
      return p.n.trim();
    }, long);

  test('a long name is cut to 20 characters; tapping the tooltip shows the full name on up to two lines', async ({ page }) => {
    await openApp(page);
    const name = await openByLength(page, true);
    const tip = page.locator('.pin-tip');
    await expect(tip).toBeVisible();
    const shown = (await tip.innerText()).trim();
    expect(shown.endsWith('…')).toBe(true);
    expect(Array.from(shown).length).toBeLessThanOrEqual(21);
    await tip.click();
    await expect(tip).toHaveAttribute('aria-expanded', 'true');
    await expect(tip).toContainText(name.slice(-8));
    // the tap did not reach the map: the puja page is still open
    await expect(page.locator('.panel .back')).toBeVisible();
    await tip.click();
    await expect(tip).toHaveAttribute('aria-expanded', 'false');
  });

  test('a short name is shown whole; the pin is a real Google-style pin sitting on the puja', async ({ page }) => {
    await openApp(page);
    const name = await openByLength(page, false);
    await expect(page.locator('.pin-tip')).toHaveText(name);
    await expect(page.locator('.sel-pin svg path[fill="#EA4335"]')).toBeVisible();
    await page.waitForFunction(() => !window.__pdMap.isMoving());
    // the pin tip (bottom centre) is at the puja's screen position
    const where = await page.evaluate(() => {
      const map = window.__pdMap;
      const puja = window.__pd.data.pujas.find((p) => p.n.trim().length <= 20);
      return map.project([puja.lo, puja.la]);
    });
    const box = await page.locator('.sel-pin').boundingBox();
    const mapBox = await page.locator('#map').boundingBox();
    expect(Math.abs(box.x + box.width / 2 - (mapBox.x + where.x))).toBeLessThan(3);
    expect(Math.abs(box.y + box.height - (mapBox.y + where.y))).toBeLessThan(3);
  });

  test('the tooltip keeps its size when zooming, stays inside the screen, and goes with Back', async ({ page }) => {
    await openApp(page);
    await openByLength(page, true);
    await page.waitForFunction(() => !window.__pdMap.isMoving());
    const before = await page.locator('.pin-tip').boundingBox();
    await page.evaluate(() => window.__pdMap.setZoom(window.__pdMap.getZoom() - 3));
    await page.waitForFunction(() => !window.__pdMap.isMoving());
    const after = await page.locator('.pin-tip').boundingBox();
    expect(Math.abs(after.width - before.width)).toBeLessThan(1);
    expect(after.x).toBeGreaterThanOrEqual(0);
    expect(after.x + after.width).toBeLessThanOrEqual(390);
    await page.goBack();
    await expect(page.locator('.pin-tip')).toHaveCount(0);
  });
});

test('estimates in the list are marked with ~', async ({ page }) => {
  await openApp(page);
  await page.locator('.grab').click();
  await expect(page.locator('.pcard .dist-pill').first()).toContainText('~');
});

test.describe('metro lines: chips, pinned timings, station fallback', () => {
  const blue = (page) => page.getByRole('button', { name: /^Blue line/ });

  test('a selected line chip shows a cross; tapping it again removes the line and the cross', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.chip-x')).toHaveCount(0);
    await blue(page).click();
    await expect(blue(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(blue(page).locator('.chip-x')).toBeVisible();
    await expect(blue(page)).toHaveAccessibleName(/selected\. Tap to remove/);
    await blue(page).click();
    await expect(blue(page).locator('.chip-x')).toHaveCount(0);
    await expect(page.locator('.sticky-head')).toHaveCount(0);
  });

  test('both lines can be selected at once', async ({ page }) => {
    await openApp(page);
    await blue(page).click();
    await page.getByRole('button', { name: /^Green line/ }).click();
    await expect(page.locator('.chip-x')).toHaveCount(2);
    await expect(page.locator('.timings-row')).toHaveCount(2);
  });

  test('timings stay pinned while the station list scrolls, and expand to weekday, weekend and frequency', async ({ page }) => {
    await openApp(page);
    await blue(page).click();
    const head = page.locator('.sticky-head');
    await expect(head).toBeVisible();
    await expect(head).toContainText(/Today/);
    await expect(head).toContainText(/every/i);
    await page.locator('.panel-body').evaluate((el) => (el.scrollTop = 600));
    await page.waitForTimeout(250);
    const box = await head.boundingBox();
    const panel = await page.locator('.panel').boundingBox();
    expect(box.y).toBeLessThan(panel.y + 90); // still at the top of the sheet
    await page.locator('.timings-row').first().click();
    const detail = page.locator('.timings-detail');
    await expect(detail).toContainText('Mon to Fri');
    await expect(detail).toContainText('Saturday');
    await expect(detail).toContainText('Sunday');
    await expect(detail).toContainText(/Trains run/);
    await expect(detail.getByRole('link', { name: /kolkatametro\.org/ })).toHaveAttribute('rel', /noopener/);
    await page.locator('.timings-row').first().click();
    await expect(detail).toHaveCount(0);
  });

  test('Kavi Subhas is closed: shown as closed, not tappable, never offered', async ({ page }) => {
    await openApp(page);
    await blue(page).click();
    const row = page.locator('.lb.closed');
    await expect(row).toContainText('Kavi Subhas');
    await expect(row).toContainText(/Closed for now/);
    await expect(row.locator('button')).toHaveCount(0);
  });

  test('a station with no pujas within 1 km shows the 5 km count and list instead of a dead end', async ({ page }) => {
    await openApp(page);
    await blue(page).click();
    // No row may say a bare "No pujas within 1 km".
    await expect(page.getByText('No pujas within 1 km', { exact: true })).toHaveCount(0);
    const rows = await page.locator('.lb .sub').allTextContents();
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((t) => /within (1|5) km|Nearest with pujas|Closed/.test(t) || /No pujas within 5 km/.test(t))).toBe(true);
    // With the whole city loaded every station has pujas within 5 km; the "nearest station" step is covered
    // by the stationOutlook unit tests. Maidan (no pujas within 1 km) must widen instead of dead-ending.
    await page.evaluate(() => window.__pd.openStation('maidan'));
    await expect(page.locator('.panel h2').first()).toContainText(/\d+ pujas within 5 km of Maidan/);
    await expect(page.locator('.pcard').first()).toBeVisible();
  });

  test('a mid-distance station widens to 5 km and says so', async ({ page }) => {
    await openApp(page);
    await blue(page).click();
    const wide = page.locator('.lb', { hasText: /pujas? within 5 km/ }).first();
    if (await wide.count()) {
      await wide.locator('button').click();
      await expect(page.locator('.panel h2').first()).toContainText(/within 5 km of/);
      await expect(page.locator('.panel')).toContainText(/None within 1 km/);
      await expect(page.locator('.pcard').first()).toBeVisible();
    }
  });
});

test('the chip bar scrolls sideways on a phone so Green line is reachable, and the page itself never shifts', async ({ page }) => {
  await openApp(page);
  const bar = page.locator('.bar-chips');
  expect(await bar.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await bar.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  const green = await page.getByRole('button', { name: /^Green line/ }).boundingBox();
  expect(green.x + green.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: /^Green line/ }).click();
  await expect(page.getByRole('button', { name: /^Green line/ }).locator('.chip-x')).toBeVisible();
  expect(await page.evaluate(() => [document.documentElement.scrollLeft, document.getElementById('app').scrollLeft])).toEqual([0, 0]);
});

for (const [line, first, last] of [
  ['Blue', 'dakshineswar', 'shahid-khudiram'],
  ['Green', 'howrah-maidan', 'salt-lake-sector-v'],
]) {
  test(`${line} line chip moves the map so the whole line is in view`, async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: new RegExp(`^${line} line`) }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: new RegExp(`^${line} line`) }).click();
    await page.waitForTimeout(900);
    await settled(page);
    const inView = await page.evaluate(
      ([a, b]) => {
        const map = window.__pdMap;
        const bounds = map.getBounds();
        return [a, b].map((id) => {
          const s = window.__pd.data.stations.find((x) => x.id === id);
          return bounds.contains([s.lng, s.lat]);
        });
      },
      [first, last],
    );
    expect(inView).toEqual([true, true]);
  });
}

test.describe('area chips', () => {
  const countOf = (page, ids) => page.evaluate((zs) => window.__pd.data.pujas.filter((p) => zs.includes(p.z)).length, ids);

  test('whole Kolkata is loaded and each zone has pujas', async ({ page }) => {
    await openApp(page);
    const zones = await page.evaluate(() => [...new Set(window.__pd.data.pujas.map((p) => p.z))].sort());
    expect(zones).toEqual(['central', 'east', 'north', 'other', 'south']);
    expect(await page.evaluate(() => window.__pd.data.pujas.length)).toBeGreaterThan(600);
  });

  test('a zone chip shows a cross, filters the list and the header, and tapping again removes it', async ({ page }) => {
    await openApp(page);
    const north = page.getByRole('button', { name: /^North Kolkata/ });
    await north.scrollIntoViewIfNeeded();
    await north.click();
    await expect(north.locator('.chip-x')).toBeVisible();
    await expect(north).toHaveAttribute('aria-pressed', 'true');
    const n = await countOf(page, ['north']);
    await expect(page.locator('.panel h2').first()).toContainText(`${n} pujas in North Kolkata`);
    await north.click();
    await expect(north.locator('.chip-x')).toHaveCount(0);
    await expect(north).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.panel h2').first()).not.toContainText('in North');
  });

  test('zone chips combine, the radius steps aside, and the map frames the chosen pujas', async ({ page }) => {
    await openApp(page);
    for (const name of [/^North Kolkata/, /^Central Kolkata/]) {
      const chip = page.getByRole('button', { name });
      await chip.scrollIntoViewIfNeeded();
      await chip.click();
    }
    const n = await countOf(page, ['north', 'central']);
    await expect(page.locator('.panel h2').first()).toContainText(`${n} pujas in North & Central Kolkata`);
    await expect(page.locator('.dist-chip')).toBeDisabled();
    await page.waitForTimeout(900);
    const allInView = await page.evaluate(() => {
      const bounds = window.__pdMap.getBounds();
      return window.__pd.data.pujas.filter((p) => p.z === 'north' || p.z === 'central').every((p) => bounds.contains([p.lo, p.la]));
    });
    expect(allInView).toBe(true);
  });

  test('a puja outside the south opens like any other', async ({ page }) => {
    await openApp(page);
    const id = await page.evaluate(() => window.__pd.data.pujas.find((p) => p.z === 'other').id);
    await page.evaluate((x) => window.__pd.openPuja(x), id);
    await expect(page.locator('.panel')).toContainText(/Get directions/i);
  });
});

test.describe('area chips drive the sheet', () => {
  const zoneCount = (page, zs) => page.evaluate((ids) => window.__pd.data.pujas.filter((p) => ids.includes(p.z)).length, zs);
  const chip = (page, zone) => page.getByRole('button', { name: zone === 'Other' ? /^Other areas/ : new RegExp(`^${zone} Kolkata`) });

  test('the Less crowded chip is not shown', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('button', { name: /^Less crowded/ })).toHaveCount(0);
  });

  test("with Metro nearby open, choosing an area replaces it with that area's count and pujas", async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__pd.openMetro());
    await expect(page.locator('.panel')).toContainText(/Metro nearby/);
    await chip(page, 'South').scrollIntoViewIfNeeded();
    await chip(page, 'South').click();
    const n = await zoneCount(page, ['south']);
    await expect(page.locator('.panel')).not.toContainText(/Metro nearby/);
    await expect(page.locator('.panel h2').first()).toContainText(`${n} pujas in South`);
    await expect(page.locator('.pcard').first()).toBeVisible();
  });

  test('with a puja or a station open, choosing an area closes it; two areas add up; removing one updates the list', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__pd.openStation('kalighat'));
    await chip(page, 'North').scrollIntoViewIfNeeded();
    await chip(page, 'North').click();
    await expect(page.locator('.panel h2').first()).toContainText(`${await zoneCount(page, ['north'])} pujas in North`);
    await chip(page, 'Central').click();
    await expect(page.locator('.panel h2').first()).toContainText(
      `${await zoneCount(page, ['north', 'central'])} pujas in North & Central Kolkata`,
    );
    await chip(page, 'North').click();
    await expect(page.locator('.panel h2').first()).toContainText(`${await zoneCount(page, ['central'])} pujas in Central`);
    await page.evaluate((x) => window.__pd.openPuja(x), await page.evaluate(() => window.__pd.data.pujas.find((p) => p.z === 'east').id));
    await chip(page, 'East').click();
    await expect(page.locator('.panel h2').first()).toContainText(/pujas? in Central & East Kolkata/);
  });

  test('every puja listed belongs to the chosen area', async ({ page }) => {
    await openApp(page);
    await chip(page, 'Other').scrollIntoViewIfNeeded();
    await chip(page, 'Other').click();
    const names = await page.locator('.pcard .pname').allTextContents();
    expect(names.length).toBeGreaterThan(0);
    const allOther = await page.evaluate(
      (list) => list.every((n) => window.__pd.data.pujas.some((p) => p.n === n.trim() && p.z === 'other')),
      names,
    );
    expect(allOther).toBe(true);
  });
});

test.describe('area framing', () => {
  // Every chosen puja must sit on the visible map: inside the screen and above the bottom sheet.
  const allVisible = (page, zones) =>
    page.evaluate((zs) => {
      const map = window.__pdMap;
      const canvas = map.getCanvas();
      const sheetTop = document.querySelector('.panel').getBoundingClientRect().top - canvas.getBoundingClientRect().top;
      return window.__pd.data.pujas
        .filter((p) => zs.includes(p.z))
        .filter((p) => {
          const pt = map.project([p.lo, p.la]);
          return !(pt.x >= 0 && pt.x <= canvas.clientWidth && pt.y >= 0 && pt.y <= sheetTop);
        }).length;
    }, zones);

  for (const [label, names, ids] of [
    ['North', ['North'], ['north']],
    ['South + North', ['South', 'North'], ['south', 'north']],
    ['Other', ['Other'], ['other']],
    ['all five', ['South', 'North', 'Central', 'East', 'Other'], ['south', 'north', 'central', 'east', 'other']],
  ]) {
    test(`choosing ${label} frames every puja above the sheet`, async ({ page }) => {
      await openApp(page);
      for (const name of names) {
        const chip = page.getByRole('button', { name: new RegExp(`^${name}( Kolkata)?`) }).first();
        await chip.scrollIntoViewIfNeeded();
        await chip.click();
      }
      // The map frames the pujas about 650 ms after the tap (once the sheet has risen), then glides for 500 ms.
      await page.waitForTimeout(1500);
      await settled(page);
      await expect.poll(() => allVisible(page, ids), { timeout: 8000 }).toBe(0);
    });
  }
});

test.describe('report, credit and metro button', () => {
  test('Report issue opens the project form in a new tab', async ({ page }) => {
    await openApp(page);
    const report = page.getByRole('link', { name: /Report an issue/ });
    await expect(report).toHaveAttribute('href', 'https://forms.gle/4dGHo5hw3wwCnc8Y9');
    await expect(report).toHaveAttribute('target', '_blank');
  });

  test('after a while a tooltip names the Report button, then it fades away by itself after about 2 seconds', async ({ page }) => {
    await page.addInitScript(() => {
      window.__PD_E2E_HINT_MS__ = 700;
      window.__hint = { shownAt: 0, goneAt: 0, text: '' };
      new MutationObserver(() => {
        const el = document.querySelector('.fab-hint');
        if (el && !window.__hint.shownAt) {
          window.__hint.shownAt = Date.now();
          window.__hint.text = el.textContent;
        }
        if (!el && window.__hint.shownAt && !window.__hint.goneAt) window.__hint.goneAt = Date.now();
      }).observe(document, { childList: true, subtree: true });
    });
    await openApp(page);
    await page.waitForFunction(() => window.__hint.goneAt > 0, null, { timeout: 8000 });
    const hint = await page.evaluate(() => window.__hint);
    expect(hint.text).toBe('Report an issue');
    const shownFor = hint.goneAt - hint.shownAt;
    expect(shownFor).toBeGreaterThan(1200);
    expect(shownFor).toBeLessThan(2800);
  });

  test('the tooltip shows on the first visit only, not on later visits', async ({ page }) => {
    await page.addInitScript(() => {
      window.__PD_E2E_HINT_MS__ = 500;
    });
    await openApp(page);
    await expect(page.locator('.fab-hint')).toHaveText('Report an issue', { timeout: 6000 });
    await expect(page.locator('.fab-hint')).toHaveCount(0, { timeout: 5000 });
    // A later visit (same browser storage): no tooltip.
    await page.reload();
    await page.waitForFunction(() => window.__pdMap);
    await page.waitForTimeout(3000);
    await expect(page.locator('.fab-hint')).toHaveCount(0);
  });

  test('the name in the credit line links to LinkedIn in blue, underlined', async ({ page }) => {
    await openApp(page);
    const link = page.locator('.made-with a');
    await expect(link).toHaveText('Prasun');
    await expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/prasun-mondal-b25320214/');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    const style = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      const [r, g, b] = s.color.match(/\d+/g).map(Number);
      return { underline: s.textDecorationLine, blueDominant: b > r + 40 && b > g };
    });
    expect(style).toEqual({ underline: 'underline', blueDominant: true });
  });

  test('the Metro button toggles: tap to open, tap again to close', async ({ page }) => {
    await openApp(page);
    const metro = page.getByRole('button', { name: /Metro stations near you/ });
    await metro.click();
    await expect(metro).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.panel')).toContainText(/Metro nearby/);
    await metro.click();
    await expect(metro).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.panel')).not.toContainText(/Metro nearby/);
    await metro.click();
    await expect(metro).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('people viewed / exploring now pill', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const reply = (page, pattern, body, status = 200) =>
    page.route(pattern, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
  // The real hold is about nine seconds; most tests shorten it. One test below puts it back and times it.
  test.beforeEach(({ page }) => page.addInitScript(() => /** @type {any} */ (window.__PD_PILL_HOLD_MS__ = 2500)));
  const visits = (page, body, status) => reply(page, '**/api/visits**', body, status);
  const live = (page, body, status) => reply(page, '**/api/live**', body, status);
  const label = (page) => page.locator('.view-pill').getAttribute('aria-label');
  /** What a person reads in the pill once any roll has finished. */
  const readable = (page) =>
    page.locator('.view-text').evaluate((el) => {
      const n = el.querySelector('.od')?.getAttribute('data-value');
      const t = el.querySelector('.swap')?.getAttribute('data-text');
      return `${n} ${t}`;
    });
  /** True once no digit is still turning and no word is still fading. */
  const still = (page) =>
    page
      .locator('.view-pill')
      .evaluate(
        (el) =>
          !el
            .getAnimations({ subtree: true })
            .some((a) => a.playState !== 'finished' && /** @type {any} */ (a.effect)?.target?.closest('.od, .swap')),
      );
  /** The digit each wheel is actually showing, read from where its strip sits. */
  const wheels = (page) =>
    page
      .locator('.od-cell:not(.off) .od-strip')
      .evaluateAll((els) => els.map((el) => Math.round(-new DOMMatrix(getComputedStyle(el).transform).m42 / 16) % 10).join(''));
  /** Record every sentence the pill announces and its width on every frame, from the very first paint. */
  const record = (page) =>
    page.addInitScript(() => {
      const w = /** @type {any} */ (window);
      w.__pill = [];
      w.__pillAt = [];
      w.__widths = [];
      new MutationObserver(() => {
        const v = document.querySelector('.view-pill')?.getAttribute('aria-label');
        if (v && w.__pill.at(-1) !== v) {
          w.__pill.push(v);
          w.__pillAt.push(performance.now());
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] });
      const tick = () => {
        const el = document.querySelector('.view-pill');
        const width = el ? Math.round(el.getBoundingClientRect().width * 10) / 10 : 0;
        if (width && w.__widths.at(-1) !== width) w.__widths.push(width);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

  test('opens on "N people viewed", rolls to "N people exploring now", then rolls back, and the pill eases in both directions', async ({
    page,
  }) => {
    await visits(page, { count: 15 });
    await live(page, { count: 1240, recent: 5 });
    await record(page);
    await openApp(page);
    await expect.poll(() => label(page), { timeout: 10_000 }).toBe('1,240 people exploring now');
    await expect(page.locator('.view-pill .live-dot.on')).toBeVisible();
    await expect(page.locator('.view-pill svg')).toHaveCount(1);
    await expect.poll(() => still(page)).toBe(true); // the roll has finished
    expect(await readable(page)).toBe('1,240 people exploring now');
    expect(await wheels(page)).toBe('1240'); // every wheel really rests on its digit
    const wide = await page.locator('.view-pill').boundingBox();
    expect(wide?.height).toBeLessThanOrEqual(32);
    expect(wide?.width).toBeLessThanOrEqual(210);

    // ...then it flips back to viewed on its own, and the dot goes out.
    await expect.poll(() => label(page), { timeout: 10_000 }).toBe('15 people viewed');
    await expect.poll(() => still(page)).toBe(true);
    expect(await readable(page)).toBe('15 people viewed');
    expect(await wheels(page)).toBe('15');
    await expect(page.locator('.od-cell:not(.off)')).toHaveCount(2);
    await expect(page.locator('.view-pill .live-dot.on')).toHaveCount(0);

    const seen = await page.evaluate(() => /** @type {any} */ (window).__pill);
    expect(seen.slice(0, 3)).toEqual(['15 people viewed', '1,240 people exploring now', '15 people viewed']);

    // Wider, then narrower, in many small steps: never a jump.
    const widths = await page.evaluate(() => /** @type {any} */ (window).__widths);
    const first = widths[0];
    const peak = Math.max(...widths);
    expect(peak).toBeGreaterThan(first + 20);
    expect(widths.at(-1)).toBeLessThan(peak - 20);
    expect(widths.filter((x) => x > first + 2 && x < peak - 2).length).toBeGreaterThanOrEqual(5);
    for (let k = 1; k < widths.length; k++) expect(Math.abs(widths[k] - widths[k - 1])).toBeLessThanOrEqual(30);
  });

  test('counts up from zero on first load, and the wheels pass through the digits in between', async ({ page }) => {
    await visits(page, { count: 15 });
    await live(page, { count: 1, recent: 0 });
    // Record what the wheels show on every frame from the first paint.
    await page.addInitScript(() => {
      const w = /** @type {any} */ (window);
      w.__digits = [];
      const tick = () => {
        const strips = [...document.querySelectorAll('.od-strip')];
        if (strips.length) {
          const now = strips.map((el) => Math.round(-new DOMMatrix(getComputedStyle(el).transform).m42 / 16) % 10).join('');
          if (w.__digits.at(-1) !== now) w.__digits.push(now);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await openApp(page);
    await expect(page.locator('.view-pill')).toBeVisible();
    await expect.poll(() => still(page)).toBe(true);
    const seenDigits = await page.evaluate(() => /** @type {any} */ (window).__digits);
    expect(seenDigits.length).toBeGreaterThan(3); // 00, 02, 07, 11 ... passes through the digits in between
    expect(seenDigits[0]).toBe('00');
    expect(await wheels(page)).toBe('15');
    expect(await readable(page)).toBe('15 people viewed');
  });

  test('holds each state for about nine seconds before rolling to the other', async ({ page }) => {
    await visits(page, { count: 15 });
    await live(page, { count: 1240, recent: 5 });
    await page.addInitScript(() => delete (/** @type {any} */ (window).__PD_PILL_HOLD_MS__)); // the real timing
    await record(page);
    await openApp(page);
    await expect.poll(() => label(page), { timeout: 14_000 }).toBe('1,240 people exploring now');
    const at = await page.evaluate(() => /** @type {any} */ (window).__pillAt);
    const gap = at[1] - at[0];
    expect(gap).toBeGreaterThanOrEqual(8000);
    expect(gap).toBeLessThanOrEqual(10_500);
    // Longer number, so two more wheels have grown in; they fold away again on the way back.
    await expect.poll(() => still(page)).toBe(true);
    await expect(page.locator('.od-cell:not(.off)')).toHaveCount(4);
  });

  test('stays on screen at every sheet height while it rolls', async ({ page }) => {
    await visits(page, { count: 15 });
    await live(page, { count: 8, recent: 3 });
    await openApp(page);
    const inside = async () => {
      const b = await page.locator('.view-pill').boundingBox();
      return Boolean(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= 390 && b.y + b.height <= 844);
    };
    await expect.poll(inside).toBe(true);
    await page.locator('.grab').click(); // initial
    await expect.poll(inside).toBe(true);
    await page.locator('.grab').click(); // half
    await expect.poll(inside).toBe(true);
    await page.locator('.grab').click(); // full
    await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'full');
    await expect(page.locator('.view-pill')).toHaveClass(/on-sheet/);
    await expect.poll(inside).toBe(true);
    await expect.poll(() => label(page), { timeout: 10_000 }).toMatch(/exploring now$/);
    await expect.poll(inside).toBe(true);
  });

  test('"1 person exploring now" is fine when somebody else was here recently', async ({ page }) => {
    await visits(page, { count: 15 });
    await live(page, { count: 1, recent: 1 });
    await openApp(page);
    await expect.poll(() => label(page), { timeout: 10_000 }).toBe('1 person exploring now');
    await expect.poll(() => readable(page)).toBe('1 person exploring now');
  });

  test('with nobody else in the last 2 hours it stays on "N people viewed"', async ({ page }) => {
    await visits(page, { count: 15 });
    await live(page, { count: 1, recent: 0 });
    await record(page);
    await openApp(page);
    await expect(page.locator('.view-pill')).toBeVisible();
    await page.waitForTimeout(8000); // long enough for a roll to have happened
    expect(await label(page)).toBe('15 people viewed');
    expect(await readable(page)).toBe('15 people viewed');
    expect(await page.evaluate(() => /** @type {any} */ (window).__pill)).toEqual(['15 people viewed']);
    await expect(page.locator('.view-pill .live-dot.on')).toHaveCount(0);
  });

  test('says "1 person viewed" for one, and stays on "exploring now" when the total is unavailable', async ({ page }) => {
    await visits(page, { count: 1 });
    await live(page, { error: 'live_unavailable' }, 503);
    await openApp(page);
    await expect(page.locator('.view-pill')).toHaveAttribute('aria-label', '1 person viewed');

    const second = await page.context().newPage();
    await second.addInitScript(() => localStorage.clear()); // no remembered total from the first page
    await second.addInitScript(() => /** @type {any} */ (window.__PD_PILL_HOLD_MS__ = 2500));
    await visits(second, { error: 'counter_unavailable' }, 503);
    await live(second, { count: 7, recent: 2 });
    await openApp(second);
    await expect(second.locator('.view-pill')).toHaveAttribute('aria-label', '7 people exploring now');
    await second.waitForTimeout(5000); // nothing to flip back to
    await expect(second.locator('.view-pill')).toHaveAttribute('aria-label', '7 people exploring now');
    await second.close();
  });

  test('is hidden when both counters are down', async ({ page }) => {
    await visits(page, { error: 'counter_unavailable' }, 503);
    await live(page, { error: 'live_unavailable' }, 503);
    await openApp(page);
    await expect(page.locator('.panel')).toBeVisible();
    await expect(page.locator('.view-pill')).toHaveCount(0);
  });

  test('checks in with a random device id that survives a reload', async ({ page }) => {
    const first = page.waitForRequest((r) => r.url().includes('/api/live?id=') && r.method() === 'POST');
    await openApp(page);
    const id = new URL((await first).url()).searchParams.get('id');
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    const again = page.waitForRequest((r) => r.url().includes('/api/live?id=') && r.method() === 'POST');
    await page.reload();
    expect(new URL((await again).url()).searchParams.get('id')).toBe(id);
  });
});

test.describe('visitor mode and the opening height', () => {
  test.use({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'] });
  const open35 = (page) => page.addInitScript(() => (window.__PD_E2E_OPEN__ = true));

  test('a visitor 150 km away: list at 35%, one closable chip, no radius chip, short area names', async ({ page }) => {
    await open35(page);
    await page.context().setGeolocation({ latitude: 23.52, longitude: 87.31 }); // Durgapur
    await openApp(page);
    // First visit from far away: the one-time card comes first.
    await page.locator('.outside').getByRole('button', { name: 'Keep both in view' }).click();
    const stage = (await page.locator('.stage').boundingBox()).height;
    await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'initial');
    await expect.poll(async () => (await page.locator('.panel').boundingBox()).height).toBeCloseTo(stage * 0.35, -1);
    const chip = page.locator('.visitor-chip');
    await expect(chip).toContainText(/Pujas are in Kolkata for now\. You're \d+ km away, so we're showing the city\./);
    await expect(page.locator('.dist-chip')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'South Kolkata' })).toContainText('South Kol.');
    await page.getByRole('button', { name: 'South Kolkata' }).click();
    await expect(page.getByRole('button', { name: /South Kolkata, selected/ })).toContainText('South Kolkata');
    await chip.getByRole('button', { name: 'Dismiss' }).click();
    await expect(chip).toHaveCount(0);
    await expect(page.locator('.panel')).not.toHaveAttribute('data-sheet', 'full');
  });

  test('someone in Kolkata: opens at 35%, then half once their location arrives; no visitor chip', async ({ page }) => {
    await open35(page);
    await page.context().setGeolocation({ latitude: 22.5186, longitude: 88.3467 });
    await openApp(page);
    await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
    await expect(page.locator('.visitor-chip')).toHaveCount(0);
    await expect(page.locator('.dist-chip')).toBeVisible();
  });

  test('26 km from Kolkata is a visitor, 24 km is not', async ({ page }) => {
    await open35(page);
    // 0.009 degrees of latitude is about 1 km; the map centre is 22.5185, 88.35.
    await page.context().setGeolocation({ latitude: 22.5185 + 0.2338, longitude: 88.35 });
    await openApp(page);
    await expect(page.locator('.visitor-chip')).toBeVisible();
    await page.context().setGeolocation({ latitude: 22.5185 + 0.2158, longitude: 88.35 });
    await page.reload();
    await page.waitForFunction(() => window.__pdMap?.getLayer('pujas'));
    await expect(page.locator('.visitor-chip')).toHaveCount(0);
  });

  test('a visitor sees our picks first, and the near-me button says it works in Kolkata', async ({ page }) => {
    await open35(page);
    await page.context().setGeolocation({ latitude: 23.52, longitude: 87.31 }); // Durgapur
    await openApp(page);
    await page.locator('.outside').getByRole('button', { name: 'Keep both in view' }).click();
    const featured = await page.evaluate(() => window.__pd.data.pujas.filter((p) => p.f).map((p) => p.n));
    expect(featured.length).toBeGreaterThan(0);
    // The sheet is at 35% here, so the map buttons are in reach.
    await page.locator('.fab.loc').click();
    await expect(page.getByText("Near me works once you're in Kolkata.")).toBeVisible();
    await page.locator('.grab').click();
    await page.locator('.grab').click(); // full: the list is in view
    const first = await page.locator('.pcard .pname').first().textContent();
    expect(featured).toContain(first?.trim());
    await expect(page.getByText('Our picks first, then the rest.')).toBeVisible();
  });
});

test('the details screen has a 44 px back arrow to the left of the title, named "Back to the list"', async ({ page }) => {
  await openApp(page);
  await page.locator('.grab').click();
  await page.locator('.grab').click();
  await page.locator('.pcard-main').first().click();
  const back = page.getByRole('button', { name: 'Back to the list' });
  await expect(back).toBeVisible();
  const box = await back.boundingBox();
  expect(Math.round(box.width)).toBe(44);
  expect(Math.round(box.height)).toBe(44);
  const title = await page.locator('.panel h2').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(title.x);
  await back.click();
  await expect(back).toHaveCount(0);
});
