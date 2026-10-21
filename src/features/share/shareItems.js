import { BHASAN, shareCopy, videoId } from '../../data/bhasan.js';

export const SITE = 'https://puja-dekho.vercel.app';

/**
 * What the share sheet shows and sends for one thing. The link is OUR app's link (`/api/share?v=...`): the server
 * answers it with the right picture and title for the preview, then sends the person into the app.
 * @typedef {{ id: string, sheetTitle: string, previewTitle: string, previewSub: string, image: string, message: string }} ShareItem
 */

/** @returns {ShareItem} */
export function videoShare(/** @type {(typeof BHASAN.videos)[number]} */ video) {
  const copy = shareCopy(video.type === 'live' ? 'live' : 'replay');
  return {
    id: videoId(video.url) ?? 'app',
    sheetTitle: 'Sharing…',
    previewTitle: copy.title,
    previewSub: copy.sub,
    image: video.thumb ?? `${SITE}/og/share.jpg`,
    message: copy.message,
  };
}

/** @returns {ShareItem} */
export function ghatShare(ghat = BHASAN.ghat) {
  const copy = shareCopy('ghat', ghat);
  return { id: 'ghat', sheetTitle: 'Sharing…', previewTitle: copy.title, previewSub: copy.sub, image: `${SITE}/og/share.jpg`, message: copy.message };
}

/** The link that goes out. `via` says how it was sent (`wa` or `cp`), so the hidden share-link count can tell. */
export const shareLink = (/** @type {ShareItem} */ item, /** @type {'wa' | 'cp'} */ via) => `${SITE}/api/share?v=${encodeURIComponent(item.id)}&s=${via}`;
export const whatsappLink = (/** @type {ShareItem} */ item) => `https://wa.me/?text=${encodeURIComponent(`${item.message}\n${shareLink(item, 'wa')}`)}`;
