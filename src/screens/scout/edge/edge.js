import { band, fmtValue } from '../../../lib/scout/metrics.js'

// THE EDGE TAB'S VERDICT AND LEDGER (#1490): "do the pitches he throws match
// up well or badly with what the hitter does well against?" Pure, so
// test/scout-edge.test.js pins every rule with the Pivetta / Chourio numbers.
//
// NO NEW DATA. Each row reads the hitter side the maps already build
// (hitterBoard.js `hitterSide`): `byType[code].typeVal` is the hitter's
// whole-type rate and `.leagueFlat` the league's, for the same pitcher hand,
// stance and scope. The bands are metrics.js `band`, so the words and the map
// colours sit on one scale: 0 is Even, ±1 Slight, ±2 Clear.
//
// WHO A BAND FAVORS: for xwOBA (est.) a higher rate favors the hitter; for
// Whiff % it favors the pitcher; Swing % favors nobody, so it says "Swings
// more" or "Swings less". A null rate is "Too few", never zero.
export const FAVORS = { xwoba: 'hitter', whiff: 'pitcher', swing: null }
const STEP = { 1: 'Slight', 2: 'Clear' }

export function whoFavors(metric, b) {
  if (b == null) return null
  if (b === 0) return 'even'
  const f = FAVORS[metric]
  if (!f) return b > 0 ? 'more' : 'less'
  return (b > 0) === (f === 'hitter') ? 'hitter' : 'pitcher'
}

// One ledger row per pill: the type's label fields, his rate, the league's,
// the band and who it favors.
export function ledgerRows(types, side, metric) {
  return types.map((t) => {
    const h = side?.byType?.[t.code]
    const value = h?.typeVal ?? null
    const league = h?.leagueFlat ?? null
    const b = band(metric, value, league)
    return { ...t, value, league, band: b, who: whoFavors(metric, b) }
  })
}

// A row's tag: the words and the tone the dot and bar take.
export function rowTag(row, names) {
  if (row.who == null) return { word: 'Too few', tone: 'even' }
  if (row.who === 'even') return { word: 'Even', tone: 'even' }
  if (row.who === 'more' || row.who === 'less') return { word: `Swings ${row.who}`, tone: 'even' }
  return { word: `${STEP[Math.abs(row.band)]} · ${names[row.who]}`, tone: row.who }
}

// "24% vs 19%": his rate against the league's, units on both.
export const versus = (metric, row) =>
  row.value == null || row.league == null ? '—' : `${fmtValue(metric, row.value)} vs ${fmtValue(metric, row.league)}`

// The ledger's shared x scale for one metric: every rate on the board, padded.
export function ledgerScale(rows) {
  const vals = rows.flatMap((r) => [r.value, r.league]).filter((v) => v != null)
  if (!vals.length) return null
  const pad = 0.03
  const lo = Math.min(...vals) - pad
  const hi = Math.max(...vals) + pad
  return { lo, hi, at: (v) => ((v - lo) / (hi - lo)) * 100 }
}

const sum = (a) => a.reduce((x, y) => x + y, 0)
const pctOf = (rows) => sum(rows.map((r) => Number(r.pct)))
const lower = (s) => s.toLowerCase() // caps-js-exempt: a pitch name inside a sentence
// "a", "a and b", "a, b and c".
export const listOf = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

// The metric the headline reads: xwOBA (est.) when the grid carries it, else
// the first one that favors a side (Whiff %). Null when neither is on.
export const leanMetric = (metrics) => ['xwoba', 'whiff'].find((m) => metrics.includes(m)) ?? null

// THE HEADLINE: sum the usage of the types that favor each side. "Lean
// {hitter}" when his sum beats the pitcher's and is at least 50; the same the
// other way; else "Close to even".
export function headline(rows) {
  const hitter = pctOf(rows.filter((r) => r.who === 'hitter'))
  const pitcher = pctOf(rows.filter((r) => r.who === 'pitcher'))
  const lean = hitter > pitcher && hitter >= 50 ? 'hitter' : pitcher > hitter && pitcher >= 50 ? 'pitcher' : null
  return { lean, hitter, pitcher }
}

// A sentence is a list of parts: a string, or { strong } for a figure the
// panel sets in bold. The panel joins them; a test reads the text.
export const textOf = (parts) => parts.map((p) => (typeof p === 'string' ? p : p.strong)).join('')

// The by-pitch-type sentences, from `rows` on the headline metric. `names` is
// { hitter, pitcher } (last names), `crowd` 'righties' | 'lefties'.
export function typeSentences(rows, metric, names, crowd) {
  const out = []
  const of = (who) => rows.filter((r) => r.who === who)
  const words = (rs) => listOf(rs.map((r) => lower(r.name)))
  const n = rows.length
  const good = of(metric === 'xwoba' ? 'hitter' : 'pitcher')
  const bad = of(metric === 'xwoba' ? 'pitcher' : 'hitter')
  if (metric === 'xwoba') {
    if (good.length) {
      out.push([
        `${names.hitter} beats the league on ${good.length} of ${names.pitcher}’s ${n} pitches (${words(good)}). Those are `,
        { strong: `${pctOf(good)}%` },
        ` of what ${names.pitcher} throws to ${crowd}.`,
      ])
    }
    if (bad.length) {
      out.push([`${names.pitcher} has the edge on contact quality with the ${words(bad)}: `, { strong: `${pctOf(bad)}%` }, ` of his pitches to ${crowd}.`])
    } else if (rows.some((r) => r.who != null)) {
      out.push([`No pitch favors ${names.pitcher} on contact quality.`])
    }
  } else {
    // Whiff % as the headline metric: higher favors the pitcher.
    if (good.length) {
      out.push([`${names.hitter} whiffs more than the league on the ${words(good)}: `, { strong: `${pctOf(good)}%` }, ` of what ${names.pitcher} throws to ${crowd}.`])
    }
    if (bad.length) out.push([`${names.hitter} makes more contact than the league on the ${words(bad)}.`])
    if (!good.length && !bad.length) out.push([`${names.hitter} whiffs at about the league’s rate on every pitch.`])
  }
  const few = rows.filter((r) => r.who == null)
  if (few.length) out.push([`Too few ${names.hitter} pitches on file to judge the ${words(few)}.`])
  return out
}

// The whiff sentence under an xwOBA headline: the types where Whiff % favors
// the pitcher. Null when there are none.
export function whiffSentence(rows, names) {
  const way = rows.filter((r) => r.who === 'pitcher')
  if (!way.length) return null
  const each = way.map((r) => `${lower(r.name)} (${versus('whiff', r)})`)
  return [`Swing and miss is ${names.pitcher}’s way in: ${names.hitter} whiffs more than the league on the ${listOf(each)}.`]
}

// THE LOCATION LENS, on All: the page's expected value against the league's,
// the share of the pitcher's pitches in the hitter's hottest regions (tone
// hi2) and in his below-league ones (lo1, lo2), and the pilled types whose
// pitcher map is thin (under MIN_COMMAND_PITCHES), which the expected value
// leaves out. Null when either All map is missing or thin.
export function locationLens(board, side) {
  if (!board?.all || board.all.thin || !side?.all) return null
  const cells = side.all.cells
  const share = (pred) => sum(Object.keys(cells).filter((r) => pred(cells[r].tone)).map((r) => board.all.share[r] ?? 0))
  const hotRegions = Object.keys(cells).filter((r) => cells[r].tone === 'hi2')
  return {
    value: side.overall.value,
    league: side.overall.league,
    hotRegions,
    hot: share((t) => t === 'hi2'),
    cold: share((t) => t === 'lo1' || t === 'lo2'),
    leftOut: leftOut(board),
  }
}

// The pilled types the expected value leaves out: thin pitcher maps.
export const leftOut = (board) =>
  (board?.types ?? []).filter((t) => board.byType[t.code]?.thin).map((t) => ({ name: t.name, n: board.byType[t.code].n }))

const pct = (x) => `${Math.round(x * 100)}%`

export function locationSentences(lens, metric, names, crowd) {
  if (!lens || lens.value == null) return []
  const out = [[
    { strong: fmtValue(metric, lens.value) },
    ...(lens.league != null ? [' vs league ', { strong: fmtValue(metric, lens.league) }] : []),
    ' on the same spots.',
  ]]
  if (metric === 'xwoba') {
    out.push([
      `${names.pitcher} puts `,
      ...(lens.hotRegions.length ? [{ strong: pct(lens.hot) }, ` of his pitches in ${names.hitter}’s hottest regions and `] : []),
      { strong: pct(lens.cold) },
      ` where ${names.hitter} is below league.`,
    ])
  }
  if (lens.leftOut.length) {
    out.push([`Leaves out the ${listOf(lens.leftOut.map((t) => `${lower(t.name)} (${t.n})`))}: too few to ${crowd} for a map.`])
  }
  return out
}

// THE WHOLE VERDICT. `sides` is { metric: hitterSide } for each metric the
// grid carries; `board` the pitcher board; `names` { hitter, pitcher };
// `stance` 'R' | 'L' (the crowd). Null with no hitter side (the Phase 1
// state): the panel keeps the Savant line instead.
export function verdict({ board, sides, names, stance }) {
  const metric = leanMetric(Object.keys(sides).filter((m) => sides[m]))
  if (!board || !metric) return null
  const crowd = stance === 'L' ? 'lefties' : 'righties'
  const rows = ledgerRows(board.types, sides[metric], metric)
  const head = headline(rows)
  const typeLines = typeSentences(rows, metric, names, crowd)
  const whiff = metric === 'xwoba' && sides.whiff ? whiffSentence(ledgerRows(board.types, sides.whiff, 'whiff'), names) : null
  const lens = locationLens(board, sides[metric])
  return {
    metric,
    lean: head.lean,
    leanName: head.lean ? names[head.lean] : null,
    typeLines: whiff ? [...typeLines, whiff] : typeLines,
    locationLines: locationSentences(lens, metric, names, crowd),
  }
}

