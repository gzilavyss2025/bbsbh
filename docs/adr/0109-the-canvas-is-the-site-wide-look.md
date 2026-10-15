# The canvas is the site-wide look

**Status:** Accepted
**Date:** 2026-10-13
**Issue:** #1879; spec `docs/player-redesign.md`, section 2; roadmap #1198
**Amends:** ADR-0082 (draft), in two points. See "Older ADRs" below.

## Context

#1198, section 1, had one open item: pick a direction for the look of the site. PR
#1841 drew four directions. Gary did not pick one of them. He drew the player page on a
design canvas: https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK ("Player Detail Page -
Pitcher and Batter"). The canvas is private to Gary. `docs/player-redesign.md`, section
1, lists its boards and tells an agent how to read them.

The canvas uses the house faces (`src/tokens/fonts.css`) and the house paper and ink.
So the look is an extension of the design system. It does not replace it.

Gary made the decisions below on 2026-10-13.

## Decision

1. **The canvas is the site-wide look.** It answers the "pick a direction" item in
   #1198. The four directions in PR #1841 close. The player page uses the look first.
   The other pages follow.
2. **The player page goes first: a hidden page, then one swap PR.** The new page is
   built at an unlisted address beside the live `/player/{id}`. The live page does not
   change until one swap PR. That PR makes `/player/{id}` serve the new page, and makes
   the old tab addresses (`/stats`, `/analytics`, `/history`) scroll to their sections.
3. **A card with no data hides, and its jump-bar button hides with it.** This is the
   rule for two-way, minor-league and retired players, as it is on the page today. A
   two-way player gets both role sets, the batting modules and the pitching modules,
   each under its own heading (today's `blocks.map` behaviour).
4. **The TBD sections ship with today's content in a stamped card.** A section that
   is still a dashed wireframe on the canvas keeps its current content inside a plain
   stamped card. It does not need a design before the swap. Gary designs it later.
   The dashed wireframe is a canvas marker only. Users never see it.
5. **Data first.** Before a card is built, every number on it has a known source.
   Adapt an existing source (a statsapi call, a `/data/` file, a `scripts/gen-*.mjs`
   generator) before you add a new one. Each card's build issue is blocked by its data
   issue.

## The shared parts

The look has five shared parts. Each part is copied from a finished board, so none of
them needs new design work. `docs/player-redesign.md`, section 3, has the detail.

| Part | What it is |
| --- | --- |
| **Stamped card** | A 2px ink border, a hard 4px ink offset shadow, an ink name tab on the top-left edge, and an optional count tag on the top-right edge. |
| **Stat tile** | One label, one big number, one caption. Three fills: ink (the lead tile), tint, plain. |
| **Fact strip** | A grid of small label and value cells under the hero. |
| **Jump bar with counts** | Square buttons, each with a count badge. The current button is ink. It scrolls sideways on a phone and wraps on a wide screen. |
| **Stamp-in motion** | A card drops 4px into its shadow when it appears. It is off under `prefers-reduced-motion`. |

**These parts live in the design system, not in the player page.** Their homes are
`src/components/ui/` (the components), `src/styles/system/` (the base rules) and
`src/tokens/` (the values). The team page (#1107) and the other pages use the same
parts. A part that is built inside `src/screens/` for the player page only is a second
copy, and the next page copies it again.

The parts obey the rules that are already in place:

- **ADR-0084 (naming and reuse).** A shape word belongs only to the block that owns the
  base rule for that shape. `Card` (`src/components/ui/frame/Card.jsx`) owns the card
  box. So the stamped card is a new `frame` of `Card`, not a new card block. The fact
  strip starts from `FactGrid`. The jump bar extends `HubTabBar`
  (`src/components/chrome/`), because the team page uses the same control.
- **ADR-0023 and ADR-0107 (tokens).** Each new value (the offset shadow, the hairline,
  the tile tints, the stamp motion) goes in `src/tokens/` as a primitive with a
  semantic alias. A partial reads the alias. Each new colour passes `check-contrast`.
- **ADR-0108 (layout).** New layout uses `Stack`, `Cluster` or `Grid`.
- **ADR-0030 (club colours).** The jump bar stays the app's own colours.

**Type weights (#1932, Gary, 2026-10-13).** The canvas draws each house face at one
weight, so the site ships one weight per face:

- Barlow Condensed ships 700 only. A rule that asks for another weight draws 700.
- JetBrains Mono ships its 500 file only, declared for every weight. Emphasis in a
  figure is colour, never weight (ADR-0073).
- The card count tag is the one Barlow 600. It has its own family name, "Barlow
  Condensed Tag" (`--font-display-tag`), so no other rule can reach that face.
- Source Sans 3 keeps 400, 500, 600 and 700. The fact strip value is 500. (Replaced on
  2026-10-15: see "Amendment (2026-10-15)" at the end.)

## Older ADRs

Each ADR named in #1879 was checked against this decision.

- **ADR-0034 (the team hub is tabs): no change.** ADR-0034 decides the shape of
  `/team/{id}`. It does not decide the player page, and this ADR does not change the
  team page. Its own "What was not done" says "No visual redesign", which was the scope
  of that work, not a rule. Draft ADR-0082 proposes to supersede ADR-0034, and that
  mark lands with #1107, as ADR-0082 says. So the status line of ADR-0034 stays as it
  is.
- **ADR-0082 (the team one-scroll, draft): amended in two points.** It stays a draft.
  - Its jump bar gains count badges. The bar is the shared `HubTabBar`, so the team
    page and the player page get the same control.
  - Its "What was not decided here" leaves the look open ("No colour", "No component").
    This ADR closes the look: when #1107 builds the team page, its cards use the shared
    parts above. ADR-0082's band grammar, band order and absent-band rule do not change.
    The player page already follows two of its rules that generalise: one scroll with a
    jump bar, and a section with no data is absent, not disabled.
- **ADR-0084 (naming and reuse): no change.** This ADR applies it. It does not amend it.

## Alternatives considered

**Pick one of the four directions in PR #1841.** Gary drew the canvas in their place.
The canvas also has finished boards for each module, so the parts are copied, not
designed again.

**Redesign the player page in place, one tab at a time.** The live page would show two
looks for weeks. A hidden page and one swap PR keep the live page whole until the new
page is complete.

**Draw every TBD section before the swap.** That puts design work in front of the swap
with no end date. Today's content in a stamped card is enough to ship.

## Consequences

- PR #1841 closes, and #1108, #1109, #1110 and #1391 close as replaced
  (`docs/player-redesign.md`, section 5, phase 0).
- The data audit (phase 1) comes before any module build. Each module issue has a
  native "blocked by" link to its data issue.
- The shared parts land in the design system and show in `/design-lab` at 390 and
  1180 px before the hidden page uses them.
- The swap PR must count the requests of a cold load of `/player/{id}`, before and
  after, in a production build.
- Before the swap, Gary checks four edge pages: a two-way player (Ohtani, 660271), a
  minor leaguer, a retired player and a closer.
- When the team page (#1107) is built, it uses the same parts. A second stamped card or
  a second jump bar in `src/screens/team/` is a review failure.

## Amendment (2026-10-14): the swap

Decision 2 is done (#1898). `/player/{id}` and its name-and-id form serve the new page.
The route parser keeps the old tab addresses: `/stats`, `/analytics` (with or without a
season segment) and `/history` open the page with a `tab` value, and the page scrolls to
that tab's section once it has loaded (Season; Plate approach, or Pitches for a pitcher;
History). An old `?look=new` link opens the page too. The old tab screens, the tab bar,
the shell, the old Overview and the cards and CSS that only they drew are deleted.
`docs/player-hub.md` describes the page as it is now.

## Amendment (2026-10-15): mono body, square band heads, ripple everywhere (#2165)

Gary made three calls on the look. The Claude Design project (`docs/design-sync.md`) already
drew them. The app now matches it.

- **Body copy is JetBrains Mono 500.** `--font-body` is the mono stack. This replaces "Source
  Sans 3 keeps 400, 500, 600 and 700" under "Type weights". Every weight of body copy now draws
  500, as every figure already did, so emphasis is colour or size, as ADR-0073 says. Source Sans 3
  is no longer a role. `fonts.css` still declares it, and only the poster canvas
  (`src/lib/preview/posterPaper.js`) draws it.
- **A band head is square.** `sectionhead--band` has no rounded corners. The rule that rounded
  its top corners is gone.
- **Every band head wears the ripple rings and sheen**, with no extra class. The lineup page's
  rule moved into `src/styles/system/section-head.css`. A host that sets its own `position`
  still wins.
- **The compact stat tile** (`stattile--compact`) is in `src/styles/system/stamped/`. The
  season and command tiles on the player page use it.

What did not change: the club-colour rule (ADR-0030) and the `--seal` scope (ADR-0083).
