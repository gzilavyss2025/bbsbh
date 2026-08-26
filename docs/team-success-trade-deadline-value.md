# Trade-deadline value: buying wins, or just being good enough to buy

Research spike #7, 2026-08-26. First spike to test factor #7 on
`docs/team-success-research.md`'s catalog ("Trades / acquisition") — no
earlier entry in this program answers this question, and this spike does not
attempt that factor's full scope (reconciling deadline trades with the whole
season's transaction wire into one number). It runs narrower, on the deadline
alone.

**The question.** When a club adds more WAR at the trade deadline than it
gives away, does it go further that same October? And is that link the
deadline actually working, or mostly a case of good teams being the ones who
go shopping?

**The answers, in order of how much weight they carry.**

1. **The raw pattern is real, and it is strong.** Net value acquired at the
   deadline (WAR received minus WAR sent, same season) tracks how far a club
   goes on the 0-5 outcome ladder used everywhere in this program. It
   survives a permutation test, it survives dropping any one season, and it
   survives dropping any one club's entire five-year run. This part of the
   spike is not in question.
2. **But an independent adversarial check on this spike could not confirm the
   headline claim it set out to make, and the honest story is now a genuine
   open question, not a settled one.** The build's own confound check tried
   to answer "is this just good teams buying, not buying making teams good?"
   by holding aside each club's final record for the season. That check made
   the link nearly vanish, and the write-up called that a confirmed
   selection effect. A second, independently-run check used each club's
   record from the YEAR BEFORE instead of the same year's final record, on
   the reasoning that a club's final record already includes whatever the
   trade itself did to it in August and September. That check found almost
   no shrinkage at all. Both checks are reasonable. They point in close to
   opposite directions. Say plainly: this spike cannot tell you how much of
   the raw pattern is a deadline effect and how much is a selection effect.
   It can only say the true number sits somewhere in a wide range, and it
   does not know where.
3. **Net value acquired predicts making the tournament far more than it
   predicts winning once inside it.** Getting in shows a strong link. Going
   from "made it" to "reached the League Championship Series or better"
   shows a much weaker one. And among the clubs that already made it, buying
   more WAR at the deadline does not tell a division winner from a wild-card
   team apart at all — if anything the (very weak) lean runs the other way.
4. **This is the same worry the very first spike in this program raised, now
   checked directly.** The roster-age spike (`docs/team-success-roster-age.md`)
   suspected that a club already winning in July is exactly the club that
   goes and rents a veteran, which would make an older roster a SYMPTOM of
   being good rather than a CAUSE of it. This spike takes that same worry and
   points it at trades themselves, and finds the same shape: buying and
   winning travel together, and untangling which comes first turns out to be
   harder than either of the two most obvious ways of checking it can settle
   on its own.
5. **Four in every ten traded players carried no WAR at all in the season
   they were traded.** Almost all of them are unproven prospects the deadline
   sends out for future value, correctly scored as adding nothing to THIS
   season's ledger. A different question, "who won the trade three years
   later," would need a different kind of scoring than this spike's.

## The story behind the numbers

Two seasons make the shape of this spike concrete. In 2021 the Los Angeles
Dodgers added the second-most net WAR of anyone at the deadline and lost the
League Championship Series. The Texas Rangers did something similar in 2023
and won the World Series outright. On the other side of the ledger, the 2021
Washington Nationals sold off Max Scherzer and Trea Turner and finished at
the bottom of the net-WAR list, missing the postseason entirely, in almost
exactly the mirror shape of the Dodgers' gain. And the 2021 Oakland
Athletics added the SECOND-biggest net WAR of any club that year and still
missed the postseason, a reminder that buying well is not the same thing as
being good enough to cash it in.

That is the raw pattern working as advertised, both directions. The harder
question is what a club is really buying: value that wins games on its own,
or a stamp of having already been good enough to be a buyer in the first
place. This spike set out to answer that, and came back with a real result
narrower than the one it went looking for.

## What "net value acquired" means

For every trade at the deadline, each traded player's WAR for that same
season (batting and pitching summed for a two-way player) is counted on the
team that gave him up as a loss and on the team that got him as a gain. A
club's net value acquired is what it gained minus what it gave, across every
deadline trade it made that year. A club that made no trades scores zero,
same as any other club in the league that year, and every value here is
already relative to the rest of that year's league by construction: what one
club gains, some other club or clubs lose, so the whole league's net always
sums to zero every single season. There is no separate "compare to league
average" step needed the way there is for age or homegrown share.

## The data

150 team-seasons, 2021-2025 (30 clubs times 5 seasons, including clubs that
made no deadline trades that year), covering five World Series champions.
This is the thinnest window and the smallest pile of team-seasons tried
anywhere in this program so far, because the deadline-trade record this
spike draws on does not reach further back. Do not read this spike's numbers
side by side with the roster-age or joint-model spikes' 2000-2025,
750-team-season results, or pool them together. They are not the same size
of evidence.

Every player sent by one team in a deadline trade was checked against the
players received by the other side, across all 356 trades in the window, and
the two sets matched exactly every time. That rules out a double-counting
bug and is also why net value sums to zero every season without any
adjustment.

## The result

**The main link, and why it survives scrutiny.** Net value acquired tracks
the 0-5 outcome ladder strongly across all 150 team-seasons. A shuffle test
that reshuffled which club got which net-value number 5,000 times, keeping
each season's own shape intact, never once produced a link this strong by
chance. Dropping any one of the five seasons and refitting leaves the same
strong link every time. Dropping any one of the thirty clubs' entire run and
refitting does the same, in all thirty cases. None of this is fragile.

**How far the link reaches.** Split the ladder into bands and the shape
sharpens. Net value acquired strongly separates clubs that made the
postseason from clubs that did not. It separates clubs that reached the
League Championship Series or better from the rest much more weakly. And
among the clubs that already made the tournament, it does not separate
division winners from wild-card teams at all — the very weak lean runs
slightly the wrong way. The deadline looks like it buys a ticket in far more
than it buys a deep run once you're there, the same shape the roster-age and
homegrown-share spikes both found on their own factors.

## The confound check, and why it comes back unresolved

This is the part of the spike worth reading twice.

The build tried to answer whether the raw link above is mostly a deadline
effect or mostly a selection effect, using the one number available for
three of the five seasons: each club's win percentage at the END of that
same season, as a stand-in for "was this team already good." Holding that
aside, the strong raw link nearly disappeared, dropping to something a
random reshuffle could easily produce. The build called that a confirmed
selection effect: teams buy WAR because they are already good, and the
buying itself adds little on top.

An independent, adversarial recheck of every number in this spike reproduced
every one of those figures exactly, including that near-vanishing. But it
also flagged a real problem with the proxy used to get there: a club's FINAL
win percentage for the season already includes whatever those August and
September trades did to help it win games. Using it to "control for how
good the team already was" partly controls for the trade itself, which
tilts the whole test toward making the raw link look smaller than it really
is.

So the recheck tried the more honest version: each club's win percentage
from the YEAR BEFORE, a number that cannot possibly include this year's
trades. On that version, the strong raw link barely moved at all. Buying
value at the deadline kept almost all of its predictive power even after
setting aside how good the club looked the previous season.

Both checks are legitimate. Both have a real flaw working against each
other: the final-record check likely gives the trade too much credit for
looking unimportant, and the prior-year check is a weak, stale signal of how
good a team already was mid-season, so it may not be catching much of the
selection effect it's meant to catch. Put together, they bracket the true,
controlled-for effect somewhere between "almost nothing left" and "almost
nothing lost," which is a genuinely wide range. The right way to read this
spike's central question is not "confirmed, it's mostly selection" but
"real and legitimate concern, not yet pinned down by data this program has
on hand."

## The volume check

One thing this recheck did rule out cleanly: net value acquired is not
secretly standing in for how MANY trades a club made. The two are close to
unrelated, and holding trade count aside barely moves the main link at all.
Whatever this spike is measuring, it is the size of what came back, not
simple deadline activity.

## The missing-value players

Four in every ten traded players, both directions combined, carried no MLB
WAR at all in the season they were traded — split evenly between players
sent and players received, which rules out a lopsided bug in how they were
counted. Almost every one of them is a not-yet-debuted prospect, correctly
scored as adding nothing to this SAME season's ladder. Kevin Alcantara and
Anderson Espinoza, both dealt in 2021 without having played a big-league
game yet, are two examples among many. This spike asks a same-season
question on purpose; a "who really won this trade" question, asked three
years later, would need to track these same players forward and is a
different piece of work entirely.

## What this does not settle

- **The confound check is the biggest open question this spike raises, not
  the one it closes.** Two reasonable, pre-treatment-versus-post-treatment
  proxies for "was this team already good" point in close to opposite
  directions. The true controlled-for effect could be nearly zero or could
  be nearly as strong as the raw link. Neither this spike nor the recheck
  that stress-tested it can narrow that range further with the data
  currently in this program.
- **The confound check itself only covers three of the five seasons**
  (2021-2023), because that is as far back as the standings file it needs
  goes. 2024 and 2025 have no equivalent check at all.
- **This window is thin.** Five seasons and five champions is the smallest
  pile tested anywhere in this program. A wider window, if the underlying
  trade data ever extends further back, would be worth rebuilding this on.
- **No historical payroll control exists anywhere in this program yet.** A
  club able to buy proven talent in July is often also a bigger spender, and
  neither proxy tried here can separate that out.
- **This spike is narrower than the full catalog question.** The catalog
  calls for reconciling deadline trades with the whole season's transaction
  record into one number. This spike looks only at the deadline window
  itself.
- **Nothing here is causal even setting the confound check aside.** "Bought
  value, went far" and "was already good, so bought value AND went far" are
  both consistent with the raw pattern, and this spike's data cannot fully
  separate them, only narrow (imperfectly) how big the gap between the two
  stories could be.
- **A full six-rung model of the ladder was tried and technically worked**
  (checked first against made-up data with known answers, to make sure the
  fitting code itself was trustworthy), but the top rungs of the real
  ladder hold as few as five clubs across all five years. That is too thin
  to trust as a headline number on its own, which is why this write-up leads
  with the plain comparisons and band cuts instead.

## Where the work lives

`.scratch/team-success/`:

- **`analyze-trade-deadline.mjs`** — builds the 150-team-season panel from
  `public/data/trade-deadline/{2021..2025}.json` (deadline trades),
  `public/data/war-history/*.json` (same-season WAR), and
  `.scratch/team-success/outcome-ladder.json` (the 0-5 ladder), and runs
  every statistic above: the main correlation, the permutation test, the
  leave-one-season-out and leave-one-club-out refits, the band cuts, the
  volume check, the missing-WAR audit, and the confound check against final
  season win percentage.
- **`trade-deadline-panel.json`** — the cached, joined panel the analysis
  script reads, so a rerun costs nothing.

The independent recheck that produced the prior-year win-percentage
comparison above ran against the same cached panel and did not add a new
script under this directory; its numbers are recorded in this document and
in the diary entry's `technical` list rather than as a separate committed
file.
