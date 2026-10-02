"""Why does a 2025-built table miss 2026 by 0.033 when a 2026 cross-validation misses by 0.008? (#1411 Part C)
Part 1: drift inside one season (train on earlier months, score the next month).
Part 2: the 2025 -> 2026 gap by batted-ball type, exit velocity and launch angle.
Part 3: does a single season-to-season scale or shift close the gap?
Estimator everywhere: nearest-neighbour box, 1 mph x 1 degree, k=3 (the best table-able estimator in step 3).
Run:  python3 xwoba_drift.py
"""
import statistics as st
from collections import defaultdict
import xw_common as xc
import xw_est as xe

R = {y: xc.bip(xc.load(y)) for y in ('2025', '2026')}


def tup(rs):
    return [(r['launch_speed'], r['launch_angle'], r['estimated_woba_using_speedangle']) for r in rs]


def mk(rs):
    return xe.KnnBox(tup(rs), k=3, se=1, sl=1)


print('== Part 1: train on all earlier months of the same season, score the next month (MAE, n)')
for y in ('2025', '2026'):
    by = defaultdict(list)
    for r in R[y]:
        by[r['game_date'][:7]].append(r)
    months = sorted(by)
    line = f'  {y}:'
    for i in range(2, len(months)):
        train = [r for m in months[:i] for r in by[m]]
        m = mk(train)
        e = xe.evaluate(m, tup(by[months[i]]))
        line += f' {months[i][5:]}: {e["mae"]:.4f} (n={e["n"]})'
    print(line)

print('\n== Part 2: 2025-built table scored on 2026 balls')
m25 = mk(R['2025'])
rows = [(r, r['estimated_woba_using_speedangle'] - m25.predict(r['launch_speed'], r['launch_angle'])) for r in R['2026']]
print(f'  all: MAE {st.mean(abs(e) for _, e in rows):.4f}, mean signed (2026 - table) {st.mean(e for _, e in rows):+.4f}')
for bt in ('ground_ball', 'line_drive', 'fly_ball', 'popup'):
    s = [e for r, e in rows if r['bb_type'] == bt]
    print(f'  {bt:12s} n={len(s):6d} MAE {st.mean(abs(x) for x in s):.4f} mean signed {st.mean(s):+.4f}')
print('  by exit velocity (mph):')
for lo, hi in ((0, 60), (60, 80), (80, 95), (95, 105), (105, 130)):
    s = [e for r, e in rows if lo <= r['launch_speed'] < hi]
    print(f'    {lo}-{hi}: n={len(s):6d} MAE {st.mean(abs(x) for x in s):.4f} mean signed {st.mean(s):+.4f}')
print('  by launch angle (deg):')
for lo, hi in ((-90, 0), (0, 10), (10, 25), (25, 35), (35, 50), (50, 91)):
    s = [e for r, e in rows if lo <= r['launch_angle'] < hi]
    print(f'    {lo}..{hi}: n={len(s):6d} MAE {st.mean(abs(x) for x in s):.4f} mean signed {st.mean(s):+.4f}')

print('\n== Part 3: does one scale or shift close the gap? est2026 ~ a * table2025 + b, fitted on a random half of 2026, scored on the other half')
import random
rr = list(rows)
random.Random(3).shuffle(rr)
half = len(rr) // 2
fit, test = rr[:half], rr[half:]
xs = [m25.predict(r['launch_speed'], r['launch_angle']) for r, _ in fit]
ys = [r['estimated_woba_using_speedangle'] for r, _ in fit]
a = st.covariance(xs, ys) / st.variance(xs)
b = st.mean(ys) - a * st.mean(xs)
print(f'  fitted a={a:.4f} b={b:+.4f}')
base = st.mean(abs(e) for _, e in test)
adj = st.mean(abs(r['estimated_woba_using_speedangle'] - (a * m25.predict(r['launch_speed'], r['launch_angle']) + b)) for r, _ in test)
print(f'  held-out half: MAE {base:.4f} -> {adj:.4f}')
for bt in ('ground_ball', 'line_drive', 'fly_ball'):
    t = [r for r, _ in test if r['bb_type'] == bt]
    print(f'    {bt}: MAE {st.mean(abs(r["estimated_woba_using_speedangle"] - m25.predict(r["launch_speed"], r["launch_angle"])) for r in t):.4f} -> {st.mean(abs(r["estimated_woba_using_speedangle"] - (a * m25.predict(r["launch_speed"], r["launch_angle"]) + b)) for r in t):.4f}')
# Is the 2026 surface a smooth warp of 2025's? Compare a few fixed balls.
print('\n== Same exact key, mean estimate per season (keys with >= 5 balls in each season, 10 largest)')
g = {y: defaultdict(list) for y in R}
for y in R:
    for r in R[y]:
        g[y][(r['launch_speed'], r['launch_angle'])].append(r['estimated_woba_using_speedangle'])
both = [k for k in g['2025'] if k in g['2026'] and len(g['2025'][k]) >= 5 and len(g['2026'][k]) >= 5]
both.sort(key=lambda k: -(len(g['2025'][k]) + len(g['2026'][k])))
for k in both[:10]:
    print(f'  EV {k[0]:5.1f} LA {k[1]:5.0f}: 2025 {st.mean(g["2025"][k]):.3f} (n={len(g["2025"][k])})  2026 {st.mean(g["2026"][k]):.3f} (n={len(g["2026"][k])})')
