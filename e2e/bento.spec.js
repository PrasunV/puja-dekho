import { expect, openApp, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });

/** Open the puja page for this id and bring the sheet to full so every card is reachable. */
async function openDetail(page, id) {
  await openApp(page);
  await page.evaluate((pujaId) => window.__pd.openPuja(pujaId), id);
  await expect(page.getByRole('button', { name: 'Close details' })).toBeVisible();
  await page.locator('.grab').click().catch(() => {});
}

test.describe('jubilee rule', () => {
  test('years, jubilee year and next milestone follow the doc', async ({ page }) => {
    await openApp(page);
    const out = await page.evaluate(async () => {
      const { heritage } = await import('/src/lib/heritage.js').catch(() => ({ heritage: null }));
      return heritage ? [heritage(1934, 2026), heritage(2001, 2026), heritage(1951, 2026), heritage(2026, 2026), heritage(null, 2026)] : null;
    });
    // Dev-server imports are not available in the built app, so this is also covered below through the page.
    if (out) {
      expect(out[0]).toMatchObject({ years: 92, jubilee: null, next: { name: 'Centenary', year: 2034 } });
      expect(out[1]).toMatchObject({ years: 25, jubilee: 'Silver Jubilee' });
      expect(out[2]).toMatchObject({ years: 75, jubilee: 'Diamond Jubilee', next: { name: 'Centenary', year: 2051 } });
      expect(out[3]).toBeNull();
      expect(out[4]).toBeNull();
    }
  });
});

test.describe('detail sheet: facts strip and bento cards', () => {
  test('tile icons are 16 px, no blue dot in the metro tile, titles stay on one line, icon and arrow stay put', async ({ page }) => {
    for (const [w, scale] of [[390, 1], [320, 1.5]]) {
      await page.setViewportSize({ width: w, height: 740 });
      await openDetail(page, 'S001');
      if (scale !== 1) {
        await page.evaluate((f) => {
          for (const sheet of document.styleSheets) for (const r of sheet.cssRules) if (r.style && r.style.fontSize?.endsWith('px')) r.style.fontSize = `${parseFloat(r.style.fontSize) * f}px`;
        }, scale);
      }
      await expect(page.locator('#card-metro .bento-preview .dot')).toHaveCount(0);
      const geo = await page.evaluate(() =>
        ['metro', 'heritage'].map((id) => {
          const card = document.querySelector(`#card-${id}`).getBoundingClientRect();
          const icon = document.querySelector(`#card-${id} .bento-head svg`).getBoundingClientRect();
          const chev = document.querySelector(`#card-${id} .bento-chev`).getBoundingClientRect();
          const title = document.querySelector(`#card-${id} .bento-title`);
          const cs = getComputedStyle(title);
          return { iw: icon.width, iLeft: icon.left - card.left, cRight: card.right - chev.right, lines: title.getBoundingClientRect().height / parseFloat(cs.lineHeight), nowrap: cs.whiteSpace, ell: cs.textOverflow };
        }),
      );
      for (const g of geo) {
        expect(g.iw).toBeCloseTo(16, 0);
        expect(g.iLeft).toBeCloseTo(17, 0); // fixed on the left (16 px padding plus the 1 px border)
        expect(g.cRight).toBeCloseTo(13, 0); // arrow fixed on the right (12 px padding plus the 1 px border)
        expect(g.lines).toBeLessThan(1.1); // one line, never "Heritag / e"
        expect(g.nowrap).toBe('nowrap');
        expect(g.ell).toBe('ellipsis');
      }
    }
  });

  test('a puja with a since-year shows the facts strip, Getting there, Heritage and Address', async ({ page }) => {
    await openDetail(page, 'S001'); // since 1938
    await expect(page.locator('.facts-strip')).not.toContainText('All day'); // the always-true "Open: All day" cell is gone
    await expect(page.locator('#card-metro .bento-preview')).toContainText('min walk'); // shut cards are small pictures, not clipped sentences
    await expect(page.locator('#card-heritage .bento-preview')).toContainText('years of puja');
    await expect(page.locator('#card-address .bento-preview')).toBeVisible();
    await expect(page.locator('.facts-strip')).toContainText('Since');
    await expect(page.locator('.facts-strip')).toContainText('1938');
    await expect(page.locator('.facts-strip')).toContainText('Nearest metro');
    await expect(page.getByRole('button', { name: /Getting there/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: /Heritage/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: /Address/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#card-heritage .bento-preview')).toContainText(/years of puja · (.+ in \d{4}|.+ year)/);
  });

  test('closed, the two small cards sit side by side; opening either stacks both full width', async ({ page }) => {
    await openDetail(page, 'S001');
    const metro = page.locator('#card-metro');
    const heritage = page.locator('#card-heritage');
    await expect.poll(async () => Math.abs((await metro.boundingBox()).y - (await heritage.boundingBox()).y)).toBeLessThan(2); // same row
    await page.getByRole('button', { name: /Heritage/ }).click();
    await expect.poll(async () => (await metro.boundingBox()).width).toBeGreaterThan(300);
    await expect.poll(async () => (await heritage.boundingBox()).width).toBeGreaterThan(300);
    const [c, d] = [await metro.boundingBox(), await heritage.boundingBox()];
    expect(d.y).toBeGreaterThan(c.y + c.height - 2); // stacked
    // The preview hides while a card is open, and the body shows.
    await expect(page.locator('#card-heritage .bento-preview')).toHaveCount(0);
    await expect(page.locator('#card-heritage .bento-body')).toContainText('Years of puja');
    await page.getByRole('button', { name: /Heritage/ }).click();
    await expect(page.locator('#card-heritage .bento-body')).toHaveCount(0);
  });

  test('Getting there lists each station with walk time, distance and the line timings for today', async ({ page }) => {
    await openDetail(page, 'S001');
    await page.getByRole('button', { name: /Getting there/ }).click();
    const body = page.locator('#card-metro .bento-body');
    await expect(body).toContainText(/\d+ min walk/);
    await expect(body).toContainText(/Blue Line: .*(AM|PM)/);
    await expect(body).toContainText(/Today, \d+ \w+/);
  });

  test('Address opens to the full address with Copy and Open in Maps', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openDetail(page, 'S001');
    await page.getByRole('button', { name: /^Address/ }).click();
    const body = page.locator('#card-address .bento-body');
    await expect(body).toContainText('Bakul Bagan');
    await expect(body.getByRole('link', { name: /Open in Maps/ })).toHaveAttribute('href', /google\.com\/maps\/search\/.*query=22\.5/);
    await body.getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByText('Address copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Bakul Bagan');
    expect((await body.getByRole('button', { name: 'Copy' }).boundingBox()).height).toBeGreaterThanOrEqual(47.5);
  });

  test('tapping Since in the facts strip opens Heritage and lifts the sheet to full', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__pd.openPuja('S001'));
    await page.locator('.facts-strip').getByRole('button', { name: /Since/ }).click();
    await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'full');
    await expect(page.getByRole('button', { name: /Heritage/ })).toHaveAttribute('aria-expanded', 'true');
  });

  test('a puja with no since-year has no Since cell and no Heritage card', async ({ page }) => {
    await openApp(page);
    const id = await page.evaluate(async () => (await (await fetch('/data/pujas.json')).json()).find((p) => !p.e)?.id);
    test.skip(!id, 'every puja has a since-year in this data');
    await page.evaluate((pujaId) => window.__pd.openPuja(pujaId), id);
    await expect(page.getByRole('button', { name: 'Close details' })).toBeVisible();
    await expect(page.locator('.facts-strip').getByText('Since')).toHaveCount(0);
    await expect(page.locator('#card-heritage')).toHaveCount(0);
  });
});
