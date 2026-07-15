# Game Notes calibration dossier — fonts & geometry for the 28 remaining clubs

Pre-work by Opus so a Sonnet agent only has to do the extraction/verification per
club. For each club below: which **page** the narrative lives on, the **body** and
**heading** font tests, rough **geometry**, sample **titles**, and **caveats**.
Everything was read off each club's `{ABBR}-latest.pdf` in this folder with
`profile-notes.mjs` (per-page font tally + left-margin heading runs) and
`page-scan.mjs` (which page carries the narrative). All sheets are **US Legal,
612 × 1008 pt**.

Done already (not here): **Brewers (158)** `column`, **Pirates (134)** `flow`, all
12 GREEN clubs, all 11 YELLOW clubs, and **ATL** (moved out of RED — see below).
Remaining: **TB, TEX, TOR, CIN** (RED tier).

> **Running this from the repo (incl. Claude Code cloud):** the PDFs are **not**
> committed (large + the "latest" one changes daily). Fetch a club's current PDF by
> teamId with `node .scratch/game-notes/fetch-note.mjs <teamId>` (it reads the URL
> the app already ships in `public/data/game-notes.json`). The template — fonts and
> geometry — is **date-stable**, so a freshly fetched PDF still matches the numbers
> below; only the day's blurb text differs. If `img.mlbstatic.com` isn't reachable
> from your sandbox, the font/geometry here is still authoritative — write the
> config from it and the maintainer verifies locally against a real PDF.

---

## Two findings that change the plan — read first

### 1. The narrative is often on PAGE 2, and the parser only reads page 1

`whatsBrewing.js` → `parsePdf` does `doc.getPage(1)`. That's fine for the Brewers
and Pirates (their blurbs are on the front page), but **most clubs split the
packet**:

- **Page 1** = a *team* front: for ~half the league this is the punny narrative
  (BOS, NYM, MIA, PHI, LAD, ATH, HOU, KC, LAA, DET, ARI, CLE, CWS); for the other
  half it's a **season-splits / leaderboard table** and the narrative moves back.
- **Page 2** = a *"TODAY'S STARTER"* page whose sub-headings are the fun ones
  (BAL: *HEY HEY HEY HEY*, *NO FLY ZONE*, *THEM CHANGES*; SEA: *KING OF THE HILL*,
  *CRACKING THE WHIP*; SD p2–3: *WELCOME TO FRIARHOOD*, *SLIIIIDE TO THE LEFT*).

**So the parser needs a per-club `page` (or `pages`) in `CONFIG`**, and `parsePdf`
must load that page instead of hardcoding 1. That's the single most important code
change before the table-front clubs can be done. It's small: thread `cfg.page ?? 1`
(or loop `cfg.pages`) into `getPage`. Do this once and ~10 clubs unlock.

### 2. Nearly every club is "flow-bold", a slight generalization of the Pirates' `flow`

The Pirates `flow` finds headings as *"a Myriad face that isn't the dominant body
subset."* That subset trick is Pirates-specific. **Every other club uses the same
family at two real weights**: body = `Family-Regular/Roman/Light/Book`, headings =
`Family-Bold/Black/DemiBold`, the heading set ALL-CAPS and/or colon-terminated,
sitting at a left margin. The Brewers' `column` split-by-`-Demi`-vs-`-Book` is the
same idea. So the cleanest generalization is a **`flow` variant driven by explicit
font regexes**, not by "which subset is biggest":

```
body     = font matches cfg.bodyFont  AND NOT cfg.headFont
heading   = font matches cfg.headFont  AND x < cfg.headingMaxX   (left margin)
```

Two things the current `extractFlow` assumes that this must relax:

- **Body can span multiple subsets of the same family** (DET, BAL, MIN, SEA all
  have the body face split across 2+ pdfjs font objects). `bodyFont = single most
  common font` would drop half the prose. Matching a **family regex minus the
  heading regex** fixes it — captures every body subset, excludes the bold heads.
- **There may be no separate display family (Gotham) to anchor the table/bottom-box
  cutoffs.** For most clubs the splits tables are set in the *body* face, so the
  Gotham-based `bottomCutoff` / `rightTableTopY` won't fire. Fall back to
  **geometry** (`columnMaxX` keeps only left-column lines; a `bottomY` cutoff drops
  the schedule box) and the **`tableLeader` dotted-leader regex** (already in the
  code) as the font-agnostic table filter.

I proved the recipe: with body=family / head=bold-weight, **titles extract cleanly
on the GREEN clubs**; the only work left is the per-club `columnMaxX` + table
exclusion the Pirates entry already models. See `flowbold-test.mjs` in this folder.

---

## Tier summary (do them in this order)

| Tier | Clubs | Why |
| ---- | ----- | --- |
| 🟢 **GREEN** (12) | BOS, NYM, MIA, PHI, LAD, ATH, HOU, KC, LAA, SEA, MIN, NYY | Clean single left column, unambiguous Regular/Bold split, punny content. Straight `flow-bold` config + geometry tuning. **All 12 calibrated.** |
| 🟡 **YELLOW** (11) | DET, ARI, CLE, CWS, BAL, SF, COL, SD, CHC, WSH, STL | Doable but one wrinkle each (split body, multi-column, italic body, substituted fonts, or blander content). **All 11 calibrated.** |
| 🔴 **RED** (5, 4 done) | ~~ATL~~, ~~CIN~~, ~~TB~~, ~~TEX~~ (done), TOR | Genuinely hard: multi-column starter pages, bespoke serif broadsheet, or (mis-tiered) two-column/single-wide-column narrative. ATL, CIN, TB, and TEX all turned out tractable — see their `CONFIG` entries in `whatsBrewing.js`. **TOR remains.** |

Recommended path: land finding #1 (`page` in CONFIG) + finding #2 (`flow-bold`
variant) as one small parser change, calibrate **BOS + NYM** as pilots (cleanest),
then fan a Sonnet agent per GREEN club, then YELLOW. Verify every club with the
`extractForTeam` Node harness (`docs/whats-brewing.md`) before wiring — the parse
fails silently to `[]`.

Geometry numbers below are **starting points** read off one dated PDF; the agent
should confirm with `dump-pdf-fonts.mjs` and nudge. Titles are colon-terminated
ALL-CAPS unless noted.

---

## 🟢 GREEN

### BOS — Red Sox (111) · page 1
- **body** `/FrutigerLT-Cn/`  **head** `/FrutigerLT-BlackCn/`  · headingMaxX ≈ 55, columnMaxX ≈ 150, right splits table at x ≈ 460
- Titles: STATE OF THE SOX · SERIES BUSINESS · ROAD WARRIORS · HEY NOW · SOX & METS · NATIONAL AFFAIRS · AT THE HELM · FUTURE SOX
- The cleanest club in the league — single left column, one bold weight. Ideal pilot. Bottom `DATE` schedule box needs a bottom-Y cutoff.

### NYM — Mets (121) · page 1
- **body** `/Grift-Regular/`  **head** `/Grift-Bold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150, right table at x ≈ 320
- Titles: METSCELLANEOUS · ROSTER MOVES · HIGH FIVE · MANY HOMERS CLUB · THAT'S OFFENSIVE · 9 IS FINE · HOW NOW YOU'RE AN ALL-STAR · 20/20 VISION · JUAN OF A KIND · RED SOTO CUPS
- Second pilot. Two lead rows are the opponent line (`Boston Red Sox (43-48)` / standings) — drop via a top cutoff or skipTitle.

### MIA — Marlins (146) · page 1
- **body** `/GothamXNarrow-Book/`  **head** `/GothamXNarrow-Bold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150, right table at x ≈ 440
- Titles: MARLINS MINUTE · FIGHTIN' FISH · YESTERDAY'S RECAP · WWWWWWWWINS FOR SANDY · 30/20 VISION · BULLPEN BULLETS · OTTO-MATIC · MACK'S MISSILES · TODAY IN MARLINS HISTORY
- `UPCOMING SCHEDULE` banner top-right (Knockout font) + bottom `DATE` box → drop by geometry.

### PHI — Phillies (143) · page 1
- **body** `/Tahoma$/` (i.e. Tahoma, not -Bold)  **head** `/Tahoma-Bold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150, right table at x ≈ 460
- Titles: GAME #94 RECAP · SCHWARBOMBS AND A SHOW · FIGHTIN' AND CLAWING · SEEING STARS · WITH ALL DUE RESPECT… · LEGACY GAME · BIG BAD JON
- Very clean single column (81 body lines at x≈40). Bold player-name lead-ins ("Wheeler", "Cristopher Sánchez") — a short-line title filter avoids treating them as titles.

### LAD — Dodgers (119) · page 1
- **body** `/ArticulatCF-Regular/`  **head** `/ArticulatCF-Bold/`  · headingMaxX ≈ 40 (titles at x≈18), columnMaxX ≈ 150
- Titles: HUMP DAY RUBBER GAME · JUST SLIPPED AWAY · SEARCHING FOR THE "W" · THE L.A. CLASSICS · PAINTING PHILLY BLUE
- Small, tidy sheet; few tables. Note left margin is x≈18 (tighter than most).

### ATH — Athletics (133) · page 1
- **body** `/ProximaNova-Regular/`  **head** `/ProximaNova-BoldIt/`  ← heads are **BoldItalic** · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: ABOUT THE A'S · KURODA-GRAUER · BEFORE THE BREAK · ALL-STARS · STARTING PITCHING · HOME AND AWAY · HOME AND AWAY SPLITS
- `ProximaNova-Bold` (non-italic) is a *different* role (right-column table) — do NOT use it as the head test; use `-BoldIt`.

### HOU — Astros (117) · page 1
- **body** `/Colfax-Regular/`  **head** `/Colfax-Bold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: ABOUT THE RECORD · ASTROS VS. NATIONALS (2025) · ASTROS VS. NATIONALS (ALL-TIME) · TODAY'S MEDIA AVAILABILITY · THIS DATE IN ASTROS HISTORY · UPCOMING SCHEDULE…
- Several "titles" are vs-table / history-box headers — add them to `skipTitle`.

### KC — Royals (118) · page 1
- **body** `/Gotham-Book/`  **head** `/Gotham-Bold/`  · headingMaxX ≈ 60 (titles at x≈14), columnMaxX ≈ 150
- Titles: GETAWAY DAY GETS AWAY · BACK IN ACTION · 10 YEARS · FIRST IMPRESSIONS · BREAK AHEAD · HEY NOW! · LUMBER JAC · ROAD WORK
- Body is Gotham too, so `isHeaderFont: /Gotham/` (the Pirates test) would match everything — must key on `-Bold`. Masthead + bold player names are also Gotham-Bold; gate titles by ALL-CAPS + short length.

### LAA — Angels (108) · page 1
- **body** `/QuietSans-Regular/`  **head** `/QuietSans-Bold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: LEADING OFF · ABOUT LAST NIGHT · ON THE MOUND · WE MEET AGAIN · LEAGUE LEADER · GETTING ON
- Bold player-name lead-ins ("Adell") and a milestone box ("12-TIME ALL-STAR", "MOST CAREER HOME RUNS vs. …") at left margin — filter to colon-terminated / short ALL-CAPS titles; drop the bottom `DAY`/schedule box.

### SEA — Mariners (136) · **page 2**
- **body** `/HelveticaNeueLTStd-Roman/`  **head** `/HelveticaNeueLTStd-Bd/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: ABOUT BRYCE MILLER · KING OF THE HILL · WHAT A STRETCH · ON A HOT STREAK · MASTER OF THE CRAFT · KEEPING THE PATHS CLEAN · CRACKING THE WHIP · BRYCE BESTS ALL · QUICK AND SNAPPY
- Page 1 is a stat/section front; the punny starter notes are page 2. Body also appears as `-Cn`/`-BdCn` (tables) — match `-Roman` only for body, `-Bd` (not `-BdCn`) for heads. Requires finding #1.

### MIN — Twins (142) · **page 2**
- **body** `/TradeGothicLTStd-Cn18/`  **head** `/TradeGothicLTStd-BdCn20/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: ON THE MEND · LAST MLB START · GET YOUR GUARD UP · FAMILIAR FACES · HOME/ROAD SPLITS · NO PLACE LIKE HERE · LEFT/RIGHT SPLITS · THE ARSENAL
- Page 1 is the giant season-splits table (skip it). Page 2 is the starter page, single left column at x≈37. Requires finding #1.

### NYY — Yankees (147) · **page 2**
- **body** `/MyriadPro-Regular/`  **head** `/MyriadPro-Bold/`  · headingMaxX ≈ 55 (titles at x≈29), columnMaxX ≈ 150
- Titles: LAST TIME OUT · ROAD TRIP · VS. WASHINGTON · WEATHERS REPORT · CAREER NOTES
- Page 1 is team stat blocks (YANKEES BY THE NUMBERS…). Page 2 is the starter notes. Content is solid if a touch less punny. Requires finding #1.

---

## 🟡 YELLOW

### DET — Tigers (116) · page 1 · **split body**
- **body** `/Calibri/` **AND NOT** `-Bold`  **head** `/Calibri-Bold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: WE'LL GET OUR PHIL · FIRST THINGS FIRST · WE DO KNOW JACK · WHO SAYS YOU CAN'T GO HOME? · GREENE STREAK · IT'S GOOD FOR SOMETHING · GET ON WITH IT · HEY NOW, YOU'RE AN ALL-STAR
- Rich narrative, BUT the body prose is split across **two Calibri subsets** (149 + 124 items) — a single-`bodyFont` flow drops half. This is the poster child for finding #2's "family minus bold" body test. Worth doing.

### ARI — Diamondbacks (109) · page 1
- **body** `/MyriadPro-Regular/`  **head** `/MyriadPro-BoldCond/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: HERE'S THE STORY · LAST GAME · ARENADO CLOSING IN ON 2,000 HITS · ARENADO IN SAN DIEGO · MORENO'S 28 STRAIGHT STARTS ON BASE
- Uses condensed faces (`MyriadPro-Cond` for captions, `-BoldCond` for heads). A two-line promo box ('KIDS FREE WEEKEND') sits at the very top — drop by top cutoff. Some bullet (`•`) items in body.

### CLE — Guardians (114) · page 1 · **Arial family quirk**
- **body** `/ArialMT/`  **head** `/Arial-BoldMT/` (also `/ArialNarrow-Bold/` for some)  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: THE BIG RIG SHUTS DOWN MINNY IN DAY-GAME WIN · TAKING OUR TALENTS TO SOUTH BEACH · CHECKING IN(TERLEAGUE) · ROAD WOES · DELAUTER IS DE MAN · START ME UP! · A SWING AND A DRIVE!
- Great punny narrative on page 1 — my page-1 font profiler missed it because the heads are `Arial-BoldMT`/`ArialNarrow-Bold`, a *different family name* from body `ArialMT` (so match by name substring, not the family heuristic). Heavy `ArialNarrow` use = right-column tables; exclude by geometry.

### CWS — White Sox (145) · page 1
- **body** `/ArialMT/`  **head** `/Arial-BoldMT/` (section banners in `/Impact/`)  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Narrative present (game recap prose at x≈36) but titles are less regular; `Impact` marks the big section banners, `Wingdings` are bullets/icons. Match heads by `Arial-BoldMT` and treat `Impact` banners as an alternate title face; verify carefully.

### BAL — Orioles (110) · **page 2** · **split body**
- **body** `/Calibri/` **AND NOT** `-Bold`  **head** `/Calibri-Bold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: QUICK HITS · LAST TIME OUT · HEY, HEY, HEY, HEY · HERE, THERE AND EVERYWHERE · PLATOON · VELO UPTICK · THEM CHANGES · SWEET VICTORY · NO FLY ZONE · RISP
- Punny page-2 starter notes. Body split across two Calibri subsets (346 + 291) like DET. Page 1 is a splits table + uses an icon font (`fontello`) and `TTCommonsPro-Blk` section heads. Requires finding #1 + #2.

### SF — Giants (137) · **page 2** · **italic body**
- **body** `/URWDIN-Light/` (covers `-Light` and `-LightItalic`)  **head** `/URWDIN-Bold/`  · headingMaxX ≈ 55 (titles at x≈23), columnMaxX ≈ 150
- Titles: WIZ KID · LAST TIME OUT · LAST MAJOR LEAGUE OUTING · SMALL SAMPLE SIZE ALERT · VS. COLORADO · WITH THE KITTIES · LAST SEASON (AT TRIPLE-A)
- The page-2 body is largely *italic* (`URWDIN-LightItalic` is the most common font), so body must match both Light and LightItalic. Single left column at x≈23. Requires finding #1.

### COL — Rockies (115) · **page 2** · **substituted fonts**
- **body** `/FreeSans$/` (i.e. not Bold)  **head** `/FreeSansBold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: ARTIST ON THE MOUND · FELT LIKE A GIANT · PRESENCE FELT · A WINDY BUMPY ROAD · LET'S LOOK AT THOSE SPLITS · 2025 BODY OF WORK · THE JOURNEY
- pdfjs reports the page-2 fonts as `FreeSans`/`FreeSansBold` (a GNU substitute — the embedded fonts have no usable name). Text and the Regular/Bold split still extract fine; just match by these names. Page 1 (GillSansMT) is a table front. Requires finding #1.

### SD — Padres (135) · **pages 2–3** · **substituted fonts, punny**
- **body** `/FreeSans$/`  **head** `/FreeSansBold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles (p2): APPEARANCE NUMBER 13 · LITTLE HELP HERE · CHECK THE SPLITS · WRONG SIDE OF HISTORY · WE MET AGAIN · SOLID VS. PHILLY. (p3): MAY 14 VS. THE BREW CREW · GREAT DAY FOR A DEBUT · WELCOME TO FRIARHOOD · SLIIIIDE TO THE LEFT
- Page 1 is CID-encoded (no font names, unreadable) — **skip page 1**, parse page 2 (and maybe 3) with the FreeSans split. Genuinely punny content; worth it despite the odd front page. Needs finding #1 (with page 2, ideally 2+3).

### CHC — Cubs (112) · **page 2** · **blander content**
- **body** `/FreeSans$/`  **head** `/FreeSansBold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- Titles: STAT LINES · CURRENT TRENDS · 2026 NOTES · CAREER NOTES
- Page 1 is a big milestone-leaderboard table (14-page packet!). Page 2 starter notes are generic ("Stat Lines", "Current Trends") rather than punny — parseable but lower payoff. Same FreeSans substitute as COL/SD. Requires finding #1.

### WSH — Nationals (120) · page 1 · **heads not at left margin**
- **body** `/GothamXNarrow-Book/`  **head** `/GothamXNarrow-Bold/` (+ `/Gotham-Bold|Black/` section heads)  · **multi-column**
- The bold heads are NOT left-margin (leftMargin count = 2) — the narrative is in **inner columns**, so a single `headingMaxX` at the page margin misses them. Needs column-band detection or a wider headingMaxX per column. Same font family as MIA but a harder layout.

### STL — Cardinals (138) · page 1 · **custom weight names**
- **body** `/CardsHelveticaCondensed$/`  **head** `/CardsHelveticaCondensedBold/`  · headingMaxX ≈ 55, columnMaxX ≈ 150
- The bold face name has **no hyphen** (`CardsHelveticaCondensedBold`), so the family heuristic mis-buckets it — match by name substring. My page-1 profiler showed 0 title candidates for exactly that reason; re-run with the explicit head regex and the titles appear. Cards notes are wordy (637 items p1), likely good content — verify.

---

## 🔴 RED (hard / low-payoff — do last or skip)

ATL and CIN were originally in this tier but turned out tractable. ATL is the
same two-narrative-column shape as NYY/ARI plus a third narrow zone; see its
`CONFIG` entry (teamId 144) in `whatsBrewing.js`. CIN's "bulleted, no
headings" read below was off a different day's PDF — its real template DOES
have colon-terminated ALL-CAPS titles in a two-column layout (teamId 113);
see its `CONFIG` entry, which also prompted a shared-parser fix (`dropRects`
now excludes words before heading detection, not just from the body — needed
because CIN embeds a stat grid whose bold labels share the heading font and
were being promoted as bogus titles). TB, TEX, TOR are the genuinely
still-open RED clubs.

### ~~TB — Rays (139) · page 2 · multi-column + multi-font~~ — CALIBRATED (as page 1)
- This read described a DIFFERENT day's page-2 starter-notes column. The real
  game-day narrative is on **page 1** and is actually ONE wide serif (Aleo)
  column (x~126-486), not multi-column — flanked by two dot-leader stat
  sidebars ("BY THE NUMB3RS" left, "SERIES BREAKDOWN" right) in
  Industry-BlackItalic/AvenirNextCondensed, which self-exclude by font. See
  the `139:` entry in `whatsBrewing.js`. Surfaced a real shared-parser bug:
  the narrative's line cadence and the sidebars' independent cadence
  occasionally land on the EXACT same y (no lineTol can separate that), so
  a body-content-only zone (xMin/columnMaxX excluding both sidebars by x, not
  just relying on line-tolerance) is the correct fix for any future club with
  this shape.

### ~~TEX — Rangers (140) · page 2 · multi-column Arial~~ — CALIBRATED (as page 1)
- This read described a different day's page-2 starter-notes layout. The
  real game-day narrative is on **page 1**: two genuine narrative columns
  (x=142.9 and x=363.2) beside a left stats sidebar to ignore, straightforward
  `columns:` config same shape as ARI/ATL/NYY — no cross-baseline collision
  risk since each zone's xMin/columnMaxX cleanly excludes the other. See the
  `140:` entry in `whatsBrewing.js`.

### TOR — Blue Jays (141) · page 2 · multi-column, heads not left-margin
- Page 2 body `ArialMT`, heads `Arial-BoldMT` (71) but leftMargin=0 — headings are inside columns. Titles (TODAY'S GAME, 2026 HIGHLIGHTS, VS. THE GIANTS) present but the layout duplicates each run twice in the stream ("TODAY'S GAME:TODAY'S GAME:") — a de-dupe quirk plus multi-column. Hard.

### ~~ATL — Braves (144) · bespoke serif broadsheet~~ — CALIBRATED
- Turned out tractable: two narrative columns (like NYY/ARI) plus a third narrow
  left zone. Body `BemboMTPro-Regular` + `ScriptA-Regular` (a decorative bullet
  glyph, not a heading), heads `AGaramondPro-Bold`. See the `144:` entry in
  `whatsBrewing.js` for the full geometry + the two column-specific quirks
  (mixed-case titles in the narrow zone, a "Braves Breakdown" stat sidebar
  dropped via `skipTitle`).

### ~~CIN — Reds (113) · page 1 · bulleted, no headings~~ — CALIBRATED
- This read was off a day's PDF that happened to lack punny sections. The
  real template DOES have colon-terminated ALL-CAPS titles ("SERIES NOTES:",
  "ELLY MAKING HISTORY:", "TOUGH SLEDDING:", …), two-column like NYY/ARI/ATL.
  `Redlegs` is a real (if oddly-named) head-weight font, not a dingbat.
  See the `113:` entry in `whatsBrewing.js` for the full geometry.

---

## Reusable tooling in this folder

All portable (resolve pdfjs via a relative path — run from the repo root):

- `fetch-note.mjs <teamId> [out.pdf]` — fetch a club's latest PDF from the URL in
  `public/data/game-notes.json` (PDFs aren't committed). e.g. `node
  .scratch/game-notes/fetch-note.mjs 111` → `111.pdf`.
- `profile-notes.mjs <pdf> <teamId> <ABBR> [page]` — per-page font tally + emphasis
  candidates + left-margin heading runs. The main calibration read-off.
- `page-scan.mjs <pdf>` — page count + which page carries the bold-left-margin
  titles (how the page-2 narratives above were found).
- `flowbold-test.mjs <pdf> <bodyRe> <headRe> [headingMaxX]` — proves a body/head
  font pair by extracting `### TITLE / body` blurbs (no geometry filtering, so body
  bleeds across columns — good enough to confirm the font tests).
