# src/components/boxlines — Box Lines (ADR-0069)

The reusable drilldown behind a summary stat line: tap the line, see the game-by-game
rows that add up to it, each linking to that game's box score. The facet registry is
`src/api/boxlines/CLAUDE.md`. The name's history and the lit doors: `docs/box-lines.md`.

- **"Box Lines" is internal and never renders.** Use the name only in a prompt: "make the
  box lines open from X, showing Y". On the page the door says the house `See all ›`
  (`ui/control/Door.jsx`'s words) and the sheet's band says `Game lines · {facet}`.
- **`BoxLinesDoor` is a FULL button reset, padding included.** A host that wants its row's
  vertical dress back states it at `button.` specificity (`.starter__careervs` in
  `10-lineup.css`). Hover draws the design canvas's outline, pointer devices only.
- **One shell for every facet.** It is handed `sheet.facet` plus an optional `note` and
  `title`, both defaulting to the club case.
- **Two doors, one wording.** The lineup page's "Career vs MIL" line and the player page's
  Splits vs team card both take their label from `api/vsTeamSplits.js`'s `vsTeamDoorLabel`,
  so they cannot disagree. The player page keys its door on the picked club, so a new pick
  remounts it closed.
- **It is a modal sheet.** A `.scrim`/`.sheet` dialog through `ModalPortal`: a bottom sheet
  on a phone, off the right edge when wide (`.scrim--boxlines`). It is NOT the wire's
  rail/dock, which are ambient and non-modal by design.
- **It holds no date logic.** Rows arrive already gated from `api/boxlines/rows.js`
  (cutoff-gated), and a row it was not handed does not exist. A list folds only rows it
  was handed, so it can only describe games the cutoff allowed.
- **A list sheet is the second mode.** A door handed a `list` descriptor instead of a
  facet opens on the GROUPS, folded by `api/boxlines/fold.js` and drawn by `BoxLinesList`
  as a two-column grid (games, and AVG or ERA), the vocabulary the Game lines card's table
  uses. A group opens in rows mode for that group's facet, headed by twelve figures
  (`foldStats`, drawn with the shared `Stat` cell). `‹ Back` returns to the list, Escape
  still closes, and focus still returns to the door. A list sheet has no headline until a
  group is picked, when the headline is that entry's own line, verbatim: `BoxLinesDoor`'s
  `headline` defaults to `label`, and a list door passes null. The join is memoized per
  (person, group, cutoff, gameTypes).
- **The sheet is stamped (ADR-0115).** Square, an ink edge, a club band over the head. The
  caller hands the band in as `sheet.band` (`bandFor(teamId, theme)`): the sheet is portalled
  outside the themed root, so it cannot inherit one. No band, or a club with no colours, is the
  house navy. A door that is a row of figures also hands in `sheet.cells`
  (`{ title, items }`), and the sheet leads with that grid instead of the verbatim line.
- **A new season starts under an ink rule** (`startsSeason`), the year in the gutter. There is
  no banding. The row mark is the full-colour `cap` logo, never the `mono` knockout. A
  postseason pill names its league (NLDS): from `league` in both game-log field lists, or from
  `roundTag` for a row that carries none (the postseason ledger).
