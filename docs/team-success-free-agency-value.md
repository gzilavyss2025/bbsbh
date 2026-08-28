# The free-agent market: does it pay for what it gets?

Research spike, 2026-08-28. Uses `scripts/data/contracts/free_agency.csv`
(5,598 signings, 1991-2026) joined to career WAR
(`public/data/war-history/`). No earlier entry in this program has touched
the contracts data; this is the first.

**The question.** When a club signs a free agent, is it paying for what the
player already did, or for what he is about to do? And where does the gap
between the two run widest?

**The answers, in order of how much weight they carry.**

1. **The market prices the recent past far more than it prices what
   actually comes next.** Holding a signing's age, era and what the player
   went on to produce all fixed, how good he had been over the previous
   three seasons still explains a large share of his pay. Holding his prior
   three seasons fixed instead, what he actually produced during the new
   deal barely moves the price at all. This is the winner's curse working
   exactly the way scouts describe it: teams buy the player they just watched,
   not the player who shows up next year.
2. **A long deal's last season is a different, worse player than its
   first.** On deals of four years or longer, the average free agent's final
   season is worth about a win and a half less than his first, and three in
   four such deals end lower than they started. This held up no matter which
   signing year was set aside and checked separately.
3. **The gap between what a player was doing and what he goes on to do grows
   with age, with contract length, and least of all for recognized
   starting pitchers.** A player in his late 20s gives back about a quarter
   of his recent production; a player 37 or older gives back over half. The
   longest deals (seven years or more) give back the most of any group, over
   half of what the player was producing when he signed.
4. **Changing clubs does not, on its own, buy a bigger contract.** A free
   agent who leaves his old team gets paid about the same as one who
   re-signs, once age, recent production and era are held fixed. The whole
   difference between "movers" and "stayers" in the raw numbers comes from
   who those two groups are, not from switching clubs paying extra.
5. **An agency's own name barely moves the price, once its clients are
   compared to similar players.** Two firms — Boras Corp. and ACES — carry a
   small, real premium after controls; one firm, Octagon, carries a small,
   real DISCOUNT. Every other agency checked is indistinguishable from
   chance. Representation matters far less than which players a firm signs.
6. **A fifth of this file's guarantees are not dollars at all**, and reading
   them as dollars would have wrecked every number above. See "the trap"
   below — this spike is the one the whole contracts-data program built its
   defenses around.

## The story behind the numbers

Barry Bonds signed a five-year, $90 million deal with the Giants after the
2001 season, coming off 12.7 WAR the year before. He gave the Giants 10-12
wins a year for three more seasons — one of the best free-agent deals ever
struck — and then, in the fourth year, his body gave out: 0.7 wins, then 3.2
in the last year of the deal. Cliff Lee's five-year Phillies deal
(2011-2015) opened at 7.5 wins and closed at zero. Alfonso Soriano's eight-year
Cubs contract (2007-2014) opened at 6.7 wins and closed BELOW replacement
level, at -0.9. Mark Teixeira's eight years with the Yankees (2009-2016)
follow the same arc: 5.2 wins in year one, -0.7 in year eight. None of these
four players were bad signings — all four were stars who had just proven it
— but every one of them was paid, for years four through eight, on the
strength of a player who no longer existed.

The flip side shows up just as clearly, usually on one-year deals nobody
much noticed. Bret Boone signed a one-year, $3.25 million contract with
Seattle in 2001 after two mediocre seasons. He hit 37 home runs and put up
7.8 WAR — the best season of his career, delivered for a fraction of what
the stars above were making. Randy Velarde ($800,000, 1999) and Aubrey Huff
($3 million, 2010) did the same thing on an even smaller scale. A short deal
lets the market's guess be wrong for only one year; a long deal lets it be
wrong for the rest of the contract.

## The trap this spike was built to avoid

`free_agency.csv` writes the number "1" in its `guarantee` column, 1,156
times — 20.7% of every row in the file — as a flag for a minor-league deal,
not as one dollar. Reading it as a dollar figure (a syntactically valid
number, which is exactly how it slips through) pulls every guarantee toward
zero: the 2020 median guarantee reads $3,000,000 with the sentinel misread,
against the real $6,050,000 once it is excluded. Both figures were
reproduced here as a sanity check before a single other number in this doc
was trusted (see `analyze-free-agency-market.mjs`'s output). Every dollar
figure in this document passed through `parseMoneyCell(raw, column, row)`
(`src/lib/contracts/parseMoney.js`), which classifies that sentinel as a
`minor-league-deal` status rather than a number, and does the same for two
related edge cases and the free-text majors salary buried in the `details`
column. `docs/contracts-data-caveats.md` section 5 has the full defect.

**The usable-guarantee denominator is 39.3%, not 18.7%.** 18.7% of rows
leave the guarantee cell blank; a further fifth of the file states "1"
instead of a dollar. 39.3% of the 5,598 rows carry no usable guarantee
figure at all, and every market statistic in this document that touches a
dollar excludes them rather than silently treating them as zero.

## What "fully scored" means, and what got left out

For every signing, this spike sums the player's career WAR
(`public/data/war-history/`, batting plus pitching, MLB Advanced Media's own
calculation) over the exact seasons his contract covers, and separately over
the three seasons immediately before he signed.

`public/data/war-history/` only carries COMPLETED seasons — 2025 is the
newest one, since 2026 is still being played. **A contract cannot be scored
until every one of its seasons has finished**, so this spike excludes, and
counts, every signing whose contract runs past 2025: 2,441 of 5,598 rows,
including all 75 rows with no confirmed identity match (`mlbId`) to join WAR
against. That leaves **3,157 fully-scoreable contracts**, and 3,123 of those
also carry a usable AAV — the set every "does the market pay for X" number
below is measured on.

**Dollars are compared using an index, not deflated.** A 1991 dollar and a
2025 dollar are not the same thing, and this repo has no inflation series to
convert between them — the same gap `docs/team-success-research.md` already
flags for a historical payroll factor. Instead, every AAV is divided by that
SAME SIGNING YEAR's median AAV among usable rows, producing `aavIndex`: a
free agent at `aavIndex = 2.0` signed for twice that year's going rate,
whatever that rate was worth in real dollars. Every correlation and bucket
average below uses this index, never a raw dollar figure spanning eras.

## Two eras, checked before being trusted

`qualifying_offer` holds two unrelated systems in one column, and pooling
them would measure a rule change instead of a market: the old free-agent
compensation regime (Type A, 751 rows; Type B, 765; Type C, 273) ran through
2012, and the current qualifying-offer system (`rejected`, 138 rows;
`accepted`, 19) starts in 2013. This was checked against the rows
themselves rather than assumed — Type A and Type B both stop exactly at
2012, Type C stops at 2007, and the earliest `rejected` row is 2013 — so the
boundary lands cleanly on one offseason. This spike does not build a
qualifying-offer-specific analysis (no earlier program prompt called for
one), but the boundary matters anyway: it sits three years before the
minor-league sentinel's own 1991-2023 window ends, so a reader should not
assume the two eras line up.

## The main question: past WAR or future WAR?

On the 3,123 fully-scoreable, AAV-usable signings:

- A player's index-priced AAV correlates with what he did over the PRIOR
  three seasons at 0.645 (Spearman).
- The same AAV correlates with what he goes on to deliver, per year, during
  the new contract at only 0.390.
- Holding age, signing year, and what the player actually delivers all
  fixed, what he did BEFORE signing still explains price at 0.574.
- Holding age, signing year, and what he did BEFORE signing all fixed, what
  he goes on to DELIVER only explains price at 0.146.

Both controlled numbers cleared a shuffle test with zero exceedances in
2,000 tries each, and held their sign in every one of 35 tests that dropped
one signing year and recomputed (0.568-0.578 for the past-performance
number, 0.136-0.154 for the future-delivery number — narrow ranges, no
flips). The market's price tracks the player it just watched far more
closely than the player it is about to get.

## Where the gap runs widest

For each fully-scoreable signing, "the gap" is the player's own prior WAR
per year minus what he actually delivered per year during the contract —
how much less he gave than the level he was paid to sustain. "Decline
ratio" turns that into a percentage of his own prior level, so a $300
million ace and a bench infielder land on the same scale.

**By age at signing:**

| Age band | n | prior WAR/yr | actual WAR/yr | decline |
| --- | --- | --- | --- | --- |
| 28-30 | 492 | 1.68 | 1.24 | 26% |
| 31-33 | 1,116 | 1.30 | 0.77 | 41% |
| 34-36 | 916 | 1.12 | 0.63 | 44% |
| 37+ | 574 | 1.31 | 0.63 | 52% |

(A 25-signing band of players 27 and under is left out of this table — too
thin to trust on its own, though its raw numbers point the same direction.)

**By contract length:**

| Length | n | prior WAR/yr | actual WAR/yr | decline |
| --- | --- | --- | --- | --- |
| 1 year | 1,915 | 0.99 | 0.60 | 40% |
| 2-3 years | 968 | 1.47 | 0.88 | 40% |
| 4-6 years | 215 | 3.06 | 1.79 | 42% |
| 7+ years | 25 | 5.33 | 2.31 | 57% |

Longer deals go to the league's best players by construction (a one-year
deal's average signee produced 1 win a year before signing; a seven-year
deal's averaged 5.3), and those same players give back the largest slice of
what made them stars in the first place. The 7+ year band is only 25
signings — a real number, not a settled one.

**By position, role tag permitting:** starting pitchers who carry an
explicit "starter" tag give back the smallest share of their own level (27%
of 520 signings) of any group; every hitting position and generic pitcher
group gives back 42-49%. Most pitcher rows in this file (976 of 1,496) carry
no starter/reliever tag at all, so this comparison likely mixes true
frontline starters against journeyman relief arms inside that 976-row
bucket, and the clean 27% for tagged starters should be read as the more
trustworthy of the two pitching numbers.

## Does a long deal's last year return less than its first?

Yes, sharply, on both cuts tried:

- **Deals of 3+ years** (n=528): average first-year WAR 2.0, average
  last-year WAR 1.1 — a 0.9-win drop. 68% of these deals end lower than they
  started. A shuffle test that randomly flips each deal's own decline never
  produced a swing this large in 5,000 tries.
- **Deals of 4+ years** (n=240): the drop is bigger — 2.6 wins down to 1.1,
  a 1.5-win fall, in 77% of deals.

Both results held their direction in every one of 32-33 tests that dropped
one signing year and recomputed. This is one of the most reliable findings
in this program to date.

## Does changing clubs pay?

3,312 signings resolve a real old club and a real new club and carry a
usable AAV. In the raw numbers, someone who left resold for a bit more than
someone who stayed (index 1.00 vs. 0.92) — but a player who re-signs and a
player who leaves are not the same kind of player to begin with: a team
mostly brings back the ones it wants, and lets the rest walk. Holding age,
recent production, era and the pitcher/hitter split all fixed, that gap
disappears (partial correlation -0.01, indistinguishable from a coin flip
across 2,000 shuffles). **Changing clubs does not pay a premium on its
own** — the raw gap was the players, not the move.

## The agent axis

430 distinct agent names appear in this file; this spike ranks the top
eight by raw signing count within `free_agency.csv` alone (a wider count
that also pools in `extensions.csv` reorders this list, so a different
scope produces a different top eight — this document's scope is stated
here, not assumed):

| Agency | Signings |
| --- | --- |
| Boras Corp. | 382 |
| ACES | 228 |
| Excel | 149 |
| CAA | 137 |
| Wasserman | 135 |
| Hendricks Sports | 122 |
| Octagon | 96 |
| ISE | 89 |

No canonicalization across spelling variants was attempted for these eight
except a manual check on CAA, which also appears as "CAA / Roc Nation," "CAA
- C Close" and five more spellings (9 more signings); folding those in still
leaves CAA behind Excel. Beyond these eight names, 429 raw strings were left
as written — 35 years of agency mergers and rebrands were not untangled
here, and a name that looks new in a later decade may be an old firm under
a new banner.

**The agent field is missing on 1,487 rows (26.6%), and it is not missing
at random.** Signings with a known agent carry a noticeably higher median
price than signings with no agent recorded (index 1.08 vs. 0.53), and the
gap widens in the newer era rather than closing (2013-2026: 1.00 vs. 0.25,
though only 31 blank-agent rows remain by then). A raw ranking of "which
agency's clients sign for more" would be measuring, in part, which
agencies' signings happened to get recorded at all.

**Holding the player fixed** (same age, same recent production, same
signing year, same broad pitcher/hitter split), only two of the eight
agencies show a real, if small, premium: Boras Corp. (partial correlation
+0.057, cleared 2,000 shuffles at p=0.0025) and ACES (+0.051, p=0.0055).
Octagon shows a real, small DISCOUNT (-0.051, p=0.003). The other five —
Excel, CAA, Wasserman, Hendricks Sports, ISE — are indistinguishable from
zero. The naive story ("Boras's guys sign for more") is mostly true only
because Boras represents better players; once that is held fixed, the
premium that survives is real but small.

## What this does not settle

- **Contract "years" is read as stated, ignoring opt-outs.** A player who
  opts out early still has his deal's full stated length scored here,
  because the file does not record when (or whether) an opt-out clause was
  exercised. This likely understates how quickly a club's exposure to
  decline actually ends in practice.
- **Prior WAR uses three seasons before signing, always, even for a
  rookie.** A player debuting the same year he signs (or one year before)
  will show an artificially low "prior WAR" that reflects too few seasons
  rather than a true talent level. This affects a small share of rows.
- **The 7+ year contract-length band is 25 signings.** Real, not a chance
  result on its own weight, but the thinnest cut in this document.
- **The agent-fixed-effect model controls for a broad pitcher/hitter split,
  not for a detailed position.** A firm that happens to represent more
  starting pitchers than shortstops could show a premium this model
  attributes to the agency rather than the mix of positions it signs.
- **The 21 identity collisions flagged across this contracts program**
  (docs/team-success-research.md's W0 foundation work) were not
  individually re-checked against this file's rows; they touch 0.08% of
  attributed dollars program-wide and were left as-is.
- **Nothing here is causal for the agent or club-change questions.** A
  small surviving partial correlation says an agency or a move is
  associated with a price difference after the controls used here, not that
  hiring that agency would change a given player's price.

## Where the work lives

`.scratch/team-success/`:

- **`build-free-agency-market.mjs`** — builds the 5,598-row panel from
  `scripts/data/contracts/free_agency.csv`, the ADR-0066 identity crosswalk,
  and `public/data/war-history/`. Every guarantee/AAV cell goes through
  `parseMoneyCell(raw, column, row)`. Writes `free-agency-market.json`.
- **`free-agency-market.json`** — the cached panel: one row per signing,
  carrying identity, position group, both club codes, contract terms, and
  season-by-season WAR for the contract's own years plus the three seasons
  before. Registered in `scripts/research-db.mjs` as
  `team_success_free_agency_market` (one row overall; `unnest(players)` for
  the per-signing table, the same shape `trade-deadline-panel.json` already
  uses).
- **`analyze-free-agency-market.mjs`** — every statistic in this document:
  the sentinel sanity check, the era-boundary check, the main correlation
  and its partial-correlation/permutation/leave-one-season-out battery, the
  three overpay-bucket tables, the last-year-vs-first-year test, the agent
  axis, and the changing-clubs test. Writes
  `free-agency-market-findings.json`.
