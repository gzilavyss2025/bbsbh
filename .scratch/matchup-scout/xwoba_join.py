"""Can the sweep join Savant's per-ball estimate to a feed pitch WITHOUT coordinates? (#1411 Part C, option B variant)
Join key tried: (game_pk, at_bat_number = atBatIndex + 1, pitch_number = 1-based count of isPitch events in the plate appearance).
Checks, for balls in play: the joined Savant row has the same launch speed and launch angle as the feed's hitData, and an estimate.
Uses the cached Savant day file (no Savant request) and statsapi (live feed). Run:  python3 xwoba_join.py [yyyy-mm-dd]
"""
import csv, gzip, io, sys
from collections import Counter
from h import jget

day = sys.argv[1] if len(sys.argv) > 1 else '2026-09-20'
with gzip.open(f'/tmp/xwoba-cache/{day}.csv.gz', 'rt', encoding='utf-8') as fh:
    rows = list(csv.DictReader(fh))
by = {(int(r['game_pk']), int(r['at_bat_number']), int(r['pitch_number'])): r for r in rows}
games = sorted({int(r['game_pk']) for r in rows})
tot = Counter()
for pk in games[:6]:
    feed = jget(f'/api/v1.1/game/{pk}/feed/live')
    for play in feed['liveData']['plays']['allPlays']:
        n = 0
        for e in play.get('playEvents', []):
            if not e.get('isPitch'):
                continue
            n += 1
            hd = e.get('hitData') or {}
            inplay = bool(e.get('details', {}).get('isInPlay'))
            if not inplay:
                continue
            r = by.get((pk, play['atBatIndex'] + 1, n))
            tot['balls in play in feed'] += 1
            if r is None:
                tot['no Savant row at the key'] += 1
                continue
            if r['description'] != 'hit_into_play':
                tot['key hits a row that is not hit_into_play'] += 1
                continue
            tot['joined to a hit_into_play row'] += 1
            if hd.get('launchSpeed') is not None and r['launch_speed'] not in ('', 'NA'):
                tot['both have EV'] += 1
                if abs(hd['launchSpeed'] - float(r['launch_speed'])) < 0.05 and abs(hd.get('launchAngle', 0) - float(r['launch_angle'])) < 0.05:
                    tot['EV and LA equal'] += 1
            if r['estimated_woba_using_speedangle'] not in ('', 'NA'):
                tot['joined row has an estimate'] += 1
print(day, 'games checked', len(games[:6]), dict(tot))
