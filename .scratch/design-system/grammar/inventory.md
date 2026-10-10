# Grammar inventory — player and team pages (2026-10-09)

Measured in Chromium at 390 px against the dev server with live MLB data, computed
styles via `getBoundingClientRect` and `getComputedStyle`. Routes: `/player/660670`
(+ `/stats` `/analytics` `/history`), `/player/694819` (starting pitcher, Misiorowski),
`/player/661388` (catcher, Contreras), `/player/815690` (Single-A prospect, Emerson,
org rank 12), `/team/158` (+ `/roster` `/games` `/numbers` `/contracts` `/minors`).
**M** = measured in the render. **I** = inferred from the CSS rule only (the element
did not render on a route I walked).

Ways drawn today: bar/track **13**, rail/plot **5**, stat tile **6**, rank cell **6**,
table header **5**, card head **9**, number format **4**, empty state **1 (undrawn)**,
colour meaning **5 sets**.

## Bar or track

| # | Class | File | Height | Ends | Fill / track | |
|---|---|---|---|---|---|---|
| 1 | `.pctstrip__bar` | `26a-percentile-strip.css` | 3px | square left, 1.5px right | navy at 55% | M |
| 2 | `.team-score__meter` | `28-team-hub.css` | 3px | pill | `--accent-primary` on `--border-hairline` | I |
| 3 | `.team-score__track-base` | `28-team-hub.css` | 2px | 2px | rule-soft rail, 16px tick | M |
| 4 | `.pitchslab__meter` | pitch slab | 5px | pill | track `--rule-soft` | M |
| 5 | `.cmdrecv__track` | `26g-command-received.css` | 7px | pill | track paper-3, bar navy | M |
| 6 | `.devbar` / `__fill` | player stats | 11px box, 7px fill | box 3px, fill square | paper-3 box, navy fill | M |
| 7 | `.pitchmix__bar` | `27-player-position-innings.css` | 12px | 3px | segments | M |
| 8 | `.spray__dirbar` | `73-spray-map.css` | 14px | 6px | track `--rule-soft` | M |
| 9 | `.rvsplit__track` | `75-run-value.css` | 18px | 3px | track manila | M |
| 10 | `.prospectcard__track` | `31d-prospect-card.css` | 24px, 1px axis | n/a | axis hairline | I |
| 11 | `.contractcard__barfill` | `26b-player-contract.css` | 72px column | top 6px | navy | M |
| 12 | `.cliff__bar` | team Contracts | 72px column | square | marker-soft | M |
| 13 | `.ovr` bars | `ovr/card.css` | tick-marked track | n/a | `--ovr-*` six tiers | I |

Heights in use: 2, 3, 5, 7, 11, 12, 14, 18, 24 px. Radii in use: square, 1.5, 2, 3
(`--radius-xs`), 6 (`--radius-sm`), pill.

## Rail or plot (the five of design.md §14.D)

| Mark | Class | Note |
|---|---|---|
| stacked bar | `.rvsplit` | 18px, 3px radius (M) |
| dot-plot rail with league tick | Comebacks `.cbk__*` | head 21h (M) |
| scatter + trend line | ABS `.chal__*` | |
| form rail | `.team-score__trackrow` | 44px track, 111px row (M) |
| workload marks | Bullpen health | |
| (player) percentile strip | `.pctstrip__track` | 28px row, bar 3px (M) |

## Stat tile

| # | Class | Measure | |
|---|---|---|---|
| 1 | `.ovrtile` | 44px, 24px display number, 12px label, centred | M |
| 2 | `.ctr__tile*` (team Contracts) | 28px mono value, 12px display label, left, no box | M |
| 3 | `.horizontile__statbox` | 46px, radius 6px, paper-3 fill, 13px mono value, 12px label | M |
| 4 | `.team-score` rank tile | marker pill 18h, radius 20px, 11px mono | M |
| 5 | `FactGrid` (`ui/frame`) | shared part | I |
| 6 | ledger row (Records) | label left, figure right, dotted door | I |

## Rank cell

| # | Class | Measure | |
|---|---|---|---|
| 1 | `.pctstrip__rank` | 16px mono, right, 35px wide | M |
| 2 | `.prankhist__rank` | 16px mono, right | M |
| 3 | `.rvcard__rank` | 13px body face, right | M |
| 4 | `.cmdrecv__rank` | 11px mono, right | M |
| 5 | `.chal__rank` | 13px mono, left | M |
| 6 | `.team-score__rank` | marker pill, 11px mono, left | M |

## Table header

| # | Class | Measure | |
|---|---|---|---|
| 1 | `.lft` / team standings `th` | 12px display, graphite, 26h, 0 border | M |
| 2 | `.formtrend__*head` | same face, right-aligned | M |
| 3 | `.ctr__*head` | 12px display, graphite, 29h, `--rule` bottom line; year col in amber 13px | M |
| 4 | `.awardtbl__lgcol` | 12px display, graphite, 26h | M |
| 5 | `.chal__who` | 13px **body** face, ink, 68h (no real header) | M |

## Card head

| # | Class | Measure | |
|---|---|---|---|
| 1 | `.pitchslab__head` | navy fill, 39h | M |
| 2 | `.prospectcard__head` | paper-0 fill, 45h | M |
| 3 | `.levelprog__head` | paper-0 fill, 94h (head plus rows) | M |
| 4 | `.gamelines__head` | paper-0 fill, 28h, 12px **mono** | M |
| 5 | `.rvcard__head` | bare, 73h | M |
| 6 | `.cbk__head` | bare, 21h | M |
| 7 | `.moundstrip__head`, `.cthist__head`, `.txntl__head`, `.awardblk__head`, `.staffgrid__head` | bare, 14 to 20h | M |
| 8 | team `thub-card__head` | club fill, 3px club accent (design.md §3) | I |
| 9 | `.tledg__block-title` | app navy, not club | I |

## Number and unit format

| # | Where | Format |
|---|---|---|
| 1 | percentile strip | 16px mono right, bare integer |
| 2 | rv card | 13px body face, signed value |
| 3 | tile values | 24px display (OVR), 28px mono (Contracts), 13px mono (horizontile) |
| 4 | rank | "6 OF 64", "3RD OF 30 CLUBS", "2ND", "org rank" (design.md §3) |

## Empty state

One, undrawn: a head with one line of text (Ballpark card 91 to 93 px). No shared part
exists in `ui/state` for a chart that has no data (I).

## Colour meaning

| Set | Where | Tokens |
|---|---|---|
| navy only | percentile, devbar, cmdrecv, contract bars | `--accent-primary` |
| green good / clay bad | team rank tile, ABS | `--accent-positive`, `--accent-negative` |
| six OVR tiers | OVR tile and menu | `--ovr-bench/starter/regular/allstar/mvp/legend` |
| marker fill | team-score rank chip | `--marker` |
| club identity | card head bar | club triad, ADR-0030 |
