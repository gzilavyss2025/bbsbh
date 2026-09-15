# ABS challenge report — working notes

The long-form thinking behind **#1072** and its children: seven questions about
ABS challenge behaviour across MLB and Triple-A, shipped as six new sections on
`/abs-challenges`, one revision to a board already there, and one card on the
team hub.

This directory is notes, not the tracker. The open work is in GitHub Issues.

| File | What it is |
|---|---|
| `research.md` | **Start here.** Every verified statsapi fact, every number quoted in an issue, and the traps each answer had to survive |
| `analysis.mjs` | Reproduces every figure in `research.md` from the row store. The spec the export cuts in #1058 to #1062 should agree with |
| `build-fixture.mjs` | Rebuilds `test/fixtures/abs-denominators.json` — the linescore and roster shapes the denominator work has to read correctly |
| `fetch-innings.mjs` | Sweeps both levels' schedules with `hydrate=linescore` into `final-innings.json` (gitignored, about a minute) |
| `fetch-exposure.mjs` | Sweeps every club's fullSeason roster into `exposure.json` (gitignored, about a minute) |
| `diag-*.mjs` | The one-off diagnoses behind #1073 and #1074 |
| `issues/` | The issue bodies as filed, so a reader can diff what was asked for against what shipped |
| `design/` | The `.dc.html` artboards behind the design canvas |

## Running the analysis

```
node .scratch/abs-reports/fetch-innings.mjs     # writes final-innings.json
node .scratch/abs-reports/fetch-exposure.mjs    # writes exposure.json
node .scratch/abs-reports/analysis.mjs          # every figure
node .scratch/abs-reports/analysis.mjs q2 q7    # or only the ones named
```

The two caches are derived and gitignored. Both rebuild in about a minute.
statsapi calls need the Bash sandbox off (`dangerouslyDisableSandbox`), and one
retry on a connect timeout.

## Design

Canvas: https://claude.ai/artifact/DdXwqNvni67o4MrJB3wkgY — a Phone page with one
artboard per surface and a Wide page at the app's real 960px frame. The `.dc.html`
files in `design/` are the source; the seeded canvas HTML is not committed
because it carries a 2 MB editor payload.

## Two things found on the way, both real bugs in what ships today

- **#1073** — the ledger counts 23 Triple-A games that were cancelled for rain
  and never played, plus one still-suspended game that is permanently
  incomplete. Triple-A's per-game figure is 4.365 published against 4.412 real.
- **#1074** — a club that reaches extra innings is issued another challenge. The
  lib models a two-challenge bank that is never topped up, so `ranOutByTeam` and
  anything counting "challenges in hand" is wrong from the tenth inning on.

Neither was in scope. Both were found by building the denominator, which is
what a denominator is for.
