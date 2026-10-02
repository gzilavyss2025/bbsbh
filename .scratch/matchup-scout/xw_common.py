"""Shared loader for the xwOBA calibration spike (#1411 Part C). Python 3.11 standard library only.

load(year) reads the day files that xwoba_pull.py cached under /tmp/xwoba-cache and returns a list of
dict rows with the columns the spike needs, numbers already parsed to float or None. It caches the parse
in /tmp/xwoba-cache/parsed-{year}.pkl, so the second call is fast. Delete the pickle after a new pull.
"""
import csv, glob, gzip, io, os, pickle, sys

CACHE = '/tmp/xwoba-cache'
STR = ['game_date', 'game_type', 'stand', 'p_throws', 'pitch_type', 'description', 'events', 'type',
       'bb_type', 'hit_location']
NUM = ['game_pk', 'at_bat_number', 'pitch_number', 'batter', 'pitcher', 'woba_value', 'woba_denom',
       'launch_speed', 'launch_angle', 'estimated_woba_using_speedangle', 'plate_x', 'launch_speed_angle',
       'hc_x', 'hc_y']


def num(v):
    if v in ('', 'NA', 'null', None):
        return None
    return float(v)


def load(year, force=False):
    pkl = f'{CACHE}/parsed-{year}.pkl'
    days = sorted(glob.glob(f'{CACHE}/{year}-*.csv.gz'))
    if not force and os.path.exists(pkl) and os.path.getmtime(pkl) > os.path.getmtime(days[-1]):
        with open(pkl, 'rb') as fh:
            return pickle.load(fh)
    rows = []
    for path in days:
        with gzip.open(path, 'rt', encoding='utf-8') as fh:
            for r in csv.DictReader(fh):
                row = {k: r[k] for k in STR}
                for k in NUM:
                    row[k] = num(r[k])
                rows.append(row)
    with open(pkl, 'wb') as fh:
        pickle.dump(rows, fh)
    return rows


def bip(rows):
    """Balls in play with exit velocity, launch angle and Savant's estimate. Same filter as probe_xwoba.py."""
    return [r for r in rows if r['description'] == 'hit_into_play' and r['launch_speed'] is not None
            and r['launch_angle'] is not None and r['estimated_woba_using_speedangle'] is not None]
