"""How many cells can a hitter's map actually fill?
For 10 hitters, measure the share of their pitches that land in a cell with enough data to show a value,
under several grid / split / pooling designs. Whiff% needs SWINGS in the cell; xwOBA needs PLATE-APPEARANCE-ENDING pitches."""
import statistics as st
from collections import Counter, defaultdict
from h import *

HITTERS = [592450, 660271, 665742, 677951, 518692, 596019, 663728, 514888, 606466, 607208]
POOL3 = {592450, 665742, 677951, 596019}          # also pull 2023 + 2024 for these
FLOOR_SWINGS, FLOOR_PA = 10, 10
EDGE = 0.708
WHIFF = {'swinging_strike', 'swinging_strike_blocked', 'missed_bunt', 'foul_tip', 'bunt_foul_tip'}
SWING = WHIFF | {'foul', 'hit_into_play', 'foul_bunt'}

ppl = jget('/api/v1/people?personIds=' + ','.join(map(str, HITTERS)))['people']
NAMES = {p['id']: (p['fullName'], p.get('batSide', {}).get('code')) for p in ppl}


def band(v, lo, hi):
    if v < lo:
        return 0
    if v > hi:
        return 4
    return 1 + min(2, int(((v - lo) / (hi - lo)) * 3))


def grid5(r):
    try:
        px, pz, top, bot = (float(r[k]) for k in ('plate_x', 'plate_z', 'sz_top', 'sz_bot'))
    except ValueError:
        return None
    if top - bot <= 0:
        return None
    col = band(px / EDGE, -1, 1)
    row = 4 - band((pz - bot) / (top - bot), 0, 1)
    return row * 5 + col


def zone13(r):
    z = r['zone']
    return z if z in {'1', '2', '3', '4', '5', '6', '7', '8', '9', '11', '12', '13', '14'} else None


def pull(pid, season):
    rows, nbytes, secs, meta, head = savant({
        'batters_lookup': [str(pid)], 'hfSea': f'{season}|', 'hfGT': ALLGT, 'player_type': 'batter'})
    return rows, nbytes, secs


def coverage(rows, cellfn, by_hand, top_n=4):
    """Returns dict with pitch share in a showable cell, for whiff% and for xwOBA."""
    types = Counter(r['pitch_type'] for r in rows if r['pitch_type'])
    keep = {t for t, _ in types.most_common(top_n)}
    cells = defaultdict(lambda: [0, 0, 0])   # pitches, swings, pa_ending
    for r in rows:
        if r['pitch_type'] not in keep:
            continue
        c = cellfn(r)
        if c is None:
            continue
        key = (r['pitch_type'], r['p_throws'] if by_hand else '*', c)
        e = cells[key]
        e[0] += 1
        if r['description'] in SWING:
            e[1] += 1
        if r['events'] and r['woba_denom'] == '1':
            e[2] += 1
    tot = sum(v[0] for v in cells.values())
    if not tot:
        return None
    w = sum(v[0] for v in cells.values() if v[1] >= FLOOR_SWINGS)
    x = sum(v[0] for v in cells.values() if v[2] >= FLOOR_PA)
    ncell = len(cells)
    shown_w = sum(1 for v in cells.values() if v[1] >= FLOOR_SWINGS)
    shown_x = sum(1 for v in cells.values() if v[2] >= FLOOR_PA)
    return dict(whiff_cov=100 * w / tot, xwoba_cov=100 * x / tot, cells=ncell, shown_w=shown_w, shown_x=shown_x,
                med_pa=st.median([v[2] for v in cells.values()]))


data = {}
tot_bytes = 0
for pid in HITTERS:
    seasons = [2025] + ([2024, 2023] if pid in POOL3 else [])
    for s in seasons:
        rows, nb, secs = pull(pid, s)
        tot_bytes += nb
        data[(pid, s)] = rows
print(f'pulled {len(data)} player-seasons, {tot_bytes/1e6:.1f} MB')
print()
print('hitter                pitches   swings  PA-ending   (2025, regular + postseason)')
for pid in HITTERS:
    rows = data[(pid, 2025)]
    sw = sum(1 for r in rows if r['description'] in SWING)
    pa = sum(1 for r in rows if r['events'] and r['woba_denom'] == '1')
    nm, bs = NAMES.get(pid, ('?', '?'))
    stands = Counter(r['stand'] for r in rows)
    print(f'{nm:20s} {len(rows):7d} {sw:8d} {pa:9d}   bats={bs} stands_seen={dict(stands)}')

CONFIGS = [
    ('C1 5x5 grid  x type x pitcher hand, 1 season', grid5, True, [2025]),
    ('C2 13 zones  x type x pitcher hand, 1 season', zone13, True, [2025]),
    ('C3 5x5 grid  x type (hands pooled), 1 season', grid5, False, [2025]),
    ('C4 13 zones  x type (hands pooled), 1 season', zone13, False, [2025]),
    ('C5 13 zones  x type (hands pooled), 3 seasons', zone13, False, [2023, 2024, 2025]),
]
print()
print(f'Share of a hitter\'s pitches (top 4 pitch types) that sit in a cell above the floor '
      f'(whiff%: >= {FLOOR_SWINGS} swings; xwOBA: >= {FLOOR_PA} PA-ending pitches). Median across hitters.')
for label, fn, hand, seasons in CONFIGS:
    res = []
    for pid in HITTERS:
        if len(seasons) > 1 and pid not in POOL3:
            continue
        rows = [r for s in seasons for r in data.get((pid, s), [])]
        c = coverage(rows, fn, hand)
        if c:
            res.append(c)
    if not res:
        continue
    print(f'{label:50s} n={len(res):2d}  whiff% shown {st.median(x["whiff_cov"] for x in res):5.1f}%'
          f' ({st.median(x["shown_w"] for x in res):.0f}/{st.median(x["cells"] for x in res):.0f} cells)'
          f' | xwOBA shown {st.median(x["xwoba_cov"] for x in res):5.1f}%'
          f' ({st.median(x["shown_x"] for x in res):.0f}/{st.median(x["cells"] for x in res):.0f} cells)'
          f' | median PA-ending pitches per cell {st.median(x["med_pa"] for x in res):.1f}')

print()
print('== zone height: constant per batter in 2026 (ABS) vs varying in 2025?')
for pid in (592450, 660271):
    out = []
    for s in (2025, 2026):
        rows = data.get((pid, s))
        if rows is None:
            rows, nb, secs = pull(pid, s)
        tops = [float(r['sz_top']) for r in rows if r['sz_top'] not in ('', 'NA')]
        if tops:
            out.append(f'{s}: n={len(tops)} mean={st.mean(tops):.3f} sd={st.pstdev(tops):.4f} distinct={len(set(round(t, 3) for t in tops))}')
    print(NAMES.get(pid, ('?',))[0], '|', ' | '.join(out))
