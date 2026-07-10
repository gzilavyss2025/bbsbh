# What's Brewing: parsing the Brewers' Game Notes PDF into text

The lineup page's **Game notes** button used to only link out to a club's
official pre-game press-notes PDF (see `src/api/gameNotes.js` and
`docs`-adjacent notes there). For the **Brewers**, it now instead opens an
in-app modal of the narrative blurbs from the PDF's left **"WHAT'S BREWING?"**
column — the hand-titled callouts (*Hulk Logan*, *Don't Pitch to Mitch*, *When
You're Hot You're Hot*, …) — with the full PDF still linked inside the modal.

This documents how that parse works, why it's shaped the way it is, and how to
verify or extend it. It's the companion to the code: `src/api/whatsBrewing.js`
(parser), `src/components/WhatsBrewingModal.jsx` (the modal), and the Brewers
branch of `GameNotesButton` in `src/screens/TeamInfo.jsx`.

## The short version

- The PDF is a real **text layer** (exported from InDesign), not a scan — so
  `pdfjs-dist` extracts positioned text directly, no OCR.
- The left "WHAT'S BREWING?" column is isolated by **x-position**, its blurbs
  split into title/body by **font** (Industry-Demi titles over Industry-Book
  body), anchored at the top by the **Industry-Bold** section header.
- Standings/records mini-tables in that column are dropped by detecting their
  long **dotted leaders**; only prose blurbs survive.
- Parsing happens **client-side**, on demand, in the browser — not in the
  nightly `gen-game-notes.mjs` cron. `pdfjs` is dynamically imported so it only
  loads when the modal opens, and it's kept out of the PWA precache.
- **Brewers only**, deliberately. The geometry and fonts below are calibrated to
  the Brewers' template. Every other club keeps the plain PDF link-out.

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

## The algorithm (`extractBlurbs` in `whatsBrewing.js`)

`extractBlurbs(items, realName)` is a **pure** function over `getTextContent()`
`items` plus a `fontName → realPostScriptName` resolver, so it's testable off a
raw items array without a browser (see the harness below). Steps:

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

## Verifying / iterating

You can exercise the shipped pure function against real PDFs **without a
browser** — Node can run `pdfjs-dist/legacy/build/pdf.mjs` with `disableWorker`.
Grab a Brewers PDF URL from the archive and drive `extractBlurbs`:

```js
// verify.mjs — run: node verify.mjs
import { getDocument } from 'file:///ABS/PATH/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { extractBlurbs } from 'file:///ABS/PATH/src/api/whatsBrewing.js'
import fs from 'fs'
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync('brew.pdf')), disableWorker: true }).promise
const page = await doc.getPage(1)
await page.getOperatorList()                                    // resolves fonts into commonObjs
const tc = await page.getTextContent()
const realName = (fn) => { try { return page.commonObjs.get(fn)?.name || '' } catch { return '' } }
console.log(extractBlurbs(tc.items, realName))
```

Grab a few PDFs to test the template across dates (the blurb set changes every
game, so this checks robustness, not just one sheet):

```bash
# URLs live in public/data/game-notes.json under notes["158"] (Brewers = 158)
node -e "const d=require('./public/data/game-notes.json'); console.log(d.notes['158'].slice(0,3).map(n=>n.url).join('\n'))"
curl -s -o brew.pdf "<one of those urls>"
```

Notes on Windows: absolute `import` paths must be `file:///C:/...` URLs, not bare
`C:/...`. The scratchpad dir is a fine place for `brew.pdf` and the harness.

To eyeball layout/fonts of a PDF quickly, `pdftotext -raw` (xpdf) dumps the left
column as a contiguous block in content-stream order, and `pdftotext -layout`
shows the visual columns interleaved.

## Extending to other clubs

Each of the 30 teams lays its notes out in its **own InDesign template**, so the
x-threshold, the font names, and the blurb structure above are Brewers-specific.
`GameNotesButton` gates the modal on `meta.id === BREWERS_ID` (158); every other
club keeps the plain PDF link.

To add a club, calibrate its template the same way (run the harness against a
couple of its PDFs, read off its column x-range and its title/body/header fonts)
and generalize the constants — don't assume the Brewers' numbers transfer. If
several clubs share the league-standard template, a small per-team config map
(column x, title font, header matcher) is cleaner than branching. Whatever the
shape, keep the **fail-safe-to-`[]`** contract so a mis-calibrated club quietly
falls back to the PDF link rather than showing garbage.
