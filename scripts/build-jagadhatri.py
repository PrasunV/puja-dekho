"""Build the Jagadhatri Puja data file: public/jagadhatripuja/data/pujas.json.

Input: data-src/jagadhatri/Jagadhatri_Puja_List.xlsx
    Sheet "Pujas"         one row per puja (the sheet you edit)
    Sheet "Entry points"  the 7 stations and ghats with their coordinates

Run from the project root (needs openpyxl once: pip install openpyxl):
    python scripts/build-jagadhatri.py

If something is wrong, the script names the row and the problem, writes nothing, and exits with an error.
Warnings (such as a missing year) are printed but do not stop the build.

Rules the script enforces:
- Every puja has an id. Ids are lower-case words joined by dashes and never change once the app is live,
  even when a puja is renamed: saved pujas, visits and crowd reports point at the id. For a new puja, the
  script suggests an id; paste it into the id column.
- Name, town, category, popular, procession, latitude, longitude and Bengali name are filled.
- Coordinates fall inside Chandannagar, Mankundu and Bhadreswar.
- No two pujas share an id, a name or a procession serial number.
- A puja going for procession has a zone and a serial number.
"""
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit('openpyxl is missing. Install it once with:  pip install openpyxl')

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'data-src' / 'jagadhatri' / 'Jagadhatri_Puja_List.xlsx'
OUT = ROOT / 'public' / 'jagadhatripuja' / 'data' / 'pujas.json'

TOWNS = {'Chandannagar', 'Mankundu', 'Bhadreswar'}
CATEGORIES = {'Adi Puja', 'Jubilee', 'Pre-Jubilee', 'Other'}
ZONES = {'A', 'B', 'C', 'D'}
# A box around the three towns with a little room (about 1 km) on each side.
BOX = {'lat': (22.80, 22.90), 'lng': (88.32, 88.40)}
ID_RE = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
YES = {'yes', 'y', 'true', '1'}
NO = {'no', 'n', 'false', '0', ''}


def haversine(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')


def clean(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = re.sub(r'\s+', ' ', value).strip()
        return value or None
    return value


def rows_of(ws):
    rows = list(ws.iter_rows(values_only=True))
    header = [clean(h) for h in rows[0]]
    for number, row in enumerate(rows[1:], start=2):
        if any(clean(v) is not None for v in row):
            yield number, dict(zip(header, (clean(v) for v in row)))


def as_int(value):
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 'bad'


def main():
    if not SHEET.exists():
        sys.exit(f'Sheet not found: {SHEET}')
    wb = openpyxl.load_workbook(SHEET, data_only=True)
    errors, warnings = [], []

    # Entry points.
    stations = []
    for n, r in rows_of(wb['Entry points']):
        try:
            lat, lng = float(r['Latitude']), float(r['Longitude'])
        except (TypeError, ValueError):
            errors.append(f'Entry points row {n}: latitude or longitude is not a number')
            continue
        if r['Kind'] not in ('station', 'ghat'):
            errors.append(f'Entry points row {n}: Kind must be "station" or "ghat"')
        stations.append({'id': r['id'], 'name': r['Short name'], 'sheet': r['Name in Pujas sheet'], 'kind': r['Kind'], 'la': lat, 'lo': lng})
    by_sheet_name = {s['sheet']: s for s in stations}

    # Pujas.
    ws = wb['Pujas']
    required = ['id', 'Puja Name', 'Town', 'Category', 'Popular', 'Going for Procession', 'Latitude', 'Longitude', 'Bengali Name']
    header = [clean(c.value) for c in ws[1]]
    missing_cols = [c for c in required if c not in header]
    if missing_cols:
        sys.exit('Missing columns in the Pujas sheet: ' + ', '.join(missing_cols))

    pujas, ids, names, serials = [], {}, {}, {}
    for n, r in rows_of(ws):
        name = r['Puja Name']
        where = f'Row {n} ({name or "no name"})'
        pid = r['id']
        if not name:
            errors.append(f'{where}: Puja Name is empty')
            continue
        if not pid:
            errors.append(f'{where}: id is empty. Suggested id: {slug(name)}')
        elif not ID_RE.match(str(pid)):
            errors.append(f'{where}: id "{pid}" must be lower-case letters, numbers and dashes. Suggested: {slug(str(pid))}')
        elif pid in ids:
            errors.append(f'{where}: id "{pid}" is already used in row {ids[pid]}')
        else:
            ids[pid] = n
        key = name.lower()
        if key in names:
            errors.append(f'{where}: the same name is already in row {names[key]}')
        names[key] = n
        for field in required[2:]:
            if r.get(field) in (None, ''):
                errors.append(f'{where}: {field} is empty')
        if r['Town'] and r['Town'] not in TOWNS:
            errors.append(f'{where}: Town "{r["Town"]}" must be one of {", ".join(sorted(TOWNS))}')
        if r['Category'] and r['Category'] not in CATEGORIES:
            errors.append(f'{where}: Category "{r["Category"]}" must be one of {", ".join(sorted(CATEGORIES))}')
        flags = {}
        for field in ('Popular', 'Going for Procession'):
            v = str(r.get(field) or '').lower()
            if v not in YES | NO:
                errors.append(f'{where}: {field} must be Yes or No')
            flags[field] = v in YES
        try:
            lat, lng = float(r['Latitude']), float(r['Longitude'])
        except (TypeError, ValueError):
            errors.append(f'{where}: latitude or longitude is not a number')
            continue
        if not (BOX['lat'][0] <= lat <= BOX['lat'][1] and BOX['lng'][0] <= lng <= BOX['lng'][1]):
            errors.append(f'{where}: {lat}, {lng} is outside the three towns. Are latitude and longitude swapped?')

        year = as_int(r.get('Estd Year'))
        if year == 'bad' or (isinstance(year, int) and not 1700 <= year <= 2026):
            errors.append(f'{where}: Estd Year "{r.get("Estd Year")}" is not a year')
            year = None
        if year is None:
            warnings.append(f'{where}: no Estd Year')

        procession = None
        if flags['Going for Procession']:
            zone, serial = r.get('Procession Zone'), as_int(r.get('Procession Serial No.'))
            if zone not in ZONES:
                errors.append(f'{where}: going for procession but Procession Zone is "{zone}" (A, B, C or D)')
            if not isinstance(serial, int):
                errors.append(f'{where}: going for procession but Procession Serial No. is empty or not a number')
            elif serial in serials:
                errors.append(f'{where}: Procession Serial No. {serial} is already used in row {serials[serial]}')
            else:
                serials[serial] = n
            trucks = as_int(r.get('Trucks Allotted'))
            procession = {'z': zone, 's': serial, 'tr': trucks if isinstance(trucks, int) else None}

        # Every station and ghat, nearest first, straight-line metres.
        dist = sorted(((s['id'], round(haversine(lat, lng, s['la'], s['lo']))) for s in stations), key=lambda x: x[1])
        sheet_station = str(r.get('Closest Station / Ferry Ghat') or '').split(',')[0].strip()
        if sheet_station and sheet_station in by_sheet_name and by_sheet_name[sheet_station]['id'] != dist[0][0]:
            warnings.append(f'{where}: sheet says closest is {sheet_station}, the map says {dist[0][0]}')

        address = r.get('Address')
        if address:
            # Google plus codes (V9GC+CRP) and the country add nothing for a visitor.
            address = re.sub(r'^[23456789CFGHJMPQRVWX]{4}\+[23456789CFGHJMPQRVWX]{2,3},\s*', '', address)
            address = re.sub(r',\s*India$', '', address)
            if address.endswith(('…', '...')):
                warnings.append(f'{where}: Address is cut short in the sheet ("{address}"); it is hidden until fixed')
                address = None
        ccjpc = as_int(r.get('CCJPC No.'))
        puja = {
            'id': pid,
            'n': name,
            'bn': r.get('Bengali Name'),
            't': r['Town'],
            'c': r['Category'],
            'j': r.get('Jubilee Name'),
            'y': year,
            'cc': ccjpc if isinstance(ccjpc, int) else None,
            'pop': flags['Popular'],
            'pr': procession,
            'la': round(lat, 6),
            'lo': round(lng, 6),
            'st': dist[0],
            'ad': address,
            'ps': r.get('P.S.'),
            'th': r.get('Puja Theme'),
            'ar': r.get('Artist'),
        }
        pujas.append({k: v for k, v in puja.items() if v is not None})

    for w in warnings:
        print('warning:', w)
    if errors:
        print()
        for e in errors:
            print('ERROR:', e)
        sys.exit(f'\n{len(errors)} problem(s) found. Nothing was written. Fix the sheet and run again.')

    data = {
        'v': 1,
        'pujas': pujas,
        'stations': [{k: s[k] for k in ('id', 'name', 'kind', 'la', 'lo')} for s in stations],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    towns = {t: sum(1 for p in pujas if p['t'] == t) for t in sorted(TOWNS)}
    print(f'\nWrote {OUT.relative_to(ROOT)}: {len(pujas)} pujas ({towns}), {len(stations)} stations and ghats, {len(warnings)} warning(s).')


if __name__ == '__main__':
    main()
