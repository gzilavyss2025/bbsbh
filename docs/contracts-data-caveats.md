# Contracts data — what these four files can and cannot support

The historical contract data lives in four checked-in Excel exports under
`scripts/data/contracts/`. Every money page, spike and generator downstream reads
them. This document states what the files actually contain, which statistics
survive their defects, and which do not. Cite it instead of re-deriving a
coverage claim.

All figures below were measured from the files on 2026-08-27, at commit
`9c77710a`. `test/contracts-data-caveats.test.js` pins the classification and the
structural claims, so a regenerated export that changes what the data MEANS fails
`npm test` and sends the next reader back here. It deliberately leaves the
per-season row counts and dollar totals unpinned: those move whenever a source
fix lands, and this document names the commit it read them at.

## The files

| file | rows | key column | window |
| --- | --- | --- | --- |
| `salaries.csv` | 27,349 | `year` | 2000–2026 |
| `free_agency.csv` | 5,598 | `year` | 1991–2026 |
| `arbitration.csv` | 2,420 | `season` | 2018–2026 |
| `extensions.csv` | 999 | `signed_date` | 1992–2026 |

The windows come from the files, not from an earlier note. Three of them correct
figures quoted elsewhere in this program:

- **Arbitration covers nine seasons only** — 2018 (212 rows), 2019 (263), 2020
  (257), 2021 (246), 2022 (307), 2023 (309), 2024 (299), 2025 (242), 2026 (285).
  There is no arbitration row before 2018. Any arbitration series that claims to
  start in 2000 is wrong.
- **Extensions start in 1992, not 2000.** 46 rows carry a `signed_date` before
  2000, spread over 1992 (4), 1993 (4), 1994 (1), 1995 (1), 1996 (7), 1997 (11),
  1998 (8) and 1999 (10). 40 rows have a `first_year` before 2000. Six rows carry
  no `signed_date` at all. `first_year` runs to 2027, because a club can sign a
  deal before its first season starts.
- **Free agency starts in 1991.** ADR-0066 already removed 45 section-divider
  rows from this file at the source, so all 5,598 rows are player rows.

## The population break, and what it costs

`salaries.csv` holds about 870 rows a season from 2000 to 2016, and about 1,240
from 2017 on. 2015 is a single spike at 1,683. **The break is entirely in rows
that carry no salary figure.** The salaried population does not step:

| era | rows a season | rows with a salary figure |
| --- | --- | --- |
| 2000–2002 | 559–716 | 559–716 |
| 2003–2014 | 800–883 | 800–883 |
| 2015 | 1,683 | 887 |
| 2016 | 869 | 869 |
| 2017–2026 | 1,206–1,269 | 875–974 |

### What survives

- **Season dollar totals, from 2006 on.** Sum the rows that carry a numeric
  salary. The total is stable and it moves smoothly: $2,274,676,824 (2006) to
  $5,112,468,062 (2026), with no step at 2015 or 2017.
- **The salaried player count, from 2006 on** — 863 to 974 a season, flat.
- **The median salary among salaried rows.** It reproduces
  `salaries_summary.csv`'s own `median_salary` exactly in 26 of 27 seasons.

### What does not survive

- **Any row count read as a player count.** A 2018 row count of 1,239 and a 2014
  row count of 883 measure different things.
- **Any per-player share, mean or median taken over the file as delivered.**
  3,974 rows have no salary. They cannot enter a dollar statistic, and they must
  not enter its denominator.
- **Any service-time distribution across the break.** The unsalaried block has a
  different shape in 2015 than in every other year (see anomaly 2).
- **Any dollar total before 2006.** 2000 lists 559 salaried players, 2001 lists
  631 and 2002 lists 716. Thirty clubs each carry a 25-man active roster, so the
  league floor is 750 players. Those three seasons are provably incomplete, and
  2003–2005 (800, 829, 848) sit close enough to the floor to be suspect. The
  file's early totals under-report the league, and they under-report it by an
  unknown amount, because the missing men are the cheap ones.

## Anomaly 1 — 88 duplicate (year, player) pairs

All 88 groups hold exactly two rows: 176 rows in total. They are three different
things and they take three different rules.

### 27 groups — a repeated row (export artifact)

Both rows agree on position, service time and salary, to the dollar. Six players
account for all 27, and each is repeated in **every consecutive season he
appears**, which is the signature of one duplicated worksheet row rather than a
per-season event:

| player | seasons | groups |
| --- | --- | --- |
| Anderson, Garret | 2000–2009 | 10 |
| Robertson, Nate | 2004–2009 | 6 |
| Proctor, Scott | 2006–2009 | 4 |
| Branyan, Russell | 2001–2003 | 3 |
| Stokes, Brian | 2007–2009 | 3 |
| Villarreal, Oscar | 2003 | 1 |

Garret Anderson played for one club through 2008, so "traded and listed twice"
cannot explain him.

**Rule: de-duplicate. Keep one row of each pair.**

**Cost when wrong:** $89,426,775, spread over 2000–2009 — $3.25M in 2000 rising
to $17.8M in 2008. If these were two real payments, a de-duplicated 2008 total
under-reports by 0.7%. That is the smaller error, and it sits inside a decade
this document already marks as incomplete.

### 26 groups — an obligation row (money without a roster spot)

One row of the pair — both rows, for Aaron Miles in 2010 — has **no position and
no service time**. That shape is structural, not accidental: 67 rows in the whole
file carry it, in 2003 (1), 2004 (1), 2005 (1), 2010 (39), 2017 (21), 2023 (1)
and 2026 (3). They total $359,568,572. They are money a club owed a man who was
not on its roster, and `salaries.csv` has no club column, so the paying club is
lost.

Two sub-shapes, and they behave differently:

- **Twinned — 25 rows, $110,009,167.** A second club's share of a traded player's
  salary. The player's own row already carries the **full** salary, so the money
  is counted twice. Roy Halladay 2010: `$15,750,000` on his own row, `$6,000,000`
  on the blank row — Toronto's share of a Philadelphia salary. Julio Lugo 2010:
  `$9,250,000` on both rows. Jose Reyes 2017: `$22,000,000` and `$21,465,000`.
- **Orphan — 42 rows, $249,559,405.** Released, retired or bought-out players with
  no roster row anywhere. 2017 alone holds 20: Josh Hamilton ($28,410,000), Carl
  Crawford ($21,857,143), Alex Rodriguez ($21,000,000), Melvin Upton Jr.
  ($16,050,000) and more. This money is real and nothing else records it.

**Rule: keep the row, and never count it as a player. For a dollar total,
subtract it when a row for the same name and year carries a position; keep it
when no such row exists.**

**Cost when wrong:** at most $110,009,167 wrongly removed, or at most
$249,559,405 wrongly kept. Both land almost entirely in 2010 and 2017. The rule
removes a 5.3% bulge from 2017 and a 4.4% bulge from 2010, and the series then
rises without a kink: $3.746B (2015), $3.862B (2016), $3.874B (2017), $4.020B
(2018). Leaving the rows in makes 2017 a peak that no other evidence supports.

### 35 groups — two different men with one name

Fifteen names. Each pair was confirmed against
`public/data/contracts-history/season-players/`, which lists who appeared in MLB
each season with an MLB id, so this is a check and not a guess:

| name | seasons | evidence |
| --- | --- | --- |
| Young, Chris | 2007–2011, 2014–2017 | 432934 (P, debut 2004), 455759 (CF, debut 2006) |
| Smith, Will | 2020–2024 | 519293 (P, debut 2012), 669257 (C, debut 2019) |
| García / Garcia, Luis | 2021–2023 | 472610 (P, debut 2013), 677651 (P, debut 2020), 671277 (1B, debut 2020) |
| Castillo, Diego | 2022–2023 | 650895 (P, debut 2018), 660636 (SS, debut 2022) |
| Muncy, Max | 2025–2026 | 571970 (3B, debut 2015), 691777 (3B, debut 2025) |
| Ortiz, Luis | 2023–2024 | 656814 (P, debut 2018), 682847 (P, debut 2022) |
| Gonzalez, Miguel | 2014–2015 | 456068 (P, debut 2012), 646057 (P, debut 2014) |
| Nunez, Abraham | 2003–2004 | 119865 (3B), 346863 (LF) |
| Carpenter, Chris | 2012 | 112020 (P, debut 1997), 452764 (P, debut 2011) |
| Thompson, Rich | 2004 | 430829 (LF, debut 2004), 460366 (P, debut 2007) |
| Taylor, Michael | 2015 | 446345 (RF, debut 2011), 572191 (RF, debut 2014) |
| Castro, Ramon | 2003 | 135783 (C, debut 1999), 425792 (2B, debut 2004) |
| Sanchez, Angel | 2015 | 447816 (SS, debut 2006), 605795 (P, debut 2017) |
| Smith, Kevin | 2022 | 675656 (SS, debut 2021), plus a left-handed pitcher |
| Duffy, Matt | 2016 | 622110 (3B, debut 2014), 592274 (3B, debut 2015) |

Four of these resolve only because the pool was searched across seasons: the
second man had not yet debuted, or had already stopped appearing, in the season
on the row. That is ADR-0066's rule working as designed.

**Rule: keep both rows. Never merge them, and never sum them.**

**Cost when wrong:** merging Will Smith's two 2022 rows attributes $13,730,000 to
one man and deletes a catcher from the league. A payroll total does not change;
every per-player statistic does.

**Zero duplicates are unexplained.** Every one of the 88 falls into a named
category above.

**One field-level defect survives inside a resolved pair.** Both 2016 Matt Duffy
rows carry an `mls` of `1.059`. The two men debuted a year apart, so one of the
two values is copied. The rows stay and the identities stand, but the service-time
cell is not trustworthy for that pair.

## Anomaly 2 — 2015 has 1,683 rows

2015 is 887 salaried rows plus a block of 796 rows with **no salary figure**. The
salaried half is sound: 887 sits between 2014 (883) and 2016 (869), and the 2015
dollar total of $3,746,155,682 sits between 2014's $3,438,566,573 and 2016's
$3,861,698,943. Nothing about 2015's payroll is unusual.

The unsalaried block is what is unusual. It sorts by service time ascending, from
`0` up to Jason Giambi at `19.082`. **157 of its rows carry three or more years of
major-league service.** Every other block carries between one and 14. The gap
widens further at five years: 2015 holds 90 such rows, and no other block holds
more than five. The deepest service in any other block is `11.086`.

Only 43% of the 2015 block appeared in an MLB game in 2015, against 68–74% for
the 2017–2026 blocks, and 119 of the 157 veterans did not appear at all —
Guillermo Quiroz, Travis Blackley, Armando Galarraga, Scott Sizemore and the like.

So 2015 is not a duplicate, an error, or a payroll event. It is one season where
the source compiled its "no salary listed" section from a wider pool: unsigned
free agents and out-of-MLB veterans as well as the pre-arbitration men every later
season lists.

**Rule: 2015 needs no special handling once unsalaried rows are excluded. Never
use 2015's row count, its block size, or its service-time distribution in a series
with other seasons.**

**Cost when wrong:** treating 2015's 1,683 rows as a population doubles the
apparent league in one year and puts a spike in every rate that divides by it. No
dollar figure moves either way — all 796 rows are empty of money.

## Anomaly 3 — the row count steps at 2017

Row counts go from about 870 a season (2000–2016) to about 1,240 (2017–2026). The
dollar totals show no matching step, and neither does the salaried count: 869
salaried in 2016, 890 in 2017, 879 in 2018.

The step is the unsalaried block arriving and staying. It is absent from 2000 to
2014 and from 2016, present once in 2015 (796 rows), and present in every season
from 2017 on: 347, 360, 349, 307, 363, 295, 298, 284, 277, 298. From 2017 the
block is drawn tightly — almost every row is under three years of service, and
three or four a year are above it. These are 40-man players whose salary the
source will not state.

The source changed **who it lists**, not what clubs paid.

**Rule: count and total on rows that carry a numeric salary. That count is the
comparable population across the whole file. The raw row count is not.**

**Cost when wrong:** a per-row average over 2018's 1,239 rows reads $3,245,000
when the salaried average is $4,573,000 — a 29% understatement that looks like a
market cooling and is not.

## Blank rates, with denominators

Every rate below divides by the file's full row count.

**`salaries.csv`** (27,349 rows)

- no salary: 3,974 = **14.5%**. 3,974 cells are empty; one more cell reads
  `forfeited` (see below).
- no service time: 8,041 = **29.4%**. This is a coverage window, not scatter:
  **all 7,970 rows from 2000 to 2009 have an empty `mls`**, and only 71 of the
  19,379 rows from 2010 on (0.4%) do. Never read a service-time statistic before
  2010.
- no position: 67 = 0.2% — the obligation rows of anomaly 1, exactly.

**`free_agency.csv`** (5,598 rows)

- no guarantee: 1,045 = **18.7%**
- no agent: 1,454 = **26.0%**
- no AAV: 2,211 = **39.5%**
- no term in years: 947 = 16.9%
- no new club: 214 = 3.8%

**`arbitration.csv`** (2,420 rows)

- no player request: 2,210 = **91.3%**
- no club offer: 1,770 = **73.1%**
- no settled salary: 473 = 19.5%
- no prior salary: 141 = 5.8%

The two headline rates mean the file cannot support a "player asked X, club
offered Y" analysis. Nine cases in ten state no request. A filed-figures study
would run on 210 rows across nine seasons, and those rows are the cases that
reached a hearing — a biased sample, not only a small one.

**`extensions.csv`** (999 rows)

- no guarantee, no AAV, no service time: **0%**. This file is the complete one.
- no agent: 18 = 1.8%
- no signed date: 6 = 0.6%

## Five more defects a consumer must handle

1. **One salary cell is a word, not a number.** 2021 Robinson Cano reads
   `forfeited`. He was suspended for the season and lost the salary. Treat a
   non-numeric salary as a status, exactly as ADR-0052 treats an out-year code:
   it adds no dollars, and it is not a salaried player. `salaries_summary.csv`
   already does this — its 2021 `players_with_salary` of 905 is one below the 906
   rows that hold something in the salary column.
2. **48 names carry a trailing asterisk, in 2025 and 2026 only.** `"Ohtani,
   Shohei*"`, `"Betts, Mookie*"` and `"Devers, Rafael*"` are three of 30 men
   marked for deferred money. The same 30 appear without the asterisk in 259 other
   rows. Strip the asterisk before any join on the name, or the same player splits
   in two.
3. **Names carry spelling errors that break a join.** 2010 holds both
   `"Taveras, Willy"` and `"Tavares, Willy"`, and `"Padillia, Vicente"` for
   Vicente Padilla. Those pairs do not group, so 88 is a floor on the duplicate
   count, not a ceiling.
4. **`salaries.csv` has no club column.** Its columns are `year`, `player`,
   `position`, `mls`, `salary`. A club payroll cannot be built from this file
   alone, and an obligation row can never be attributed to the club that paid it.
5. **The `position` cell sometimes holds a job title, not a playing position.**
   49 rows read `mgr` (40), `spec ass't to GM` (4), `VP, AGM` (2), `GM`,
   `SVP, GM` or `Manager`. One more reads `72000017`. The export wrote a man's
   later role over the position he played. **27 of those 50 rows are real player
   salaries** — Robin Ventura at $8,500,000 in 2001 and again in 2002, Brad
   Ausmus at $5,500,000 in 2003, Tyler O'Neill at $4,950,000 in 2023, and rows
   for Mike Matheny, Joe Girardi, Craig Counsell, Mike Redmond and A.J. Hinch.
   They total $74,756,667. The other 23 rows ($12,250,000) are genuine non-player
   salaries: Tony La Russa, Dusty Baker, Billy Beane, Brian Cashman and other
   managers, coaches and executives.

   The split was decided by asking `season-players/` whether the man appeared in
   an MLB game that season. It was not decided by reading the position cell.
   **Never filter this file by position to drop non-players.** That filter
   deletes $74,756,667 of real player salary, and it trusts the one field that is
   wrong. Filter on whether the man played.

## Why the CSVs were not edited

`salaries_summary.csv` is a mechanical rollup of `salaries.csv`: its
`total_payroll`, `players_with_salary` and `median_salary` reconcile against the
detail rows exactly in 26 of 27 seasons, with 2021 off by the one `forfeited`
cell. Removing the 27 repeated rows from the detail file would therefore make the
summary wrong for 2000–2009 unless both files changed together. That is a
deliberate, separately reviewed change, and it is not this document's job.

The rules above are the contract instead. Apply them at read time.

ADR-0066 removed 45 divider rows from `free_agency.csv` at the source, because
those rows were not player rows at all. A repeated player row is a different case:
the row is real, and only the second copy is wrong.
