# What's Brewing: parsing a club's Game Notes PDF into text

The lineup page's **Game notes** button used to only link out to a club's
official pre-game press-notes PDF (see `src/api/gameNotes.js` and
`docs`-adjacent notes there). For a **calibrated club**, it now instead opens an
in-app modal of the narrative blurbs from the PDF — the hand-titled callouts
(Brewers: *Hulk Logan*, *Don't Pitch to Mitch*, …; Pirates: *Beer Batter*, *Jake
'n Rake*, *Home(r) Happy*, …) — with the full PDF still linked inside the modal.

This documents how that parse works, why it's shaped the way it is, and how to
verify or extend it. It's the companion to the code: `src/api/whatsBrewing.js`
(parser + the per-club `CONFIG`), `src/components/WhatsBrewingModal.jsx` (the
modal), and `GameNotesButton` in `src/screens/TeamInfo.jsx`.

## The short version

- The PDF is a real **text layer** (exported from InDesign), not a scan — so
  `pdfjs-dist` extracts positioned text directly, no OCR.
- The parse is **per-club**, driven by a `CONFIG` map keyed by teamId. Each entry
  picks a `layout` algorithm and its tunables (fonts, x-bounds). Two templates
  are calibrated so far, in two layouts:
  - **`column`** (Brewers, 158): the bespoke Industry-font sheet whose blurbs
    live in a narrow **left column**, isolated by **x-position** and split into
    title/body by **font** (Industry-Demi titles over Industry-Book body),
    anchored by the **Industry-Bold** "WHAT'S BREWING?" header.
  - **`flow`** (Pirates, 134): the **league-standard Myriad + Gotham** sheet
    whose blurbs are **full-width prose** with an **inline all-caps heading**
    (`TITLE : body`, all on one baseline), flowing around right-column stat
    tables. See "The flow layout" below.
- Standings/records tables are dropped by detecting long **dotted leaders**
  and/or their **x-position**; only prose blurbs survive.
- Parsing happens **client-side**, on demand, in the browser — not in the
  nightly `gen-game-notes.mjs` cron. `pdfjs` is dynamically imported so it only
  loads when the modal opens, and it's kept out of the PWA precache.
- Callers gate the modal on **`hasWhatsBrewing(teamId)`** (i.e. "has a CONFIG
  entry"); every un-calibrated club keeps the plain PDF link-out.

## Why client-side, not the cron

The natural instinct in this repo is to precompute heavy things in a nightly
GitHub Action and commit static JSON (that's the `war.json` / `rehab.json` /
`game-notes.json` pattern). We deliberately **don't** do that here:

- The note you most want parsed is **tonight's**, and a club posts it only a few
  hours before first pitch — *after* the daily `update-game-notes.yml` cron has
  already run. A build-time parse would always be a day behind for the game
  you're actually scoring.
- The PDF host (`img.mlbstatic.com`) serves with **`Access-Control-Allow-Origin:
  *`**, so the browser can `fetch()` and parse the PDF directly. No backend, no
  proxy, no `game-notes.json` bloat.

So the parser is a lazily-imported client module. `pdfjs-dist` is heavy
(~365 KB chunk + a ~1.3 MB worker), so:

- `WhatsBrewingModal.jsx` does `await import('../api/whatsBrewing.js')` inside an
  effect, and `whatsBrewing.js` in turn does `await import('pdfjs-dist/...')` —
  Vite code-splits pdfjs into its own chunk that never touches the main bundle.
- `vite.config.js` keeps the pdfjs chunk/worker **out of the PWA precache**
  (`globIgnores: ['**/assets/pdf*']`) and runtime-caches them **CacheFirst**
  instead, so they only ever download for a user who actually taps the modal.

## Spoiler stance

A Game Notes packet is written **pre-game**; it only ever recaps *prior*
results, never the game being scored. So these blurbs are spoiler-safe like the
rest of the lineup page, and the modal lives **outside any seal** — the same
stance as the original full-PDF link-out. Nothing here needs a `SealBox`.

## The PDF's structure (Brewers template)

Front page, US Legal (612 × 1008 pt), three columns. What we want is the **left
column**, headed "WHAT'S BREWING?", which is a vertical stack of small boxed
callouts:

```
WHAT'S BREWING?          <- Industry-Bold, the section header (top anchor)
Today's Transactions     <- Industry-Demi title
  RHP … was reinstated…  <- Industry-Book body (may open with a bold name)
When You're Hot You're Hot
  The Brewers are a Major League-best 45-21 (.682) since April 26.
Arch Support
  The Brewers look to win 4 games in a series in St. Louis…
Hulk Logan / Don't Pitch to Mitch / The Brice Is Right / Say It Ain't Joe! / …
NL Central Standings / MLB Best Records / Opponent Record  <- dotted-leader tables
```

The fonts are the key signal (resolve them via `page.commonObjs.get(fontName)`
after `page.getOperatorList()`; the generated `g_d0_fN` ids are **not** stable
across PDFs, but the real PostScript names are):

| Real font name       | Role                                             |
| -------------------- | ------------------------------------------------ |
| `Industry-Bold`      | The "WHAT'S BREWING?" section header — **anchor** |
| `Industry-Demi`      | Blurb **titles** + inline bold player names      |
| `Industry-Book`      | Blurb **body** prose                             |
| `Industry-Medium`    | Table numbers (standings/records)                |
| `Industry-DemiItalic`| Italic emphasis (excluded)                       |

## The `column` layout (Brewers) — `extractColumn` in `whatsBrewing.js`

`extractBlurbs(items, realName, cfg)` is a **pure** dispatch over
`getTextContent()` `items` plus a `fontName → realPostScriptName` resolver and
the club's `cfg`; for a `column`-layout club it runs `extractColumn`. It's
testable off a raw items array without a browser (see the harness below). Steps:

1. **Emphasis vs header fonts.** `isEmphasis` = `Industry-Demi` (non-italic) —
   titles and inline names. `isHeaderFont` = `Industry-Bold` — the section
   header. Keeping these **separate** matters: mid-column lead-ins like "BREWING
   SUCCESS" are Demi, so if the header anchor accepted Demi it would wrongly lock
   onto them instead of the real Bold "WHAT'S BREWING?". This was a real bug in
   development — see the git history of `whatsBrewing.js`.
2. **Top anchor.** Find the Bold word matching `/BREWING/`; its `y` is the top of
   the column. Everything below it is column content; the away@home masthead
   sits above and is excluded.
3. **Isolate the column** by x-position (`x < 165`; the page is 612 pt wide and
   the next column starts past ~165) and `y < headerY`, then sort top-to-bottom
   (PDF `y` increases upward, so descending `y`).
4. **Regroup into visual lines** — items sharing a baseline (`|Δy| ≤ 3`) are one
   line. A line `allBold` when every item on it is emphasis-font.
5. **Split into blurbs.** A short (`≤ 40` char), fully-emphasis line starts a new
   blurb (its **title**); the ordinary lines beneath it are its **body** until
   the next such title. (Body lines that merely *open* with a bold player name
   are mixed-font, so they're not mistaken for titles.)
6. **Drop the non-narrative boxes.** Filter out any blurb whose title is a known
   table (`SKIP_TITLE`: standings, records, the upcoming schedule, the broadcast
   footer) **or** whose body contains long dotted leaders (`/\.{8,}/` — the
   "Milwaukee …………… 58-34" table style). Only prose blurbs remain.
7. **Tidy the prose.** The notes use `.....` (3–5 dots) as a *stylistic sentence
   separator*, so runs of 3+ dots become a spaced ellipsis `…`. Tighten space
   before real sentence punctuation — but **not** before a decimal like ` .331`
   (a batting average), which is why the tidy regex only collapses space before
   punctuation that's followed by whitespace/end.

Failure is **safe by design**: any surprise (network error, template change,
unexpected fonts) returns `[]`, and the modal falls back to just showing the
"View full PDF ↗" link.

## The `flow` layout (Pirates / league-standard template) — `extractFlow`

Most clubs use MLB's **league-standard** notes template (Myriad body, Gotham
headers) rather than a bespoke one, and it looks nothing like the Brewers' left
column — so it gets its own algorithm, selected by `cfg.layout === 'flow'`. The
Pirates (134) are the first `flow` club.

**What the sheet looks like.** Front page, US Legal, with the narrative set as
**full-width prose paragraphs**, each introduced by an **inline heading**: an
all-caps section title, a colon, then the body — *all on the same baseline* —
e.g. `THE PIRATES : have lost two of the first three games…`. The prose wraps
full width at the top of the page, then narrows as boxed **stat tables** intrude
from the right (a "BUCS WHEN…" team-record table top-right; a scoreless-streaks
table mid-right) and full-width **boxes** close the page (an "ON THIS DATE…"
recap, an "UPCOMING GAMES…" grid).

The fonts don't split title from body the way the Brewers' do — the headings are
a **heavier weight of the same variable font** (`MyriadVariableConcept-Roman`),
which pdfjs surfaces as a *distinct font object with the same base name but a
different subset prefix*. The **subset prefix is not stable across exports**, so
the parser never hardcodes it; instead it treats "a Myriad face that is **not**
the dominant body face" as the heading face. Gotham marks the section/table
headers and the masthead.

| Real font name (base)          | Role                                        |
| ------------------------------ | ------------------------------------------- |
| `MyriadVariableConcept-Roman`  | Body prose **and** headings — separated by which *subset* (dominant = body, the other = heading) |
| `Gotham-Ultra` / `Gotham-Black`| Section/table headers + the masthead        |

Steps (`extractFlow`):

1. **Body face = the most common font on the page** (dynamically — no hardcoded
   subset). Headings = an emphasis face (`/Myriad/`) that isn't the body face.
2. **Headings** are emphasis-face runs at the **left margin** (`x < headingMaxX`,
   ~37 pt). Group each heading's same-baseline emphasis words (title + its colon)
   and strip the colon; sort headings top-to-bottom.
3. **Body words = the body face only.** This alone drops the Gotham headers and
   the non-body-subset stat-table values (e.g. the streak table's names) for free.
4. **Two contaminants share the body face** and must be excluded geometrically:
   - the **bottom boxes** (ON THIS DATE / UPCOMING GAMES) — dropped by a
     **bottom-Y cutoff** set to the highest Gotham header sitting left-of-center
     below the narrative (`headerLeftMaxX`), i.e. the top of those boxes;
   - the **right-column records table** ("BUCS WHEN…") — dropped by excluding its
     **rectangle** (`x ≥ rightTableMinX`, at/below its own Gotham header). The
     only prose that reaches that far right is the lead blurb's top lines, which
     sit *above* that header and so survive. A `tableLeader` regex (10+ dots,
     possibly space-separated) is a second line of defense.
5. **Regroup body words into baselines** (`|Δy| ≤ lineTol`, tight — 2 pt — since
   the two right-column tables interleave baselines with the prose and must not
   merge), keep lines that start in the left column (`x_min < columnMaxX`) and lie
   in the narrative band, then **assign each line to the lowest heading at or
   above it** and join top-to-bottom.
6. **Join words by gap, not blindly by space** (`joinWords`): a space goes in
   only where there's a real horizontal gap, so tightly-kerned combining glyphs
   (`Ram` `í` `rez`) rejoin as `Ramírez`. Then **tidy** (shared with `column`):
   `...` → ` … `, rejoin line-break hyphenation (`Chicago- NL` → `Chicago-NL`),
   tighten space before sentence punctuation.

Same **fail-safe-to-`[]`** contract: if the heading face can't be told from the
body face (or anything else surprises), the result is `[]` and the modal just
links the PDF.

## Verifying / iterating

You can exercise the shipped pure function against real PDFs **without a
browser** — Node can run `pdfjs-dist/legacy/build/pdf.mjs` with `disableWorker`.
Drive **`extractForTeam(items, realName, teamId)`** — the pure core of
`fetchWhatsBrewing` minus the fetch, which picks the club's `CONFIG` for you:

```js
// verify.mjs — run: node verify.mjs <pdf> <teamId>
import { getDocument } from 'file:///ABS/PATH/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { extractForTeam } from 'file:///ABS/PATH/src/api/whatsBrewing.js'
import fs from 'fs'
const [file, teamId] = [process.argv[2], Number(process.argv[3])]
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), disableWorker: true }).promise
const page = await doc.getPage(1)
await page.getOperatorList()                                    // resolves fonts into commonObjs
const tc = await page.getTextContent()
const realName = (fn) => { try { return page.commonObjs.get(fn)?.name || '' } catch { return '' } }
console.log(extractForTeam(tc.items, realName, teamId))         // e.g. teamId 134 = Pirates
```

Grab a few PDFs to test the template across dates (the blurb set changes every
game, so this checks robustness, not just one sheet):

```bash
# URLs live in public/data/game-notes.json under notes[teamId] (158 = Brewers, 134 = Pirates)
node -e "const d=require('./public/data/game-notes.json'); console.log(d.notes['134'].slice(0,3).map(n=>n.url).join('\n'))"
curl -s -o notes.pdf "<one of those urls>"
```

To read off a new club's fonts/geometry, use the standalone dumper in the
Game-Notes parsing kit (`~/Documents/bbsbh-game-notes/dump-pdf-fonts.mjs`):
`node dump-pdf-fonts.mjs PIT-latest.pdf 1 fonts` tallies the page's fonts;
without `fonts` it prints every item's `x, y, font, text` — exactly the raw
material `extractFlow`/`extractColumn` work from.

Notes on Windows: absolute `import` paths must be `file:///C:/...` URLs, not bare
`C:/...`. The scratchpad dir is a fine place for `notes.pdf` and the harness.

To eyeball layout/fonts of a PDF quickly, `pdftotext -raw` (xpdf) dumps the
content-stream order, and `pdftotext -layout` shows the visual columns
interleaved.

## Extending to other clubs

Each club lays its notes out in an InDesign template — either a **bespoke** one
(the Brewers) or the **league-standard** Myriad + Gotham sheet (the Pirates, and
most others). To add a club:

1. **Read off its template** with the dumper (fonts + column x-bounds).
2. **Pick a `layout`.** If it's the league-standard sheet, start from the
   Pirates' `flow` entry and re-tune the x-bounds; if it's bespoke, you may need
   a new layout function. Don't assume another club's numbers transfer.
3. **Add a `CONFIG` entry** keyed by its teamId (with a `title` for the modal
   heading). That's the whole wiring — `hasWhatsBrewing`/`whatsBrewingTitle` and
   `GameNotesButton` light up automatically the moment the entry exists.
4. **Verify** with the harness above against a couple of its PDFs before shipping
   — the parse fails silently to `[]`, so a human glance per club is worth it.

Whatever the shape, keep the **fail-safe-to-`[]`** contract so a mis-calibrated
club quietly falls back to the PDF link rather than showing garbage.
