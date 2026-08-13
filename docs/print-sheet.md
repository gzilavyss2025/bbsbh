# Tonight's sheet — the printable pre-pitch scorecard

`/{date}/{matchup}/sheet` → `src/screens/sheet/`. One page of landscape paper
carrying both batting orders, the crew, the park, the managers, the probable
starters and the weather, with **every at-bat box empty**. You print it, you take
it to the game, you keep score on it by hand.

The proposal this shipped from is `docs/enhancement-proposals.md` §"Considered and
set aside", which called it "a print-layout project more than a data feature". That
turned out to be exactly right, and it is why this doc is mostly about paper.

## The empty grid is the product

This is the point on which the feature can only be got wrong in one direction.
Tally shows you the game; **you** keep the score. A sheet that filled in what has
already happened would make this a scoring tool, which the app deliberately is not
(root `CLAUDE.md`). So:

- Nothing on the shipped route may fill an at-bat box, a per-inning run total, an
  AB/H/R/RBI column, or the decision line.
- The inked grid already exists — `src/api/loadScorecard.js`'s `scorecardPlays`,
  rendered by `/scorecard-lab`. It is DEV-only, `App.jsx` drops it from the
  production module graph, and it stays there.

`test/print-sheet.test.js` pins the empty cell as an assertion, so a change that
fills one has to delete a test that says why not.

## Where the values come from

`src/screens/sheet/sheetModel.js` imports **`src/api/select.js` and nothing else**
out of the data layer. Four selectors, all of which the two lineup pages already
call at their own render top level today (`screens/TeamInfo.jsx`):

| Sheet field | Selector |
| --- | --- |
| Date, ballpark, first pitch, box weather | `selectGameInfo` |
| Club names, abbreviations, probable starters | `selectTeamMeta` |
| Umpire crew | `selectOfficials` |
| Batting orders — jersey, starting position, name | `selectLineup` |

Managers and the outdoor weather reading are not in the feed at all; both arrive as
props from `GameView` (`useGameData`'s `managers` and `weather`), so opening the
sheet costs **no request** — every input is already in hand for whatever section of
the game you came from.

Three modules are off limits, and two guards enforce it rather than this paragraph:

- `api/linescore.js` and `api/derive.js` are reveal-only and carry an `importers`
  allowlist in `src/api/spoiler-manifest.json`;
  `scripts/check-spoiler-manifest.mjs` fails `npm run lint` on any importer not on
  it.
- `api/loadScorecard.js` is classed `mixed` and the manifest would *permit* its
  spoiler-free half — so `test/print-sheet.test.js` blocks it separately. Its
  spoiler-free half sits two lines above an import of `revealInning`, and pulling
  any of it in would drag the full-reveal grid into the production bundle.

## Paper

`src/styles/63-print-sheet.css`, authored in **millimetres**, because the unit the
deliverable is measured in is paper. A useful side effect: the on-screen preview is
literally life-size.

`@page { size: landscape; margin: 8mm }` declares an **orientation and no paper
name**, so the reader's own Letter or A4 selection stands. That means one design has
to fit both, and:

> **A4 landscape is the binding constraint, not Letter.** It is 6mm *shorter*
> (210mm vs 216mm) even though it is 18mm wider. At an 8mm margin: A4 gives 194mm of
> usable height, Letter 200mm.

The sheet measures 181.5mm — 12.5mm of slack on A4, 18.4mm on Letter. That slack is
the allowance for a font falling back to a taller face, not spare room to spend.
`--ps-row` is where any change lands: **every 0.5mm added to a row costs 9mm of
page**, because there are eighteen of them.

Two other rules that are load-bearing rather than stylistic:

- **Nothing may depend on a background fill.** A browser's print dialog has
  "background graphics" switched off by default, so a background is simply absent
  from the paper. Every rule, box and diamond is drawn with a `border`.
- **The print block peels the app down to the sheet** through an explicit
  `#root > .app > .screen > .printsheet-screen` chain, keyed on a
  `body[data-print-sheet]` attribute the page sets while mounted. Explicit rather
  than a `:has()` sweep so that when `GameView`'s structure changes it shows up as
  chrome in the print preview and as a failing page count, both findable.

## The door, and the phone

The entry point is on **both lineup pages**, under the facts and the umpire card:
"Print tonight's sheet" (`screens/TeamInfo.jsx`). Those are the pre-first-pitch
surfaces, which is when a scorer wants a sheet.

It is deliberately **not** a sixth `.stepnav` tab: those buttons are `flex: 1 1 0`,
so a sixth stop divides a phone's row into ~52px cells and wraps "Innings" onto two
lines.

On the page itself, `PrintSheetButton.jsx` takes the **same two-step shape as
`SavePosterButton`** (`components/preview/`) — a phone has exactly one route out of
a web page into its own apps, and that is the system share sheet. The payload is
what differs, and it is why this isn't literally that component:

| | Poster | Sheet |
| --- | --- | --- |
| Deliverable | the bytes | ink on paper |
| Shared | a `File` | the page's own **URL** |
| Discriminator | `navigator.canShare({ files })` — desktop has `share()` and refuses files | `(pointer: coarse)` — every desktop `share()` accepts a URL, so the payload can't tell them apart |
| Fallback | download link | `window.print()` |

A phone can't make ink, but it can hand the sheet to something that can: AirPrint,
a Mac over AirDrop, a message to whoever is carrying the scorebook. That is why the
sheet is a real, deep-linkable address rather than a modal.

## MiLB

Degrades the way everything else does (root `CLAUDE.md`), and here the degradation
has a natural shape because the whole sheet is already made of writing lines:

- No batting order posted → nine numbered, otherwise blank rows.
- A two- or three-man crew → the missing bases print as blank lines, never dropped
  and never `—`; the PA announcer will tell you.
- No probable starter, no manager, no weather, no venue → blank lines.

Verified against a Low-A game (`/08122026/slujup/sheet`, sportId 14) and against an
MLB game whose lineups had not posted yet.

## Verification

`e2e/print-sheet.spec.js` prints the route to PDF **for real**, at Letter and at A4,
and reads the result back with `pdfjs-dist` to assert one page each, that the
staging data reached the paper, and that the app's chrome did not. It runs on the
`desktop` project only — a sheet of paper is the same size on a phone.

`test/print-sheet.test.js` covers the model, the MiLB degradations and the spoiler
boundary above.
