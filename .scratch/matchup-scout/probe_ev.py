"""How often does the statsapi feed carry exit velocity for a ball in play, versus Savant?"""
from collections import Counter
from h import *

def ok(v):
    return v not in ('', 'NA', None)

tot = Counter()
for date, n in [('2026-09-20', 6), ('2026-06-14', 4), ('2025-08-20', 4)]:
    d = jget(f'/api/v1/schedule?sportId=1&date={date}&gameType=R')
    pks = [g['gamePk'] for dt in d['dates'] for g in dt['games'] if g['status']['abstractGameState'] == 'Final'][:n]
    for pk in pks:
        feed = jget(f'/api/v1.1/game/{pk}/feed/live')
        feed_bip = feed_ev = 0
        missing_events = Counter()
        for play in feed['liveData']['plays']['allPlays']:
            for e in play.get('playEvents', []):
                if not e.get('isPitch'):
                    continue
                code = (e.get('details') or {}).get('code')
                if code in ('X', 'D', 'E'):          # in play
                    feed_bip += 1
                    hd = e.get('hitData') or {}
                    if hd.get('launchSpeed') is not None:
                        feed_ev += 1
                    else:
                        missing_events[play['result'].get('event')] += 1
        rows, nb, sc, mt, hd = savant({'game_pk': str(pk), 'player_type': 'batter', 'hfGT': 'R|'})
        s_bip = [r for r in rows if r['description'] == 'hit_into_play']
        s_ev = [r for r in s_bip if ok(r['launch_speed'])]
        print(f'{date} pk={pk}: BIP feed={feed_bip} savant={len(s_bip)} | with EV: feed={feed_ev} savant={len(s_ev)}'
              f' | feed-missing by event: {dict(missing_events.most_common(4))}')
        tot['feed_bip'] += feed_bip
        tot['feed_ev'] += feed_ev
        tot['s_bip'] += len(s_bip)
        tot['s_ev'] += len(s_ev)
print()
print(f"TOTAL balls in play: feed {tot['feed_bip']} / savant {tot['s_bip']}")
print(f"  with exit velocity: feed {tot['feed_ev']} ({100*tot['feed_ev']/max(1,tot['feed_bip']):.0f}%)  savant {tot['s_ev']} ({100*tot['s_ev']/max(1,tot['s_bip']):.0f}%)")
