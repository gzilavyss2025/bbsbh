// What's Brewing — pulls the narrative blurbs out of a club's pre-game Game Notes
// PDF into plain text, so the fun hand-titled callouts can pop out in an in-app
// modal instead of making the user leave for the full PDF. The lineup page's Game
// notes button (TeamInfo.jsx) opens that modal and keeps a link to the whole PDF
// inside it. (The name is a Brewers pun — the first club wired up — but the parser
// now serves any club with a CONFIG entry below.)
//
// Why client-side, not the nightly cron: the note you most want parsed is
// TONIGHT'S, and it posts only a few hours pre-game — after the daily
// game-notes cron (gen-game-notes.mjs) has already run — so a build-time parse
// wouldn't have it in time. The PDF host (img.mlbstatic.com) serves with
// `Access-Control-Allow-Origin: *`, so the browser can fetch and parse it
// directly, no backend and no game-notes.json bloat. pdfjs-dist is heavy, so
// this whole module is meant to be dynamically imported (by the modal, on open)
// — Vite code-splits it into its own chunk that never touches the main bundle.
//
// Spoiler note: a Game Notes packet is written pre-game; it only ever recaps
// PRIOR results, never the game being scored. These blurbs are therefore
// spoiler-safe like the rest of the lineup page, and the modal lives outside any
// seal — the same stance as the existing full-PDF link-out (see gameNotes.js).
//
// PER-CLUB CALIBRATION. Every club lays its notes out in its own InDesign
// template, so the parse is driven by a CONFIG entry keyed by teamId (see below).
// Two templates are calibrated so far, in two `layout` shapes:
//   - Brewers (158) — 'column': a bespoke Industry-font sheet whose narrative
//     blurbs live in a narrow left column, each a Demi title over Book body.
//   - Pirates (134) — 'flow': the league-standard Myriad+Gotham sheet whose
//     blurbs are full-width prose with an INLINE all-caps heading (title, colon,
//     body all on one baseline) flowing around right-column stat tables.
// Callers gate on hasWhatsBrewing(teamId) (whatsBrewingClubs.js — kept out of
// this module so that gate check doesn't force a static import of this whole
// heavy parser, which would defeat the dynamic import above). Parsing fails
// safe: any surprise → [] → the modal just shows the PDF link. Adding a club
// means a new CONFIG entry here + a title in whatsBrewingClubs.js (calibrate
// the template with the dumper in docs/whats-brewing.md), not a new parser.

import { BREWERS_ID, PIRATES_ID } from './whatsBrewingClubs.js'

export { BREWERS_ID, PIRATES_ID }

// Per-club parse calibration. `layout` selects the algorithm; the rest are that
// layout's tunables (read off the club's PDF with the font/geometry dumper —
// see docs/whats-brewing.md "Extending to other clubs"). Fonts are matched by
// real PostScript name, NOT the unstable subset prefix pdfjs prepends.
const CONFIG = {
  // Brewers — narrow left "WHAT'S BREWING?" column, Industry font family.
  [BREWERS_ID]: {
    layout: 'column',
    // The left column lives left of this x (page is 612pt wide; the column runs
    // ~36–160pt, the next column starts past 165).
    columnMaxX: 165,
    // A blurb title is a short, fully-emphasized line; anything longer is body.
    titleMaxLen: 40,
    // 8+ consecutive dots ⇒ a standings/records table row (prose uses 3–5).
    tableLeader: /\.{8,}/,
    // Non-narrative column boxes to drop by title.
    skipTitle: /^(Team Record|Record$|Opponent Record|NL Central|MLB Best|DATE|UPCOMING|Games broadcast)/i,
    // Titles + inline bold names are Industry-Demi (non-italic); the "WHAT'S
    // BREWING?" section header is the heavier Industry-Bold, kept separate so a
    // mid-column "BREWING SUCCESS" Demi lead-in can't masquerade as the header.
    isEmphasis: (n) => /-Demi\b/.test(n) && !/Italic/.test(n),
    isHeaderFont: (n) => /-Bold\b/.test(n),
    headerText: /BREWING/i,
  },
  // Pirates — full-width narrative flow, league-standard Myriad + Gotham template.
  [PIRATES_ID]: {
    layout: 'flow',
    // "THE PIRATES" section is the first blurb, so don't reuse it as the heading).
    // Section headings sit at the page's left margin (~37pt).
    headingMaxX: 55,
    // A prose line starting right of this is a right-column stat table, not body.
    columnMaxX: 250,
    // The full-width bottom boxes (ON THIS DATE…, UPCOMING GAMES…) carry a Gotham
    // header sitting left of this x; the highest such header is the bottom of the
    // narrative region (everything below it is those boxes, dropped).
    headerLeftMaxX: 260,
    // The "BUCS WHEN…" records table is in the prose face too (so font won't drop
    // it) and shares baselines with blurb lines — exclude its rectangle: right of
    // this x and below its own Gotham header.
    rightTableMinX: 440,
    // 10+ dots (possibly space-separated) ⇒ a records-table leader; prose uses 3.
    tableLeader: /\.(\s*\.){9,}/,
    // Headings are a heavier Myriad weight than the body; pdfjs gives them a
    // distinct font object (same base name, different subset), so "a Myriad face
    // that isn't the dominant body face" identifies them. Gotham marks the
    // section/table headers and the masthead.
    isEmphasisBase: (n) => /Myriad/i.test(n),
    isHeaderFont: (n) => /Gotham/i.test(n),
    // Baselines are very stable (10.2pt type on 11.4pt leading); group tightly so
    // a blurb line and an adjacent stat-table row never merge.
    lineTol: 2,
  },
  // --- 'flow-bold' clubs: the league-standard full-width-prose template, but
  // with a real two-weight (Regular/Bold) body/heading split instead of the
  // Pirates' same-subset-vs-different-subset trick. See CALIBRATION.md.

  // Red Sox — cleanest sheet in the league; single left column, one bold weight.
  111: {
    layout: 'flow-bold',
    bodyFont: /FrutigerLT-Cn/,
    headFont: /FrutigerLT-BlackCn/,
    headingMaxX: 55,
    columnMaxX: 150,
    rightTableMinX: 460,
    tableLeader: /\.(\s*\.){7,}/,
    bottomCutoff: 90,
  },
  // Mets — the lead row is the night's opponent/standings line ("{City} {Club}
  // (W-L)"), not a blurb — matched structurally (ends in a win-loss record) so
  // it drops regardless of which opponent the Mets are playing that night.
  // columnMaxX widened (150 -> 310, just under the already-configured
  // rightTableMinX/320): a confirmed real second column recurs at ~310+, but
  // 150 was cutting sentences short of even that — once, mid-WORD ("Mets d |
  // ropped the opening game…" split across two PDF items with a ~0.1pt gap,
  // the second half past the old cutoff, producing "Mets d their…").
  121: {
    layout: 'flow-bold',
    bodyFont: /Grift-Regular/,
    headFont: /Grift-Bold/,
    headingMaxX: 55,
    columnMaxX: 310,
    rightTableMinX: 320,
    tableLeader: /\.(\s*\.){7,}/,
    skipTitle: /^(New York Mets|Vs\. )|\(\d+-\d+\)$/i,
  },
  // Marlins — UPCOMING SCHEDULE banner top-right + bottom DATE box dropped by
  // geometry/skipTitle; allCapsOnly drops bold player-name recap lead-ins
  // ("Kyle Stowers", "Otto Lopez") that share the heading font but aren't titles.
  // columnMaxX widened just enough (150 -> 300) to stop chopping wrapped
  // bold names (e.g. "SS Otto Lopez (16 SB)" in a list) short of a genuine
  // recurring second column confirmed starting ~310pt (a geometry scan
  // clustered 9 separate lines there) — stays below that, unlike
  // rightTableMinX/440 which guards a DIFFERENT, further-right box and
  // isn't a safe columnMaxX (it let a body-font stat sidebar with no
  // ALL-CAPS marker on every row bleed into two blurbs).
  146: {
    layout: 'flow-bold',
    bodyFont: /GothamXNarrow-Book/,
    headFont: /GothamXNarrow-Bold/,
    headingMaxX: 55,
    columnMaxX: 300,
    rightTableMinX: 440,
    tableLeader: /\.(\s*\.){7,}/,
    bottomCutoff: 90,
    allCapsOnly: true,
    skipTitle: /^(UPCOMING|SCHEDULE|ALL TIMES ET)/i,
  },
  // Phillies — very clean single column; allCapsOnly avoids bold player-name
  // lead-ins ("Wheeler", "Cristopher Sánchez") being mistaken for titles.
  // bottomCutoff drops the "Score First:"/"DATE" boxes at the page foot.
  // columnMaxX stays tight: this page ALSO carries a large day-by-day pitcher
  // stat table (own ALL-CAPS row labels, e.g. "CRISTOPHER SÁNCHEZ") that a
  // wider columnMaxX pulls in wholesale — its labels pass allCapsOnly and get
  // wrongly promoted as blurb titles, swallowing the whole table as "body".
  // 150 incidentally keeps that table out; some very wide-wrapping narrative
  // lines still get chopped, a smaller loss than that leakage.
  143: {
    layout: 'flow-bold',
    bodyFont: /Tahoma$/,
    headFont: /Tahoma-Bold/,
    headingMaxX: 55,
    columnMaxX: 150,
    rightTableMinX: 460,
    tableLeader: /\.(\s*\.){7,}/,
    titleMaxLen: 40,
    allCapsOnly: true,
    bottomCutoff: 110,
  },
  // Dodgers — small tidy sheet, tighter left margin than most; allCapsOnly
  // avoids bold player-name lead-ins ("Wrobleski", "Betts") as titles.
  // columnMaxX widened past the old 150, then again past a too-conservative
  // 300 (still chopped a hyphen at a line-wrap: "…will at" + a SEPARATE "-"
  // item at x=432.77, with the actual word-continuing text on the next
  // physical line — losing the hyphen meant the two halves joined with a
  // bare space instead of tidy()'s hyphen-rejoin, producing "at tend)"
  // instead of "attend)"). A geometry scan confirmed the real second column
  // doesn't start until ~x440, so 438 is the genuine safe ceiling here; the
  // marker-based per-line cutoff still keeps that column out regardless.
  119: {
    layout: 'flow-bold',
    bodyFont: /ArticulatCF-Regular/,
    headFont: /ArticulatCF-Bold/,
    headingMaxX: 40,
    columnMaxX: 438,
    tableLeader: /\.(\s*\.){7,}/,
    allCapsOnly: true,
    skipTitle: /^Date\/Time/i,
  },
  // Athletics — heads are BoldItalic; plain -Bold is a different (table) role.
  // bottomCutoff drops the "Fri./Sat./Sun." schedule box at the page foot.
  133: {
    layout: 'flow-bold',
    bodyFont: /ProximaNova-Regular/,
    headFont: /ProximaNova-BoldIt/,
    headingMaxX: 55,
    columnMaxX: 150,
    tableLeader: /\.(\s*\.){7,}/,
    bottomCutoff: 95,
  },
  // Astros — several "titles" are vs-table / history-box headers, plus a
  // record-summary colon-table with no dotted leader to key off of — drop them
  // all by skipTitle so their bodies fall through as ownerless (a dropped
  // heading's own body is simply unclaimed, not reattached, when nothing
  // survives above it).
  117: {
    layout: 'flow-bold',
    bodyFont: /Colfax-Regular/,
    headFont: /Colfax-Bold/,
    headingMaxX: 55,
    columnMaxX: 150,
    tableLeader: /\.(\s*\.){7,}/,
    skipTitle: /^(GAME #\d|ABOUT THE RECORD|ASTROS VS\.|TODAY'S MEDIA AVAILABILITY|UPCOMING SCHEDULE|DATE$|pada$)/i,
    bottomCutoff: 135,
  },
  // Royals — body is Gotham too, so the head test must key on -Bold specifically;
  // masthead + bold player names are also Gotham-Bold, gated by allCapsOnly.
  // bottomCutoff drops the UPCOMING GAMES box + broadcast footer. columnMaxX
  // widened just enough (150 -> 215) to stop chopping a wrapped bold name
  // ("...including starting shortstop Bobby Witt Jr. and pitcher Michael
  // Wacha") short of a genuine recurring second column starting ~220-230pt.
  118: {
    layout: 'flow-bold',
    bodyFont: /Gotham-Book/,
    headFont: /Gotham-Bold/,
    headingMaxX: 60,
    columnMaxX: 215,
    tableLeader: /\.(\s*\.){7,}/,
    titleMaxLen: 40,
    allCapsOnly: true,
    bottomCutoff: 180,
  },
  // Angels — bold player-name lead-ins ("Adell") gated out by allCapsOnly; the
  // numbered ALL-TIME leaderboard boxes ("LEAGUE LEADER", "MOST CAREER…") are
  // ALL-CAPS too, so they're dropped by skipTitle instead. Bottom DATE/schedule
  // box dropped by geometry. columnMaxX widened just enough (150 -> 238) to
  // stop chopping real wrapped names short of a same-baseline "IN THE
  // DUGOUT:" sidebar ("...Cal Ripken Jr. (BAL – 17) and George Brett (KC –
  // 11)"); the marker-based per-line cutoff excludes that sidebar directly,
  // but the page also has a genuine recurring second column starting ~240pt
  // (confirmed via a geometry scan — 9 separate lines cluster there with no
  // ALL-CAPS marker on every row), so this stays well under that to avoid
  // pulling it in wholesale.
  108: {
    layout: 'flow-bold',
    bodyFont: /QuietSans-Regular/,
    headFont: /QuietSans-Bold/,
    headingMaxX: 55,
    columnMaxX: 238,
    tableLeader: /\.(\s*\.){7,}/,
    titleMaxLen: 40,
    allCapsOnly: true,
    skipTitle: /^(LEAGUE LEADER|MOST CAREER)/i,
    bottomCutoff: 90,
  },
  // Mariners — page 2 (starter notes); body also appears as -Cn/-BdCn (tables),
  // so match -Roman only for body and -Bd (not -BdCn) for heads. topCutoff drops
  // the "2026/Career MLB Breakdown" stat tables above the narrative; allCapsOnly
  // drops bold player-name mentions mid-body ("Castillo", "Bryan Woo").
  136: {
    layout: 'flow-bold',
    page: 2,
    bodyFont: /HelveticaNeueLTStd-Roman/,
    headFont: /HelveticaNeueLTStd-Bd$/,
    headingMaxX: 55,
    columnMaxX: 150,
    tableLeader: /\.(\s*\.){7,}/,
    allCapsOnly: true,
    topCutoff: 780,
  },
  // Twins — the real narrative is on PAGE 1, not page 2 (page 2 is just the
  // starting pitcher's own day-by-day box, a narrower feature — an earlier
  // pass here miscalibrated on that page because page 1's bold-left-margin
  // scan surfaced only its stat-table labels, not this column). Page 1's
  // narrative sits in its OWN column (x~163-450) wedged between TWO stat
  // tables sharing its exact body/head font pair and even its baselines — a
  // left "SEASON AT A GLANCE"/streaks column ending ~x145, a right "Last N
  // games"/"All-Time" column starting ~x459 — so xMin + columnMaxX isolate
  // it rather than a single-sided cutoff. skipTitle drops the bare year
  // headers ("2022:", "2023:"...) inside an embedded 5-season stat grid
  // midway through one blurb ("THESE ARE THE BREAKS:") so they don't
  // fragment into their own mini-titles; dropIfBodyMatches then drops that
  // WHOLE blurb (prose glued to a wall of per-season numbers, no clean way
  // to split them) rather than showing it half-garbled. topCutoff drops the
  // matchup masthead + probable-pitchers schedule above the narrative;
  // bottomCutoff drops the UPCOMING MILESTONES footer below it.
  142: {
    layout: 'flow-bold',
    bodyFont: /TradeGothicLTStd-Cn18/,
    headFont: /TradeGothicLTStd-BdCn20/,
    xMin: 155,
    headingMaxX: 175,
    columnMaxX: 450,
    tableLeader: /\.(\s*\.){7,}/,
    topCutoff: 805,
    bottomCutoff: 78,
    titleMaxLen: 40,
    allCapsOnly: true,
    skipTitle: /^\d{4}$/,
    // skipTitle already swallows each year row's own numbers (they land as
    // that heading's leadWords, discarded along with it) — what's left in
    // "THESE ARE THE BREAKS:" is just its lead-in sentence plus the table's
    // column-header row ("AVG R H 2B 3B HR RBI BB K OBP SLG OPS"), a run of
    // 6+ short all-caps/numeric tokens no real sentence produces.
    dropIfBodyMatches: /(?:\b[A-Z0-9]{1,4}\b[ ,]+){6,}\b[A-Z0-9]{1,4}\b/,
  },
  // Yankees — page 1, NOT page 2 (page 2 is the starting pitcher's own
  // breakdown, a different feature). Page 1's real narrative is easy to miss:
  // a thin left-margin sidebar (x<65, "YANKEES BY THE NUMBERS" / team stat
  // blocks) sits over the true two-column game-notes narrative that starts
  // further right — two full narrative columns side by side, not one. Handled
  // as cfg.columns: column 1 ("AT A GLANCE", "YESTERDAY'S NEWS", …) then
  // column 2 ("RICE RICE BABY", "PEN PALS", …), each read top-to-bottom in
  // turn (NOT merged into one wide column — see extractFlowBold's note on
  // why that would interleave two unrelated columns' lines). topCutoff drops
  // the masthead/matchup header above both columns; bottomCutoff drops the
  // "Upcoming Probable Pitchers" table below them; rightTableMinX on column 2
  // drops the "…RANKINGS THIS SEASON" stat box embedded in its prose.
  147: {
    layout: 'flow-bold',
    bodyFont: /MyriadPro-Regular/,
    headFont: /MyriadPro-Bold/,
    tableLeader: /\.(\s*\.){7,}/,
    topCutoff: 810,
    bottomCutoff: 70,
    // Unlike most clubs, NYY bolds player names/stat callouts freely WITHIN a
    // blurb's body, not just at its title — so a wrapped body line that
    // happens to start with one of those (e.g. a line beginning "Ryan
    // McMahon (2-for-5…)") looks like a heading candidate too. allCapsOnly
    // filters those out, same fix as the single-column clubs.
    allCapsOnly: true,
    columns: [
      { xMin: 140, headingMaxX: 165, columnMaxX: 372 },
      { xMin: 372, headingMaxX: 385, columnMaxX: 620, rightTableMinX: 485 },
    ],
  },
  // Tigers — page 1, single left column like BOS/LAA; a MyriadPro masthead
  // sits above and a right-column stat sidebar sits beside the narrative, but
  // neither needs explicit handling: the masthead has no real heading above
  // it to own it (dropped by the ordinary "unowned line" rule), and the
  // sidebar's own section headers ("TIGERS STREAKS," "AL LEADERS...") sit
  // past columnMaxX so they're excluded by the plain x cutoff before ever
  // reaching the marker/heading logic — no rightTableMinX needed. bottomCutoff
  // drops a "What's Next" schedule box that shares the narrative column's own
  // x-range below the last blurb. Body is split across two Calibri subsets
  // (CALIBRATION.md finding #2) — bodyFont matches bare "Calibri" (anchored
  // so it doesn't also match "Calibri-Bold").
  116: {
    layout: 'flow-bold',
    bodyFont: /Calibri$/,
    headFont: /Calibri-Bold/,
    headingMaxX: 55,
    columnMaxX: 400,
    tableLeader: /\.(\s*\.){7,}/,
    allCapsOnly: true,
    bottomCutoff: 125,
  },
}

// A per-url cache so reopening the modal for the same note doesn't refetch and
// reparse the PDF. Values are the settled promise (errors already swallowed to []).
const cache = new Map()

// Resolve the narrative blurbs for a Game Notes PDF, as [{ title, body }].
// Returns [] for a missing url, an un-calibrated club, or any parse/network
// failure — the modal treats [] as "no blurbs, just link the PDF".
export function fetchWhatsBrewing(pdfUrl, teamId) {
  const cfg = CONFIG[teamId]
  if (!pdfUrl || !cfg) return Promise.resolve([])
  const key = `${teamId}:${pdfUrl}`
  if (!cache.has(key)) {
    cache.set(
      key,
      parsePdf(pdfUrl, cfg).catch(() => []),
    )
  }
  return cache.get(key)
}

async function parsePdf(pdfUrl, cfg) {
  // Dynamic imports keep pdfjs (and its worker asset) in this lazily-loaded
  // chunk. The worker ships as an ES-module asset; Vite's `?url` hands us its
  // built path to point GlobalWorkerOptions at.
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const buf = await fetch(pdfUrl).then((r) => {
    if (!r.ok) throw new Error(`pdf ${r.status}`)
    return r.arrayBuffer()
  })
  const doc = await pdfjs.getDocument({ data: buf }).promise
  try {
    const page = await doc.getPage(cfg.page ?? 1)
    // getOperatorList resolves the page's fonts into commonObjs so we can read
    // each item's real PostScript name (the generated "g_d0_fN" ids aren't
    // stable across PDFs; the font names are).
    await page.getOperatorList()
    const tc = await page.getTextContent()
    const realName = (fontName) => {
      try {
        return page.commonObjs.get(fontName)?.name || ''
      } catch {
        return ''
      }
    }
    return extractBlurbs(tc.items, realName, cfg)
  } finally {
    doc.destroy?.()
  }
}

// Pure dispatch over getTextContent() items + a fontName→realPostScriptName
// resolver, so each layout is testable off a raw items array without a browser
// (see docs/whats-brewing.md's Node harness).
export function extractBlurbs(items, realName, cfg) {
  if (cfg?.layout === 'flow') return extractFlow(items, realName, cfg)
  if (cfg?.layout === 'flow-bold') return extractFlowBold(items, realName, cfg)
  return extractColumn(items, realName, cfg)
}

// Same as extractBlurbs but selects the club's calibration by teamId (the shipped
// CONFIG). This is the pure core of fetchWhatsBrewing minus the fetch, so the Node
// verification harness can exercise the exact config the app ships (see
// docs/whats-brewing.md). Returns [] for an un-calibrated club.
export function extractForTeam(items, realName, teamId) {
  const cfg = CONFIG[teamId]
  return cfg ? extractBlurbs(items, realName, cfg) : []
}

// The calibrated layout for a club ('column' | 'flow' | 'flow-bold'), or null
// for an un-calibrated club — CONFIG itself stays private (its tunables are
// internal detail), but the layout shape is useful to surface (e.g. a QA page
// listing every club's calibration status) without duplicating the CONFIG map.
export function whatsBrewingLayout(teamId) {
  return CONFIG[teamId]?.layout ?? null
}

// ---------------------------------------------------------------------------
// 'column' layout (Brewers): blurbs stacked in a narrow left column; a short,
// fully-emphasized line is a title, the ordinary lines beneath it its body.
// ---------------------------------------------------------------------------
function extractColumn(items, realName, cfg) {
  const isEmphasis = (i) => cfg.isEmphasis(realName(i.fontName))
  const isHeaderFont = (i) => cfg.isHeaderFont(realName(i.fontName))
  const words = items
    .filter((i) => i.str.trim())
    .map((i) => ({ x: i.transform[4], y: i.transform[5], str: i.str, bold: isEmphasis(i) }))

  // Everything below this y is column content; the away@home masthead sits above.
  const header = items.find((i) => isHeaderFont(i) && cfg.headerText.test(i.str))
  const topY = header ? header.transform[5] : Infinity

  const col = words
    .filter((w) => w.x < cfg.columnMaxX && w.y < topY)
    .sort((a, b) => b.y - a.y || a.x - b.x)

  // Regroup words into visual lines (same baseline within a few pt).
  const lines = []
  let cur = null
  for (const w of col) {
    if (!cur || Math.abs(cur.y - w.y) > 3) {
      cur = { y: w.y, words: [w] }
      lines.push(cur)
    } else {
      cur.words.push(w)
    }
  }
  for (const l of lines) {
    l.text = l.words.map((w) => w.str).join(' ').replace(/\s+/g, ' ').trim()
    l.allBold = l.words.every((w) => w.bold)
  }

  // A fully-bold, short line starts a new blurb (its title); the ordinary lines
  // under it are its body until the next such title.
  const blurbs = []
  let b = null
  for (const l of lines) {
    if (l.allBold && l.text.length <= cfg.titleMaxLen && !cfg.tableLeader.test(l.text)) {
      b = { title: l.text, body: [] }
      blurbs.push(b)
    } else if (b) {
      b.body.push(l.text)
    }
  }

  return blurbs
    .map((blurb) => ({ title: blurb.title, raw: blurb.body.join(' ') }))
    .filter((blurb) => blurb.raw && !cfg.skipTitle.test(blurb.title) && !cfg.tableLeader.test(blurb.raw))
    .map((blurb) => ({ title: blurb.title, body: tidy(blurb.raw) }))
}

// ---------------------------------------------------------------------------
// 'flow' layout (Pirates / league-standard template): full-width prose with an
// inline all-caps heading (title : body, all on one baseline). Body is isolated
// as "the dominant prose face, minus the right-column tables and bottom boxes".
// ---------------------------------------------------------------------------
function extractFlow(items, realName, cfg) {
  const tol = cfg.lineTol ?? 2
  const words = items
    .filter((i) => i.str.trim())
    .map((i) => ({
      x: i.transform[4],
      y: i.transform[5],
      w: i.width || 0,
      str: i.str,
      font: realName(i.fontName),
    }))
  if (!words.length) return []

  // Body face = the most common font on the page (the prose the blurbs are set in).
  const tally = {}
  for (const w of words) tally[w.font] = (tally[w.font] || 0) + 1
  const bodyFont = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]

  // Headings are a distinct (heavier) Myriad face; the body shares the base name
  // but is a different subset, so "emphasis face AND not the body face" finds them.
  const isEmphasis = (w) => cfg.isEmphasisBase(w.font) && w.font !== bodyFont
  const isHeader = (w) => cfg.isHeaderFont(w.font)

  // Section headings: emphasis-face runs at the left margin. Group same-baseline
  // emphasis words (title + its colon) into one heading and strip the colon.
  const headings = []
  for (const w of words.filter((w) => isEmphasis(w) && w.x < cfg.headingMaxX)) {
    if (!headings.some((h) => Math.abs(h.y - w.y) < tol)) headings.push({ y: w.y })
  }
  for (const h of headings) {
    const line = words.filter((w) => isEmphasis(w) && Math.abs(w.y - h.y) < tol)
    h.title = joinWords(line).replace(/\s*:\s*$/, '').replace(/\s+/g, ' ').trim()
  }
  headings.sort((a, b) => b.y - a.y)
  if (!headings.length) return []
  const firstHeadingY = headings[0].y

  // Bottom cutoff: the top of the full-width bottom boxes, whose Gotham headers
  // sit in the left-center below the narrative. Prose below it is those boxes.
  const bottomHeaders = words.filter(
    (w) => isHeader(w) && w.x < cfg.headerLeftMaxX && w.y < firstHeadingY,
  )
  const bottomCutoff = bottomHeaders.length ? Math.max(...bottomHeaders.map((w) => w.y)) : -Infinity

  // The right-column records table is in the prose face too, so exclude its
  // rectangle: right of rightTableMinX and at/below its own Gotham header. (The
  // only prose that reaches that far right is the lead blurb's top lines, which
  // sit ABOVE the header and so survive.)
  const rightTableTopY = Math.max(
    -Infinity,
    ...words.filter((w) => isHeader(w) && w.x >= cfg.rightTableMinX).map((w) => w.y),
  )
  const inRecordsTable = (w) => w.x >= cfg.rightTableMinX && w.y <= rightTableTopY

  const body = words
    .filter((w) => w.font === bodyFont && !cfg.tableLeader.test(w.str) && !inRecordsTable(w))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  // Regroup body words into visual lines, then keep only narrative lines: those
  // that start at the left column (not a right-column table) and lie inside the
  // narrative's vertical band.
  const lines = []
  for (const w of body) {
    let l = lines.find((l) => Math.abs(l.y - w.y) < tol)
    if (!l) { l = { y: w.y, words: [] }; lines.push(l) }
    l.words.push(w)
  }
  const narrative = lines.filter((l) => {
    const xMin = Math.min(...l.words.map((w) => w.x))
    return xMin < cfg.columnMaxX && l.y > bottomCutoff && l.y <= firstHeadingY + tol
  })

  // Assign each line to the lowest heading at or above it, then join top-to-bottom.
  for (const l of narrative) {
    l.text = joinWords(l.words)
    let owner = null
    for (const h of headings) if (h.y + tol >= l.y) owner = h
    l.owner = owner
  }
  return headings
    .map((h) => ({
      title: h.title,
      body: tidy(
        narrative
          .filter((l) => l.owner === h)
          .sort((a, b) => b.y - a.y)
          .map((l) => l.text)
          .join(' '),
      ),
    }))
    .filter((b) => b.title && b.body)
}

// ---------------------------------------------------------------------------
// 'flow-bold' layout (most other clubs): the same full-width-prose-with-inline-
// heading shape as 'flow', but the body/heading split is a REAL two-weight font
// pair (body regular, heads bold/black/demi) rather than "biggest subset wins" —
// so it's driven by explicit cfg.bodyFont/cfg.headFont regexes instead of a
// dominant-font heuristic. Reuses 'flow's columnMaxX/rightTableMinX/tableLeader
// geometry knobs for table exclusion (most of these clubs have no separate
// Gotham display face to anchor a bottom-box cutoff off of, so cfg.topCutoff/
// cfg.bottomCutoff are plain y-coordinates instead).
//
// A genuine two-column page (NYY: a thin left-margin stat sidebar, then the
// REAL narrative starts as two side-by-side columns further right) is handled
// by cfg.columns — an array of column-zone overrides (xMin/headingMaxX/
// columnMaxX/rightTableMinX), each run independently through the same
// single-column logic below and concatenated left-column-first. Do NOT
// widen a single column's columnMaxX to "cover both" — that interleaves two
// unrelated columns' lines whenever they happen to share a y (PDF read order
// is column-major, not row-major).
// ---------------------------------------------------------------------------
function extractFlowBold(items, realName, cfg) {
  if (cfg.columns) return cfg.columns.flatMap((colCfg) => extractFlowBoldZone(items, realName, { ...cfg, ...colCfg }))
  return extractFlowBoldZone(items, realName, cfg)
}

function extractFlowBoldZone(items, realName, cfg) {
  const tol = cfg.lineTol ?? 3
  const xMin = cfg.xMin ?? 0
  const bottomCutoff = cfg.bottomCutoff ?? -Infinity
  const allWords = items
    .filter((i) => i.str.trim())
    .map((i) => ({
      x: i.transform[4],
      y: i.transform[5],
      w: i.width || 0,
      str: i.str,
      font: realName(i.fontName),
    }))
  // A fixed topCutoff y-coordinate is fragile for a page whose bio/stat box
  // grows over the season (MIN: a pitcher's game-log table gains a row every
  // month, pushing the real narrative down) — cfg.topCutoffAfter anchors the
  // cutoff to that box's own last row instead of a magic number, so it tracks
  // the boundary as the box grows. Falls back to the plain cfg.topCutoff.
  let topCutoff = cfg.topCutoff ?? Infinity
  if (cfg.topCutoffAfter) {
    const marks = allWords.filter((w) => cfg.topCutoffAfter.test(w.str) && w.x >= xMin && w.x < cfg.columnMaxX)
    if (marks.length) topCutoff = Math.min(topCutoff, Math.max(...marks.map((w) => w.y)))
  }
  const words = allWords.filter((w) => w.x >= xMin && w.y < topCutoff && w.y > bottomCutoff)
  if (!words.length) return []
  snapSuperscriptOrdinals(words)

  const isHead = (w) => cfg.headFont.test(w.font)

  // cfg.columnMaxX is a per-club OUTER bound, not the real column edge on
  // every line: a genuinely separate box/column can sit on the SAME baseline
  // as a wrapped narrative line (LAA: "…joining Hall of Famers Cal Ripken
  // Jr. (BAL – 17) and George Brett (KC – 11)" shares a baseline with an
  // unrelated "IN THE DUGOUT:" sidebar a bit further right), so a single
  // fixed x cutoff either truncates real prose (bold names past a tight
  // bound) or lets a sidebar bleed in (past a loose one). Instead, find each
  // baseline's OWN cutoff: the x of a genuine second-column marker sharing
  // that line — a head-font run that is (up to its colon) ALL-CAPS, e.g.
  // "IN THE DUGOUT:", "ERROR MESSAGE:", vs. a plain bold player name like
  // "George Brett" or "Bobby Witt Jr.", which is mixed-case and so never
  // trips this test and survives out to cfg.columnMaxX.
  const rawLines = []
  for (const w of words) {
    let l = rawLines.find((l) => Math.abs(l.y - w.y) < tol)
    if (!l) { l = { y: w.y, words: [] }; rawLines.push(l) }
    l.words.push(w)
  }
  // Stamp each word with its own line's cutoff directly, rather than
  // re-deriving "which line is this word on" via a second fuzzy y lookup
  // later — two baselines can legitimately sit within `tol` of EACH OTHER
  // without being the same line, and an independent per-word .find() can
  // silently match the wrong one, applying a neighboring line's (tighter)
  // cutoff to words that never had a marker of their own.
  for (const l of rawLines) {
    l.words.sort((a, b) => a.x - b.x)
    const cutoff = lineMarkerCutoff(l.words, isHead, cfg.headingMaxX, cfg.columnMaxX)
    for (const w of l.words) w.cutoff = cutoff
  }

  // Section headings: head-font runs at the left margin, grouped by baseline.
  // headingMaxX anchors which BASELINES qualify (the line's first word starts
  // at the margin AND is head-font); once anchored, the title is the
  // CONTIGUOUS head-font run from the start of the line — not every head-font
  // word up to columnMaxX — because a second, later bold run on the same
  // baseline (LAA: "12-TIME ALL-STAR: Mike Trout has earned…", the name is
  // bold again after a body-font colon) is an inline lead-in for the body, not
  // more of the title. A genuinely multi-word title (SEA: "THE ROAD SO FAR")
  // IS one contiguous head-font run and must not be truncated at headingMaxX.
  const lineWords = []
  for (const w of words) {
    if (w.x >= w.cutoff) continue
    let l = lineWords.find((l) => Math.abs(l.y - w.y) < tol)
    if (!l) { l = { y: w.y, words: [] }; lineWords.push(l) }
    l.words.push(w)
  }
  const headings = []
  for (const l of lineWords) {
    l.words.sort((a, b) => a.x - b.x)
    // Skip past any leading decoration (e.g. a bullet glyph in a third,
    // neither-body-nor-head symbol font) to find where the head-font run
    // actually starts; headingMaxX gates THAT word's x, not the decoration's.
    const start = l.words.findIndex((w) => isHead(w))
    if (start === -1 || l.words[start].x >= cfg.headingMaxX) continue
    let i = start
    while (i < l.words.length && isHead(l.words[i])) i++
    const titleWords = l.words.slice(start, i)
    const leadWords = l.words.slice(i)
    headings.push({ y: l.y, allWords: l.words, titleWords, leadWords })
  }
  for (const h of headings) {
    const line = joinWords(h.titleWords).replace(/\s+/g, ' ').trim()
    const lead = joinWords(h.leadWords).replace(/^[\s:]+/, '').trim()
    // A colon mid-line (not at the very end) means the head-font run itself
    // continues past the title into an inline bold lead-in on the SAME
    // baseline (KC: one PDF text item "THE RIGHT LANE: Lane Thomas") — keep
    // only the part before the colon as the title and fold the rest into this
    // heading's body as its first line.
    const colon = line.indexOf(':')
    if (colon >= 0 && colon < line.length - 1) {
      h.title = line.slice(0, colon).trim()
      h.extraLead = [line.slice(colon + 1).trim(), lead].filter(Boolean).join(' ')
    } else {
      h.title = line.replace(/\s*:\s*$/, '').trim()
      h.extraLead = lead
    }
  }
  // A stray heading-font run that isn't really a section title (too long, or
  // not ALL-CAPS — e.g. NYY bolds inline player names like "3B Ryan McMahon"
  // mid-paragraph, on their own wrapped line) doesn't get to act as a title OR
  // an ownership boundary. But it must NOT just vanish either: the whole raw
  // line (its bold name/position included — that text fails the plain isBody
  // font test on its own, so it needs to be reinstated explicitly) folds back
  // in as an ordinary continuation line of whichever real heading is above it.
  // A cfg.skipTitle match, by contrast, IS a genuine section boundary (a known
  // non-narrative box: a leaderboard, a schedule grid) — it still owns its
  // body for ownership purposes, so that body doesn't leak into a neighboring
  // blurb, but the whole thing is dropped at output time, not folded back in.
  const titled = []
  const foldedBackLines = []
  for (const h of headings) {
    const isRealTitle =
      h.title && (!cfg.titleMaxLen || h.title.length <= cfg.titleMaxLen) && (!cfg.allCapsOnly || isAllCaps(h.title))
    if (isRealTitle) {
      titled.push(h)
      for (const w of h.titleWords) w.consumed = true
      for (const w of h.leadWords) w.consumed = true
    } else {
      const text = joinWords(h.allWords).trim()
      if (text && !cfg.tableLeader.test(text)) foldedBackLines.push({ y: h.y, text })
      for (const w of h.allWords) w.consumed = true
    }
  }
  titled.sort((a, b) => b.y - a.y)
  if (!titled.length) return []

  // Body words: everything NOT already consumed by a promoted title or folded
  // back whole (above), left column only, excluding right-column stat tables
  // (by x-position and/or dotted leader). Includes BOTH body and head font —
  // an inline bold run that never even qualified as a heading candidate (NYY
  // bolds a player name/position mid-sentence — "…Thursday at Tropicana
  // Field… RHP Paul Blackburn (2.0IP…" — the bold run sits well right of
  // headingMaxX, so it's not near the left margin) would otherwise silently
  // vanish rather than reading as plain body text. Still excludes a genuinely
  // decorative THIRD font (a bullet/symbol glyph, neither body nor head) —
  // PHI marks every wrapped body LINE with its own margin bullet in one such
  // font, which would otherwise leak into running text mid-sentence.
  const isContent = (w) => cfg.bodyFont.test(w.font) || isHead(w)
  const body = words.filter(
    (w) =>
      isContent(w) &&
      !w.consumed &&
      w.x < w.cutoff &&
      !cfg.tableLeader.test(w.str) &&
      !(cfg.rightTableMinX != null && w.x >= cfg.rightTableMinX),
  )

  const lines = [...foldedBackLines]
  for (const w of body) {
    let l = lines.find((l) => Math.abs(l.y - w.y) < tol)
    if (!l) { l = { y: w.y, words: [] }; lines.push(l) }
    if (l.words) l.words.push(w)
  }
  for (const l of lines) if (!l.text) l.text = joinWords(l.words)

  // Assign each body line to the lowest surviving heading at or above it.
  for (const l of lines) {
    let owner = null
    for (const h of titled) if (h.y + tol >= l.y) owner = h
    l.owner = owner
  }

  return titled
    .filter((h) => !(cfg.skipTitle && cfg.skipTitle.test(h.title)))
    .map((h) => ({
      title: h.title,
      body: tidy(
        [h.extraLead, ...lines.filter((l) => l.owner === h).sort((a, b) => b.y - a.y).map((l) => l.text)]
          .filter(Boolean)
          .join(' '),
      ),
    }))
    .filter((b) => b.body)
    // A blurb whose title is real prose but whose OWN body run straight into
    // a stat table with no sub-heading of its own to key off (MIN: "THESE
    // ARE THE BREAKS:" narrates a sentence, then a bare 5-season AVG/R/H/…
    // grid follows in the same column, same font, no dotted leader) can't be
    // cleanly split — better to drop the whole note than show prose glued to
    // a wall of numbers.
    .filter((b) => !(cfg.dropIfBodyMatches && cfg.dropIfBodyMatches.test(b.body)))
}

// Finds the x where a GENUINE second-column marker starts on a shared
// baseline, if any — a head-font run whose text (up to its own colon, if it
// has one) is ALL-CAPS, e.g. "IN THE DUGOUT:", "ERROR MESSAGE:". Skips past
// any leading decoration (PHI marks every wrapped line with its own margin
// bullet, in a third font that's neither head nor body) to the line's own
// first head-font run; that run is skipped WITHOUT testing only when it's
// actually anchored near the left margin (x < headingMaxX) — the same bar
// the real title-detection logic uses, so it's treated the same way here: a
// genuine title candidate, never a marker for itself. A head-font run that
// starts further right, with nothing but plain body text ahead of it on the
// line (LAA: "...joining Hall THIS DATE IN ANGELS HISTORY"), was never a
// real title and still gets tested. A plain bold player name ("George
// Brett", "Bobby Witt Jr.") is mixed-case and never matches, so it stays
// part of the line's body past cfg.columnMaxX up to whatever real marker (or
// the outer bound) comes next. Requires a genuine multi-word OR longish run
// — a bare box-score abbreviation ("ND", "L", "HR", "ERA", "IP") is ALSO
// bold + ALL-CAPS but must never trip this (PHI bolds these inline
// constantly; treating them as markers collapsed every line to nothing).
function lineMarkerCutoff(sortedWords, isHead, headingMaxX, defaultCutoff) {
  let i = 0
  while (i < sortedWords.length && !isHead(sortedWords[i])) i++
  if (i < sortedWords.length && sortedWords[i].x < headingMaxX) {
    while (i < sortedWords.length && isHead(sortedWords[i])) i++
  }
  while (i < sortedWords.length) {
    if (!isHead(sortedWords[i])) { i++; continue }
    let j = i
    while (j < sortedWords.length && isHead(sortedWords[j])) j++
    const runText = joinWords(sortedWords.slice(i, j)).trim()
    const beforeColon = runText.split(':')[0].trim()
    const looksLikeMarker = /\s/.test(beforeColon) || beforeColon.length >= 6
    if (looksLikeMarker && isAllCaps(beforeColon)) {
      return Math.min(defaultCutoff, sortedWords[i].x)
    }
    i = j
  }
  return defaultCutoff
}

// Ordinal suffixes ("2nd", "3rd", "96th") are often set as a true typographic
// superscript — the "nd"/"rd"/"th" glyphs sit a couple pt ABOVE their number's
// baseline. That's enough to clear the line-grouping tolerance, so the suffix
// forms its own one-word "line" that then gets sorted (by y, independently of
// its number) into the wrong spot when lines are joined — e.g. "since nd
// ranks T-2" instead of "ranks T-2nd". Snap each such suffix onto its nearest
// immediate-left neighbor's baseline before any line-grouping happens, so it
// rejoins the same line right after the number it modifies. Searches by Y
// LOCALITY first (candidates within a small y-band), not a page-wide x-sort —
// a page-wide sort puts same-x words from unrelated lines next to each other
// (this repeats a left margin constantly), so a naive "nearest in x order"
// scan can snap an ordinal onto a totally different line's word.
function snapSuperscriptOrdinals(words) {
  for (const w of words) {
    if (!/^(st|nd|rd|th)$/i.test(w.str)) continue
    let best = null
    let bestGap = Infinity
    for (const p of words) {
      if (p === w) continue
      const dy = Math.abs(w.y - p.y)
      if (dy <= 0.5 || dy > 6) continue
      const gap = w.x - (p.x + (p.w || 0))
      if (gap < -2 || gap > 6) continue
      if (gap < bestGap) { bestGap = gap; best = p }
    }
    if (best) w.y = best.y
  }
}

// ALL-CAPS check for cfg.allCapsOnly, tolerant of the "Mc" surname convention
// (e.g. "McMAHON OF THE HOUR" is a real title — "Mc" stays mixed-case even in
// an otherwise all-caps headline) — normalize a leading "Mc" before an
// uppercase letter to "MC" so it doesn't read as a stray lowercase letter.
function isAllCaps(title) {
  const normalized = title.replace(/\bMc(?=[A-Z])/g, 'MC')
  return normalized === normalized.toUpperCase()
}

// Join x-sorted words, inserting a space only where there's a real horizontal
// gap — so tightly-kerned combining glyphs ("Ram" "í" "rez") rejoin as "Ramírez"
// rather than being split by spaces.
function joinWords(ws) {
  let out = ''
  let prevEnd = null
  for (const w of ws.slice().sort((a, b) => a.x - b.x)) {
    if (prevEnd !== null && w.x - prevEnd > 0.6) out += ' '
    out += w.str
    prevEnd = w.x + (w.w || 0)
  }
  return out
}

// The notes render "....." as a stylistic sentence separator — turn any run of
// 3+ dots into a spaced ellipsis, rejoin line-break hyphenation ("Chicago- NL"),
// tighten space before real sentence punctuation (but not before a decimal like
// " .331"), and collapse doubles.
function tidy(s) {
  return s
    .replace(/\.{3,}/g, ' … ')
    // Some clubs' notes use a literal "…" glyph packed tight against the
    // words on either side (no space characters as separate PDF items), so
    // joinWords never gets a gap to insert a space at — pad it here instead.
    .replace(/…(?=\S)/g, '… ')
    .replace(/(?<=\S)…/g, ' …')
    .replace(/([A-Za-z])- ([A-Za-z])/g, '$1-$2')
    .replace(/\s+([,;:.!?])(?=\s|$)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
