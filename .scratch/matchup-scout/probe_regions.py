"""Coverage of the PROPOSED layout: 13 regions as unions of 5x5 cells (inner 3x3 + high/low/1B-side/3B-side),
versus Savant's own `zone` column that the earlier table measured."""
import statistics as st, pickle, os, tempfile
from collections import Counter, defaultdict
from h import *

HITTERS = [592450, 660271, 665742, 677951, 518692, 596019, 663728, 514888, 606466, 607208]
FLOOR_SWINGS, FLOOR_PA, EDGE = 10, 10, 0.708
WHIFF = {'swinging_strike', 'swinging_strike_blocked', 'missed_bunt', 'foul_tip', 'bunt_foul_tip'}
SWING = WHIFF | {'foul', 'hit_into_play', 'foul_bunt'}
cache = os.path.join(tempfile.gettempdir(), 'matchup_scout_regions_cache.pkl')  # 10 players x 2025, about 18 MB
data = pickle.load(open(cache, 'rb')) if os.path.exists(cache) else {}
for pid in HITTERS:
    if pid not in data:
        rows, nb, secs, meta, head = savant({'batters_lookup': [str(pid)], 'hfSea': '2025|', 'hfGT': ALLGT, 'player_type': 'batter'})
        data[pid] = [r for r in rows if r['plate_x'] != '']
pickle.dump(data, open(cache, 'wb'))

def band(v, lo, hi):
    if v < lo: return 0
    if v > hi: return 4
    return 1 + min(2, int(((v - lo) / (hi - lo)) * 3))

def cell(r):
    try: px, pz, top, bot = (float(r[k]) for k in ('plate_x', 'plate_z', 'sz_top', 'sz_bot'))
    except ValueError: return None
    if top - bot <= 0: return None
    return (4 - band((pz - bot) / (top - bot), 0, 1), band(px / EDGE, -1, 1))   # (row, col)

def region13(r):
    c = cell(r)
    if c is None: return None
    row, col = c
    if 1 <= row <= 3 and 1 <= col <= 3: return f'in{row}{col}'
    if row == 0: return 'high'
    if row == 4: return 'low'
    return 'side3B' if col == 0 else 'side1B'

def savant_zone(r):
    z = r['zone']; return z if z in {'1','2','3','4','5','6','7','8','9','11','12','13','14'} else None

def cov(rows, fn, by_hand, top_n=4):
    types = Counter(r['pitch_type'] for r in rows if r['pitch_type'])
    keep = {t for t, _ in types.most_common(top_n)}
    cells = defaultdict(lambda: [0, 0, 0])
    for r in rows:
        if r['pitch_type'] not in keep: continue
        c = fn(r)
        if c is None: continue
        e = cells[(r['pitch_type'], r['p_throws'] if by_hand else '*', c)]
        e[0] += 1
        if r['description'] in SWING: e[1] += 1
        if r['events'] and r['woba_denom'] == '1': e[2] += 1
    tot = sum(v[0] for v in cells.values())
    return (100 * sum(v[0] for v in cells.values() if v[1] >= FLOOR_SWINGS) / tot,
            100 * sum(v[0] for v in cells.values() if v[2] >= FLOOR_PA) / tot,
            len(cells), sum(1 for v in cells.values() if v[2] >= FLOOR_PA))

print('median across 10 hitters, 2025, top 4 pitch types: share of pitches in a region above the floor')
print(f'{"layout":58s} whiff%   xwOBA   regions shown(xwOBA)')
for label, fn, hand in [
    ('Savant zone column (1-9, 11-14), hands pooled   [measured before]', savant_zone, False),
    ('PROPOSED union regions (3x3 + high/low/1B/3B), hands pooled', region13, False),
    ('Savant zone column, by pitcher hand             [measured before]', savant_zone, True),
    ('PROPOSED union regions, by pitcher hand', region13, True),
]:
    res = [cov(data[p], fn, hand) for p in HITTERS]
    print(f'{label:58s} {st.median(x[0] for x in res):5.1f}%  {st.median(x[1] for x in res):5.1f}%   {st.median(x[3] for x in res):.0f}/{st.median(x[2] for x in res):.0f}')
# how different are the two layouts cell by cell? share of pitches where the Savant zone is inside (1-9) vs my inner 3x3
agree = tot = 0
for p in HITTERS:
    for r in data[p]:
        z, g = savant_zone(r), region13(r)
        if z is None or g is None: continue
        tot += 1
        agree += (z in {'1','2','3','4','5','6','7','8','9'}) == g.startswith('in')
print(f'in-zone vs outside agreement between the two layouts: {100*agree/tot:.1f}% of {tot} pitches')
