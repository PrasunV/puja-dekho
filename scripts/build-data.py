"""Build the two data files the app loads: public/data/pujas.json and public/data/metro.json.

Inputs (data-src/):
    map_all_pins.json            Every pin exported from the source map (metro stations are the "Metro" folder).
    south_kolkata_pujas.json     The curated South Kolkata list with addresses, flags and founding years. It wins
                                 over the pin export wherever both describe the same puja.
    metro_timings_2026.json      Puja-time metro hours and the sources they came from.

Run from the project root:
    python3 scripts/build-data.py

The app reads short keys to keep the files small. See src/lib/types.js for what each key means.
"""
import json
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data-src'
OUT = ROOT / 'public' / 'data'

# Calendar of metro puja-time schedules (IST dates, inclusive). Saptami's date is not confirmed by
# the sources, so 17 Oct is its own "uncertain" phase. Edit here when dates are confirmed.
METRO_PHASES = [
    {'id': 'ps', 'label': 'Panchami / Shashthi', 'from': '2026-10-15', 'to': '2026-10-16'},
    {'id': 'uncertain', 'label': 'Shashthi or Saptami (date unconfirmed)', 'from': '2026-10-17', 'to': '2026-10-17'},
    {'id': 'sn', 'label': 'Saptami to Navami', 'from': '2026-10-18', 'to': '2026-10-20'},
    {'id': 'd', 'label': 'Dashami', 'from': '2026-10-21', 'to': '2026-10-21'},
]

# Station names in the source map that differ from the official spelling.
STATION_RENAMES = {
    'Kali ghat Metro Station': 'Kalighat',
    'Chadni Chowk': 'Chandni Chowk',
    'Sovabazar': 'Shobhabazar Sutanuti',
    'Jai Hind - Bimanbandar': 'Jai Hind Bimanbandar',
}
BLUE = {'Dakshineswar', 'Noapara', 'Dum Dum', 'Belgachia', 'Shyambazar', 'Shobhabazar Sutanuti', 'Girish Park',
        'Mahatma Gandhi Road', 'Central', 'Chandni Chowk', 'Esplanade', 'Park Street', 'Maidan', 'Rabindra Sadan',
        'Netaji Bhawan', 'Jatin Das Park', 'Kalighat', 'Rabindra Sarovar', 'Mahanayak Uttam Kumar', 'Netaji',
        'Masterda Surya Sen', 'Gitanjali', 'Kavi Nazrul', 'Shahid Khudiram', 'Kavi Subhas'}
GREEN = {'Howrah Maidan', 'Howrah', 'Mahakaran', 'Esplanade', 'Sealdah', 'Phoolbagan', 'Bengal Chemical',
         'City Centre', 'Central Park', 'Karunamayee', 'Salt Lake Sector V'}
YELLOW = {'Jai Hind Bimanbandar', 'Noapara', 'Dum Dum'}

# Neighbourhood names that recur in the source addresses. Addresses list the local name first, so the
# first token that matches wins. A puja with no match takes the area of its nearest matched puja within
# AREA_FALLBACK_M, otherwise "Other".
AREAS = [
    ('Rajpur Sonarpur', r'rajpur sonarpur'), ('Jodhpur Park', r'jodhpur park'), ('New Alipore', r'new alipore'),
    ('Kalighat', r'kalighat'), ('Behala', r'behala'), ('Bhowanipore', r'bhowanipore|bhawanipore'),
    ('Kidderpore', r'kidderpore|andaman dock'), ('Putiary', r'putiary'), ('Ballygunge', r'ballygunge|ballygunj'),
    ('Santoshpur', r'santoshpur'), ('Garia', r'\bgaria\b'), ('Dhakuria', r'dhakuria'), ('Barisha', r'barisha'),
    ('Haltu', r'haltu'), ('Naktala', r'naktala'), ('Haridevpur', r'haridevpur'), ('Tollygunge', r'tollygunge'),
    ('Jadavpur', r'jadavpur'), ('Purbachal', r'purbachal'), ('Alipore', r'\balipore\b'), ('Kasba', r'kasba'),
    ('Narendrapur', r'narendrapur'), ('Maheshtala', r'maheshtala'), ('Baruipur', r'baruipur'),
    ('Bansdroni', r'bansdroni'), ('Baghajatin', r'baghajatin'), ('Patuli', r'patuli'), ('Tiljala', r'tiljala'),
    ('Newtown', r'newtown|action area'), ('Boral', r'\bboral\b'), ('Chetla', r'chetla'),
    ('Batanagar', r'batanagar'), ('Golpark', r'golpark|gol park'), ('Gariahat', r'gariahat'),
    ('Lake Gardens', r'lake gardens'), ('Sarsuna', r'sarsuna'), ('Thakurpukur', r'thakurpukur'),
    ('Mominpore', r'mominpore'), ('Watgunge', r'watgunge'),
]
AREA_FALLBACK_M = 1500
ZONE_LABEL = {'south': 'South Kolkata', 'north': 'North Kolkata', 'central': 'Central Kolkata', 'east': 'East Kolkata', 'other': 'Other'}
# Pujas farther than this from every station are flagged elsewhere; the flag is not shown per puja.
HIDDEN_FLAGS = {'metro_far_over_1500m'}


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def haversine(lat1, lng1, lat2, lng2):
    """Straight-line distance in metres."""
    radius, rad = 6371000, math.pi / 180
    a = math.sin((lat2 - lat1) * rad / 2) ** 2 + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin((lng2 - lng1) * rad / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def load(name):
    with open(SRC / name, encoding='utf-8') as handle:
        return json.load(handle)


def write(name, payload):
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / name, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(',', ':'))


def build_stations(pins):
    """Metro stations with the lines that serve them."""
    stations = []
    for pin in pins:
        if pin['folder'] != 'Metro':
            continue
        name = STATION_RENAMES.get(pin['name'], pin['name'])
        lines = [line for line, members in (('blue', BLUE), ('green', GREEN), ('yellow', YELLOW)) if name in members]
        if name == 'Kavi Subhas':
            lines.append('orange')
        stations.append({'id': slug(name), 'name': name, 'lat': pin['lat'], 'lng': pin['lng'], 'lines': lines})
    unmapped = [s['name'] for s in stations if not s['lines']]
    assert not unmapped, f'stations with no line: {unmapped}'
    return stations


def build_metro(stations):
    timings = load('metro_timings_2026.json')
    return {
        'stations': stations,
        'timings': timings['puja_2026_windows'],
        'phases': METRO_PHASES,
        'dates': timings['sourced_dates'],
        'sources': timings['sources'],
        'note': timings['note'],
    }


def area_of(address):
    for token in address.lower().split(','):
        for name, pattern in AREAS:
            if re.search(pattern, token):
                return name
    return None


# Zone chips. The pin export files each puja under a map folder (or a leading "North · " tag in the bulk folder).
FOLDER_ZONE = {'South Kolkata': 'south', 'North Kolkata': 'north', 'Central Kolkata': 'central', 'East Kolkata': 'east',
               'Howrah': 'other', 'Others': 'other'}
TAG_ZONE = {'South': 'south', 'North': 'north', 'East': 'east', 'Central': 'central', 'Howrah': 'other', 'Outside Kolkata': 'other'}
BULK_FOLDER = 'Durga Puja ~ Kolkata & Howrah'
ZONE_PREFIX = {'south': 'S', 'north': 'N', 'central': 'C', 'east': 'E', 'other': 'O'}
SAME_SPOT_M = 25
SAME_NAME_M = 800
CITY_WORDS = re.compile(r'^(kolkata|calcutta|howrah|west bengal|india|\d{6})$|^kolkata\s*\d{6}$|^(howrah|kolkata),?\s*(west bengal\s*)?\d{6}$')


def name_key(text):
    return re.sub(r'[^a-z0-9]', '', re.sub(r'\(.*?\)', '', text.lower()))


def clean_desc(desc):
    """Pull founding year, heritage, featured and the address out of a pin description."""
    text = re.sub(r'https?://\S+', '', desc.split('<br>')[0]).strip()
    year = re.search(r'Established (\d{4})', text)
    text = re.sub(r'^[A-Za-z ]+ · ', '', text)
    text = re.sub(r'durgapujakolkata\.in', '', text)
    text = re.sub(r'Established \d{4}', '', text)
    heritage = 'Heritage' in text
    featured = 'Featured' in text
    text = re.sub(r'Featured', '', text)
    text = re.sub(r'Heritage, more than \d+ years', '', text)
    address = re.sub(r'\s+', ' ', text).strip(' ,.')
    return {'est': int(year.group(1)) if year else None, 'heritage': heritage, 'featured': featured,
            'address': address if address and not address.startswith('From your') else ''}


def neighbourhood(address):
    """Local name for a puja outside the curated list: the last meaningful token before the city."""
    parts = [t.strip() for t in address.split(',') if t.strip()]
    parts = [t for t in parts if not CITY_WORDS.match(t.lower())]
    parts = [t for t in parts if not re.search(r'\bffd member\b|\d{6}$', t.lower())]
    for token in reversed(parts):
        junk = re.search(r'committee|sarbojanin|sarbajanin|durgotsab|block|\brd\b|road|\bst\b|street|\bso\b|club|sangha|samity', token.lower())
        if not junk and not re.search(r'\d', token) and len(token) > 2:
            return token.title() if token.isupper() else token
    return None


def merge_pins(curated, pins):
    """Whole-Kolkata list: the curated South records first, then every other pin that is not a duplicate."""
    records = [dict(r, zone='south') for r in curated]
    ordered = [p for p in pins if p['folder'] in FOLDER_ZONE] + [p for p in pins if p['folder'] == BULK_FOLDER]
    unplaced = []
    for pin in ordered:
        spot = None
        for r in records:
            d = haversine(pin['lat'], pin['lng'], r['lat'], r['lng'])
            if d < SAME_SPOT_M or (d < SAME_NAME_M and name_key(pin['name']) == name_key(r['name'])):
                spot = r
                break
        if spot:
            continue
        zone = FOLDER_ZONE.get(pin['folder']) or TAG_ZONE.get(pin['desc'].split(' · ')[0])
        info = clean_desc(pin['desc'])
        record = {'name': pin['name'], 'lat': pin['lat'], 'lng': pin['lng'], 'est': info['est'],
                  'heritage': info['heritage'], 'featured': info['featured'], 'address': info['address'],
                  'aliases': [], 'est_conflict': '', 'flags': [], 'zone': zone, 'fresh': True}
        (records if zone else unplaced).append(record)
    # A pin with no zone tag joins the zone of its nearest tagged puja.
    for record in unplaced:
        nearest = min(records, key=lambda r: haversine(record['lat'], record['lng'], r['lat'], r['lng']))
        record['zone'] = nearest['zone']
        records.append(record)
    counters = Counter()
    for record in records:
        if 'id' not in record:
            prefix = ZONE_PREFIX[record['zone']]
            counters[prefix] += 1
            record['id'] = f'{prefix}{counters[prefix] + (271 if prefix == "S" else 0):03d}'
    return records


def build_pujas(records, stations):
    """Puja list in the compact shape the app uses, with nearest stations and an area for each."""
    pujas = []
    for record in records:
        nearest = sorted((haversine(record['lat'], record['lng'], s['lat'], s['lng']), s['id']) for s in stations)[:2]
        pujas.append({
            'id': record['id'], 'n': record['name'], 'a': record['aliases'],
            'la': round(record['lat'], 6), 'lo': round(record['lng'], 6), 'ad': record['address'],
            'e': record['est'], 'h': bool(record['heritage']), 'f': bool(record['featured']),
            'ec': record['est_conflict'] or None,
            'm': [[station_id, round(distance)] for distance, station_id in nearest],
            'fl': [flag for flag in record['flags'] if flag not in HIDDEN_FLAGS],
            'ck': 'stacked_pin_wrong_coords' not in record['flags'],
            'ar': area_of(record['address']) or (neighbourhood(record['address']) if record.get('fresh') else None),
            'z': record['zone'],
        })
    matched = [p for p in pujas if p['ar']]
    for puja in pujas:
        if puja['ar']:
            continue
        closest = min(matched, key=lambda m: haversine(puja['la'], puja['lo'], m['la'], m['lo']), default=None)
        within = closest and haversine(puja['la'], puja['lo'], closest['la'], closest['lo']) <= AREA_FALLBACK_M
        puja['ar'] = closest['ar'] if within else ZONE_LABEL[puja['z']]
    return pujas


def main():
    stations = build_stations(load('map_all_pins.json'))
    write('metro.json', build_metro(stations))
    pujas = build_pujas(merge_pins(load('south_kolkata_pujas.json'), load('map_all_pins.json')), stations)
    write('pujas.json', pujas)
    print(len(pujas), 'pujas,', len(stations), 'stations')
    print('zones', Counter(p['z'] for p in pujas).most_common())
    print('areas', Counter(p['ar'] for p in pujas).most_common(25))
    print('lines', Counter(line for s in stations for line in s['lines']))


if __name__ == '__main__':
    main()
