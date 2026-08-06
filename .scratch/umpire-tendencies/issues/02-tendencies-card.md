# 02 — The Umpire Tendencies card (UI)

Status: `ready-for-agent`
Phase: 1
Blocked by: 01

Build `src/components/umpire/UmpireTendencies.jsx` and render it in its two
hosts. Structure mirrors the reference graphic band for band; palette is the
paper-scorebook system (PRD §3).

## Component

```jsx
<UmpireTendencies umpire={data} />   // the loadUmpire(id) record
```

Renders nothing (`return null`) when `umpire.accuracy?.season?.called` is falsy —
same guard `PlateAccuracyCard` already uses, so a MiLB umpire or one the file
hasn't caught up to gets no empty shell.

### Bands

1. **Masthead** — `UMPIRE TENDENCIES`, navy on `--text-on-ink`. Reuse
   `SectionMasthead`'s treatment rather than restyling a header.
2. **Identity** — name; beneath it `{games} GAMES · {hpCount} BEHIND THE PLATE`.
   **Not** service time — statsapi has none (issue 01's reference section).
   The existing `UmpireTierPill` goes here.
3. **Scale** — five stacked bands, diverging `--navy` → neutral → `--clay`, with
   the labels **beside** the bar (never on it) and a `--surface-inset` pointer
   chip on the resolved band. From `umpire.lean.tier`.
4. **Area to watch** — kraft-amber flag panel, from `umpireWatchArea()`. The
   whole band is omitted when that returns null.
5. **Tiles** — reuse `umpage__acctile` verbatim: accuracy %, rank, consistency,
   runs/game. These are the Phase 1 stand-ins for CHALLENGES/GAME and OVERTURN%,
   which arrive in issue 03.
6. **Provenance** — season, games behind the plate, freshness, in
   `--text-caption`.

### Accessibility

The scale is `role="img"` with an `aria-label` naming the resolved bucket in
words (`"Pitcher friendly — hands pitchers 0.2 runs per game more than a typical
umpire"`), mirroring `UmpireZoneMap`. Pointer position must never be the only way
to read the value.

### Two "runs per game" on one card — resolve before building

`season.favorPerGame` is **unsigned**: `favorMagnitude / games`, the total
absolute impact of every missed call in both directions. Bacchus reads **1.548**.

The scale is driven by the **signed net** — `Σ(favorAway + favorHome) / games` —
which for the same umpire is **0.432**.

Both are legitimately "runs per game" and they are nowhere near each other.
Printing the unsigned figure in a tile beside a signed-net-driven scale reads as
an error. Either relabel the tile so the distinction is unmistakable in very few
words (the card's register is labels, not sentences — see PRD §3), or drop it:
of the four Phase 1 tiles it is the weakest.

### Register

**No descriptor prose on the card.** PRD §3 "The register" carries the
maintainer's direction: labels and numbers plus at most one asterisked footnote,
matching the reference graphic. Facts that must survive (the scale is measured
against a league average, not zero) become a terse label or a footnote — never a
sentence.

## Hosts

- **`UmpirePage.jsx`** — first card in `umpage__cards`, above the existing
  `PlateAccuracyCard`. Pass `data` straight through; it already has everything.
- **`UmpireAccuracyModal.jsx`** — above the zone-map section. The modal already
  calls `loadUmpire(id)`, so no new fetch.

**Do not** inline it into `TeamInfo.jsx`'s `Umpires` card — PRD §1 has the
reasoning. The existing `UmpireTierGlyph` → modal path is the lineup-page entry.

## CSS

`src/styles/38-umpire-pages.css`. That partial is **381 lines and already
carries a `check-file-size.mjs` budget entry** — check the budget first, and
split the partial rather than raising the cap. A new partial must be inserted at
the cascade position its rules belong in, not appended (`src/CLAUDE.md`, "Order
is the contract").

Semantic tokens only, no raw hex. Guards to clear: `check-typography.mjs`,
`check-focus-ring.mjs`, `check-contrast.mjs`, `check-caps.mjs`,
`check-file-size.mjs`.

## Spoiler check

Every value on this card is a Final-games season aggregate of ball/strike
judgments — no `SealBox`, on the same footing as the accuracy rank already
shipped on the lineup page. **`umpires.json` game rows carry `awayScore`/
`homeScore`; this card must not read or render them.** It touches only
`accuracy`/`lean`/`rank`/`zoneCells`, all derived from `umpire-accuracy.json`,
which carries no score at all.

## Verification

Not test-covered — this is a visual change, so per the repo workflow it needs the
browser check, not just `npm test`:

1. `npm run dev` (or the next free reserved port).
2. `/umpire/{id}?nointro` for an umpire in each of the five tiers — measured
   occupancy is 14/21/22/19/14, so all five are reachable. Pick from PRD §2's
   named extremes for the outer bands.
3. An umpire below `MIN_RANK_GAMES` (scale renders, rank line does not).
4. A MiLB umpire with no accuracy record (card absent entirely, no empty shell).
5. The same card via the lineup page's tier glyph → modal.

Include the clickable local URL in the handoff.
