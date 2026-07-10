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
// Callers gate on hasWhatsBrewing(teamId); every un-calibrated club keeps the
// plain full-PDF button. Parsing fails safe: any surprise → [] → the modal just
// shows the PDF link. Adding a club means a new CONFIG entry (calibrate its
// template with the dumper in docs/whats-brewing.md), not a new parser.

export const BREWERS_ID = 158
export const PIRATES_ID = 134

// Per-club parse calibration. `layout` selects the algorithm; the rest are that
// layout's tunables (read off the club's PDF with the font/geometry dumper —
// see docs/whats-brewing.md "Extending to other clubs"). Fonts are matched by
// real PostScript name, NOT the unstable subset prefix pdfjs prepends.
const CONFIG = {
  // Brewers — narrow left "WHAT'S BREWING?" column, Industry font family.
  [BREWERS_ID]: {
    layout: 'column',
    // Modal heading — the club's own name for this column (a Brewers pun).
    title: "What's Brewing?",
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
    // Modal heading — neutral, since these blurbs span the whole sheet (their own
    // "THE PIRATES" section is the first blurb, so don't reuse it as the heading).
    title: 'Pirates Game Notes',
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
}

// True when this club's Game Notes template is calibrated — the caller opens the
// What's Brewing modal; otherwise it keeps the plain full-PDF link-out.
export function hasWhatsBrewing(teamId) {
  return !!CONFIG[teamId]
}

// The modal heading for a calibrated club (the club's own name for its notes).
export function whatsBrewingTitle(teamId) {
  return CONFIG[teamId]?.title || 'Game Notes'
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
    const page = await doc.getPage(1)
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
    .replace(/([A-Za-z])- ([A-Za-z])/g, '$1-$2')
    .replace(/\s+([,;:.!?])(?=\s|$)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
