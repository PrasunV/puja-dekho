// Renders public/jagadhatripuja/share-card.jpg (1200 x 630): the picture in the Share with friends sheet and the file
// the phone's share menu attaches. Same family as og.jpg: maroon field, orange glow, pins.
// Run: node scripts/make-share-card.mjs   (needs Playwright with Chromium, which is a dev tool and not a dependency)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const font = readFileSync(
  `${root}node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2`,
).toString('base64');
const icon = readFileSync(`${root}public/jagadhatripuja/icon.svg`).toString('base64');
const pujas = JSON.parse(readFileSync(`${root}public/jagadhatripuja/data/pujas.json`, 'utf8'));
const count = Array.isArray(pujas) ? pujas.length : (pujas.pujas?.length ?? 207);

// Pins: a fixed seed, so the card is the same every time it is made.
let s = 7;
const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const pins = Array.from({ length: 46 }, () => {
  const x = 700 + rnd() * 460;
  const y = 40 + rnd() * 550;
  const r = 5 + rnd() * 9;
  return `<span class="pin" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${(r * 2).toFixed(0)}px;height:${(r * 2).toFixed(0)}px"></span>`;
}).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:J;src:url(data:font/woff2;base64,${font});font-weight:200 800}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;font-family:J,system-ui,sans-serif;color:#fff;position:relative;overflow:hidden;
 background:radial-gradient(circle at 900px 250px,#fc8105 0,#a8420c 130px,#6b1219 330px,#4a0e14 560px)}
.pin{position:absolute;border-radius:50%;background:#b31d24;border:2px solid rgba(255,255,255,.65);box-shadow:0 0 0 5px rgba(179,29,36,.35)}
.pin::after{content:"";position:absolute;inset:32%;border-radius:50%;background:#fff}
.logo{position:absolute;left:80px;top:72px;display:flex;align-items:center;gap:16px;font-size:30px;font-weight:700}
.logo i{width:70px;height:56px;border-radius:14px;background:#fff url(data:image/svg+xml;base64,${icon}) center/44px no-repeat}
h1{position:absolute;left:80px;top:176px;width:640px;font-size:96px;line-height:100px;font-weight:700;letter-spacing:-1px}
h1 b{color:#ffb566;font-weight:700}
p{position:absolute;left:80px;top:410px;width:560px;font-size:32px;line-height:44px;font-weight:500}
.url{position:absolute;left:80px;top:540px;font-size:28px;font-weight:600;color:#ffb566}
</style><body>${pins}
<div class="logo"><i></i>Puja Dekho</div>
<h1>Jagadhatri <b>Puja’26</b></h1>
<p>${count} pujas, crowd reports and route plans on one map</p>
<div class="url">puja-dekho.vercel.app/jagadhatripuja</div></body>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
writeFileSync(`${root}public/jagadhatripuja/share-card.jpg`, await page.screenshot({ type: 'jpeg', quality: 88 }));
await browser.close();
console.log('share-card.jpg written');
