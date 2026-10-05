# src/api/boxlines — Box Lines data and the Game lines registry (ADR-0069)

Reference for the doors that are lit, and the measurements behind these rules:
`docs/box-lines.md`. The sheet itself: `src/components/boxlines/CLAUDE.md`.

## `GameLinesCard` is a registry

**`GameLinesCard` is a REGISTRY, not a card to copy** (ADR-0069, #997): a stack of
`BoxLinesDoor`s, each a career line under one facet. Do not build a second facet card
beside it.

- **Adding a facet is ONE entry** — `{ key, label, note, title, facet, section, groups }`
  plus exactly ONE label source: `sitCode` (a situation), `careerGameType` (a career
  under a game type) or `fielding` (`'starts'`/`'bench'`, off the fielding career's own
  `gamesStarted`). Nothing else: the fetch, the gate, the sheet and the dress are
  already there.
- **The list lives in `cardFacets.js`**, not in the component. A `.jsx` file cannot be
  imported by `node --test`, and the failure that has to be pinned is otherwise
  untestable: an unknown facet `kind` keeps NOTHING, so a typo opens a door onto an
  empty ledger in silence.
- **Four headings** (`SECTIONS`, same file). The card groups by that list, not by the
  registry's order, so a door added in the wrong place files itself. A heading with no
  door does not render.
- **The card is a table** (ADR-0073). Every door prints the same five figures, named
  ONCE at each section's head (`DOOR_COLUMNS`), with five cells per door (`doorCells`).
  `label` stops being visible: it becomes the sheet's headline and the button's
  accessible name. The house `See all ›` is said once, under the card title.
- **The suite pins two rules.** The cells and `careerSplitLine` must quote the same five
  figures in the same order (the door is the only place the card and the sheet meet).
  `DOOR_EMPHASIS` must ink a RATE: a pitcher's fifth column is `BB`, a hitter's is OPS,
  and inking `BB` points at a walk total as though it were the headline. Emphasis is
  COLOUR, never weight: JetBrains Mono ships one registered weight here.
- **A run of doors folds.** Doors that differ in one number set `family` and fold behind
  one row (`FAMILIES`/`FOLD_FROM`). A folded door is not in the DOM, so a test that
  asserts one opens its family first.

## Postseason, surfaces, and counts

- **`spansPostseason` and `facet.postseason` are required together**, and a test pins
  it: one alone states a career the door does not open. Only the month and weekday
  doors span the postseason (ADR-0073).
- **MLB publishes no combined aggregate.** `careerStatSplits` answers one `gameType` at
  a time, so the label adds two with `mergeCareerSplits` and recomputes rates from
  components. Two rates cannot be averaged, and MLB's OPS is each half ROUNDED to three
  places, then added.
- **The Postseason door moves the fetch's game types** instead of filtering rows, so it
  does not share the other six's join. Never ask statsapi for the umbrella `P`: it comes
  back as every PITCHING row's type and empties the sheet for pitchers alone (ADR-0069).
- **On grass / On turf** use `hydrate=venue(fieldInfo)`. The surface is SEASON-correct,
  so never build it from a table of today's parks.
- **Started / Substitution** (#1003) are game COUNTS and nothing else: they set
  `lineKind: 'games'` alongside `fielding`, and `doorLine` lets one card hold both kinds
  of line. They are the only doors that cost a request of their own (`needsLineups`). A
  row the lineups could not answer for is `null` and belongs to NEITHER door.
- **A door's figure and its rows disagree by a few games.** The figure is MLB's career
  aggregate and the rows are MLB's per-game flags. They cannot be reconciled, so never
  assert one against the other.

## List doors

A list door is the other shape (#1048): an entry with a `list` descriptor and NO `facet`
and NO label source, for a question with too many answers to be doors:
`{ groupBy, name, order, facet, title }`. The sheet folds the gated rows into groups
(`fold.js`) and each group opens its own rows.

- **Its figures come from the ROWS, not from MLB.** `b1`–`b9` count games with a plate
  appearance in a slot, where the lineups count who STARTED there, so a door labelled
  from the aggregate opens an empty sheet on the low slots.
- **It names no source**, so the card cannot test it for games. The card's existence
  test asks for at least one SOURCED door, or a MiLB player would get a card holding one.
- **Its row is its name and the chevron**, with no five cells: the figures belong to its
  groups.
- **A park list groups on the stable venue ID** and names each group from its NEWEST row.
- **Both lists count October** (`postseason: true` on the list's facet). A list door must
  never set `spansPostseason`: that widens a LABEL's fetch and a list has no label
  source, so a test pins it undefined.
