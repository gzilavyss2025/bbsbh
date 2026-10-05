"""Two follow-up questions for the xwOBA spike (#1411 Part C). Run:  python3 xwoba_extras.py
(1) Cold start: how many days of a new season does the table need? Train on the first N days of 2026, score July-September 2026.
(2) Sprint speed in the gate: does a one-slope sprint term on ground balls (launch angle < 10) shrink the board-level error?
    Sprint speed comes from Savant's sprint-speed leaderboard (xwoba_fetch_sprint.py), joined on the batter id.
Estimator: nearest-neighbour box, 1 mph x 1 degree, k=3.
"""
import datetime as dt, random, statistics as st
from collections import defaultdict
import xw_common as xc
import xw_est as xe
import xwoba_board as xb
from xwoba_sprint import speeds

rows26 = xc.load('2026')
b26 = xc.bip(rows26)
tup = lambda rs: [(r['launch_speed'], r['launch_angle'], r['estimated_woba_using_speedangle']) for r in rs]
mk = lambda rs: xe.KnnBox(tup(rs), k=3, se=1, sl=1)

print('== (1) Cold start: train on the first N days of 2026 (opening day 2026-03-25), score balls from 2026-07-01 on')
test = [r for r in b26 if r['game_date'] >= '2026-07-01']
opening = dt.date(2026, 3, 25)
for n in (3, 7, 14, 21, 30, 45, 60, 90):
    cut = (opening + dt.timedelta(days=n)).isoformat()
    train = [r for r in b26 if r['game_date'] < cut]
    # an empty neighbourhood falls through to a wider box, so a thin table still answers
    e = xe.evaluate(mk(train), tup(test))
    print(f'  first {n:3d} days: train balls {len(train):6d}  MAE {e["mae"]:.4f}  RMSE {e["rmse"]:.4f}  <=.02 {e["w02"]:.3f}  <=.05 {e["w05"]:.3f}')
m25 = mk(xc.bip(xc.load('2025')))
e = xe.evaluate(m25, tup(test))
print(f'  (2025 table on the same July+ balls: MAE {e["mae"]:.4f})')

print('\n== (2) Sprint-speed term in the gate (2026 board, pa >= 10 and >= 40)')
sp = speeds('2026')
# slope per ft/s on ground balls (LA < 10): fitted on 2025 residuals of a 10-fold nearest-neighbour estimate
rows25 = xc.bip(xc.load('2025'))
sp25 = speeds('2025')
d25 = tup(rows25)
idx = list(range(len(d25)))
random.Random(7).shuffle(idx)
res = []
for f in range(10):
    m = xe.KnnBox([d25[i] for k, i in enumerate(idx) if k % 10 != f], k=3, se=1, sl=1)
    for k, i in enumerate(idx):
        if k % 10 == f and d25[i][1] < 10 and int(rows25[i]['batter']) in sp25:
            res.append((d25[i][2] - m.predict(d25[i][0], d25[i][1]), sp25[int(rows25[i]['batter'])]))
mean_sp = st.mean(v for _, v in res)
beta = st.covariance([v for _, v in res], [e for e, _ in res]) / st.variance([v for _, v in res])
print(f'  slope {beta:+.4f} xwOBA per ft/s on ground balls (fitted on 2025), mean sprint speed {mean_sp:.2f} ft/s; 2026 players with a speed: {len(sp)}')

# 2026 cross-fitted models
idx = list(range(len(b26)))
random.Random(7).shuffle(idx)
fold = {id(b26[i]): k % 10 for k, i in enumerate(idx)}
t26 = tup(b26)
mf = [mk([b26[i] for k, i in enumerate(idx) if k % 10 != f]) for f in range(10)]
m26 = mk(b26)
board = xb.board('2026')
pa = xb.groups(rows26)
batter_of = {}


def run(label, pick, floor, use_sprint):
    errs, withspeed = [], []
    for key, br in board.items():
        if int(br['pa']) < floor:
            continue
        vals = []
        for r in pa[key]:
            def lk(ev, la, r=r):
                p = pick(r).predict(ev, la)
                if use_sprint and la < 10:
                    s = sp.get(int(r['batter']))
                    if s is not None:
                        p += beta * (s - mean_sp)
                return p
            v = xb.value(r, lk)
            if v is not None:
                vals.append(v)
        if vals:
            errs.append(sum(vals) / len(vals) - float(br['est_woba']))
            withspeed.append(sp.get(key[0]))
    a = [abs(e) for e in errs]
    n = len(a)
    return f'  {label:44s} pa>={floor:2d} n={n} MAE {st.mean(a):.4f} RMSE {(sum(e * e for e in errs) / n) ** .5:.4f} max {max(a):.3f} <=.010 {100 * sum(x <= .01 for x in a) / n:5.1f}% <=.020 {100 * sum(x <= .02 for x in a) / n:5.1f}%  mean signed {st.mean(errs):+.4f}'


for floor in (40, 10):
    print(run('2025 table', lambda r: m25, floor, False))
    print(run('2025 table + sprint term', lambda r: m25, floor, True))
    print(run('2026 cross-fitted', lambda r: mf[fold[id(r)]] if id(r) in fold else m26, floor, False))
    print(run('2026 cross-fitted + sprint term', lambda r: mf[fold[id(r)]] if id(r) in fold else m26, floor, True))
