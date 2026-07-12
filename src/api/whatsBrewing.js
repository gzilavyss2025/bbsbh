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
  121: {
    layout: 'flow-bold',
    bodyFont: /Grift-Regular/,
    headFont: /Grift-Bold/,
    headingMaxX: 55,
    columnMaxX: 150,
    rightTableMinX: 320,
    tableLeader: /\.(\s*\.){7,}/,
    skipTitle: /^(New York Mets|Vs\. )|\(\d+-\d+\)$/i,
  },
  // Marlins — UPCOMING SCHEDULE banner top-right + bottom DATE box dropped by
  // geometry/skipTitle; allCapsOnly drops bold player-name recap lead-ins
  // ("Kyle Stowers", "Otto Lopez") that share the heading font but aren't titles.
  146: {
    layout: 'flow-bold',
    bodyFont: /GothamXNarrow-Book/,
    headFont: /GothamXNarrow-Bold/,
    headingMaxX: 55,
    columnMaxX: 150,
    rightTableMinX: 440,
    tableLeader: /\.(\s*\.){7,}/,
    bottomCutoff: 90,
    allCapsOnly: true,
    skipTitle: /^(UPCOMING|SCHEDULE|ALL TIMES ET)/i,
  },
  // Phillies — very clean single column; allCapsOnly avoids bold player-name
  // lead-ins ("Wheeler", "Cristopher Sánchez") being mistaken for titles.
  // bottomCutoff drops the "Score First:"/"DATE" boxes at the page foot.
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
  119: {
    layout: 'flow-bold',
    bodyFont: /ArticulatCF-Regular/,
    headFont: /ArticulatCF-Bold/,
    headingMaxX: 40,
    columnMaxX: 150,
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
  // bottomCutoff drops the UPCOMING GAMES box + broadcast footer.
  118: {
    layout: 'flow-bold',
    bodyFont: /Gotham-Book/,
    headFont: /Gotham-Bold/,
    headingMaxX: 60,
    columnMaxX: 150,
    tableLeader: /\.(\s*\.){7,}/,
    titleMaxLen: 40,
    allCapsOnly: true,
    bottomCutoff: 180,
  },
  // Angels — bold player-name lead-ins ("Adell") gated out by allCapsOnly; the
  // numbered ALL-TIME leaderboard boxes ("LEAGUE LEADER", "MOST CAREER…") are
  // ALL-CAPS too, so they're dropped by skipTitle instead. Bottom DATE/schedule
  // box dropped by geometry.
  108: {
    layout: 'flow-bold',
    bodyFont: /QuietSans-Regular/,
    headFont: /QuietSans-Bold/,
    headingMaxX: 55,
    columnMaxX: 150,
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
  // Twins — page 2 (starter notes); page 1 is the season-splits table. The
  // starter's bio box (height/weight, a game-by-game log that gains a row
  // every month) sits above the narrative — topCutoffAfter anchors the cutoff
  // to the game log's own last row ("…CAREER TOTALS") rather than a fixed y,
  // so it keeps working as that table grows through the season (a plain
  // topCutoff, tuned against one date's PDF, clipped the real first heading
  // on a later date once the table had gained rows).
  142: {
    layout: 'flow-bold',
    page: 2,
    bodyFont: /TradeGothicLTStd-Cn18/,
    headFont: /TradeGothicLTStd-BdCn20/,
    headingMaxX: 55,
    columnMaxX: 150,
    tableLeader: /\.(\s*\.){7,}/,
    topCutoffAfter: /CAREER TOTALS/,
    allCapsOnly: true,
    skipTitle: /^PITCH \(AVG/i,
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

  const isHead = (w) => cfg.headFont.test(w.font)

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
    if (w.x >= cfg.columnMaxX) continue
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
      w.x < cfg.columnMaxX &&
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
