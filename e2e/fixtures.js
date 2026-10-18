import { test as base, expect } from '@playwright/test';

/** Background-only map style: the sandbox and CI have no tile server, and the tests only need the map engine. */
const STUB_STYLE = {
  version: 8,
  name: 'stub',
  sources: {},
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8e4dc' } }],
};

const IGNORED_CONSOLE = /tiles\.openfreemap|net::ERR|Failed to load resource/;

export const test = base.extend({
  page: async ({ page, context }, use) => {
    await context.addInitScript(() => {
      window.__PD_E2E__ = true;
    });
    await context.route('https://tiles.openfreemap.org/**', (route) =>
      route.request().url().includes('/styles/') ? route.fulfill({ json: STUB_STYLE }) : route.abort(),
    );
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !IGNORED_CONSOLE.test(message.text())) errors.push(message.text());
    });
    await use(page);
    expect(errors, 'no page errors').toEqual([]);
  },
});

export { expect };

/** Open the app and wait until the map style and puja layer exist. */
export async function openApp(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__pdMap?.getLayer('pujas') && window.__pdMap.isStyleLoaded(), null, { timeout: 20_000 });
}

/** Move the map and wait for it to settle, then return the screen position of the first unclustered puja. */
export async function firstPujaOnScreen(page) {
  return page.evaluate(async () => {
    const map = /** @type {import('maplibre-gl').Map} */ (window.__pdMap);
    map.jumpTo({ center: [88.3467, 22.5186], zoom: 16 });
    await new Promise((resolve) => map.once('idle', resolve));
    const feature = /** @type {any} */ (map.querySourceFeatures('pujas').find((f) => !f.properties.cluster));
    map.jumpTo({ center: feature.geometry.coordinates, zoom: 17 });
    await new Promise((resolve) => map.once('idle', resolve));
    const point = map.project(feature.geometry.coordinates);
    return { x: point.x, y: point.y, id: feature.properties.id };
  });
}
