import { MEETUP, PIN_STYLES, personLabel, taggedPeople } from '../src/data/meetup.js';
import { expect, openApp, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });

const openMeetup = async (page) => {
  await page.getByTestId('whats-new').click();
  await expect(page.getByTestId('meetup-page')).toBeVisible();
};
/** Shyambazar is north of the opening view, so bring the pin on screen the way a person would (by moving the map). */
const showPin = async (page) => {
  await page.evaluate(({ lat, lng }) => window.__pdMap.jumpTo({ center: [lng, lat], zoom: 15 }), MEETUP.place);
  await expect(page.locator('.mu-pin')).toBeVisible();
};
const closeIntro = async (page) => {
  await page.getByTestId('mu-intro').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('mu-intro')).toHaveCount(0);
};

test.describe('the chip', () => {
  test('"What\'s new" is the first chip, 48 px tall, and has the travelling light', async ({ page }) => {
    await openApp(page);
    const chip = page.getByTestId('whats-new');
    await expect(chip).toHaveText("What's new");
    const first = await page.evaluate(() => document.querySelector('.bar-chips > :first-child')?.getAttribute('data-testid'));
    expect(first).toBe('whats-new');
    const box = await chip.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    // The outline is a conic gradient that turns (an animated angle), all the way round.
    const look = await chip.evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, anim: getComputedStyle(el).animationName }));
    expect(look.bg).toContain('conic-gradient');
    expect(look.anim).toBe('trail-run');
  });
  test('the light runs twice (fast, then slower), then the glow appears; it does not loop', async ({ page }) => {
    await openApp(page);
    const chip = page.getByTestId('whats-new');
    const state = () =>
      chip.evaluate((el) => {
        const a = el.getAnimations().find((x) => x.animationName === 'trail-run');
        return {
          iterations: getComputedStyle(el).animationIterationCount,
          glow: Number(getComputedStyle(el, '::before').opacity),
          running: a ? a.playState : 'gone',
        };
      });
    expect((await state()).iterations).toBe('1');
    expect((await state()).glow).toBe(0); // no glow while the light is running
    await expect.poll(async () => (await state()).glow, { timeout: 8000 }).toBeGreaterThan(0.5);
    expect((await state()).running).toBe('finished');
  });
  test('tapping gives a 1 > 0.97 > 1 press and never paints a tint over the chip', async ({ page }) => {
    await openApp(page);
    const chip = page.getByTestId('whats-new');
    await expect.poll(() => chip.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
    const bgBefore = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
    await chip.hover();
    expect(await chip.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(bgBefore);
    const tap = await chip.evaluate(async (el) => {
      el.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return el.getAnimations().some((a) => a.animationName === 'chip-tap');
    });
    expect(tap).toBe(true);
    // pressed (sheet open): same surface, no tint
    expect(await chip.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(bgBefore);
    await expect.poll(() => chip.evaluate((el) => el.classList.contains('tap'))).toBe(false);
  });
  test('with reduced motion the light stops turning', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page);
    expect(await page.getByTestId('whats-new').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });
});

test.describe('the sheet', () => {
  test('chip opens the recap at half height, flies to Shyambazar, and the pin is on the map', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await expect(page.locator('.panel')).toHaveAttribute('data-sheet', 'half');
    await expect(page.getByTestId('meetup-page').locator('h2')).toHaveText(MEETUP.headline);
    await expect(page.locator('.mu-pin')).toHaveCount(1);
    const centre = await page.evaluate(() => {
      const c = window.__pdMap.getCenter();
      return { lat: c.lat, lng: c.lng };
    });
    expect(Math.abs(centre.lat - MEETUP.place.lat)).toBeLessThan(0.02);
    expect(Math.abs(centre.lng - MEETUP.place.lng)).toBeLessThan(0.02);
  });
  test('the pin opens the same sheet', async ({ page }) => {
    await openApp(page);
    await showPin(page);
    await page.locator('.mu-pin').click();
    await expect(page.getByTestId('meetup-page')).toBeVisible();
  });
  test('the one-time card shows first, closes with OK, and does not come back', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await expect(page.getByTestId('mu-intro')).toBeVisible();
    await closeIntro(page);
    await page.getByRole('button', { name: 'Close highlights' }).click();
    await openMeetup(page);
    await expect(page.getByTestId('mu-intro')).toHaveCount(0);
    await page.reload();
    await openApp(page);
    await openMeetup(page);
    await expect(page.getByTestId('mu-intro')).toHaveCount(0);
  });
  test('tapping a photo opens a full-screen viewer; zoom, swipe and close all work', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    await page.getByTestId('mu-photo-0').getByRole('button').click();
    const viewer = page.getByTestId('photo-viewer');
    await expect(viewer).toBeVisible();
    const vp = page.viewportSize();
    const box = await viewer.boundingBox();
    expect(box.width).toBe(vp.width);
    expect(box.height).toBe(vp.height);
    await expect(page.getByTestId('pv-count')).toHaveText(`1 / ${MEETUP.photos.length}`);
    const close = await page.getByTestId('pv-close').boundingBox();
    expect(close.width).toBeGreaterThanOrEqual(48);
    // Double-tap zooms in (mouse double-click), and again zooms out.
    const img = viewer.getByTestId('pv-img').first();
    await img.dblclick();
    await expect.poll(() => img.evaluate((el) => el.style.transform)).toContain('scale(2.5)');
    await img.dblclick();
    await expect.poll(() => img.evaluate((el) => el.style.transform)).toContain('scale(1)');
    // Swipe to the next photo and the counter follows.
    await viewer.locator('.pv-track').evaluate((el) => el.scrollTo({ left: el.clientWidth }));
    await expect(page.getByTestId('pv-count')).toHaveText(`2 / ${MEETUP.photos.length}`);
    // Escape closes it, and the meetup sheet is still there.
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
    await expect(page.getByTestId('meetup-page')).toBeVisible();
    // Back button closes it too.
    await page.getByTestId('mu-photo-0').getByRole('button').click();
    await expect(viewer).toBeVisible();
    await page.goBack();
    await expect(viewer).toHaveCount(0);
    await expect(page.getByTestId('meetup-page')).toBeVisible();
  });
  test('photos sit in 4:3 frames with left-aligned dots; no tags are drawn on the photos', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const photo = page.getByTestId('mu-photo-0');
    await expect(photo).toBeVisible();
    const box = await photo.boundingBox();
    expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.02);
    for (const [i, p] of MEETUP.photos.entries()) {
      expect(p.alt.length).toBeGreaterThan(20); // real descriptions for screen readers
      expect(
        await page
          .getByTestId(`mu-photo-${i}`)
          .locator('img')
          .evaluate((img) => img.complete && img.naturalWidth > 0),
      ).toBe(true);
    }
    await expect(page.getByTestId('mu-tag')).toHaveCount(0);
    await expect(page.locator('.mu-photo a')).toHaveCount(0);
    const dots = page.getByTestId('mu-dots');
    await expect(dots.locator('.mu-dot')).toHaveCount(MEETUP.photos.length);
    const frame = await page.getByTestId('mu-gallery').boundingBox();
    const first = await dots.locator('.mu-dot').first().boundingBox();
    expect(first.x - frame.x).toBeLessThan(2); // left aligned
    expect(first.y).toBeGreaterThan(box.y + box.height); // below the frame
    await expect(dots.locator('.mu-dot.on')).toHaveCount(1);
    expect(await page.getByTestId('mu-gallery').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.getByTestId('mu-gallery').evaluate((el) => el.scrollTo({ left: el.clientWidth + 8 }));
    await expect(dots.locator('.mu-dot').nth(1)).toHaveClass(/on/);
  });
  test('tagged people: one chip: circles, first name and +n, that opens a chip per person, each an Instagram or Facebook link', async ({
    page,
  }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const people = taggedPeople();
    const stack = page.getByTestId('mu-stack');
    await expect(stack.locator('.mu-av')).toHaveCount(Math.min(3, people.length));
    await expect(stack).toContainText(people[0].name); // first person's name
    if (people.length > 1) await expect(stack).toContainText(`+${people.length - 1}`);
    await expect(stack.locator('.mu-av img')).toHaveCount(people.slice(0, 3).filter((x) => x.avatar).length); // pictures where given, initials otherwise
    expect((await stack.boundingBox()).height).toBeGreaterThanOrEqual(40);
    await expect(stack).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('mu-person')).toHaveCount(0);
    await stack.click();
    await expect(stack).toHaveAttribute('aria-expanded', 'true');
    const links = page.getByTestId('mu-person');
    await expect(links).toHaveCount(people.length);
    for (const [i, person] of people.entries()) {
      const link = links.nth(i);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('href', person.url);
      await expect(link).toHaveAttribute('href', person.platform === 'facebook' ? /facebook\.com/ : /instagram\.com/);
      await expect(link).toContainText(personLabel(person)); // @handle on Instagram, the name on Facebook
      expect(person.url).not.toContain('?'); // clean profile links, no tracking parameters
    }
    await stack.click();
    await expect(page.getByTestId('mu-person')).toHaveCount(0);
  });
  test('the paragraph sits right below the tagged people chip, before the place; there is no next-meetup block', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const order = await page.getByTestId('meetup-page').evaluate((el) => {
      const y = (sel) => el.querySelector(sel)?.getBoundingClientRect().top ?? -1;
      return [y('.mu-gallery'), y('.mu-dots'), y('.mu-people'), y('.mu-blurb'), y('[data-testid="mu-place"], .bento')];
    });
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(order.every((n) => n >= 0)).toBe(true);
    await expect(page.getByTestId('mu-next')).toHaveCount(0);
    await expect(page.getByTestId('mu-meta')).toHaveText(`${MEETUP.place.short} · ${MEETUP.date}`);
    await expect(page.getByTestId('mu-meta')).toHaveText('Shyambazar · 17th Oct 2026');
  });
  test('spacing between sheet blocks is on the 4/8 grid', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const gaps = await page
      .getByTestId('meetup-page')
      .evaluate((el) => [parseFloat(getComputedStyle(el).rowGap), parseFloat(getComputedStyle(el.querySelector('.mu-media')).rowGap)]);
    for (const g of gaps) expect(g % 4).toBe(0);
  });
  test('love: one tap fills the heart, it stays after a reload, and tapping again does not add another', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const love = page.getByTestId('mu-love');
    await expect(love).toHaveAttribute('aria-pressed', 'false');
    await expect(love).toHaveAttribute('data-state', 'idle');
    await expect(love).toHaveText(''); // idle: icon only
    expect((await love.boundingBox()).height).toBe(56);
    await love.click();
    await expect(love).toHaveAttribute('data-state', 'clicked'); // darker, icon only, for a moment
    await expect(love).toHaveAttribute('data-state', 'liked'); // then the filled heart
    await expect(love).toHaveAttribute('aria-pressed', 'true');
    await expect(love).toContainText(/\d/); // with the shared total
    const total = await love.innerText();
    await love.click();
    await page.reload();
    await openApp(page);
    await openMeetup(page);
    await expect(page.getByTestId('mu-love')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('mu-love')).toHaveText(total);
  });
  test('love plays one short sound on the first tap only, and the heart is 24 px', async ({ page }) => {
    await page.addInitScript(() => {
      window.__tones = 0;
      const gain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n });
      window.AudioContext = class {
        state = 'running';
        currentTime = 0;
        destination = {};
        resume() {}
        createGain() {
          return gain();
        }
        createOscillator() {
          window.__tones += 1;
          return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n, start() {}, stop() {} };
        }
      };
    });
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const love = page.getByTestId('mu-love');
    const heart = await love.locator('.mu-heart').boundingBox();
    expect(Math.round(heart.width)).toBe(24);
    await love.click();
    await expect(love).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.__tones)).toBeGreaterThan(0);
    await expect(love.locator('.mu-burst i')).toHaveCount(6); // sparks as the heart pops
    const after = await page.evaluate(() => window.__tones);
    await love.click();
    expect(await page.evaluate(() => window.__tones)).toBe(after); // no second sound
  });
  test('in the preview (lab flag) the heart can be tapped again and again, replays each time, and saves nothing', async ({ page }) => {
    await page.addInitScript(() => {
      window.__PD_PIN_LAB__ = true;
      window.__tones = 0;
      const gain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n });
      window.AudioContext = class {
        state = 'running';
        currentTime = 0;
        destination = {};
        resume() {}
        createGain() {
          return gain();
        }
        createOscillator() {
          window.__tones += 1;
          return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n, start() {}, stop() {} };
        }
      };
    });
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const love = page.getByTestId('mu-love');
    await love.click();
    const first = await page.evaluate(() => window.__tones);
    expect(first).toBeGreaterThan(0);
    await love.click();
    expect(await page.evaluate(() => window.__tones)).toBeGreaterThan(first); // plays again
    await page.reload();
    await openApp(page);
    await openMeetup(page);
    await expect(page.getByTestId('mu-love')).toHaveAttribute('aria-pressed', 'false'); // nothing was saved
  });
  for (const width of [320, 390]) {
    test(`love is a round floating button, right aligned above the pinned buttons, at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await openApp(page);
      await openMeetup(page);
      await closeIntro(page);
      const fab = await page.getByTestId('mu-love').boundingBox();
      const join = await page.getByTestId('mu-join').boundingBox();
      expect(Math.round(fab.width)).toBe(56);
      expect(Math.round(fab.height)).toBe(56);
      expect(Math.abs(fab.x + fab.width - (width - 16))).toBeLessThan(2); // rightmost, on the 16 px margin
      expect(fab.y + fab.height).toBeLessThanOrEqual(join.y); // above the buttons
      expect(join.y - (fab.y + fab.height)).toBeLessThan(24);
      expect(await page.getByTestId('mu-love').evaluate((el) => getComputedStyle(el).backdropFilter)).toContain('blur');
    });
  }
  test('love has three looks: light grey outline, darker when clicked, filled pink-red with the number once liked', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const love = page.getByTestId('mu-love');
    const look = () =>
      love.evaluate((el) => {
        const cs = getComputedStyle(el);
        const heart = el.querySelector('.mu-heart');
        return {
          border: cs.borderTopColor,
          color: cs.color,
          fill: heart.getAttribute('fill'),
          num: el.querySelector('.mu-fab-n').textContent,
        };
      });
    const idle = await look();
    expect(idle.border).toBe('rgb(161, 172, 193)'); // #a1acc1
    expect(idle.color).toBe('rgb(87, 94, 102)'); // #575e66
    expect(idle.fill).toBe('none');
    await love.click();
    await expect(love).toHaveAttribute('data-state', 'clicked');
    const clicked = await look();
    expect(clicked.fill).toBe('none');
    expect(clicked.border).not.toBe(idle.border);
    await expect(love).toHaveAttribute('data-state', 'liked');
    await page.waitForTimeout(400);
    const liked = await look();
    expect(liked.fill).toBe('currentColor');
    expect(liked.color).toBe('rgb(255, 61, 110)'); // pink-red
    expect(liked.num).toMatch(/\d/);
  });
  test('the next-meetup button is external and Share opens our sharing sheet with the meetup link', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const join = page.getByTestId('mu-join');
    await expect(join).toHaveText(MEETUP.next.label);
    await expect(join).toHaveText('Join challenge');
    await expect(join).toHaveAttribute('href', 'https://forms.gle/nvK3Cq5SQQDTg5jz6');
    await expect(join).toHaveAttribute('rel', /noopener/);
    await expect(join).toHaveAttribute('target', '_blank');
    await page.getByTestId('meetup-share').click();
    await expect(page.locator('.share-root')).toBeVisible();
    await expect(page.locator('.share-root')).toContainText('Sharing…');
    const href = await page.locator('.share-root a[href*="wa.me"]').getAttribute('href');
    expect(decodeURIComponent(href)).toContain('/api/share?v=meetup&s=wa');
  });
  test('back closes it, a shared link opens it, and a puja pin replaces it', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    await page.goBack();
    await expect(page.getByTestId('meetup-page')).toHaveCount(0);
    await page.goto('/?meetup=1');
    await expect(page.getByTestId('meetup-page')).toBeVisible();
  });
});

// PARKED: the record player is switched off (see MeetupPage.jsx). Remove `.skip` when it is switched back on.
test.describe.skip('the record player', () => {
  const angleOf = (page) => page.locator('.mu-player svg g[transform^="rotate"]').first().getAttribute('transform');
  test('sits under the tagged chips; a tap plays: the record spins, the arm swings on, a second tap pauses', async ({ page }) => {
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const player = page.getByTestId('mu-player');
    await expect(player).toBeVisible();
    const order = await page.getByTestId('meetup-page').evaluate((el) => {
      const y = (sel) => el.querySelector(sel).getBoundingClientRect().top;
      return [y('.mu-people'), y('.mu-player'), y('.mu-blurb')];
    });
    expect([...order].sort((a, b) => a - b)).toEqual(order); // chips, then the player, then the paragraph
    await expect(player).toHaveAttribute('data-playing', 'false');
    const play = page.getByTestId('mu-play');
    await expect(play).toHaveAttribute('aria-label', 'Play the song');
    expect((await play.boundingBox()).height).toBeGreaterThanOrEqual(48);
    const armRest = await player.locator('g[transform^="rotate"]').nth(1).getAttribute('transform');
    await play.click();
    await expect(player).toHaveAttribute('data-playing', 'true');
    await expect(play).toHaveAttribute('aria-label', 'Pause the song');
    const spun = await angleOf(page);
    await page.waitForTimeout(600);
    expect(await angleOf(page)).not.toBe(spun); // the record is turning
    expect(await player.locator('g[transform^="rotate"]').nth(1).getAttribute('transform')).not.toBe(armRest); // the arm has swung on
    await play.click();
    await expect(player).toHaveAttribute('data-playing', 'false');
    await page.waitForTimeout(3600); // spins down
    const stopped = await angleOf(page);
    await page.waitForTimeout(300);
    expect(await angleOf(page)).toBe(stopped);
  });
  test('tapping the record picture also plays; closing the sheet stops the song', async ({ page }) => {
    await page.addInitScript(() => {
      window.__pauses = 0;
      const pause = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause = function () {
        window.__pauses += 1;
        return pause.call(this);
      };
    });
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    await page.getByTestId('mu-deck').click();
    await expect(page.getByTestId('mu-player')).toHaveAttribute('data-playing', 'true');
    const before = await page.evaluate(() => window.__pauses);
    await page.getByRole('button', { name: 'Close highlights' }).click();
    await expect(page.getByTestId('mu-player')).toHaveCount(0);
    expect(await page.evaluate(() => window.__pauses)).toBeGreaterThan(before); // the song was stopped
  });
  test('the player fits at 320 px and the song details are shown', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const box = await page.getByTestId('mu-player').boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    await expect(page.getByTestId('mu-player')).toContainText(MEETUP.song.title);
    await expect(page.getByTestId('mu-player')).toContainText(MEETUP.song.artist);
  });
});

test.describe('the round pin follows the zoom', () => {
  test('small far out, up to 88 px wide close up; the label fades in; one band, no outline on each letter', async ({ page }) => {
    await openApp(page);
    const at = async (zoom) => {
      await page.evaluate(({ lat, lng, zoom }) => window.__pdMap.jumpTo({ center: [lng, lat], zoom }), { ...MEETUP.place, zoom });
      await expect(page.locator('.mu-pin')).toBeVisible();
      const box = await page.locator('.mu-pin').boundingBox();
      const label = await page.locator('.mu-pin .mu-lbl').evaluate((el) => Number(getComputedStyle(el).opacity));
      return { width: box.width, label };
    };
    const far = await at(12);
    const mid = await at(14.5);
    const near = await at(16);
    const closer = await at(18);
    expect(far.width).toBeLessThan(60);
    expect(far.width).toBeLessThan(mid.width);
    expect(mid.width).toBeLessThan(near.width);
    expect(Math.round(near.width)).toBeLessThanOrEqual(88);
    expect(Math.round(closer.width)).toBe(Math.round(near.width)); // stops growing
    expect(far.label).toBe(0); // far out: the photo only
    expect(near.label).toBe(1);
    const look = await page.locator('.mu-pin').evaluate((el) => {
      const text = getComputedStyle(el.querySelector('text'));
      const band = getComputedStyle(el.querySelector('.mu-band'));
      return {
        stroke: text.stroke,
        bandWidth: band.strokeWidth,
        bands: el.querySelectorAll('.mu-band').length,
        d: el.querySelector('.mu-band').getAttribute('d'),
      };
    });
    expect(look.stroke).toBe('none'); // no outline on the letters
    expect(look.bands).toBe(1); // one band for the whole word
    expect(look.d).toContain('A48 48'); // an arc, sized to the word
  });
  test('the tip stays on the spot while zooming', async ({ page }) => {
    await openApp(page);
    const tip = async (zoom) => {
      await page.evaluate(({ lat, lng, zoom }) => window.__pdMap.jumpTo({ center: [lng, lat], zoom }), { ...MEETUP.place, zoom });
      await expect(page.locator('.mu-pin')).toBeVisible();
      const box = await page.locator('.mu-pin').boundingBox();
      const spot = await page.evaluate(({ lat, lng }) => window.__pdMap.project([lng, lat]), MEETUP.place);
      const map = await page.locator('#map, .maplibregl-map').first().boundingBox();
      return { dx: box.x + box.width / 2 - (map.x + spot.x), dy: box.y + box.height - (map.y + spot.y) };
    };
    for (const zoom of [12, 14, 16]) {
      const { dx, dy } = await tip(zoom);
      expect(Math.abs(dx)).toBeLessThan(3);
      expect(Math.abs(dy)).toBeLessThan(3);
    }
  });
});

test.describe('three pin looks', () => {
  for (const style of PIN_STYLES) {
    test(`${style.label} draws and opens`, async ({ page }) => {
      await page.addInitScript((id) => localStorage.setItem('pd_pinStyle2', JSON.stringify(id)), style.id);
      await openApp(page);
      await showPin(page);
      const pin = page.locator('.mu-pin');
      await expect(pin).toHaveClass(new RegExp(`mu-pin-${style.id}`));
      const box = await pin.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await pin.click();
      await expect(page.getByTestId('meetup-page')).toBeVisible();
      await expect(page.locator('.mu-pin')).toHaveClass(/sel/);
    });
  }
  test('the preview switcher changes the look and is remembered', async ({ page }) => {
    await page.addInitScript(() => {
      window.__PD_PIN_LAB__ = true;
    });
    await openApp(page);
    await showPin(page);
    await page.getByRole('button', { name: /^Pin:/ }).click();
    await page.getByRole('radio', { name: /C\. Brand badge/ }).click();
    await expect(page.locator('.mu-pin')).toHaveClass(/mu-pin-c/);
    await page.reload();
    await openApp(page);
    await showPin(page);
    await expect(page.locator('.mu-pin')).toHaveClass(/mu-pin-c/);
  });
  test('without the lab flag the switcher is not there', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.pin-lab')).toHaveCount(0);
  });
});

for (const [w, h] of [
  [320, 640],
  [360, 740],
  [390, 844],
  [430, 932],
]) {
  test(`${w} px: chip row, pin and sheet fit with no sideways page scroll`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openApp(page);
    await openMeetup(page);
    await closeIntro(page);
    const problems = await page.evaluate(() => {
      const out = [];
      if (document.documentElement.scrollWidth > window.innerWidth) out.push('page scrolls sideways');
      const page = document.querySelector('[data-testid=meetup-page]');
      for (const node of page.querySelectorAll('h2, .mu-blurb, .btn, .chip')) {
        const r = node.getBoundingClientRect();
        if (r.right > window.innerWidth + 1) out.push(`${node.className} overflows right`);
      }
      return out;
    });
    expect(problems).toEqual([]);
    const actions = await page.locator('.actions .btn').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(Math.max(...actions) - Math.min(...actions)).toBeLessThan(2); // one row
  });
}

test('dark mode: sheet and chip stay readable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page);
  await openMeetup(page);
  await closeIntro(page);
  const colours = await page
    .getByTestId('meetup-page')
    .evaluate((el) => ({ ink: getComputedStyle(el.querySelector('h2')).color, bg: getComputedStyle(document.body).backgroundColor }));
  expect(colours.ink).not.toBe(colours.bg);
});
