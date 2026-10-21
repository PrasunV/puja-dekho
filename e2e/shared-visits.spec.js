import { expect, test } from '@playwright/test';

const stats = (request, key = 'e2e-stats-key') => request.get(`/api/stats?key=${key}`);
const todayCount = async (request) => Number((await (await stats(request)).text()).match(/Today [\d-]+: (\d+)/)[1]);

test.describe('hidden share-link count', () => {
  test('the stats page is private: no key or a wrong key looks like a missing page', async ({ request }) => {
    expect((await request.get('/api/stats')).status()).toBe(404);
    expect((await stats(request, 'nope')).status()).toBe(404);
    const ok = await stats(request);
    expect(ok.status()).toBe(200);
    expect(ok.headers()['x-robots-tag']).toContain('noindex');
  });

  test('a tagged visit counts once per device per day, by source; a plain visit does not; the public total is unchanged', async ({ playwright }) => {
    const baseURL = 'http://localhost:3111';
    const device = () => playwright.request.newContext({ baseURL });
    const admin = await device();
    const before = await todayCount(admin);
    const total0 = (await (await admin.get('/api/visits')).json()).count;

    const phone = await device();
    const first = await (await phone.post('/api/visits?s=wa')).json();
    expect(first.counted).toBe(true);
    await phone.post('/api/visits?s=wa'); // same device, same day
    expect(await todayCount(admin)).toBe(before + 1);

    const other = await device();
    await other.post('/api/visits?s=ig');
    const body = await (await stats(admin)).text();
    expect(body).toMatch(/wa: \d+/);
    expect(body).toMatch(/ig: \d+/);
    expect(await todayCount(admin)).toBe(before + 2);

    const typed = await device();
    await typed.post('/api/visits'); // no tag: counts as a normal view only
    await typed.post('/api/visits?s=%3Cscript%3E'); // junk tags are ignored
    expect(await todayCount(admin)).toBe(before + 2);

    // The people-viewed total moved exactly as before: one per new device per day (phone, other and typed).
    expect((await (await admin.get('/api/visits')).json()).count).toBe(total0 + 3);
  });
});
