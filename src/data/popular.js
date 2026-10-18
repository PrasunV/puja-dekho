/**
 * The Popular pujas strip: hand-picked, shown in this order, at most 10.
 *
 * PLACEHOLDER: these are the pujas the dataset marks as featured. Replace with your own picks
 * by listing puja ids (the `id` field in public/data/pujas.json). Pujas outside the chosen
 * radius are hidden; if none are left the whole strip hides.
 *
 * Set to an empty array to switch the strip off.
 * @type {string[]}
 */
export const POPULAR_IDS = [
  'S007',
  'S022',
  'S026',
  'S035',
  'S058',
  'S080',
  'S089',
  'S099',
  'S105',
  'S119',
];

/** Strip length limit from the PRD. */
export const POPULAR_MAX = 10;
