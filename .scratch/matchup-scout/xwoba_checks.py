"""Small checks for the xwOBA spike (#1411 Part C). Run:  python3 xwoba_checks.py
(1) Does Savant's pitch-result filter hfPR=hit%5C.%5C.into%5C.%5C.play%7C return exactly the hit_into_play rows? Cost per day.
    Compares three days with the unfiltered day cached by xwoba_pull.py. Makes 3 Savant requests, one at a time.
(2) What do woba_value and estimated_woba_using_speedangle hold for a walk, a hit-by-pitch and a strikeout, per season?
"""
import csv, gzip, io, time, urllib.parse
from collections import Counter, defaultdict
from h import SAV, ALLGT, curl
import xw_common as xc

print('== (1) hfPR filter vs unfiltered, same day')
for day in ('2025-06-15', '2026-05-10', '2026-09-20'):
    with gzip.open(f'/tmp/xwoba-cache/{day}.csv.gz', 'rt', encoding='utf-8') as fh:
        raw = fh.read()
    rows = list(csv.DictReader(io.StringIO(raw)))
    want = [r for r in rows if r['description'] == 'hit_into_play']
    params = [('game_date_gt', day), ('game_date_lt', day), ('hfGT', ALLGT), ('player_type', 'pitcher'), ('hfPR', 'hit\\.\\.into\\.\\.play|')]
    body, meta, secs, _ = curl(SAV + urllib.parse.urlencode(params, safe='|'), 240)
    got = list(csv.DictReader(io.StringIO(body.decode('utf-8-sig'))))
    same = Counter((r['game_pk'], r['at_bat_number'], r['pitch_number']) for r in got) == Counter((r['game_pk'], r['at_bat_number'], r['pitch_number']) for r in want)
    print(f'  {day}: unfiltered {len(rows)} rows {len(raw.encode()) / 1e6:.2f} MB (text); filtered {len(got)} rows {len(body) / 1e6:.2f} MB {secs:.1f}s; '
          f'hit_into_play rows in the unfiltered day {len(want)}; same set of pitches: {same}; descriptions in filtered: {dict(Counter(r["description"] for r in got))}')
    time.sleep(1)

print('\n== (2) walk / hit-by-pitch / strikeout values per season (PA-ending rows, woba_denom = 1)')
for year in ('2025', '2026'):
    rows = xc.load(year)
    for ev in ('walk', 'hit_by_pitch', 'strikeout'):
        rs = [r for r in rows if r['events'] == ev and r['woba_denom'] == 1 and r['game_type'] == 'R']
        print(f'  {year} {ev:13s} n={len(rs):6d} woba_value {dict(Counter(r["woba_value"] for r in rs).most_common(3))} '
              f'estimated_woba_using_speedangle {dict(Counter(None if r["estimated_woba_using_speedangle"] is None else round(r["estimated_woba_using_speedangle"], 4) for r in rs).most_common(3))}')
    for ev in ('single', 'double', 'triple', 'home_run', 'field_out'):
        rs = [r for r in rows if r['events'] == ev and r['woba_denom'] == 1 and r['game_type'] == 'R']
        print(f'  {year} {ev:13s} woba_value {dict(Counter(r["woba_value"] for r in rs).most_common(2))}')
