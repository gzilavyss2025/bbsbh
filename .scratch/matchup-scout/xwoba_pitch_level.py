"""Step 3 of the xwOBA calibration spike (#1411 Part C): pitch-level accuracy of estimators of Savant's
estimated_woba_using_speedangle from (launch_speed, launch_angle).

Reads the Savant day files that xwoba_pull.py cached under /tmp/xwoba-cache. Run:  python3 xwoba_pitch_level.py
Method: pick each estimator's settings by 10-fold cross-validation on 2025 ONLY. Then score that choice
 - out of sample: train 2025, test 2026
 - in sample:     10-fold cross-validation inside 2026 (and inside 2025)
Writes /tmp/xwoba-cache/pitch_level.json for the notes.
"""
import json, sys, time
import xw_common as xc
import xw_est as xe


def data(year):
    return [(r['launch_speed'], r['launch_angle'], r['estimated_woba_using_speedangle']) for r in xc.bip(xc.load(year))]


d25, d26 = data('2025'), data('2026')
print(f'balls in play with EV, LA and estimate: 2025={len(d25)} 2026={len(d26)}')
mean25 = sum(y for *_, y in d25) / len(d25)
base = xe.evaluate(type('M', (), {'predict': lambda s, e, l: mean25})(), d26)
print('baseline (predict the 2025 mean for every 2026 ball):', {k: round(v, 4) for k, v in base.items()})

L3 = ((1, 1), (2, 4), (4, 8))
candidates = {
    'grid 1x1 -> 2x4 -> 4x8': lambda t: xe.Cascade(t, levels=L3),
    'grid 2x4 -> 4x8': lambda t: xe.Cascade(t, levels=L3[1:]),
    'grid 4x8': lambda t: xe.Cascade(t, levels=L3[2:]),
    'grid 1x1 (n>=2) -> 2x4 -> 4x8': lambda t: xe.Cascade(t, levels=L3, minn=2),
    'grid 1x1 (n>=3) -> 2x4 -> 4x8': lambda t: xe.Cascade(t, levels=L3, minn=3),
    'grid 2x4 (n>=3) -> 4x8': lambda t: xe.Cascade(t, levels=L3[1:], minn=3),
}
for m in (1, 2, 4, 8):
    candidates[f'shrink 1x1>2x4>4x8>8x16 m={m}'] = (lambda mm: lambda t: xe.Shrink(t, m=mm))(m)
for se, sl in ((0.5, 1), (0.7, 1), (1, 1)):
    candidates[f'kernel sigma {se} mph x {sl} deg'] = (lambda a, b: lambda t: xe.Kernel(t, se=a, sl=b))(se, sl)
for k in (2, 3, 5, 8, 12):
    candidates[f'knn box 1 mph x 2 deg, k={k}'] = (lambda kk: lambda t: xe.KnnBox(t, k=kk, se=1, sl=2))(k)
for k in (2, 3, 5, 8):
    candidates[f'knn box 1 mph x 1 deg, k={k}'] = (lambda kk: lambda t: xe.KnnBox(t, k=kk, se=1, sl=1))(k)
for k in (3, 5, 8):
    candidates[f'knn box 0.5 mph x 1 deg, k={k}'] = (lambda kk: lambda t: xe.KnnFine(t, k=kk, res=2, se=1, sl=1))(k)
for k in (1, 2):
    candidates[f'knn ceiling 0.1 mph x 1 deg, k={k} (no table)'] = (lambda kk: lambda t: xe.KnnFine(t, k=kk, res=10, se=1, sl=1))(k)

out = {'n25': len(d25), 'n26': len(d26), 'baseline_mae_2026': base['mae'], 'rows': []}
print(f'\n{"estimator":38s} {"cv25 MAE":>9s} | {"25>26 MAE":>9s} {"RMSE":>7s} {"<=.02":>6s} {"<=.05":>6s} | {"cv26 MAE":>9s} {"RMSE":>7s} {"<=.02":>6s} {"<=.05":>6s} | {"JSON B":>8s} {"gz B":>7s}')
for name, f in candidates.items():
    t0 = time.time()
    cv25 = xe.cv(f, d25)
    model = f(d25)
    oos = xe.evaluate(model, d26)
    cv26 = xe.cv(f, d26)
    try:
        raw, gz = xe.size_of(model.table())
    except NotImplementedError:
        raw = gz = 0
    out['rows'].append({'name': name, 'cv25': cv25, 'oos': oos, 'cv26': cv26, 'json_bytes': raw, 'gz_bytes': gz})
    print(f'{name:38s} {cv25["mae"]:9.4f} | {oos["mae"]:9.4f} {oos["rmse"]:7.4f} {oos["w02"]:6.3f} {oos["w05"]:6.3f} | {cv26["mae"]:9.4f} {cv26["rmse"]:7.4f} {cv26["w02"]:6.3f} {cv26["w05"]:6.3f} | {raw:8d} {gz:7d}  ({time.time() - t0:.0f}s)', flush=True)
json.dump(out, open('/tmp/xwoba-cache/pitch_level.json', 'w'))
