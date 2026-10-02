"""Can the feed-only sweep compute xwOBA? estimated_woba_using_speedangle should be a function of (exit velo, launch angle).
Also: does the feed's hitData equal Savant's launch_speed/launch_angle? And the switch-hitter stance rule."""
import statistics as st
from collections import Counter, defaultdict
from h import *

def ok(v):
    return v not in ('', 'NA', None)

# --- (1) is est a smooth function of (EV, LA)?  Five full days of MLB 2026.
rows, nbytes, secs, meta, head = savant({'game_date_gt': '2026-09-14', 'game_date_lt': '2026-09-18',
                                         'hfGT': 'R|', 'player_type': 'pitcher'}, timeout=400)
print(f'5-day pull: rows={len(rows)} bytes={nbytes/1e6:.1f} MB ({meta}); under 25,000 cap: {len(rows) < 25000}')
bip = [r for r in rows if r['description'] == 'hit_into_play' and ok(r['launch_speed'])
       and ok(r['launch_angle']) and ok(r['estimated_woba_using_speedangle'])]
print('balls in play with EV, LA and est:', len(bip))
allv = [float(r['estimated_woba_using_speedangle']) for r in bip]
gm = st.mean(allv)
base_mae = st.mean(abs(v - gm) for v in allv)
print(f'baseline MAE (predict the global mean {gm:.3f}): {base_mae:.3f}')
for label, fe, fl in [('1 mph x 1 deg', 1, 1), ('2 mph x 4 deg', 2, 4), ('4 mph x 8 deg', 4, 8)]:
    bins = defaultdict(list)
    for r in bip:
        k = (round(float(r['launch_speed']) / fe), round(float(r['launch_angle']) / fl))
        bins[k].append(float(r['estimated_woba_using_speedangle']))
    errs, covered = [], 0
    for r in bip:
        k = (round(float(r['launch_speed']) / fe), round(float(r['launch_angle']) / fl))
        v = float(r['estimated_woba_using_speedangle'])
        b = bins[k]
        if len(b) >= 2:
            covered += 1
            errs.append(abs((sum(b) - v) / (len(b) - 1) - v))      # leave-one-out
    print(f'  bins {label}: leave-one-out MAE={st.mean(errs):.3f} on {covered}/{len(bip)} balls ({100*covered/len(bip):.0f}%)')
# exact-key determinism
exact = defaultdict(set)
for r in bip:
    exact[(r['launch_speed'], r['launch_angle'])].add(r['estimated_woba_using_speedangle'])
multi = [k for k, v in exact.items() if len(v) > 1]
dup = [k for k, v in exact.items() if sum(1 for r in bip if (r['launch_speed'], r['launch_angle']) == k) > 1]
print(f'exact (EV, LA) keys: {len(exact)}; keys seen more than once: {len(dup)}; of those with >1 distinct est: {len([k for k in dup if len(exact[k]) > 1])}')

# --- (2) feed hitData vs Savant, 2026-09-20 game 823570
pk = 823570
feed = jget(f'/api/v1.1/game/{pk}/feed/live')
fp = []
for play in sorted(feed['liveData']['plays']['allPlays'], key=lambda p: p['about']['atBatIndex']):
    for e in play.get('playEvents', []):
        if e.get('isPitch'):
            hd = e.get('hitData') or {}
            fp.append((hd.get('launchSpeed'), hd.get('launchAngle')))
srows, nb, sc, mt, hd = savant({'game_pk': str(pk), 'player_type': 'batter', 'hfGT': 'R|'})
srows = [r for r in srows if not r['description'].startswith('automatic')]
srows.sort(key=lambda r: (int(r['at_bat_number']), int(r['pitch_number'])))
print(f'\nfeed vs Savant hitData, game {pk}: feed pitches={len(fp)} savant rows={len(srows)}')
dv, da, miss = [], [], 0
for (fs, fa), r in zip(fp, srows):
    # Balls in play only. Savant also carries exit velocity on other tracked pitches (fouls), which the feed does not.
    if r['description'] == 'hit_into_play' and ok(r['launch_speed']):
        if fs is None:
            miss += 1
        else:
            dv.append(fs - float(r['launch_speed']))
            if fa is not None and ok(r['launch_angle']):
                da.append(fa - float(r['launch_angle']))
print(f'  balls with Savant EV: {len(dv) + miss}; feed has EV for {len(dv)}; feed missing {miss}')
if dv:
    print(f'  EV diff: mean={st.mean(dv):+.3f} max|d|={max(abs(x) for x in dv):.3f}')
if da:
    print(f'  LA diff: mean={st.mean(da):+.3f} max|d|={max(abs(x) for x in da):.3f}')

# --- (3) switch hitter stance vs pitcher hand (Lindor 2025)
lrows, nb, sc, mt, hd = savant({'batters_lookup': ['596019'], 'hfSea': '2025|', 'hfGT': ALLGT, 'player_type': 'batter'})
print('\nLindor 2025 (stand, p_throws):', dict(Counter((r['stand'], r['p_throws']) for r in lrows)))

# --- (4) listed heights for the zone-height ratio
for p in jget('/api/v1/people?personIds=592450,660271')['people']:
    print(p['fullName'], p.get('height'))
