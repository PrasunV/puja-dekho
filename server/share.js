import { BHASAN, shareCopy, videoId } from '../src/data/bhasan.js';

const DEFAULT_SITE = 'https://puja-dekho.vercel.app';
const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** What the link preview should show for `?v=`: a video's own picture and title, the ghat, or the plain app. */
export function shareCard(/** @type {string | null} */ id, site = DEFAULT_SITE) {
  const video = id && id !== 'ghat' ? BHASAN.videos.find((v) => videoId(v.url) === id) : null;
  if (video) {
    const copy = shareCopy(video.type === 'live' ? 'live' : 'replay');
    return { title: copy.title, description: `${copy.message}. On Puja Dekho.`, image: video.thumb ?? `${site}/og/share.jpg` };
  }
  if (id === 'ghat') {
    const copy = shareCopy('ghat');
    return { title: copy.title, description: `${copy.message}. Find ghats near you on Puja Dekho.`, image: `${site}/og/share.jpg` };
  }
  if (id === 'meetup') {
    return { title: 'See our Puja Dekho meetup', description: 'Look at the highlights from our Puja Dekho meetup. On Puja Dekho.', image: `${site}/og/share.jpg` };
  }
  return { title: 'Puja Dekho', description: "Shubho Bijoya! Explore Kolkata's Durga Puja pandals on one simple map.", image: `${site}/og/share.jpg` };
}

/**
 * The address people share: /api/share?v=<video id | ghat>&s=<wa | cp>. Chat apps read its title and picture for the preview
 * (they do not run scripts); a person who taps it is sent straight on into the app, carrying the `s` tag for the hidden count.
 * @param {{ env?: Record<string, string | undefined> }} [options]
 */
export function createShareHandler({ env = process.env } = {}) {
  const site = (env.SITE_URL || DEFAULT_SITE).replace(/\/$/, '');
  return function share(req, res) {
    const query = new URL(req.url || '/', 'http://x').searchParams;
    const id = /^[A-Za-z0-9_-]{1,20}$/.test(query.get('v') ?? '') ? query.get('v') : null;
    const tag = /^[a-z0-9_-]{1,20}$/i.test(query.get('s') ?? '') ? query.get('s').toLowerCase() : 'link';
    const card = shareCard(id, site);
    const self = `${site}/api/share?v=${encodeURIComponent(id ?? '')}&s=${tag}`;
    const target = id === 'meetup' ? `/?s=${tag}&meetup=1` : `/?s=${tag}`;
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(card.title)}</title>
<meta name="description" content="${esc(card.description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Puja Dekho" />
<meta property="og:title" content="${esc(card.title)}" />
<meta property="og:description" content="${esc(card.description)}" />
<meta property="og:url" content="${esc(self)}" />
<meta property="og:image" content="${esc(card.image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(card.title)}" />
<meta name="twitter:description" content="${esc(card.description)}" />
<meta name="twitter:image" content="${esc(card.image)}" />
<meta http-equiv="refresh" content="0;url=${esc(target)}" />
</head><body><p><a href="${esc(target)}">Open Puja Dekho</a></p><script>location.replace(${JSON.stringify(target)});</script></body></html>`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.end(html);
  };
}
