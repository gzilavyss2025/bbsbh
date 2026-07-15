# Team Transactions — card design

**Status:** design locked; data layer not yet scoped
**Slug:** team-transactions
**Reference:** `wireframe.html` in this directory (static HTML/CSS mock, not
production code — open it in a browser)

## Product idea

A "Team Transactions" card on the team profile page (`src/screens/TeamPage.jsx`)
that turns the club's raw MLB Stats API transaction feed into a readable
story: a trade reads next to the corresponding DFA it caused, a call-up reads
next to the option/IL move that made room for it, headshots of the players
involved sit alongside the sentence. A social-feed read on the transaction
ledger, not a raw log dump.

## Design decisions (locked)

- **Grouped by day, not by transaction.** One dateline header per day —
  spelled out in full ("SUNDAY, JULY 12", all-caps per the app's global
  caps invariant) rather than a month row plus an abbreviated date. Real
  transaction feeds routinely log multiple moves on one date (the Brewers'
  actual log turned up 6 transactions on Jul 12, 2026 and 8 on Jul 7, 2026 —
  see Data findings below), so the dateline runs once and each transaction
  underneath is its own compact "story."
- **Each story is a type pill + a floated headshot rail + a wrapping cutline
  sentence.** The type pill (Trade, Roster shuffle, Injured list, Roster
  move, Signing, …) and an IN/OUT headshot rail share one top edge (the rail
  is a CSS float, not a grid column), and the narrative sentence wraps around
  the headshots the way a magazine caption wraps a floated photo, closing
  back to full width once the sentence runs past the photos.
- **The rail is not always a clean 2-player pair.** It flexes to however
  many players a move actually involves: a simple trade-in/DFA-out pair (2
  slots), a 3-player shuffle (2 up, 1 down — real example: Jul 7's Gasser +
  Lara recalled, Perkins optioned), a same-player double-move (Crow
  activated off the IL then immediately optioned back down — 1 slot, a
  neutral "Up/Down" banner), a solo move with no corollary (a plain minor-
  league signing — 1 slot), or no rail at all (a pure IL-to-IL transfer with
  no active-roster photo, e.g. Woodruff's 15-day → 60-day transfer — just
  the sentence, no headshots).
- **Headshots**: plain, non-overlapping frames (no stacked/overlapping
  cluster — that read as generic "AI slop"). Each carries a soft wash of the
  club's brand color under a uniform halftone dot-screen texture (the
  "newspaper" read comes from the dot screen + serif cutline text, not from
  color-coding one side vs. the other). The brand-color wash reuses the
  existing `teamTintColor()` convention (`src/lib/teams.js`, consumed by
  `src/components/Headshot.jsx`) — not a new one-off treatment.
- **Cutline copy**: past-tense narrative sentences (Acquired, designated,
  Recalled, optioned, Placed, selected, Signed, assigned, …), in
  `--font-read` (Newsreader) — the same serif register the app already uses
  for box-score-notes / in-game notification copy (`PitcherNotice` etc.),
  distinct from the plainer Plex Sans used by the existing per-player
  `TransactionTimeline.jsx` (career ledger on the player page). This card is
  intentionally a different visual language from that component — see
  "Relationship to prior work" below.
- **No meaningless chrome.** No "N moves" count on the day header, no
  season-total count on the card's section flag ("Transactions") — both were
  tried and cut; neither told anyone anything.
- **Responsive**: a single-column card at every width — this is a
  second-screen companion (phone-first, `--app-width: 390px`), not a
  dashboard. iPad (~600px) just gives the cutline/rail more breathing room;
  desktop caps the card at a comfortable ~460px reading width rather than
  stretching it to fill a widescreen viewport.

## Relationship to prior work

`src/components/TransactionTimeline.jsx` already exists and is used today on
the **player page** (`PlayerPage.jsx`) as a per-player career ledger — vertical
rail with a node per move, `.txntl__chip` type coloring (field/clay/graphite
for add/out/lateral), Plex Sans description text. This new card is
**team-scoped**, reads as a chronological social feed of *paired* moves
rather than one player's career, and deliberately uses a different visual
language (floated headshot rail, serif cutline, halftone photo treatment,
day-grouped stories) so it doesn't look like a re-skin of the player-page
component. Both can and should coexist; this scope does not touch
`TransactionTimeline.jsx`.

## Data findings (from the real feed — informs the data-layer scope)

Pulled the Brewers' (team id 158) actual `statsapi` transactions for
2026-06-24 through 2026-07-15 to stress-test the design against real
content rather than invented examples. Findings that the eventual data layer
must account for:

1. **Multi-move days are the norm.** 6 transactions logged Jul 12, 8 on
   Jul 7, across a 3-week window. Any generator must group by date before
   it groups by "story."
2. **Not every group of same-day transactions is a clean 2-player pair.**
   Jul 7 has a genuine 3-player shuffle in one window (2 recalls + 1
   option). Jul 12 has a same-player double-move (activated off the 15-day
   IL, then optioned right back down the same day) and a pure IL-to-IL
   transfer (15-day → 60-day, Woodruff) with no new active-roster player at
   all.
3. **The raw feed duplicates records.** The same Logan Henderson rehab
   assignment appeared 3 times on 2026-06-28; the same trade (Easton McGee
   to the Royals) appeared twice on 2026-07-14, once from each team's
   perspective, with the second copy missing the `person` field. A
   generator must de-dupe (by description + date, or by transaction `id`
   where present) before grouping into stories.
4. **Typecodes seen in the sample:** `SFA` (signed free agent), `SU`
   (suspension), `SC` (status change — activation, IL placement, IL
   transfer all use this generic code, disambiguated only by description
   text), `OPT` (optioned), `ASG` (assigned — rehab), `SE` (selected —
   contract selected from a minor-league affiliate), `CU` (recalled), `DES`
   (designated for assignment), `TR` (trade).
5. **No real 27th-man doubleheader example turned up in this window**, but
   structurally it would look identical to the Jul 7-style same-day
   recall + option pair already handled by the design.

## Non-goals (this scope)

- No data-layer implementation yet — generator, reader module, de-dupe
  logic, and the real React component are unscoped. This file exists to
  lock the visual/product design before that work starts.
- Does not replace or modify `TransactionTimeline.jsx`.
- Real player headshots, not the placeholder silhouette SVGs in the
  wireframe — production would use the existing `Headshot` component.

## Next step

Scope the data layer: a `scripts/gen-team-transactions.mjs`-style nightly
precompute (fetch → de-dupe → group by day → group into stories → shape for
the design above), a paired `src/api/` reader, and the real React component
and CSS in `src/index.css` / a new `TeamTransactionsCard.jsx`.
