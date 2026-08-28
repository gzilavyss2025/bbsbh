# Material for the diary entry — W3.5, service-time debut clock

W5 writes the entry. This is the material, not the entry.

**Verdict: no-ship.** Full method and every number:
`docs/service-time-debut-clock.md`.

## The one-sentence answer

Promotions do run about 1.6 times as fast per day in the fortnight after the
service line as before it, and that is entirely the shape of April; once the
model knows how many days into the season it is, the line itself adds nothing
that can be told from chance.

## VOICE WARNING, carried forward from the spike contract

This describes a practice, not a conspiracy — and here it does not even
describe a practice at league scale. State what the numbers show and stop.
**No adjectives about intent. Name no club**: the club-heterogeneity test is
null (χ²=34.79, 29 df, p=0.211), so the sample does not support naming one.

## The numbers an entry can lean on

- 5,008 major-league debuts, 2005–2025. 2020 excluded (67-day season).
- 834 first-time roster additions in the first 45 days, 16 seasons.
- Raw jump 1.560 (p<0.0001) → controlled 1.266, 95% CI 0.856–1.872, p=0.24.
- The same three days of April: 7.4% of promotions when the line has passed,
  7.5% when it has not. p=0.98.
- Significant in 0 of 16 leave-one-season-out refits.
- Roster need is HIGHER before the line (2.26 against 1.64, p=0.0002).

## The two stories worth telling, beyond the null

**1. A wrong finding was one anchor away.** Measuring the season's start from
its first game rather than from the day the league opened produces a rate ratio
of 1.702 (p=0.0012) and a clean 14.4%-against-5.5% contrast. That version is an
artifact of six overseas openers — Japan, Australia, Seoul, Tokyo — where two
clubs play and the league then waits six to ten days. The "long seasons" in
that test were exactly the overseas ones.

**2. The premise did not survive contact.** The spike existed because service
time is now in the data. It is, and it cannot carry the test: 15.2% of
populated `mls` cells are bare integers, 61.1% of them provably wrong on men
who could not have banked a year — and all 65 men who COULD have banked one
carry the same spelling, a bare `1`. The confirmations and the errors are
indistinguishable per cell.

## What must NOT be said

- Do not say the clock has no effect. The interval reaches 1.87.
- Do not say clubs do not do this. The test rules out a league-wide practice,
  not one confined to a handful of men a year — which is what the well-known
  individual cases look like.
- Do not repeat the 1.702 figure as a finding. It is the artifact.

## Flag to the orchestrator, not for the diary

`docs/prospect-traits.md` question 4 is NOT overturned — it said the debut
month showed nothing, and this agrees. But its instrument was the debut date,
and this spike shows the debut date has the wrong sign for this question
(0.651 against 1.640 on the roster-add date). That is a method note for a
future pass, not a correction. The old entry stays exactly as it is.
