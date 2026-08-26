# Star diversity, checked a second way, and why it mostly fails

Research spike #9, 2026-08-26. A follow-up to `docs/team-success-star-diversity.md`,
this program's strongest correlation to date: teams that spread their WAR across
more players, rather than leaning on one or two stars, go deeper in October. That
finding rests on one measurement of "star." This spike asks whether a completely
different measurement of the same idea — who the game itself calls out, through
All-Star selections and postseason awards, rather than a Wins Above Replacement
number nobody outside a front office watches — points the same way.

**The question.** Set WAR aside. Build a concentration measure from recognition
instead: how much of a team's All-Star nods and major awards piled onto a small
handful of players, versus spread around the roster. Does that measure predict
the outcome ladder the same direction the WAR-based measure already does? Does
it hold up on its own, checked against the confound that already tripped up a
different spike in this program (`docs/team-success-postseason-usage.md`)?

**The answers, in order of how much weight they carry.**

1. **The headline sign matches, on the surface, but it does not survive the one
   check that matters.** A team's honors-based concentration correlates with
   finishing lower on the ladder, the same direction the WAR-based finding runs,
   on both hitting and pitching. That result, taken alone, would read as a
   second witness for the original finding.
2. **It fails the confound test this program already knows to run.** The same
   trick that undid a different spike's raw postseason-usage number is doing
   the work here. Recognition-based "concentration" turns out to be almost a
   restatement of a plainer fact: how many players on the roster got any notice
   at all. A good team simply has more players who earn a mention somewhere —
   an All-Star nod, a Gold Glove, a down-ballot MVP vote. Once that plain count
   is held fixed, the concentration measure's relationship to winning **flips
   sign** on both sides of the ball. What looked like "spread the recognition
   around and you win" is mostly "have more players worth recognizing at all
   and you win" wearing a different shirt.
3. **The original WAR-based finding does not have this problem.** Running the
   identical confound check on the original spike's own data, its sign survives
   — attenuated, but not reversed. The two measures are not built the same way
   under the hood, and only one of them holds up.
4. **The other pieces of the original finding do replicate cleanly**, on the
   data available: the null between division winners and wild-card teams
   reproduces almost exactly, and a genuine (not merely mechanical) recognition
   measure had never been built or cross-checked against the WAR-based one
   before this spike. That part of the exercise was worth doing even though the
   headline claim did not hold up.
5. **The available window is small and single-era.** A concentration measure
   built from awards needs the awards themselves on file, and the shared
   Trophy Case data only reaches back to 2022. Four seasons is a thin floor for
   any of this, on top of the confound above.

## Why this needed a genuine concentration measure, not a count

The original spike's own stretch section already tried a plain All-Star count
as a face-validity check, and flagged it as circular. This spike goes one step
past that. A team's share of its own All-Star nods held by its single most-
selected player is, by construction, exactly one divided by the count of
players selected — three All-Stars means a 33% share, no matter which three
they are. That is not a measurement of concentration; it is the count wearing
a fraction. Building a real concentration measure meant layering major awards
(MVP, Cy Young, Gold Glove, Silver Slugger, Rookie of the Year, and the rest)
on top of the All-Star nods, weighting every honor the same (one point each,
a deliberate simplification rather than an invented value scale), and only
then asking how concentrated those points were on a team's roster.

That is also where the ceiling on the sample comes from. `public/data/
awards-history.json` is a rolling five-season hand-run file built for a
player's own Trophy Case page, not a research archive — it holds 2022 through
2025 and nothing older. The primary sample here is roughly a hundred
team-seasons on each side of the ball, against the original spike's 450.

## The result, and the check that undid it

Honors-based concentration correlates with the ladder the expected direction
on both sides of the ball, for four straight seasons, and stays same-signed
whether any one club or any one season is dropped from the fit. Taken at face
value, that reads as a second, largely independent data point for the
original finding.

It is not independent, and the reason is the same one that tripped up a
different spike in this program before. `docs/team-success-postseason-usage.md`
already learned that a "share" statistic can secretly be tracking how much of
something there is, not how it is divided up. The same trap was hiding here.
Recognition-based concentration turns out to be almost a mechanical
restatement of how many different players on a roster got any recognition at
all — and that plain count, on its own, correlates strongly with winning,
for an unsurprising reason: a good team simply has more players good enough
to catch a voter's eye. Hold that count fixed and ask what is left over, and
the concentration measure's own relationship to the ladder does not just
weaken. It reverses, on both top1Share and the two related measures, on both
hitting and pitching.

Run that identical check against the original spike's WAR-based concentration
measure, and it does not happen. The sign there survives, smaller but intact.
The two measures are not interchangeable underneath, and only one of them
turns out to measure what it claims to.

Checked directly against each other, on the exact same team-seasons, the two
concentration measures barely agree with one another in the first place — a
weak, near-nothing relationship on the hitting side and effectively no
relationship on the pitching side. That alone should have been a warning sign
before the confound check ever ran: two measures of "the same underlying
idea" that barely track each other are not confirming one another no matter
which direction each one points.

The one piece of the original finding this spike DOES confirm cleanly is the
null between division winners and wild-card teams among clubs that already
made October — recognition-based concentration says nothing there either,
matching the original spike's own result almost exactly.

## What this does not settle

- **The central claim of this spike does not survive its own confound check**,
  and the write-up should not soften that. "Recognition partially replicates
  the star-diversity finding" is too generous a reading once the breadth
  confound is accounted for; a fairer one is that the recognition-based
  cross-check, as built, mostly fails, and the sign match it shows on the
  surface is largely an artifact of how many players got noticed at all,
  not of how concentrated that notice was.
- **The original WAR-based finding is not weakened by anything in this spike.**
  The same confound check, run on that spike's own data, leaves its sign
  intact. That program's strongest correlation to date stands as it was.
- **A weighted honors scale was not tried.** Every honor here counts as one
  point, from an All-Star nod to an MVP trophy, a deliberate simplification to
  avoid inventing a value scale with no clear basis. A properly weighted
  version is a natural next step, not run here, and might behave differently
  under the same confound check — or might not.
- **Major awards carry a sharper circularity risk than All-Star selection
  alone.** A year-end award is voted with full knowledge of how a team's
  season went, more directly than an All-Star roster spot is. The original
  spike already flagged this risk for All-Star selection; stacking awards on
  top inherits it more directly, and nothing here can rule it out
  statistically.
- **The 2022-2025 window sits inside a single postseason bracket format**, so
  there is no era variation available in this window to check the result
  against, on top of the confound problem.
- **No payroll control**, the standing gap across this entire research
  program.

## Where the work lives

`.scratch/team-success/analyze-recognition-diversity.mjs` builds the honors-
based concentration measure from `public/data/all-star-rosters.json` and
`public/data/awards-history.json`, joins it against the outcome ladder and the
roster-age cache, and reports the primary correlations, the band comparisons,
the leave-one-club-out and leave-one-season-out refits, the cross-check
against the WAR-based measure, and the All-Star-count sanity check. It does
not itself run the confound check that undid the headline claim; that check
was run as a second, independent pass reading the same raw files directly and
is not yet captured in a checked-in script. A follow-up pass should fold a
partial-correlation-against-recognized-player-count check into the main
script itself, since this program's own house rule — learned from the
postseason-usage spike — should have caught this before the headline claim
was written, not after.

`src/lib/research/contenderDiary/starDiversityAwards.js` reports this spike
in the Contender Diary and cachedPanelPaths were not produced; the measure
uses no panel of its own, the same way the original star-diversity spike
recomputes from the roster-age cache, `public_war_history`,
`public_all_star_rosters`, and `public_awards_history` rather than owning a
DuckDB view.
