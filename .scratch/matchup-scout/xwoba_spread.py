"""Step 3, second half (#1411 Part C): why is Savant's estimate not a pure function of (launch_speed, launch_angle)?

Looks at balls in play that share an EXACT (launch_speed, launch_angle) key. Reports the spread by bb_type, hit_location,
stand, season, and whether a ball's batter explains it. Run:  python3 xwoba_spread.py
"""
import statistics as st
import sys
from collections import defaultdict
import xw_common as xc

rows = {y: xc.bip(xc.load(y)) for y in ('2025', '2026')}
for y, r in rows.items():
    print(y, 'balls in play with EV, LA, estimate:', len(r))


def key(r):
    return (r['launch_speed'], r['launch_angle'])


def groups(rs, sub=None):
    g = defaultdict(list)
    for r in rs:
        g[(key(r),) + ((sub(r),) if sub else ())].append(r)
    return g


def mad_within(g, minn=2):
    """Mean absolute deviation of est from the group mean, pooled over balls in groups with >= minn balls."""
    tot, n = 0.0, 0
    for rs in g.values():
        if len(rs) >= minn:
            m = sum(r['estimated_woba_using_speedangle'] for r in rs) / len(rs)
            tot += sum(abs(r['estimated_woba_using_speedangle'] - m) for r in rs)
            n += len(rs)
    return (tot / n if n else float('nan')), n


for label, rs in (('2025', rows['2025']), ('2026', rows['2026']), ('2025+2026 pooled', rows['2025'] + rows['2026'])):
    g = groups(rs)
    rep = {k: v for k, v in g.items() if len(v) >= 2}
    multi = [k for k, v in rep.items() if len({round(r['estimated_woba_using_speedangle'], 4) for r in v}) > 1]
    spread = [max(r['estimated_woba_using_speedangle'] for r in v) - min(r['estimated_woba_using_speedangle'] for r in v) for k, v in rep.items() if k in set(multi)]
    print(f'\n== {label}: exact keys {len(g)}; keys seen >= 2 times {len(rep)}; of those, more than one distinct estimate {len(multi)} ({100 * len(multi) / len(rep):.1f}%)')
    if spread:
        print(f'   range (max-min) inside a multi-estimate key: median {st.median(spread):.3f}, p90 {sorted(spread)[int(.9 * len(spread))]:.3f}, max {max(spread):.3f}')
    print(f'   pooled MAD about the key mean (irreducible error of an (EV, LA)-only lookup): {mad_within(g)[0]:.4f} on {mad_within(g)[1]} balls')

# Where does the spread live? bb_type.
pool = rows['2025'] + rows['2026']
print('\n== Spread by bb_type (pooled, exact keys with >= 2 balls). MAD = mean abs deviation from the key mean.')
for bt in ('ground_ball', 'line_drive', 'fly_ball', 'popup', ''):
    sub = [r for r in pool if r['bb_type'] == bt]
    g = groups(sub)
    m, n = mad_within(g)
    multi = sum(1 for v in g.values() if len(v) >= 2 and len({round(r['estimated_woba_using_speedangle'], 4) for r in v}) > 1)
    rep = sum(1 for v in g.values() if len(v) >= 2)
    print(f'   {bt or "(blank)":12s} balls {len(sub):6d}  MAD {m:.4f} on {n:6d} repeated-key balls; keys with >1 estimate {multi}/{rep}')

# Does a sub-key explain the spread? Compare MAD with the key alone to MAD with key + variable, on the SAME balls.
print('\n== Does one more variable explain the spread? Same balls, groups of key vs key+variable (balls in key+variable groups of >= 2).')
for name, sub in (('bb_type', lambda r: r['bb_type']), ('hit_location', lambda r: r['hit_location']), ('stand', lambda r: r['stand']),
                  ('season', lambda r: r['game_date'][:4]), ('game_type', lambda r: r['game_type']),
                  ('p_throws', lambda r: r['p_throws']), ('batter', lambda r: r['batter'])):
    g_sub = groups(pool, sub)
    keep = {id(r) for v in g_sub.values() if len(v) >= 2 for r in v}
    pool_k = [r for r in pool if id(r) in keep]
    m_key, n = mad_within(groups(pool_k))
    m_sub, _ = mad_within(groups(pool_k, sub))
    print(f'   {name:13s} n={n:6d}  MAD key only {m_key:.4f}  key+{name} {m_sub:.4f}  ratio {m_sub / m_key:.2f}')

# Season drift on the same exact key
print('\n== Same exact key in both seasons: does the estimate move between 2025 and 2026?')
g25, g26 = groups(rows['2025']), groups(rows['2026'])
diffs = []
for k in set(g25) & set(g26):
    a = st.mean(r['estimated_woba_using_speedangle'] for r in g25[k])
    b = st.mean(r['estimated_woba_using_speedangle'] for r in g26[k])
    diffs.append((b - a, len(g25[k]), len(g26[k])))
print(f'   keys in both seasons: {len(diffs)}; mean diff (2026-2025) {st.mean(d for d, _, _ in diffs):+.4f}; mean |diff| {st.mean(abs(d) for d, _, _ in diffs):.4f}')
w = [d for d, a, b in diffs if a >= 2 and b >= 2]
print(f'   keys with >= 2 balls in each season: {len(w)}; mean diff {st.mean(w):+.4f}; mean |diff| {st.mean(abs(x) for x in w):.4f}')


# ---- The same test inside ONE season, with a control. Splitting a group always shrinks its spread a little, so a random
# label with the same group sizes shows what "no information" looks like. Season is removed by using 2026 only.
import random
from xwoba_sprint import speeds
sp = speeds('2026')
rng = random.Random(11)
rand_label = {id(r): rng.randrange(2) for r in rows['2026']}
tert = sorted(sp.values())
lo_cut, hi_cut = tert[len(tert) // 3], tert[2 * len(tert) // 3]


def sprint_bucket(r):
    v = sp.get(int(r['batter']))
    return None if v is None else (0 if v < lo_cut else 1 if v < hi_cut else 2)


print('\n== Inside 2026 only: key vs key+variable on the same balls. A random 2-way label is the control (ratio shows the no-information value).')
r26 = rows['2026']
for name, sub, sel in (('random label (control)', lambda r: rand_label[id(r)], None), ('bb_type', lambda r: r['bb_type'], None),
                       ('hit_location', lambda r: r['hit_location'], None), ('stand', lambda r: r['stand'], None),
                       ('p_throws', lambda r: r['p_throws'], None), ('game_type', lambda r: r['game_type'], None),
                       ('random label, LA < 10 only', lambda r: rand_label[id(r)], lambda r: r['launch_angle'] < 10),
                       ('sprint-speed third, LA < 10 only', sprint_bucket, lambda r: r['launch_angle'] < 10),
                       ('sprint-speed third, LA >= 10 only', sprint_bucket, lambda r: r['launch_angle'] >= 10)):
    pool_s = [r for r in r26 if (sel is None or sel(r)) and (name.startswith('sprint') is False or sprint_bucket(r) is not None)]
    g_sub = groups(pool_s, sub)
    keep = {id(r) for v in g_sub.values() if len(v) >= 2 for r in v}
    pool_k = [r for r in pool_s if id(r) in keep]
    m_key, n = mad_within(groups(pool_k))
    m_sub, _ = mad_within(groups(pool_k, sub))
    print(f'   {name:36s} n={n:6d}  MAD key only {m_key:.4f}  key+variable {m_sub:.4f}  ratio {m_sub / m_key:.2f}')
