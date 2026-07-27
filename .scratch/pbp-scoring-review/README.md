# Play-by-play scoring & substitution review

A drift review of the scoring mechanism in the innings view, run over PRs #396
(multi-leg advancement + stretch-out rework), #400 (sac-reached notation) and
#401 (the placed-runner card), then extended to substitution handling —
pitching changes, pinch hitters, defensive subs and switches.

Method: every finding was measured by replaying real feeds through the actual
modules (`computeHalfInningFeed`, `buildCallouts`, `moundVisitRemainings`,
`scorecardPlays`) over every Final MLB game on 2026-07-20 … 2026-07-24, and
diffing against the pre-#396 module where the question was "did this change?".
Counts in the tickets are from those sweeps, not estimates.

## Shipped in PR #403

- The placed runner's card never drew the out-sequence circle.
- A bases-loaded balk advance (`forced_balk`) was tagged `GO`.
- A pickoff card read `PO` where the diamond reads `PK` (and `PO` is already
  this app's mark for a pop out).
- Steal call-outs read as if the BATTER had stolen the base — 86 in one day's
  bundle. Plus a thinner note shape in the roll-up path and a duplicate note
  when a runner stole twice in one plate appearance.
- A mid-inning substitution stepped with the at-bat AFTER it instead of the one
  before; the "Now Pitching" header showed the half's LAST arm, duplicating the
  reliever's card and contradicting the at-bat cards under it.
- The pitcher-removal trip was charged as a mound visit — 31% of visit events,
  pushing four club-games past the legal maximum of five.
- A defensive switch to DH rendered with no position phrase.

## Open — see `issues/`

| # | Ticket | Why it's open |
| - | ------ | ------------- |
| 01 | Duplicate leg notations on one continuous advance | Needs a call on the notation convention (22% of cards with legs) |
| 02 | Scorecard Lab drops the automatic runner | Sheet's R column disagrees with its own scoreboard; three options |
| 03 | Two remaining `GO` advance-code fallbacks | No obviously-right scorer's mark to substitute |
| 04 | `sac_*_double_play` charged an at-bat | Sac fly is clear; sac bunt needs a real case checked against the official AB column |
| 05 | Substitution surface asymmetries | Copy/placement decisions ADR-0017 governs |
