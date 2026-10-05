"""Save Savant's pitch-arsenal-stats BATTER board for one season to /tmp/xwoba-cache/board-{year}.csv.
Usage: python3 xwoba_fetch_board.py 2026 [min]      One request. Run it after the day pull ends (one Savant request at a time).
"""
import sys
from h import curl

year = sys.argv[1]
mn = sys.argv[2] if len(sys.argv) > 2 else '10'
url = f'https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=batter&pitchType=&year={year}&team=&min={mn}&csv=true'
for attempt in range(3):
    body, meta, secs, err = curl(url, 120)
    if meta.startswith('200') and body.strip():
        open(f'/tmp/xwoba-cache/board-{year}.csv', 'wb').write(body)
        lines = body.decode('utf-8-sig').count('\n')
        print(f'saved board {year} min={mn}: {len(body)} bytes, {lines} lines, {secs:.1f}s, head: {body[:160]!r}')
        break
    print('try', attempt + 1, meta, err[:80])
