"""Does a batter's sprint speed explain the part of Savant's estimate that (launch_speed, launch_angle) cannot?
The 119 search columns have no sprint speed, so this joins Savant's sprint-speed leaderboard on the batter id.

Residual = Savant estimate minus a leave-fold-out nearest-neighbour estimate from OTHER balls (10 folds).
Then, for each batted-ball type, the correlation of the residual with the batter's sprint speed, and a one-slope correction
(slope fitted on 2025, scored on 2026). Run:  python3 xwoba_sprint.py
"""
import csv, math, random, statistics as st
from collections import defaultdict
import xw_common as xc
import xw_est as xe


def speeds(year):
    out = {}
    with open(f'/tmp/xwoba-cache/sprint-{year}.csv', encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh):
            try:
                out[int(r['player_id'])] = float(r['sprint_speed'])
            except (KeyError, ValueError):
                pass
    return out


def residuals(year, spd):
    b = xc.bip(xc.load(year))
    data = [(r['launch_speed'], r['launch_angle'], r['estimated_woba_using_speedangle']) for r in b]
    idx = list(range(len(b)))
    random.Random(7).shuffle(idx)
    pred = [None] * len(b)
    for f in range(10):
        m = xe.KnnBox(data and [data[i] for k, i in enumerate(idx) if k % 10 != f], k=5, se=1, sl=2)
        for k, i in enumerate(idx):
            if k % 10 == f:
                pred[i] = m.predict(data[i][0], data[i][1])
    out = []
    for r, p in zip(b, pred):
        s = spd.get(int(r['batter']))
        if s is not None:
            out.append((r, r['estimated_woba_using_speedangle'] - p, s))
    return out


def main():
    sp = {'2025': speeds('2025'), '2026': speeds('2026')}
    print('sprint-speed rows:', {y: len(v) for y, v in sp.items()})
    res = {y: residuals(y, sp[y]) for y in ('2025', '2026')}
    print('balls with a sprint speed:', {y: len(v) for y, v in res.items()})
    groups = {
        'ground ball, EV < 85 (weak)': lambda r: r['bb_type'] == 'ground_ball' and r['launch_speed'] < 85,
        'ground ball, EV 85+': lambda r: r['bb_type'] == 'ground_ball' and r['launch_speed'] >= 85,
        'ground ball, all': lambda r: r['bb_type'] == 'ground_ball',
        'line drive': lambda r: r['bb_type'] == 'line_drive',
        'fly ball': lambda r: r['bb_type'] == 'fly_ball',
        'popup': lambda r: r['bb_type'] == 'popup',
        'LA < 10 (any type)': lambda r: r['launch_angle'] < 10,
    }
    print('\ncorrelation of residual with batter sprint speed, and OLS slope (xwOBA per ft/s):')
    for name, sel in groups.items():
        line = f'  {name:30s}'
        for y in ('2025', '2026'):
            s = [(e, v) for r, e, v in res[y] if sel(r)]
            es, vs = [e for e, _ in s], [v for _, v in s]
            c = st.correlation(vs, es)
            slope = st.covariance(vs, es) / st.variance(vs)
            line += f' | {y}: n={len(s):6d} r={c:+.3f} slope={slope:+.4f}'
        print(line)
    # One-slope correction on weak ground balls, slope from 2025, scored on 2026.
    sel = groups['ground ball, EV < 85 (weak)']
    tr = [(e, v) for r, e, v in res['2025'] if sel(r)]
    mv = st.mean(v for _, v in tr)
    beta = st.covariance([v for _, v in tr], [e for e, _ in tr]) / st.variance([v for _, v in tr])
    te = [(e, v) for r, e, v in res['2026'] if sel(r)]
    before = st.mean(abs(e) for e, _ in te)
    after = st.mean(abs(e - beta * (v - mv)) for e, v in te)
    print(f'\nweak ground balls: slope {beta:+.4f} per ft/s fitted on 2025. 2026 MAE of the neighbour estimate {before:.4f} -> {after:.4f} with the sprint-speed term')
    allg = [(e, v) for r, e, v in res['2026']]
    print(f'all 2026 balls with a speed: MAE {st.mean(abs(e) for e, _ in allg):.4f}; weak ground balls are {len(te)} of {len(allg)} ({100 * len(te) / len(allg):.1f}%)')


if __name__ == '__main__':
    main()
