# Pair ledger: the default layout for a two-team analysis table

Issue [#2455](https://github.com/gzilavyss2025/bbsbh/issues/2455). Gary approved
**Design A, "Scouting ledgers"** on 2026-10-21. Use it for each new two-team analysis
table. The first adopters are the World Series home's Nine keys and Glove and legs
([PR #2459](https://github.com/gzilavyss2025/bbsbh/pull/2459)). The durable Design A
reference is the
[scouting contract at commit f26f830](https://github.com/gzilavyss2025/bbsbh/blob/f26f830c47eb8ed154a8684bef6d57a0d3096aae/docs/world-series-scouting.md#two-team-scouting-ledgers).

## The parts

| Part | File |
| --- | --- |
| `PairLedger`, `PairFigure`, `PairAffix`, `PairLegend`, `NO_FIGURE` | `src/components/ui/table/PairLedger.jsx` |
| `pairLead(a, b, { lowerWins, digits })` | `src/lib/design/ledger/pairLead.js` |
| Presentation (one namespace, `pair-ledger`) | `src/styles/system/ledger/pair-ledger.css` |
| Club adapter for the World Series home | `src/components/worldseries/cards/scouting/ComparisonLedger.jsx` |
| Specimens (`/design-lab?nointro`, section "Two-team ledger") | `src/screens/designlab/ledger/PairLedgerLab.jsx` |

`PairLedger` composes `Card frame="stamped" body="flush"`, `Table frame="bare"
density="keep"`, `Key`, `Stack` and `Cluster`. It adds no frame, no raw value and no
second card. It knows no team, unit, rank rule or threshold. A caller gives it two
`sides` (`{ key, label, kicker, mark }`) in the order the caller chooses. A
club adapter turns two team ids into sides, and a ledger of seasons or splits needs no
adapter.

## When to use it

Use it when all four statements are true:

1. The table compares the **same measures** for **two sides**.
2. A reader needs the **figure** more than its shape.
3. Each row has **one figure per side**.
4. A leader per row has meaning ("better" is defined for each measure).

Do not use it for a chart, a bar or track that carries magnitude, a list of different
people for each side, a head-to-head event list, or a table with more than two sides.

## Required semantics

- **Order.** Each row reads measure, then side A, then side B. Side order is the
  caller's and is the same on every sibling card.
- **Title and note.** One title. The note names the measures and the direction
  ("League ranks · lower is better", "higher is better"). The period (for example
  "Regular season") is quiet metadata beside the title.
- **Leader.** An amber underline (`--marker`) means "leads this measure". It does not
  mean "passes a threshold". `pairLead` picks the leader from the value at the precision
  the reader sees (pass `digits`). A tie marks neither side. A missing figure is never zero
  and never a win. The figure also carries hidden text "(leads)".
- **Failure.** A failed criterion keeps its number readable: clay ink, a visible
  asterisk and hidden text "(failed)". The model owns the rule. It supplies `failed`
  per figure and the legend words (`PairLegend failed="Outside top 15"`). The primitive
  contains no threshold. A figure can lead and fail. The two marks stay distinct.
- **Missing.** Use `NO_FIGURE`: the dash and hidden text "no figure".
- **Units, signs, ranks.** The model formats the figure. Use `PairAffix` for an
  ordinal suffix or a unit. Write a negative number with the true minus sign (−3).
- **Groups.** `<tr><th scope="colgroup" colSpan={3}>` starts a group such as Defense.
- **No aggregate.** Do not add a winner across measures that have different units or
  unsupported equal weighting. Do not add odds, a ranking method, a normalization or a
  data generator.
- **Not interactive.** A figure is plain text and does not look like a button. A
  control in the footer (a link, an `InfoPopover`) keeps its established target, focus ring
  and keyboard operation. An explanation must not need hover.

## Layout rules

The head shows the mark above the name. A card at least 36rem wide (a container query,
not the screen) shows the mark beside the name and the kicker (a city) above it. The
card gets a 740px step for padding and title size. Verify phone, tablet and desktop.

## Initial adopters

| Card | Model | Leader rule | Failure |
| --- | --- | --- | --- |
| Nine keys (`NineKeys.jsx`) | `keysVerdict.js`, `nine-keys.json` | lower rank | `data.bar` |
| Glove and legs (`GloveLegs.jsx`) | `gloveLegs.js` | higher, per measure | none |

Both adopters still use the older `ww-comparison__*` class names for a few contents
(`row`, `ordinal`, `unit`, `footline`, `tally`). The file `comparison.css` keeps those.
A follow-up moves `NineKeys.jsx` to `PairAffix` and the pair-ledger footer. Open PR #2464
holds that file, so this change leaves it alone.

## Audit of other two-team cards

This list comes from each file's header comment and structure. It is an inference, not
a check of every rendered state. **No card moves in this issue.** A candidate needs its
own issue and the owner's approval.

| Card | Verdict | Reason |
| --- | --- | --- |
| `postseason/SeriesTotals.jsx` | Candidate | Same measures, two clubs, a leader per pair. The stat code sits between the figures, so the order differs. It reads counted-game box scores: a migration must keep that gate. |
| `scouting/Platoon.jsx` | Candidate | Rows could be the pitcher hand, columns the two clubs. The tint for the hand a club faces next is a third mark and must stay distinct from the leader. |
| `postseason/SeriesNineKeys.jsx` (series page) | Keep | The rank track shows position among 30. A ledger drops it. |
| `worldseries/cards/Tape.jsx` | Keep | Mirrored bars carry magnitude and the away/home order. |
| `scouting/ParkFit.jsx` | Keep | Two parks' walls over shares, and under one park a carry block. It shows no leader by design. |
| `scouting/PitchByPitch.jsx` | Keep | One starter against the other club's hitters. It is not symmetric. |
| `cards/Probables.jsx`, `postseason/SeriesStarters.jsx` | Keep | Different pitchers per side with outing bars. The measures are not shared rows. |
| `cards/Bullpen.jsx`, `cards/HomeRoad.jsx`, `cards/HotBats.jsx` | Keep | Per-club lists of different people or games. |
| `postseason/SeriesLeadersLedger.jsx` | Keep | A leader per category who differs by club. It has its own ledger. |
| `screens/designlab/scout/HeadToHead.jsx` | Keep | An event list, not a measure table. |
