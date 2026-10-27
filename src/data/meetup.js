
// `new URL(..., import.meta.url)` is resolved by the build (and also works in plain Node, where the tests read this file).
const asset = (/** @type {string} */ name) => new URL(`../features/meetup/assets/${name}`, import.meta.url).href;
const photo1 = asset('meetup-1.jpg');
const photo2 = asset('meetup-2.jpg');
// PARKED (record player): the song and its cover. Un-comment these and `song` below to bring the player back.
// (the sample files are parked in src/features/meetup/parked; move them back into assets/ to use them)
// const songFile = asset('sample-track.mp3');
// const songCover = asset('sample-cover.svg');

/**
 * The Meetup highlights special: one pin on the map, a "What's new" chip, and a sheet with a recap.
 * Everything here is PLACEHOLDER content (sample names, sample date, sample links). Replace it by hand; nothing is fetched.
 *
 * HOW TO UPDATE
 *  - Words:       `headline`, `blurb`, `date`. The line under the headline is the place's `short` name and the `date`.
 *  - Photos:      put the files in src/features/meetup/assets, import them above, list them in `photos` (shown in a 4:3 frame; for portrait photos set `focus`, like '50% 35%', to choose what stays in view).
 *                 `alt` is read out to screen-reader users: describe the photo.
 *  - People:      `people` lists everyone tagged: `{ name, platform: 'instagram' | 'facebook', handle?, url, avatar? }`.
 *                 `url` is their profile link (use the clean profile link, without tracking parameters). Tag people only with their
 *                 permission. `avatar` (optional) is a picture saved in src/features/meetup/assets with their permission; without
 *                 it, or if it fails to load, the circle shows their initials. They are not drawn on the photos.
 *  - Place:       `place.lat` and `place.lng` set where the pin sits. The values below are the Shyambazar five-point crossing
 *                 (approximate): replace them with the real meetup spot.
 *  - Song:        PARKED. The record player is switched off; its `song` is commented out below.
 *  - Next meetup: `next.label` is the pinned button ("Join challenge") and `next.url` where it goes (the Google Form, an external link). Set `next` to null to hide the button.
 *  There is no end date: the pin and chip stay until this file is changed.
 */
export const MEETUP = Object.freeze({
  id: 'meetup-1', // keys the love counter: use a new id for a new meetup so its count starts at zero
  chipLabel: "What's new",
  pinLabel: 'Celebfie', // curved along the top of the round pin
  headline: 'Celebfie with OG bengali creators',
  blurb:
    "Shyambazar, 17th Oct 2026. In the middle of puja season, with the lights up and the crowds out, we stopped for a Celebfie with some of the OG Bengali creators: Tapojit da, Bishal da and Rohit da, the OG singer of 'Dugga ma asche'. Good company, a few easy smiles, and a reminder that the best part of puja is who you run into along the way.",
  date: '17th Oct 2026',
  place: Object.freeze({
    name: 'Shyambazar Five Point Crossing',
    short: 'Shyambazar', // shown under the headline
    area: 'Shyambazar, North Kolkata',
    address: 'Shyambazar, Kolkata 700004',
    lat: 22.6017,
    lng: 88.3738,
  }),
  photos: Object.freeze([
    Object.freeze({
      src: photo2,
      alt: 'Five friends posing together beside a police barricade at the Shyambazar meetup, smiling and one making a peace sign.',
    }),
    Object.freeze({
      src: photo1,
      focus: '50% 35%', // which part stays in the 4:3 frame when the photo is portrait ("x% y%")
      alt: 'Two friends smiling at the camera on the street at Shyambazar, one giving a thumbs up, with a lit-up puja pandal behind them.',
    }),
  ]),
  // Everyone tagged in this meetup, in the order they appear in the chip. `platform` is 'instagram' or 'facebook'.
  people: Object.freeze([
    Object.freeze({ name: 'Tapojit Mitra', platform: 'instagram', handle: 'harry___bol', url: 'https://www.instagram.com/harry___bol' }),
    Object.freeze({ name: 'Bishaljit Sarkar', platform: 'instagram', handle: 'bishal.is.here_', url: 'https://www.instagram.com/bishal.is.here_' }),
    Object.freeze({ name: 'Rohit Infra', platform: 'instagram', handle: 'infra_rs', url: 'https://www.instagram.com/infra_rs' }),
  ]),
  // PARKED: the record player's song. The player is switched off for now (see RecordPlayer.jsx); un-comment to bring it back.
  // The song for the record player. PLACEHOLDER track and cover until the real ones are added.
  // `src` is an audio file saved in src/features/meetup/assets (mp3 or m4a), `cover` the picture on the record's centre label.
  // Set `song` to null to hide the player.
  // song: Object.freeze({
  //   src: songFile,
  //   cover: songCover,
  //   title: 'Sample track',
  //   artist: 'Artist name',
  // }),
  next: Object.freeze({
    label: 'Join challenge',
    url: 'https://forms.gle/nvK3Cq5SQQDTg5jz6',
  }),
});

/** Everyone tagged in the meetup, once each, in order. */
export const taggedPeople = (config = MEETUP) => [...config.people];

/** What a person chip shows and how it is announced: `@handle` on Instagram, the name on Facebook. */
export const personLabel = (person) => (person.platform === 'instagram' && person.handle ? `@${person.handle}` : person.name);
export const personSite = (person) => (person.platform === 'facebook' ? 'Facebook' : 'Instagram');

/** The three pin looks the preview lets you compare. The choice is remembered on the phone. */
export const PIN_STYLES = Object.freeze([
  Object.freeze({ id: 'd', label: 'D. Round photo, curved label', note: 'Big round photo, a small pointer, the label curved over the top' }),
  Object.freeze({ id: 'a', label: 'A. Photo bubble', note: 'Photo in a rounded bubble with a label' }),
  Object.freeze({ id: 'b', label: 'B. Story ring', note: 'Round photo with a glowing ring' }),
  Object.freeze({ id: 'c', label: 'C. Brand badge', note: 'Maroon and orange badge, no photo' }),
]);
export const DEFAULT_PIN_STYLE = 'd';

/** Google Maps link to the place. */
export const meetupDirectionsUrl = (place = MEETUP.place) => `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
