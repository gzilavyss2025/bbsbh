# Batter-vs-staff explorer (on demand)

**Status:** ready-for-agent (not started)
**Opened:** 2026-08-06, alongside the starter-matchups rebuild.

## What

"Here's a batter — show me his splits against each pitcher on that other
club." A user-initiated page (or modal), not a precomputed surface.

The lineup page deliberately shows **only** the opposing probable starter
(that was the scoping decision behind the rebuild — see
`scripts/gen-career-matchups.mjs`'s header). History against the rest of the
staff is real and wanted, it just isn't the staging sheet's job. This is where
it goes.

## Why it can be built live, unlike the card

The nightly precompute exists for two reasons, and only one of them applies
here:

- **Spoilers** — the binding one for the lineup card. `vsPlayerTotal` for the
  current season reflects tonight's plate appearances the moment they happen,
  so a mid-game fetch could leak whether tonight's batter and pitcher have
  already matched up. **This surface is outside the scored-game flow**, the
  same standing the Game Photos page has (see `src/api/gamePhotos.js`'s
  header): it carries its own framing rather than sitting inside a seal. Check
  that reasoning still holds before wiring it to a game route — if it ever
  renders next to a sealed half, it needs the precompute path instead.
- **Cost** — not binding here. One batter vs one staff is ~13 `vsPlayerTotal`
  calls at MLB (one per pitcher, one level). That is an ordinary page load,
  fanned out with `Promise.all`. The nightly job pays a big multiple of that
  only because it covers every game on the slate.

## The trap to avoid

Do **not** reach for `stats=vsPlayer&opposingTeamId={teamId}` to do this in one
request. It returns a batter's whole career book against a franchise — every
pitcher, every season — and looks like exactly the right endpoint. It filters
by the uniform the pitcher was **wearing at the time**, not by who is on that
staff today, so everything a pitcher accrued with previous clubs is missing.
Measured against a real PIT@MIL slate: 41 of 141 real pairs, 140 of 495 plate
appearances, and it silently *undercounts* the pairs it does return rather
than dropping them. Modern roster churn makes that the common case.

Per-pair `vsPlayerTotal` is the only accurate source. `opposingPlayerId`
rejects a comma-list, so it really is one call per pair.

## Notes

- `stats=opponentsFaced` is a cheap "who has this batter faced" index (no stat
  lines, just the pairings) — but it is **season-scoped**, defaulting to the
  current year, so career pruning would cost one call per season. Not useful
  as an optimization; noted so nobody re-derives it.
- `src/api/careerMatchups.js`'s `matchupLine` already formats a row as
  scorebook shorthand and is reusable as-is.
- A callout family over the same data is the other open idea — that one WOULD
  sit inside the game flow, so it belongs in the nightly
  `gen-callouts.mjs` pipeline (see `docs/callouts.md`), not here.
