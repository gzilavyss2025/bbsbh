"""Does the Savant leaderboard pitch-arsenal-stats include the postseason?
Compares the board's `pitches` per pitch type with a Savant search for the same hitter, regular season only
versus regular season plus postseason.
Result 2026-10-02: the board equals the regular-season-only count. It is REGULAR SEASON ONLY.
Guerrero Jr. 2025 four-seam: board 679, regular 679, regular+postseason 768."""
import csv, io
from collections import Counter
from h import *

body, meta, secs, err = curl('https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=batter&pitchType=&year=2025&team=&min=1&csv=true', 90)
board = list(csv.DictReader(io.StringIO(body.decode('utf-8-sig'))))
for pid, nm in [(665489, 'Guerrero Jr.'), (592450, 'Judge'), (666182, 'Bichette')]:
    reg, _, _, _, _ = savant({'batters_lookup': [str(pid)], 'hfSea': '2025|', 'hfGT': 'R|', 'player_type': 'batter'})
    post, _, _, _, _ = savant({'batters_lookup': [str(pid)], 'hfSea': '2025|', 'hfGT': 'F|D|L|W|', 'player_type': 'batter'})
    r = Counter(x['pitch_type'] for x in reg if x['plate_x'] != '')
    p = Counter(x['pitch_type'] for x in post if x['plate_x'] != '')
    b = {x['pitch_type']: int(x['pitches']) for x in board if x['player_id'] == str(pid) and x['pitches']}
    print(f'{nm}: regular pitches={sum(r.values())} postseason pitches={sum(p.values())} board pitches={sum(b.values())}')
    for t in sorted(b, key=lambda k: -b[k])[:4]:
        print(f'   {t}: board={b[t]:4d}  regular={r.get(t,0):4d}  regular+post={r.get(t,0)+p.get(t,0):4d}')
