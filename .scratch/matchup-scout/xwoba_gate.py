"""Step 5 of the xwOBA calibration spike (#1411 Part C): the gate.

For each (hitter, pitch type) row on Savant's 2026 pitch-arsenal-stats batter board, compute an estimated xwOBA from the Savant
search rows, with a lookup table in place of Savant's own per-ball estimate, and compare with the board's est_woba.
The plate appearances are the same on both sides, so the gap is lookup error only, averaged over each hitter's balls in play.

Usage: python3 xwoba_gate.py "<estimator name>" ...    (names from the ESTIMATORS dict below)
Tables: 2025-built (out of sample), 2026-built (in sample), and 2026 ten-fold cross-fitted (each ball scored by a table built
without its fold). The cross-fitted column is the honest in-season number.
"""
import math, random, statistics as st, sys
from collections import defaultdict
import xw_common as xc
import xw_est as xe
import xwoba_board as xb

L3 = ((1, 1), (2, 4), (4, 8))
ESTIMATORS = {
    'knn box 1 mph x 1 deg, k=3': lambda t: xe.KnnBox(t, k=3, se=1, sl=1),
    'knn box 1 mph x 2 deg, k=2': lambda t: xe.KnnBox(t, k=2, se=1, sl=2),
    'kernel sigma 0.5 mph x 1 deg': lambda t: xe.Kernel(t, se=0.5, sl=1),
    'grid 1x1 -> 2x4 -> 4x8': lambda t: xe.Cascade(t, levels=L3),
    'grid 2x4 -> 4x8': lambda t: xe.Cascade(t, levels=L3[1:]),
    'grid 4x8': lambda t: xe.Cascade(t, levels=L3[2:]),
}


def train_of(rows):
    b = xc.bip(rows)
    return b, [(r['launch_speed'], r['launch_angle'], r['estimated_woba_using_speedangle']) for r in b]


def stats(errs, pairs):
    n = len(errs)
    if n == 0:
        return None
    mae = sum(abs(e) for e in errs) / n
    rmse = math.sqrt(sum(e * e for e in errs) / n)
    xs, ys = [p[0] for p in pairs], [p[1] for p in pairs]
    corr = st.correlation(xs, ys) if n > 2 else float('nan')
    return {'n': n, 'mae': mae, 'rmse': rmse, 'corr': corr, 'max': max(abs(e) for e in errs),
            'w010': sum(1 for e in errs if abs(e) <= 0.010) / n, 'w020': sum(1 for e in errs if abs(e) <= 0.020) / n,
            'w030': sum(1 for e in errs if abs(e) <= 0.030) / n}


def line(label, s):
    if not s:
        return f'{label:14s} (none)'
    return (f'{label:14s} n={s["n"]:4d} MAE={s["mae"]:.4f} RMSE={s["rmse"]:.4f} corr={s["corr"]:.3f} max={s["max"]:.3f} '
            f'<=.010 {100 * s["w010"]:5.1f}%  <=.020 {100 * s["w020"]:5.1f}%  <=.030 {100 * s["w030"]:5.1f}%')


def main(names):
    board = xb.board('2026')
    rows26 = xc.load('2026')
    pa = xb.groups(rows26)
    b25, t25 = train_of(xc.load('2025'))
    b26, t26 = train_of(rows26)
    fold = {}
    idx = list(range(len(b26)))
    random.Random(7).shuffle(idx)
    for k, i in enumerate(idx):
        fold[id(b26[i])] = k % 10
    for name in names:
        f = ESTIMATORS[name]
        m25, m26 = f(t25), f(t26)
        mf = []
        for fo in range(10):
            mf.append(f([t26[i] for k, i in enumerate(idx) if k % 10 != fo]))
        print(f'\n===== {name}')
        for floor in (40, 10):
            for tag, pick in (('2025 table (out of sample)', lambda r: m25), ('2026 table (in sample)', lambda r: m26),
                              ('2026 cross-fitted', lambda r: mf[fold[id(r)]] if id(r) in fold else m26)):
                errs, pairs, rowsout = [], [], []
                for key, br in board.items():
                    if int(br['pa']) < floor or key not in pa:
                        continue
                    vals = []
                    for r in pa[key]:
                        v = xb.value(r, (lambda ev, la, r=r: pick(r).predict(ev, la)))
                        if v is not None:
                            vals.append(v)
                    if not vals:
                        continue
                    mine = sum(vals) / len(vals)
                    theirs = float(br['est_woba'])
                    errs.append(mine - theirs)
                    pairs.append((mine, theirs))
                    rowsout.append((key, int(br['pa']), br['pitch_type'], mine - theirs))
                print(f'-- pa >= {floor}: {tag}')
                print('   ' + line('all', stats(errs, pairs)))
                if tag.startswith('2025') or tag.endswith('cross-fitted'):
                    for lo, hi in ((10, 19), (20, 39), (40, 79), (80, 10 ** 6)):
                        sel = [i for i, (_, p, _, _) in enumerate(rowsout) if lo <= p <= hi]
                        if sel:
                            print('   ' + line(f'pa {lo}-{hi if hi < 10**6 else "+"}', stats([errs[i] for i in sel], [pairs[i] for i in sel])))
                    if floor == 10 and (tag.startswith('2025') or tag.endswith('cross-fitted')):
                        by = defaultdict(list)
                        for i, (_, _, t, e) in enumerate(rowsout):
                            by[t].append(e)
                        print('   by pitch type (n, MAE):', {t: (len(v), round(sum(abs(x) for x in v) / len(v), 4)) for t, v in sorted(by.items(), key=lambda kv: -len(kv[1]))})


if __name__ == '__main__':
    main(sys.argv[1:] or list(ESTIMATORS)[:1])
