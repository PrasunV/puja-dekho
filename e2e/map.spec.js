import { expect, firstPujaOnScreen, openApp, test } from './fixtures.js';

test('map draws pujas, and metro stations once a line is switched on, in Plus Jakarta Sans', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /Blue/ }).first().click();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const map = window.__pdMap;
    return {
      drawn: map.queryRenderedFeatures({ layers: ['pujas', 'clusters'] }).length,
      canvas: Boolean(document.querySelector('canvas.maplibregl-canvas')),
      stations: document.querySelectorAll('.sm').length,
    };
  });
  expect(info.canvas).toBe(true);
  expect(info.drawn).toBeGreaterThan(0);
  expect(info.stations).toBeGreaterThan(5);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Plus Jakarta Sans');
});

test('tapping a puja opens its page and selects it on the map', async ({ page }) => {
  await openApp(page);
  const target = await firstPujaOnScreen(page);
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + target.x, box.y + target.y);
  await expect(page.locator('.panel .back')).toBeVisible();
  const filter = await page.evaluate(() => JSON.stringify(window.__pdMap.getFilter('puja-sel')));
  expect(filter).toContain(target.id);
});

test('tapping a cluster zooms in', async ({ page }) => {
  await openApp(page);
  await page.evaluate(async () => {
    const map = window.__pdMap;
    map.jumpTo({ center: [88.35, 22.5185], zoom: 11 });
    await new Promise((resolve) => map.once('idle', resolve));
  });
  const cluster = await page.evaluate(() => {
    const map = window.__pdMap;
    const feature = map.queryRenderedFeatures({ layers: ['clusters'] })[0];
    const point = map.project(feature.geometry.coordinates);
    return { x: point.x, y: point.y, zoom: map.getZoom() };
  });
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + cluster.x, box.y + cluster.y);
  await expect.poll(() => page.evaluate(() => window.__pdMap.getZoom())).toBeGreaterThan(cluster.zoom);
});
