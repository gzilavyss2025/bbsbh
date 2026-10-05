"""Step 4 of the xwOBA calibration spike (#1411 Part C): reproduce Savant's pitch-arsenal-stats BATTER board
from Savant search rows, before any comparison with an estimate.

Board: https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=batter&pitchType=&year=2026&team=&min=10&csv=true
Saved by xwoba_fetch_board.py to /tmp/xwoba-cache/board-2026.csv. Day files come from xwoba_pull.py.

The board's definition, as measured on 2026-10-02 (the first guess in the task text needed three fixes, see the notes file):
  scope        game_type R only
  pitch type   the PA-ending pitch's pitch_type, with KC (knuckle curve) and CS (slow curve) folded into CU. The board has no KC row.
  pa           every row with a non-empty `events`, except `truncated_pa`. Sac bunts, intentional walks without a pitch type, and
               balls in play with no tracking data all count. (woba_denom = 1 is NOT the board's pa.)
  est_woba     the mean of one value per PA, over the PAs that HAVE a value:
                 ball in play with an estimate    estimated_woba_using_speedangle
                 any other PA                     woba_value (strikeout 0, walk and hit-by-pitch 0.7, catcher interference 0.7)
                 sac bunt, ball in play with no estimate, no value: skipped (not in the mean, still in pa)
"""
import csv, sys
from collections import defaultdict
import xw_common as xc

FOLD = {'KC': 'CU', 'CS': 'CU'}


def board(year):
    out = {}
    with open(f'/tmp/xwoba-cache/board-{year}.csv', encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh):
            if r['pitch_type'] and r['pa']:
                out[(int(r['player_id']), r['pitch_type'])] = r
    return out


def pa_rows(rows, gt='R'):
    """Rows the board counts as plate appearances, with a pitch type."""
    return [r for r in rows if r['game_type'] == gt and r['events'] and r['events'] != 'truncated_pa' and r['pitch_type']]


def key(r):
    return (int(r['batter']), FOLD.get(r['pitch_type'], r['pitch_type']))


def is_bip(r):
    return r['description'] == 'hit_into_play'


def value(r, lookup=None):
    """The board's per-PA value, or None when the board skips the PA. `lookup(ev, la)` replaces Savant's estimate on a ball in play."""
    if r['events'] == 'sac_bunt':
        return None
    if r['events'] == 'catcher_interf':
        return r['woba_value']
    if is_bip(r):
        est = r['estimated_woba_using_speedangle']
        if est is None:
            return None
        if lookup is not None:
            return lookup(r['launch_speed'], r['launch_angle'])
        return est
    return r['woba_value']


def groups(rows):
    g = defaultdict(list)
    for r in pa_rows(rows):
        g[key(r)].append(r)
    return g


def mine(rs, lookup=None):
    vals = [v for v in (value(r, lookup) for r in rs) if v is not None]
    return (sum(vals) / len(vals) if vals else None), len(vals)


if __name__ == '__main__':
    year = sys.argv[1] if len(sys.argv) > 1 else '2026'
    b = board(year)
    g = groups(xc.load(year))
    print(f'board rows {len(b)}; reproduced groups {len(g)}; board rows with no group {sum(1 for k in b if k not in g)}')
    for pid, t, label in [(592450, 'FF', 'Judge FF'), (592450, 'SI', 'Judge SI'), (592450, 'SL', 'Judge SL')]:
        br, rs = b.get((pid, t)), g.get((pid, t), [])
        print(f'{label}: board pa {br["pa"]} est_woba {br["est_woba"]} | mine pa {len(rs)} est {mine(rs)[0]:.4f}')
    n = pa_eq = 0
    gaps = []
    for k, br in b.items():
        rs = g.get(k, [])
        m, _ = mine(rs)
        if len(rs) == int(br['pa']):
            pa_eq += 1
        if m is not None:
            gaps.append(abs(m - float(br['est_woba'])))
    gaps.sort()
    N = len(gaps)
    print(f'pa equal on {pa_eq}/{len(b)} rows')
    print(f'est_woba gap |mine - board| over {N} rows: median {gaps[N // 2]:.5f}, max {gaps[-1]:.4f}; share <=0.0005 {sum(x <= .0005 for x in gaps) / N:.4f}, <=0.002 {sum(x <= .002 for x in gaps) / N:.4f}, <=0.005 {sum(x <= .005 for x in gaps) / N:.4f}')
    for lo in (10, 40):
        sel = [abs(mine(g.get(k, []))[0] - float(br['est_woba'])) for k, br in b.items() if int(br['pa']) >= lo and mine(g.get(k, []))[0] is not None]
        print(f'  board pa >= {lo}: n={len(sel)} share within 0.002: {sum(x <= .002 for x in sel) / len(sel):.4f}; max {max(sel):.4f}')
