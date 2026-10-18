/**
 * Regular Kolkata Metro timetable, copied from https://kolkatametro.org/schedule/ on 17 Oct 2026.
 * That site says it is independent (not Metro Railway) and that some figures are estimates, so the app
 * always shows this source and date next to the times. Puja-special hours live in public/data/metro.json.
 * To update: change the values and `CHECKED_ON`. Times are 24-hour, in IST.
 */

export const SCHEDULE_SOURCE = Object.freeze({
  name: 'kolkatametro.org (independent site, not Metro Railway)',
  url: 'https://kolkatametro.org/schedule/',
  checkedOn: '17 Oct 2026',
});

/** `null` means no service that day. `freq` is the usual gap between trains. */
export const REGULAR_SCHEDULE = Object.freeze({
  blue: {
    name: 'Blue Line',
    route: 'Dakshineswar to Shahid Khudiram',
    weekday: '06:00 – 22:30',
    saturday: '06:00 – 22:30',
    sunday: '09:00 – 22:30',
    freq: 'About every 8–10 min (estimate)',
  },
  green: {
    name: 'Green Line',
    route: 'Howrah Maidan to Salt Lake Sector V',
    weekday: '06:00 – 22:30',
    saturday: '06:00 – 22:30',
    sunday: '09:00 – 22:30',
    freq: 'Every 6 min at peak',
  },
});

/** Stations that are shut at the moment. They are never offered as "nearest" and cannot be opened. */
export const CLOSED_STATIONS = Object.freeze({
  'kavi-subhas': 'Closed for now, so the Blue Line ends at Shahid Khudiram.',
});

export const HOLIDAY_NOTE = 'On public holidays fewer trains run, with the same first and last times.';
