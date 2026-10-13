# Player Transactions card: design handoff

Status: design exploration. No app code changed.

## What this is
Notes and data for a new design of the Transactions section on the player page
(History tab, `src/components/transactions/TransactionTimeline.jsx`).

The design canvas, option A only: https://claude.ai/artifact/5hbQ1Q53SU5MvVJq72jtCU
The master design system it follows: https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK
Gary did not like option A. Start a different design. Four earlier options
(level lanes, season grid, stays, year ledger) were also not chosen.

## Files
- `run3.mjs` builds real rows for Gasser (688107), Turang (668930) and Yelich (592885).
  It runs the app's `transactionTimelineView` on the live MLB Stats API, adds the
  draft and rookie rows, and adds All-Star selections from `/people/{id}/awards`.
  Run it from the repo root: `node .scratch/tx-player/run3.mjs`.
- `final.json` is its output (2026-10-13). Each row has date, code, label, tone,
  club, text, tag (level change) and il (injured-list days).


## Facts a new design must respect
- The shipped feed has roster moves only. Awards (All-Star too) are a separate
  section on purpose. Gary asked to try All-Star rows in the feed. Nobody has
  decided if they stay.
- Collapse rule (`collapsedCount`): at least 5 rows, stretch to the first row
  that is not an injured-list stay, at most 8.
- The injured list is one row per stay (ADR-0033). Keep it that way.
- Paternity, bereavement and restricted lists stay out (ADR-0033).
- The level tag must show only when a move names two levels. A trade or an
  injured-list row has no level change.
- Existing app bug: the level of a club is read as of today, not for the move's
  season. Turang's 2019-07-08 move shows as "Sent Down" (A+ to A). Fix it
  separately.
- The wire sentence repeats the player name and club on every row. Rewriting it
  is risky: trade lines name other players, and `linkifyNames` matches verbatim text.
- Gasser (22 rows) is the heavy case. A veteran can have 60 or more rows.
- A review of option A found: tiles with Up/Down counts mislead, the collapsed
  card runs near 900px on a phone, and 320px width overflows unless the level
  tag has its own slot.
