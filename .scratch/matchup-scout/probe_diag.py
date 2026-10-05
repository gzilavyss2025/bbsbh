"""(1) Why does Savant have more rows than the feed in some games?
   (2) Is minors=true really Triple-A?  (3) Is the 25,000-row cap real?"""
from collections import Counter
from h import *

print('== (1) extra Savant rows: what are they?')
for pk in [777514, 776661, 823329, 849841]:
    rows, nbytes, secs, meta, head = savant({'game_pk': str(pk), 'player_type': 'batter', 'hfGT': ALLGT})
    auto = Counter(r['description'] for r in rows if r['description'].startswith('automatic'))
    noxy = Counter(r['description'] for r in rows if r['plate_x'] == '')
    print(f'pk={pk} savant_rows={len(rows)} automatic_*={dict(auto)} rows_with_no_plate_x={dict(noxy)}')

print()
print('== (2) minors=true: which games came back?')
rows, nbytes, secs, meta, head = savant({
    'minors': 'true', 'hfLevel': 'AAA|', 'hfSea': '2025|', 'player_type': 'pitcher',
    'game_date_gt': '2025-06-14', 'game_date_lt': '2025-06-14',
})
pks = sorted({r['game_pk'] for r in rows})
print(f'rows={len(rows)} distinct game_pk={len(pks)} bytes={nbytes}')
for sid in (1, 11):
    d = jget(f'/api/v1/schedule?sportId={sid}&date=2025-06-14')
    sched = {str(g['gamePk']) for dt in d.get('dates', []) for g in dt['games']}
    print(f'  sportId={sid}: schedule has {len(sched)} games; Savant pks found in it: {len(set(pks) & sched)} of {len(pks)}')
print('  home_team sample:', sorted({r['home_team'] for r in rows})[:12])
# Same call WITHOUT minors=true, for contrast
rows2, nb2, s2, m2, h2 = savant({'hfSea': '2025|', 'hfGT': 'R|', 'player_type': 'pitcher',
                                 'game_date_gt': '2025-06-14', 'game_date_lt': '2025-06-14'})
print(f'  contrast, no minors flag: rows={len(rows2)} distinct pk={len({r["game_pk"] for r in rows2})}')

print()
print('== (3) cap test: whole 2025 regular season, one request')
rows, nbytes, secs, meta, head = savant({'hfSea': '2025|', 'hfGT': 'R|', 'player_type': 'pitcher'}, timeout=400)
print(f'rows={len(rows)} bytes={nbytes} secs={secs:.1f} {meta}')
print('last game_date in rows:', max(r['game_date'] for r in rows) if rows else None,
      ' first:', min(r['game_date'] for r in rows) if rows else None)
