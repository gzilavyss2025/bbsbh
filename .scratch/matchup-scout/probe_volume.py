"""Option B volume: what does one nightly day-pull cost, is it complete, and are the columns stable?"""
from collections import Counter
from h import *

day = '2026-09-20'
rows, nbytes, secs, meta, head = savant({'game_date_gt': day, 'game_date_lt': day, 'hfGT': 'R|', 'player_type': 'pitcher'})
print(f'{day}: rows={len(rows)} bytes={nbytes} ({nbytes/1e6:.2f} MB) secs={secs:.1f} {meta}')
by_game = Counter(r['game_pk'] for r in rows)
d = jget(f'/api/v1/schedule?sportId=1&date={day}&gameType=R')
games = [g['gamePk'] for dt in d['dates'] for g in dt['games'] if g['status']['abstractGameState'] == 'Final']
print(f'schedule: {len(games)} final games; Savant has rows for {len(by_game)} games')
tot_box = tot_sav = 0
diffs = []
for pk in games:
    bs = jget(f'/api/v1/game/{pk}/boxscore')
    n = sum((bs['teams'][s]['teamStats']['pitching'].get('numberOfPitches') or 0) for s in ('away', 'home'))
    s = by_game.get(str(pk), 0)
    tot_box += n
    tot_sav += s
    if n != s:
        diffs.append((pk, n, s))
print(f'sum boxscore numberOfPitches={tot_box}  sum Savant rows={tot_sav}')
print(f'games where they differ: {len(diffs)} of {len(games)}; differences (pk, boxscore, savant): {diffs[:8]}')
auto = Counter(r['description'] for r in rows if r['description'].startswith('automatic'))
print('automatic_* rows in the day:', dict(auto))

print()
print('== column stability (header of a day pull, by year)')
cols = {}
cols['2026-09-20'] = list(rows[0].keys())
for y, dd in [('2024-06-14', '2024-06-14'), ('2025-06-14', '2025-06-14')]:
    r2, nb, sc, m, h = savant({'game_date_gt': dd, 'game_date_lt': dd, 'hfGT': 'R|', 'player_type': 'pitcher'})
    cols[y] = list(r2[0].keys())
    print(f'{y}: rows={len(r2)} bytes={nb}')
base = set(cols['2026-09-20'])
for y in ('2024-06-14', '2025-06-14'):
    s = set(cols[y])
    print(f'{y}: columns={len(s)}  only in {y}: {sorted(s - base)}  only in 2026: {sorted(base - s)}')
print('2026 column count:', len(base))
