#!/bin/bash
S=$(cd "$(dirname "$0")/.." && pwd)   # the age-shift folder; cache/ is created here and should not be committed
for t in batter pitcher; do for y in $(seq 2015 2025); do
 f=$S/cache/$t-$y.csv
 [ -s $f ] && [ $(wc -l <$f) -gt 5 ] && continue
 curl -sS -m 90 -o $f "https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=$t&year=$y&csv=true"
done; done
