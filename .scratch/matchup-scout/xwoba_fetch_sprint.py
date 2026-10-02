"""Save Savant's sprint-speed leaderboard (ft/s, one row per player) for one season to /tmp/xwoba-cache/sprint-{year}.csv.
Usage: python3 xwoba_fetch_sprint.py 2025     One request. Run it when no day pull is running.
"""
import sys
from h import curl

year = sys.argv[1]
url = f'https://baseballsavant.mlb.com/leaderboard/sprint_speed?min_season={year}&max_season={year}&position=&team=&min=10&csv=true'
for attempt in range(3):
    body, meta, secs, err = curl(url, 120)
    if meta.startswith('200') and body.strip():
        open(f'/tmp/xwoba-cache/sprint-{year}.csv', 'wb').write(body)
        print(f'saved sprint {year}: {len(body)} bytes, {secs:.1f}s, head: {body[:300]!r}')
        break
    print('try', attempt + 1, meta, err[:80], body[:100])
