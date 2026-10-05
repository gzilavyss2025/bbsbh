"""Savant game_type codes (D, W, S, E, A), and a stab at minor-league coverage."""
from collections import Counter
from h import *

def count(label, params):
    rows, nbytes, secs, meta, head = savant(params)
    c = Counter(r['game_type'] for r in rows)
    print(f'{label}: rows={len(rows)} bytes={nbytes} secs={secs:.1f} game_types={dict(c)} {meta}')

base = {'player_type': 'pitcher'}
count('hfGT=F  2025-09-30..10-02', {**base, 'hfGT': 'F|', 'game_date_gt': '2025-09-30', 'game_date_lt': '2025-10-02'})
count('hfGT=D  2025-10-04..10-12', {**base, 'hfGT': 'D|', 'game_date_gt': '2025-10-04', 'game_date_lt': '2025-10-12'})
count('hfGT=L  2025-10-12..10-21', {**base, 'hfGT': 'L|', 'game_date_gt': '2025-10-12', 'game_date_lt': '2025-10-21'})
count('hfGT=W  2025-10-24..11-02', {**base, 'hfGT': 'W|', 'game_date_gt': '2025-10-24', 'game_date_lt': '2025-11-02'})
count('hfGT=PO 2025-10-04..10-12', {**base, 'hfGT': 'PO|', 'game_date_gt': '2025-10-04', 'game_date_lt': '2025-10-12'})
count('hfGT=S  2025-03-01..03-02 (spring)', {**base, 'hfGT': 'S|', 'game_date_gt': '2025-03-01', 'game_date_lt': '2025-03-02'})
count('hfGT=E  2025-03-01..03-31 (exhibition)', {**base, 'hfGT': 'E|', 'game_date_gt': '2025-03-01', 'game_date_lt': '2025-03-31'})
count('hfGT=A  2025-07-15 (all-star)', {**base, 'hfGT': 'A|', 'game_date_gt': '2025-07-15', 'game_date_lt': '2025-07-15'})

# Minor leagues: try the documented-looking URL shapes. Unknown; report what comes back.
for label, url in [
    ('minors /statcast-search-minors/csv',
     'https://baseballsavant.mlb.com/statcast-search-minors/csv?all=true&hfLevel=AAA%7C&hfSea=2025%7C&player_type=pitcher&type=details&game_date_gt=2025-06-14&game_date_lt=2025-06-14'),
    ('minors statcast_search/csv?minors=true',
     'https://baseballsavant.mlb.com/statcast_search/csv?all=true&minors=true&hfLevel=AAA%7C&hfSea=2025%7C&player_type=pitcher&type=details&game_date_gt=2025-06-14&game_date_lt=2025-06-14'),
]:
    body, meta, secs, err = curl(url, 90)
    text = body.decode('utf-8-sig', errors='replace')
    rows = list(csv.DictReader(io.StringIO(text))) if text.strip().startswith('"') else []
    print(f'{label}: {meta} rows={len(rows)} first_bytes={text[:120]!r}')
