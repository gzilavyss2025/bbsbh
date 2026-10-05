"""Does the statsapi feed's pitch location match Savant's, in 2025 and in 2026?
Also: do pitch-type codes agree?"""
import statistics as st
from collections import Counter
from h import *


def games_on(date, n=2, gt='R'):
    d = jget(f'/api/v1/schedule?sportId=1&date={date}&gameType={gt}')
    out = []
    for dt in d.get('dates', []):
        for g in dt['games']:
            if g['status']['abstractGameState'] == 'Final':
                out.append(g['gamePk'])
    return out[:n]


targets = []
for date, gt in [('2025-06-14', 'R'), ('2025-08-20', 'R'), ('2026-06-14', 'R'), ('2026-09-20', 'R'), ('2026-09-30', 'F')]:
    for pk in games_on(date, 2, gt):
        targets.append((date, gt, pk))

type_pairs = Counter()
for date, gt, pk in targets:
    feed = jget(f'/api/v1.1/game/{pk}/feed/live')
    fp = []
    for play in sorted(feed['liveData']['plays']['allPlays'], key=lambda p: p['about']['atBatIndex']):
        for e in play.get('playEvents', []):
            if not e.get('isPitch'):
                continue
            pd = e.get('pitchData', {}) or {}
            co = pd.get('coordinates', {}) or {}
            fp.append(dict(
                code=(e.get('details', {}).get('type') or {}).get('code'),
                speed=pd.get('startSpeed'),
                px=co.get('pX'), pz=co.get('pZ'),
                top=pd.get('strikeZoneTop'), bot=pd.get('strikeZoneBottom'),
            ))
    rows, nbytes, secs, meta, head = savant({'game_pk': str(pk), 'player_type': 'batter', 'hfGT': ALLGT})
    rows.sort(key=lambda r: (int(r['at_bat_number']), int(r['pitch_number'])))
    ok = len(rows) == len(fp)
    line = f'{date} {gt} pk={pk} feed_pitches={len(fp)} savant_rows={len(rows)} aligned={ok}'
    if not ok:
        print(line)
        continue
    dx, dz, dtop, dbot, dspd = [], [], [], [], []
    for f, r in zip(fp, rows):
        type_pairs[(f['code'], r['pitch_type'])] += 1
        try:
            if f['px'] is not None and r['plate_x'] != '':
                dx.append(f['px'] - float(r['plate_x']))
            if f['pz'] is not None and r['plate_z'] != '':
                dz.append(f['pz'] - float(r['plate_z']))
            if f['top'] is not None and r['sz_top'] != '':
                dtop.append(f['top'] - float(r['sz_top']))
            if f['bot'] is not None and r['sz_bot'] != '':
                dbot.append(f['bot'] - float(r['sz_bot']))
            if f['speed'] is not None and r['release_speed'] != '':
                dspd.append(f['speed'] - float(r['release_speed']))
        except ValueError:
            pass

    def s(v):
        if not v:
            return 'n=0'
        return f'n={len(v)} mean={st.mean(v):+.4f} max|d|={max(abs(x) for x in v):.4f}'
    print(line)
    print('   pX-plate_x    ', s(dx))
    print('   pZ-plate_z    ', s(dz))
    print('   szTop-sz_top  ', s(dtop))
    print('   szBot-sz_bot  ', s(dbot))
    print('   speed diff    ', s(dspd))

print()
print('pitch type pairs (feed code, savant pitch_type) with count:')
same = sum(c for (a, b), c in type_pairs.items() if a == b)
tot = sum(type_pairs.values())
print(f'  agree {same}/{tot}')
for (a, b), c in sorted(type_pairs.items(), key=lambda x: -x[1]):
    if a != b:
        print('  MISMATCH', a, '->', b, c)
print('  feed codes   :', sorted({a for a, b in type_pairs}, key=str))
print('  savant codes :', sorted({b for a, b in type_pairs}, key=str))
