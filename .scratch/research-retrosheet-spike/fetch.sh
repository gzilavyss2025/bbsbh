#!/usr/bin/env bash
# #2234 Retrosheet spike, step 0: download the inputs OUTSIDE the repo (ADR-0100,
# decision 3) and extract them. Usage: bash fetch.sh <dlDir> [firstYear] [lastYear]
# Then: node pull-schedules.mjs <dlDir>/sched, node join.mjs <dlDir>.
set -u
D=${1:?usage: bash fetch.sh <dlDir> [firstYear] [lastYear]}; A=${2:-1901}; B=${3:-2025}
case "$(realpath -m "$D")" in "$(git rev-parse --show-toplevel 2>/dev/null)"*) echo "refuse: $D is inside the repo"; exit 1;; esac
mkdir -p "$D/zip" "$D/chad" "$D/ev" "$D/gl"
for i in 0 1 2 3 4 5 6 7 8 9 a b c d e f; do
  curl -sS -f -o "$D/chad/people-$i.csv" "https://raw.githubusercontent.com/chadwickbureau/register/master/data/people-$i.csv" || echo "FAIL chad $i"
done
for y in $(seq "$A" "$B"); do
  curl -sS -f -o "$D/zip/${y}eve.zip" "https://www.retrosheet.org/events/${y}eve.zip" || echo "FAIL eve $y"
  curl -sS -f -o "$D/zip/gl${y}.zip" "https://www.retrosheet.org/gamelogs/gl${y}.zip" || echo "FAIL gl $y"
  sleep 0.3
done
for z in "$D"/zip/*eve.zip; do y=$(basename "$z" eve.zip); mkdir -p "$D/ev/$y"; unzip -q -o "$z" -d "$D/ev/$y"; done
for z in "$D"/zip/gl*.zip; do unzip -q -o "$z" -d "$D/gl"; done
