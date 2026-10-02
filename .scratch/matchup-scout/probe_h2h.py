"""Reconcile head-to-head plate appearances: Savant rows vs statsapi vsPlayer,
with and without postseason game types. Pair: Judge (592450) vs Verlander (434378)."""
from collections import Counter, defaultdict
from h import *

B, P = '592450', '434378'
rows, nbytes, secs, meta, head = savant({
    'batters_lookup': [B], 'pitchers_lookup': [P], 'hfGT': ALLGT, 'player_type': 'batter',
})
print(f'Savant rows={len(rows)} bytes={nbytes} secs={secs:.1f} {meta}')
pa = {}
for r in rows:
    if r['events']:
        pa[(r['game_pk'], r['at_bat_number'])] = r['game_type']
by_type = Counter(pa.values())
by_season = defaultdict(Counter)
for r in rows:
    if r['events']:
        by_season[r['game_year']][r['game_type']] += 1
print('Savant PA by game_type:', dict(by_type), 'total', sum(by_type.values()))
print('Savant PA by season/game_type:', {k: dict(v) for k, v in sorted(by_season.items())})
print('distinct game_type values in rows:', sorted({r['game_type'] for r in rows}))

for gt in ['R', 'F', 'D', 'L', 'W', 'F,D,L,W', 'R,F,D,L,W']:
    d = jget(f'/api/v1/people/{B}/stats?stats=vsPlayer&group=hitting&opposingPlayerId={P}&gameType={gt}')
    total = 0
    per = {}
    for s in d.get('stats', []):
        for sp in s.get('splits', []):
            n = sp['stat'].get('plateAppearances', 0)
            total += n
            per[sp.get('season')] = per.get(sp.get('season'), 0) + n
    print(f'statsapi vsPlayer gameType={gt:12s} PA total={total} by season={dict(sorted(per.items(), key=lambda x: str(x[0])))}')
