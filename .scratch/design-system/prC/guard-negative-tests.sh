#!/usr/bin/env bash
# Proves the padding/gap rule in scripts/check-typography.mjs fails on each
# thing it claims to catch, and passes on each thing it claims to allow.
#
# The repo does not unit-test its check-*.mjs guards, and this one cannot be
# imported: it reads a fixed path and runs on import. So the evidence lives
# here instead of in test/. Every case mutates a real partial, runs the guard,
# and restores the file with `git checkout`. It needs a clean src/styles/.
#
# Run from the repo root: bash .scratch/design-system/prC/guard-negative-tests.sh
#
# The line numbers and anchor strings below were true at ADR-0085. If a case
# reports FAIL because its anchor moved, repoint the anchor — do not weaken the
# assertion.
set -u

run() { node scripts/check-typography.mjs >/tmp/g.out 2>&1; echo $?; }

t() { # name  expect(0|1)  grep-pattern
  local name="$1" expect="$2" pat="$3"
  local code; code=$(run)
  local hit="-"
  if [ -n "$pat" ]; then grep -qF "$pat" /tmp/g.out && hit="matched" || hit="MISSING"; fi
  if [ "$code" = "$expect" ] && { [ -z "$pat" ] || [ "$hit" = "matched" ]; }; then
    echo "PASS  $name  (exit $code, $hit)"
  else
    echo "FAIL  $name  (exit $code, expected $expect, $hit)"
    sed -n '1,6p' /tmp/g.out
  fi
}

echo "--- 0. clean tree ---"
t "clean tree is green" 0 ""

echo "--- 1. a swept literal put back raw ---"
sed -i 's|^  gap: var(--space-1);$|  gap: 4px;|' src/styles/77-express-lane.css
t "raw 4px in gap fails" 1 "4px is raw"
git checkout -- src/styles/77-express-lane.css

echo "--- 2. a raw half-step value ---"
sed -i 's|^  gap: var(--space-1);$|  gap: 6px;|' src/styles/77-express-lane.css
t "raw 6px in gap fails" 1 "6px is raw"
git checkout -- src/styles/77-express-lane.css

echo "--- 3. a NEW odd value not on the ledger ---"
sed -i 's|^  gap: var(--space-1);$|  gap: 17px;|' src/styles/77-express-lane.css
t "unlisted 17px fails" 1 "17px is raw"
git checkout -- src/styles/77-express-lane.css

echo "--- 4. a LISTED literal removed: ledger must come down ---"
sed -i 's|padding-left: 36px|padding-left: var(--space-10)|' src/styles/report/charts.css
t "listed-but-gone fails" 1 "SPACING_RESIDUE lists 3x 36px"
git checkout -- src/styles/report/charts.css

echo "--- 5. a padding LONGHAND, previously unmatched by the old shape ---"
sed -i '238s|^  padding-bottom: var(--space-2);$|  padding-bottom: 17px;|' src/styles/07-team-logo-and-buttons.css
t "padding-bottom longhand is now scanned" 1 "padding-bottom: 17px"
git checkout -- src/styles/07-team-logo-and-buttons.css

echo "--- 6. scroll-padding-inline must NOT be swallowed ---"
sed -i 's|scroll-padding-inline: var(--space-1);|scroll-padding-inline: 17px;|' src/styles/52-highlight-clip-card.css
t "scroll-padding-inline stays out of this rule" 0 ""
git checkout -- src/styles/52-highlight-clip-card.css

echo "--- 7. a nudge is exempt, not an error ---"
sed -i 's|^  gap: var(--space-1);$|  gap: 2px;|' src/styles/77-express-lane.css
t "2px nudge passes" 0 ""
git checkout -- src/styles/77-express-lane.css

echo "--- 8. the four prose comments would fail WITHOUT the strip ---"
grep -n 'padding: .half has no padding' src/styles/12-sealbox.css >/dev/null && echo "  comment 1 present"
grep -n 'gap: 4px\` from the old five-separate-chips' src/styles/03-slate-header.css >/dev/null && echo "  comment 4 present"
node -e '
const {readFileSync}=require("fs");
const RAW=/(?<![\w.-])(-?\d+(?:\.\d+)?)px(?![\w-])/;
const HEAD=/(?<![\w-])(?:padding(?:-top|-right|-bottom|-left|-inline-start|-inline-end|-block-start|-block-end|-inline|-block)?|(?:row-|column-)?gap)\s*:\s*([^;]+);/g;
let n=0;
for(const f of ["src/styles/12-sealbox.css","src/styles/boxlines/boxlines.css","src/styles/boxlines/gamelines.css","src/styles/03-slate-header.css"]){
 const raw=readFileSync(f,"utf8");
 const stripped=raw.replace(/\/\*[\s\S]*?\*\//g,b=>b.replace(/[^\n]/g," "));
 const a=[...raw.matchAll(HEAD)].length, b=[...stripped.matchAll(HEAD)].length;
 if(a!==b){n+=a-b;console.log("  "+f+": "+(a-b)+" comment-only match(es) removed by the strip");}
}
console.log(n>0?"PASS  the strip removes "+n+" comment match(es)":"FAIL  the strip removed nothing");
'

echo "--- final: tree restored ---"
git status --short src/styles | head
t "clean tree still green" 0 ""
