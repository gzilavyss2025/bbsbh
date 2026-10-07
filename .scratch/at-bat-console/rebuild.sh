#!/usr/bin/env bash
# Rebuild every mockup page for #1389 from the repo root:
#   bash .scratch/at-bat-console/rebuild.sh
# Needs network (statsapi.mlb.com, baseballsavant.mlb.com). Writes only to
# node_modules/.cache/innings-console/ (not committed). Then open the pages:
#   opt-A.html, opt-B.html, opt-C.html   round 1: notation options
#   stage.html#v1 / #v2 / #v3            round 2: animated stage
#   onescreen.html#o1 / #o2              round 3: one screen (the current design)
set -euo pipefail
C=node_modules/.cache/innings-console
H=.scratch/innings-console-redesign/mockup
A=.scratch/at-bat-console
mkdir -p "$C/savant"
node $H/build-data.mjs                                 # canvas data, six games, app modules
node $A/tools/variants.mjs                             # data-A/B/C.json, the notation options
for o in A B C; do node $H/build-page.mjs "$C/data-$o.json" "$C/opt-$o.html"; done
# Savant, two showcase games: /gf (bat speed, flight time) and the Statcast CSV
# (swing path; fills the morning after a game). Each /gf file is about 2.4 MB.
for pk in 823169 823035; do
  [ -s "$C/savant/$pk.json" ] || curl -sf --max-time 60 "https://baseballsavant.mlb.com/gf?game_pk=$pk" -o "$C/savant/$pk.json"
  [ -s "$C/savant/$pk.csv" ] || curl -sf --max-time 60 "https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=batter&game_pk=$pk" -o "$C/savant/$pk.csv"
done
node $A/stage/enrich.mjs "$C/data-B.json" "$C/data-stage.json" "$C/savant"
node $A/stage/build.mjs "$C/data-stage.json" "$C/stage.html"
node $A/stage/build.mjs "$C/data-stage.json" "$C/onescreen.html" onescreen
echo "built: $C/{opt-A,opt-B,opt-C,stage,onescreen}.html"
