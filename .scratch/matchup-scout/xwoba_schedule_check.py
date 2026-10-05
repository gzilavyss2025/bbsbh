"""Completeness check for the cached Savant days: per date, compare the games Savant returned with the Final games in the statsapi schedule.
Usage: python3 xwoba_schedule_check.py 2025   (statsapi only, no Savant request)
"""
import sys
from collections import defaultdict
import xw_common as xc
from h import jget

year = sys.argv[1]
start, end = (f'{year}-03-01', f'{year}-11-10')
sched = jget(f'/api/v1/schedule?sportId=1&startDate={start}&endDate={end}&gameType=R,F,D,L,W&fields=dates,date,games,gamePk,status,detailedState,gameType')
want = defaultdict(set)
for d in sched['dates']:
    for g in d['games']:
        if g['status']['detailedState'] == 'Final':
            want[d['date']].add(g['gamePk'])
rows = xc.load(year)
got = defaultdict(set)
for r in rows:
    got[r['game_date']].add(int(r['game_pk']))
# Savant's game_date is the official date. A suspended or resumed game can sit on another date, so report, do not assume.
bad = []
for day in sorted(set(want) | set(got)):
    w, g = want.get(day, set()), got.get(day, set())
    if w != g:
        bad.append((day, len(w), len(g), sorted(w - g)[:3], sorted(g - w)[:3]))
print(f'{year}: schedule days {len(want)}, Savant days {len(got)}, schedule games {sum(map(len, want.values()))}, Savant games {sum(map(len, got.values()))}')
print('days that differ:', len(bad))
for b in bad[:30]:
    print('  ', b)
