// What's Brewing — pulls the narrative blurbs out of the Brewers' pre-game Game
// Notes PDF (the left "WHAT'S BREWING?" column) into plain text, so the fun
// hand-titled callouts (Hulk Logan, Don't Pitch to Mitch, When You're Hot You're
// Hot, …) can pop out in an in-app modal instead of making the user leave for the
// full PDF. The lineup page's Game notes button (TeamInfo.jsx) opens that modal
// and keeps a link to the whole PDF inside it.
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
// BREWERS ONLY, for now. Every club lays its notes out in its own InDesign
// template, so the column geometry and the blurb title/body font split below are
// calibrated to the Brewers' sheet (left column, Industry-Demi titles over
// Industry-Book body, an Industry-Bold "WHAT'S BREWING?" header as the top
// anchor). Callers gate on teamId === BREWERS_ID; every other team keeps the
// plain full-PDF button. Parsing fails safe: any surprise → [] → the modal just
// shows the PDF link. Generalizing to more clubs means calibrating each
// template, not rewriting this.

export const BREWERS_ID = 158

// The left column lives left of this x (page is 612pt wide; the column runs
// ~36–160pt, the next column starts past 165).
const COLUMN_MAX_X = 165
// A blurb title is a short, fully-emphasized line; anything longer is body that
// merely opens with a bolded player name.
const TITLE_MAX_LEN = 40
// Table rows use long dotted leaders ("Milwaukee .......... 58-34"); prose uses a
// stylistic 3–5 dot separator we keep. 8+ dots ⇒ a standings/records table.
const TABLE_LEADER = /\.{8,}/
// Non-narrative column boxes to drop by title (standings, records, the upcoming
// schedule, broadcast footer) — the pun-titled blurbs are what we keep.
const SKIP_TITLE = /^(Team Record|Record$|Opponent Record|NL Central|MLB Best|DATE|UPCOMING|Games broadcast)/i

// A per-url cache so reopening the modal for the same note doesn't refetch and
// reparse the PDF. Values are the settled promise (errors already swallowed to []).
const cache = new Map()

// Resolve the What's Brewing blurbs for a Game Notes PDF, as [{ title, body }].
// Returns [] for a missing url, a non-Brewers caller that slipped through, or any
// parse/network failure — the modal treats [] as "no blurbs, just link the PDF".
export function fetchWhatsBrewing(pdfUrl) {
  if (!pdfUrl) return Promise.resolve([])
  if (!cache.has(pdfUrl)) {
    cache.set(
      pdfUrl,
      parsePdf(pdfUrl).catch(() => []),
    )
  }
  return cache.get(pdfUrl)
}

async function parsePdf(pdfUrl) {
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
    // stable across PDFs; the font names — Industry-Demi/Book/Bold — are).
    await page.getOperatorList()
    const tc = await page.getTextContent()
    const realName = (fontName) => {
      try {
        return page.commonObjs.get(fontName)?.name || ''
      } catch {
        return ''
      }
    }
    return extractBlurbs(tc.items, realName)
  } finally {
    doc.destroy?.()
  }
}

// The heavy lifting is pure so it's testable off a raw textContent.items array:
// resolve which font is an emphasis face, isolate the left column, regroup items
// into lines, split into title→body blurbs, and drop the table/schedule boxes.
export function extractBlurbs(items, realName) {
  // Blurb titles and inline bolded player names are the Demi weight
  // (Industry-Demi); body is Book. The "WHAT'S BREWING?" section header is a
  // distinct, heavier Bold weight (Industry-Bold) — kept separate on purpose so
  // it anchors the top of the column WITHOUT the mid-column "BREWING SUCCESS"
  // Demi lead-ins masquerading as the header.
  const isEmphasis = (i) => /-Demi\b/.test(realName(i.fontName)) && !/Italic/.test(realName(i.fontName))
  const isHeaderFont = (i) => /-Bold\b/.test(realName(i.fontName))
  const words = items
    .filter((i) => i.str.trim())
    .map((i) => ({ x: i.transform[4], y: i.transform[5], str: i.str, bold: isEmphasis(i) }))

  // Everything below this y is column content; the away@home masthead sits above.
  const header = items.find((i) => isHeaderFont(i) && /BREWING/i.test(i.str))
  const topY = header ? header.transform[5] : Infinity

  const col = words
    .filter((w) => w.x < COLUMN_MAX_X && w.y < topY)
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
    if (l.allBold && l.text.length <= TITLE_MAX_LEN && !TABLE_LEADER.test(l.text)) {
      b = { title: l.text, body: [] }
      blurbs.push(b)
    } else if (b) {
      b.body.push(l.text)
    }
  }

  return blurbs
    .map((blurb) => ({ title: blurb.title, raw: blurb.body.join(' ') }))
    .filter((blurb) => blurb.raw && !SKIP_TITLE.test(blurb.title) && !TABLE_LEADER.test(blurb.raw))
    .map((blurb) => ({ title: blurb.title, body: tidy(blurb.raw) }))
}

// The notes render "....." as a stylistic sentence separator — turn any run of
// 3+ dots into a spaced ellipsis, tighten space before real sentence
// punctuation (but not before a decimal like " .331"), and collapse doubles.
function tidy(s) {
  return s
    .replace(/\.{3,}/g, ' … ')
    .replace(/\s+([,;:.!?])(?=\s|$)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
