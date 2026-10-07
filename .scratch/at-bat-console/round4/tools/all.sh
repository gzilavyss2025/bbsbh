# Every shot of round 4: 3 directions x (sealed + 3 revealed moments) x 4 widths, plus the runners sheet.
OUT=${1:-/tmp/r4shots}; mkdir -p "$OUT"; cd "$(dirname "$0")"
for d in 1 2 3; do
  for st in "hr sealed" "hr rev" "abs rev" "sb rev"; do node shoot.mjs "$OUT" $d $st 2>&1 | grep -v -i -E 'undici|trace'; done
done
node shoot.mjs "$OUT" 1 sb rev '&sheet=1' 2>&1 | grep -v -i -E 'undici|trace'
