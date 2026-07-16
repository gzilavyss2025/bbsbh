# Season Grade — one verdict with two visible drivers

Season Grade answers: **how impressive has this team's season been, considering
both its play and the assignment it entered the year with?** It is an MLB-only,
0.0–10.0 verdict on the Team Page. It is not a projection.

The grade combines two existing, independently inspectable measures at the same
spoiler-safe date cutoff:

- **Quality** measures how strongly the club has played. It blends 60% actual
  wins with 40% Pythagorean wins derived from run differential, then centers and
  dampens the result around a 5.0 average club.
- **Vs. expectation** measures actual wins against a schedule-adjusted preseason
  win-total baseline. A 5.0 means the club is exactly on its running assignment.

The UI keeps both scores directly beneath the Grade. Current Form remains a
separate last-10 Quality diagnostic and never modifies the season verdict.

## Headroom-aware formula

A flat blend gives preseason expectation too much authority: a surprising
middle-tier team can pass a genuinely elite club. A direct z-score bonus has the
opposite problem and can drive an elite team close to 10 too early. Season Grade
therefore adjusts only the space remaining above or below Quality:

```text
direction = (vsExpectation − 5) / 5

if direction >= 0:
  adjustment = 0.60 × direction × (10 − quality)
else:
  adjustment = 0.60 × direction × quality

grade = clamp(quality + adjustment, 0, 10)
```

The calculation lives in `src/api/seasonGradeFormula.js`. It runs from the
rounded, auditable Quality and Vs. expectation values already shipped to the
browser. Examples from the July 2026 calibration set:

- Quality 6.1 and Vs. expectation 8.5 → Grade 7.7.
- Quality 8.7 and Vs. expectation 4.1 → Grade 7.8.
- Any Quality score paired with 5.0 expectation keeps its original value.

The `0.60` achievement weight is a calibrated product coefficient, not an
empirical truth. The supporting backtest covered 300 team checkpoints at 95
games across the 2015–2025 full seasons, excluding 2020. Historical expectation
used a Marcel fallback where market seeds were unavailable, so future market
seed curation may justify recalibration.

## Data and cutoff contract

Quality comes from `team-score.json`; Vs. expectation comes from
`season-score.json`. `leagueSeasonGradesFor` includes a club only when both
readers have a snapshot at or before the requested cutoff. It never lets either
input fall forward to a newer date. See ADR-0018 for why these derived
season-level results can render unsealed and ADR-0020 for the composite decision.
