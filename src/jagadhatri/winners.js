/**
 * Jagadhatri Puja 2026 winners, as announced by the Chandernagore Central Jagadhatri Puja Committee on 18 Nov 2026.
 * Names are kept as the committee wrote them. `id` links a winner to a puja in the app; it is set only where the match is
 * certain, so every other winner shows as plain text until Prasun confirms the puja.
 * @typedef {{ en: string, bn: string, id?: string }} Winner
 * @typedef {{ place: 1 | 2 | 3 | 0, joint: boolean, who: Winner }} Placing  place 0 is an unranked winner
 * @typedef {{ id: string, en: string, bn: string, placings: Placing[] }} Award
 */

export const WINNERS_EVENT_ID = 'winners-2026';

/**
 * @param {1 | 2 | 3 | 0} place
 * @param {boolean} joint
 * @param {string} en
 * @param {string} bn
 * @param {string} [id]
 * @returns {Placing}
 */
const p = (place, joint, en, bn, id) => ({ place, joint, who: id ? { en, bn, id } : { en, bn } });

/** @type {readonly Award[]} */
export const AWARDS = Object.freeze([
  {
    id: 'idol-face',
    en: 'Idol’s Face',
    bn: 'প্রতিমার মুখশ্রী',
    placings: [
      p(1, false, 'Palpara', 'পালপাড়া', 'palpara-jagadhatri-puja-committee'),
      p(2, true, 'Fatakgora', 'ফটকগোড়া', 'fatakgora-sarbojonin'),
      p(2, true, 'Lalbagan', 'লালবাগান'),
      p(3, true, 'Bhadreswar Nimtala', 'ভদ্রেশ্বর নিমতলা'),
      p(3, true, 'Haritakitola', 'হরিতকিতলা', 'haritakitala'),
    ],
  },
  {
    id: 'idol-decoration',
    en: 'Idol’s Decoration & Attire',
    bn: 'প্রতিমার সাজসজ্জা',
    placings: [
      p(1, false, 'Borotaldanga', 'বোড় তালডাঙ্গা', 'boro-taldanga'),
      p(2, true, 'Bagbazar Choumatha', 'বাগবাজার চৌমাথা', 'bagbazar-choumatha'),
      p(2, true, 'Barasat Banerjeepara', 'বারাসাত ব্যানার্জীপাড়া'),
      p(3, true, 'Kundughat Dalan', 'কুন্ডুঘাট দালান', 'kundughat-dalan'),
      p(3, true, 'Narua Sarkarpara', 'নাড়ুয়া সরকারপাড়া'),
    ],
  },
  {
    id: 'pandal-decoration',
    en: 'Pandal Decoration',
    bn: 'মণ্ডপসজ্জা',
    placings: [
      p(1, false, 'Mankundu', 'মানকুণ্ডু'),
      p(2, true, 'Niyogibagan', 'নিয়োগীবাগান'),
      p(2, true, 'Ambika', 'অম্বিকা', 'ambika-athletic-club'),
      p(3, true, 'Circus Math', 'সার্কাস মাঠ'),
      p(3, true, 'Urdibazar', 'উর্দিবাজার'),
    ],
  },
  {
    id: 'ambience-theme',
    en: 'Ambience & Theme',
    bn: 'পরিবেশ ও ভাবনা',
    placings: [
      p(1, false, 'Satghat', 'সাতঘাট', 'satghata-jagadhatri-puja'),
      p(2, true, 'Adi Haldarpara', 'আদি হালদারপাড়া', 'adi-haldarpara-burima'),
      p(2, true, 'Uttaranchal', 'উত্তরাঞ্চল', 'uttaranchal-santan-sangha'),
      p(3, true, 'Dinemardanga Talpukurdhar', 'দিনেমারডাঙ্গা তালপুকুরধার', 'dinemardanga-talpukurdhar'),
      p(3, true, 'Gondalpara Kacharighat', 'গোঁদলপাড়া কাছারিঘাট'),
    ],
  },
  {
    id: 'street-lighting',
    en: 'Street Lighting',
    bn: 'পথ আলোকসজ্জা',
    placings: [
      p(1, false, 'Kalupukur', 'কলুপুকুর'),
      p(2, true, 'Vidyalankar', 'বিদ্যালঙ্কার'),
      p(2, true, 'Barabazar', 'বড়বাজার', 'barabazar-sarbojonin'),
      p(3, true, 'Kayedbeltala Balak Sangha', 'কয়েদবেলতলা বালক সংঘ'),
      p(3, true, 'Madhyanchal', 'মধ্যাঞ্চল'),
    ],
  },
  {
    id: 'presentation',
    en: 'Attractive Presentation',
    bn: 'আকর্ষণীয় উপস্থাপনা',
    placings: [
      p(0, false, 'Bowbazar Shitalatala', 'বৌবাজার শীতলাতলা'),
      p(0, false, 'Khalisani Kalpukurdhar', 'খলিসানী কলপুকুরধার'),
      p(0, false, 'Natunpara', 'নতুনপাড়া'),
    ],
  },
]);

const ORD = ['', '1st', '2nd', '3rd'];

/**
 * "1st", "Joint 2nd", or "Winner" for an unranked award.
 * @param {Placing} pl
 */
export function placeLabel(pl) {
  if (pl.place === 0) return 'Winner';
  return `${pl.joint ? 'Joint ' : ''}${ORD[pl.place]}`;
}

/**
 * Every award a puja won, in the committee's order, for its details sheet.
 * @param {string} pujaId
 * @returns {{ award: Award, label: string }[]}
 */
export function awardsOf(pujaId) {
  /** @type {{ award: Award, label: string }[]} */
  const out = [];
  for (const award of AWARDS) {
    for (const pl of award.placings) if (pl.who.id === pujaId) out.push({ award, label: placeLabel(pl) });
  }
  return out;
}
