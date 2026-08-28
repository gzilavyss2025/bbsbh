# Who wins an extension?

A research spike (W3.3, contracts-data program) over `scripts/data/contracts/extensions.csv`
— 999 signings. It asks a simple question with a hidden cost inside it: when a
club locks up a player before free agency, does the club come out ahead, or
does the player? The answer needs a price for a win, and that price decides
the answer more than anything else this spike tested.

Panels: `.scratch/contracts-extensions/fa-war-price.json` and
`.scratch/contracts-extensions/extension-outcomes.json`. Build script:
`.scratch/contracts-extensions/build-panel.mjs`. Analysis script:
`.scratch/contracts-extensions/analyze-extension-value.mjs`. Both re-run with
`node <path>` and reproduce every number below from files already checked
into the repo — no live pull needed.

## The window

`extensions.csv` signings run 1992-2026, not 2000-2026 (46 rows sign before
2000 — `docs/contracts-data-caveats.md` already states this; re-confirmed
here against the live file). `final_year` runs past 2025 on contracts still
being played out. This spike can only SCORE a deal once every season of it
has been played, so it drops any row whose `final_year` exceeds 2025 (the
last season `public/data/war-history/*.json` carries). **118 of 999 rows are
dropped this way, and the drop is not random**: the excluded rows average
$96.8M guaranteed and center on 2024, against $27.0M and 2010 for the rows
that could be scored. Anything this spike says about "who wins" describes
older, smaller extensions more than it describes today's market.

Ten more rows have no resolved player id in
`public/data/contracts-history/identity/extensions.json` (of 999, 968 exact,
21 fuzzy, 10 unresolved) and are dropped. Sixteen fuzzy-confidence matches
stay in the scored set — a small, known source of noise, not excluded,
because ADR-0066's crosswalk is the only identity join this program uses and
re-deriving one here would drift from it. Seven more rows have a resolved id
but no `war-history` row anywhere in the contract's window (the player never
appeared in a big-league box score inside it — usually a career-ending
injury right after signing). **864 of 999 rows are scored.**

## The price of a win — stated up front, the way the dispatch demands

A dollar guaranteed only means something next to what it bought. This spike
prices a win using the league's own free-agent market, in
`free_agency.csv` — not an outside estimate — because that file already sits
in this repo, already carries a resolved player id, and is literally the
open market an extension is judged against.

**Every USABLE free-agent contract** (a real numeric AAV, a real numeric
year count, a resolved player id) contributes one observation per season it
has actually been played: `(that season's AAV, that season's delivered WAR)`.
3,314 of 5,598 free-agency rows qualify (2,250 fail because `aav` is a status,
not a number — the minor-league-deal sentinel and other prose this program's
ground truth already flags; 30 more have no resolved id). Those 3,314 deals
produce 5,206 season-level observations, pooled by PERFORMANCE year, not
signing year, so an unfinished five-year deal still prices the seasons of it
that have already happened.

Two estimates come out of that pool, on purpose, because the spike prompt
requires testing an alternative:

- **RATIO** (primary): `sum(AAV) / sum(WAR delivered)` within a season — the
  average price the market paid per win bought that year, including the
  baseline pay a below-replacement season still draws.
- **SLOPE** (alternative): the slope of AAV regressed on WAR within that
  season — the MARGINAL price of an extra win, net of the fixed cost every
  signed player draws regardless of production.

Season-specific figures, not one constant across 26 years, as required:

| season | n | RATIO $/WAR | SLOPE $/WAR |
| --- | --- | --- | --- |
| 1992 | 74 | $1.79M | $0.25M |
| 2000 | 122 | $3.53M | $1.09M |
| 2010 | 172 | $6.22M | $1.50M |
| 2019 | 158 | $10.13M | $1.87M |
| 2025 | 183 | $11.14M | $3.86M |

Full table: `fa-war-price.json`'s `bySeason`, one row per 1991-2025.

**This choice is not a footnote — it flips the headline finding.** Scored
against RATIO pricing, clubs come out ahead on 572 of 864 extensions (66.2%).
Scored against SLOPE pricing, clubs come out ahead on only 177 of 864
(20.5%). A spike that reported "the club won" without saying which of these
it meant would have reported nothing, exactly as the dispatch warns. Both are
defensible: RATIO answers "what would this exact production have cost to buy
on the open market that year"; SLOPE answers "what is the league's marginal
cost of one more win, net of the baseline every roster spot costs anyway."
This spike cannot pick one as simply correct — it reports both, side by side,
everywhere below.

**2020 era check.** The 60-game season prices at $26.07M/WAR (RATIO) and
$4.38M/WAR (SLOPE) — both far above every other season (next-highest RATIO:
$12.99M in 2018) — because a full-season AAV sits over a season's WAR that
was mechanically capped at roughly a third of a normal year's games. This is
an artifact of the schedule, not a real market move. 91 of the 864 scored
extensions have a window touching 2020. Rescoring with 2020 priced as
unpriced (rather than at its inflated rate) moves the headline only slightly
— RATIO 66.2%→64.7%, SLOPE 20.5%→19.9% — so the 2020 anomaly is real but not
the thing driving the headline split.

## What is robust to the price choice, even though the headline split is not

The dollar amount of "who wins" swings hard on RATIO vs. SLOPE. The
DIRECTION of every cut below does not. That is the finding this spike ships
with confidence.

### Cut 1 — service time at signing

The dispatch's own framing: a player extended at low service time is selling
arbitration or even pre-arbitration years he has not earned yet; one
extended past free-agent eligibility is selling years the market would have
bid on anyway.

| bucket | n | club-win % (RATIO) | club-win % (SLOPE) | median surplus/$ (RATIO) |
| --- | --- | --- | --- | --- |
| pre-arb (<2 yrs) | 86 | 84.9% | 60.5% | +415% |
| arb-era (2-<5 yrs) | 401 | 74.3% | 24.7% | +128% |
| FA-era (>=5 yrs) | 377 | 53.3% | 6.9% | +14% |

The row-level version of the same relationship: Spearman(service time at
signing, surplus per guaranteed dollar) = **-0.4206 (RATIO)** / **-0.4076
(SLOPE)**, n=864, permutation p<0.0002 on 5,000 within-sample reshuffles for
both. **Leave-one-signing-year-out (34 refits, one signing year dropped at a
time): the negative sign survives 34 of 34 refits, under both pricings.** The
earlier a club locks a player up, the better the deal reads for the club —
under either honest way of pricing a win.

### Cut 2 — age at signing

Same shape, same robustness:

| bucket | n | club-win % (RATIO) | club-win % (SLOPE) |
| --- | --- | --- | --- |
| <=25 | 148 | 87.8% | 46.6% |
| 26-29 | 361 | 71.5% | 19.9% |
| 30-33 | 241 | 52.3% | 10.4% |
| 34+ | 114 | 50.9% | 9.6% |

Spearman(age, surplus/$) = **-0.3845 (RATIO)** / **-0.3737 (SLOPE)**, p<0.0002
both, sign survives 34 of 34 leave-one-signing-year-out refits. Age and
service time move together here (older players usually carry more service
time too), so these two cuts are not independent confirmations of two
different things — they are close to the same underlying fact seen two ways.

### Cut 3 — hitters vs. pitchers: tested, not assumed, and the honest answer is a null

The dispatch predicted the pitcher answer would be worse for the club. It is
worse on the simple win-rate view — pitchers win for the club on 64.1% of
deals (RATIO) / 16.7% (SLOPE) against hitters' 67.6% / 23.1% — but that gap
does not survive a sharper test. The mean surplus per guaranteed dollar is
**not distinguishable between the two groups**: hitters 142.4% vs. pitchers
144.3% under RATIO (permutation p=0.9436), hitters -35.7% vs. pitchers -32.8%
under SLOPE (permutation p=0.6500). n=516 hitters, n=348 pitchers — plenty of
size to detect a real gap if one were there. **Verdict on this cut: no-ship.**
The predicted pitcher penalty does not hold up once tested properly; the
win-rate view that suggested it was closer to noise than signal.

## The front-office axis

`gm` sits on every scored row but is a messy column: the same executive
appears under a full name, a smushed initial ("AFriedman"), a spaced initial
("J Byrnes"), a typo ("MGirsh" for "MGirsch"), or bundled with a co-executive
in one cell ("JMozeliak / MGirsch"). `.scratch/contracts-extensions/gmNames.mjs`
canonicalizes: 134 raw name fragments across the 999-row file collapse to
119 distinct people. A joint cell credits the extension to both named
executives — the file does not say which of the two actually drove the deal.

39 executives clear a reporting floor of 8 scored extensions each — still
thin, and this spike refuses to name anyone below that floor, and treats
even those above it cautiously (a single big miss or hit swings a n=8 median
hard). Ranking those 39 by median service time at signing and testing
against median surplus per guaranteed dollar:

**Spearman(median service time at signing, median surplus/$) = -0.4289
(RATIO) / -0.3451 (SLOPE), n=39 executives, permutation p=0.0090 (RATIO).**

This is significant, but it is largely a restatement of Cut 1 at the
front-office level, not independent evidence: an executive who personally
tends to sign extensions early will, almost by construction, show the same
pattern Cut 1 already found at the player level. Read it as a confirmation
that the effect is not concentrated in one or two front offices, not as a
new, separate finding, and read no single name in the 39-person table as a
verdict on that person — the n per executive is too small for that, and this
spike does not attempt it.

## Verdicts

- **The headline "who wins" number: no-ship as a single figure.** It reads
  66.2% club-favorable or 20.5% club-favorable depending on a defensible,
  stated choice of win price, and this spike cannot collapse that range to
  one number with the data on hand.
- **Earlier extensions favor the club, later ones favor the player: holds.**
  Robust across both pricing choices, at the row level and the bucket level,
  and survives all 34 leave-one-signing-year-out refits.
- **Younger players at signing favor the club more than older ones: holds**,
  on the same evidence, though it substantially overlaps with the service-time
  finding rather than adding an independent one.
- **Pitchers are worse extension bets for the club than hitters: no-ship.**
  A simple win-rate view suggested it; a permutation test on the actual
  surplus magnitude found no distinguishable gap (p=0.94 RATIO, p=0.65
  SLOPE). This is a real null, not a hedge.
- **Early-extending front offices do better per dollar: holds, but
  read as a restatement of the service-time finding, not new evidence** —
  and no individual executive's name should be read as a verdict from a
  39-person table with an 8-deal reporting floor.

## What did not hold / open questions

- The single biggest number in this spike — the club-win percentage — does
  not hold across a plausible alternative price of a win. That IS a finding
  (the price choice matters more than almost anything else tested), not a
  failure to find one, but it means this spike cannot answer "did clubs win
  the extension era" with one number.
- Right-censoring (118 of 999 rows, averaging 3.6x the guarantee of the
  scored rows and centered three seasons later) means every number above
  describes an OLDER, SMALLER population of extensions than the one clubs
  are signing today. As more of 2021-2025's extensions finish playing out,
  this spike should be re-run rather than trusted as a read on today's market.
- Sixteen scored rows carry a fuzzy-confidence identity match rather than an
  exact one. Not large enough to move the headline, but not zero.
- This spike never re-derives player identity, WAR, or the free-agency
  guarantee/AAV parsing — it reuses `src/lib/contracts/parseMoney.js`,
  `public/data/contracts-history/identity/*.json`, and
  `public/data/war-history/*.json` exactly as W0 and the WAR generator built
  them. A defect discovered later in any of those three feeds this spike's
  numbers directly.
- The SLOPE price-of-win estimator extrapolates its regression line down to
  WAR=0, past most of the data it was fit on (most free agents deliver 0-4
  WAR in a season) — its intercept should not be read as a literal
  replacement-level salary. Reported here as an alternative price for
  robustness, not as a claim about replacement-level pay.
- No test in this spike controls for the four postseason-bracket eras or any
  other structural break inside 1992-2025 beyond the 2020 season-length
  check above. A future pass could refit Cuts 1-2 within era bands the way
  the team-success spikes already do for postseason outcomes.
