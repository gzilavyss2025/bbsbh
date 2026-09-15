# The probes

Every number in `../probes.md`, and every number in issues #1038 and #1055,
comes out of one of these. They are kept so the claims can be re-checked rather
than believed — a measurement nobody can re-run is an assertion.

Each is a standalone Node script with no imports from the app and no arguments.
Run from the repo root:

```
node .scratch/offseason-design/probes/<name>.mjs
```

**They hit `statsapi.mlb.com`, so they need the Bash sandbox off**
(`dangerouslyDisableSandbox`), and a connect timeout is worth one retry.

Several sample randomly but **seed the shuffle**, so a re-run picks the same
games and reproduces the same answer.

## #1038 step 1 — the offseason probes

| Script | Question | Answer it gave |
| --- | --- | --- |
| `gap.mjs` | Counting every sport, how long is the offseason? | **12 days** — Feb 8–19 2026 |
| `gap2.mjs` | Per level TAB, how long is it dark? | MLB 110, AAA 175, AA 179, A+ 197, A 196 |
| `probe1b.mjs` | What share of a played MiLB season is scoreable? | **135 of 135 sampled**, all four levels |
| `scoreless.mjs` | What are the rows a schedule gives no score? | 87 A+ rows; **65 were played** |
| `wire.mjs` | Is the roster wire thin in the offseason? | No — 223 rows in the deadest week |

## #1055 — the winter-ball probes

| Script | Question | Answer it gave |
| --- | --- | --- |
| `winter-tabs.mjs` | How many winter leagues play the same day? | Median **4**, peak **6** |
| `winter-marks.mjs` | Do the clubs have marks and abbreviations? | 36 of 36 across five leagues; **ABL 0 of 4** |
| `winter-feeds.mjs` | Are the feeds complete? | **60 of 60** sampled games |
| `pitchdepth.mjs` | How many pitches per play does each league record? | ~3.9 everywhere, **PWL 1.69** |
| `coverage.mjs` | What does dropping a league cost in days? | Dropping PWL costs **0 days** |
| `fixtures.mjs` | One verified game per league, for tests | The gamePks in #1055 |

`pitchdepth.mjs` is the one worth reading before adding a league. `winter-feeds.mjs`
asks whether a play has *any* pitch event and PWL passes it; `pitchdepth.mjs`
asks how *many* and PWL fails by half. The first question is not enough.
