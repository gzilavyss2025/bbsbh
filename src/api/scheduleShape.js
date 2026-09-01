// One club's schedule SHAPE across a decade, and the droughts it answers:
// "the last time they won game 1 of a road trip was July 3rd", "they have not
// won a series opener in Chicago since 2019".
//
// Read from the static public/data/schedule-shape/{teamId}.json that
// scripts/gen-schedule-shape.mjs precomputes — twelve seasons of finished
// regular-season games, ~1,900 rows per club at ~32 KB. docs/schedule-shape.md
// catalogs the whole family, including the candidates that were measured and
// thrown out.
//
// WHAT MAKES THIS A DIFFERENT QUESTION from teamRecords.js. That module answers
// a RATE over one season ("34-27 when scoring first"), with lastOccurrence
// bolted on for a date. This one answers a DROUGHT over many: not how often,
// but how long since, counted in CHANCES rather than days. The two are not
// interchangeable, and the reason is the gate at the bottom of this file.
//
// SPOILER: cutoff-gated, the same class and the same argument as
// teamRecords.js and standings.js. The shard holds only Final games from a
// nightly cron that runs before the day's games, so it cannot contain tonight
// even before a cutoff applies — but every entry point here takes `cutoff` and
// applies it BEFORE it counts anything, because a dated page must not learn
// that something happened after its own date. The team hub is an open surface
// by rule (ADR-0034); this is a season-shape aggregate of completed games, not
// a live line.

import { staticJsonBy } from './staticJson.js'

const fetchShard = staticJsonBy((teamId) => `/data/schedule-shape/${teamId}.json`, { fallback: null })

export async function fetchScheduleShape(teamId) {
  if (!teamId) return null
  return fetchShard(teamId)
}

// The shipped row is [mmdd, opponentId, site, result]. These two tables are the
// reader's half of the encoding scripts/lib/schedule-shape.mjs writes; the two
// files cannot import each other (one is a build script, one ships to the
// browser), so test/schedule-shape.test.js pins them against each other.
const SITE = ['away', 'home', 'neutral']
const RESULT = ['L', 'W', 'T']

// ---------------------------------------------------------------------------
// Decoding and segmentation
// ---------------------------------------------------------------------------

// Walks `rows` once, calling `onSegment(indices)` wherever `keyOf` changes.
// A null key drops a row out of the segmentation without ending the run around
// it — the neutral-site rule, argued in the generator's lib.
function eachRun(rows, keyOf, onSegment) {
  const live = rows.map((_, i) => i).filter((i) => keyOf(rows[i]) != null)
  let start = 0
  for (let p = 1; p <= live.length; p++) {
    const prev = rows[live[p - 1]]
    const cur = live[p] != null ? rows[live[p]] : null
    if (cur && keyOf(cur) === keyOf(prev)) continue
    onSegment(live.slice(start, p))
    start = p
  }
}

// The club's whole ledger, decoded, ordered, and tagged with its place in the
// three segments. Segments are cut PER SEASON: a road trip does not run from
// one October into the next March, and a ledger that segmented across the
// whole range would join every season's last road game to the next season's
// first and report one continent-spanning trip a year.
//
// `cutoff` is an ISO date. Rows after it are dropped BEFORE segmentation, not
// after, so the last segment on a dated page is the one in progress on that
// date rather than a completed segment with its tail hidden.
export function ledgerOf(data, { cutoff = null } = {}) {
  if (!data?.seasons) return []
  const out = []
  for (const season of Object.keys(data.seasons).sort()) {
    const rows = []
    for (const [mmdd, opponentId, site, result] of data.seasons[season]) {
      const date = `${season}-${mmdd}`
      if (cutoff && date > cutoff) continue
      rows.push({ date, season: Number(season), opponentId, site: SITE[site], result: RESULT[result] })
    }
    // Neutral-site games are transparent to BOTH segmentations — see the
    // generator's lib for the 2020 Brewers game at Busch Stadium that proved
    // it, a designated home game inside a road series that split the series in
    // two and invented an opener nobody played.
    eachRun(
      rows,
      (r) => (r.site === 'neutral' ? null : `${r.opponentId}|${r.site}`),
      (seg) =>
        seg.forEach((i, n) => {
          rows[i].seriesGame = n + 1
          rows[i].seriesLength = seg.length
          rows[i].seriesOpener = n === 0
          rows[i].seriesFinale = n === seg.length - 1
        }),
    )
    eachRun(
      rows,
      (r) => (r.site === 'neutral' ? null : r.site),
      (seg) => {
        const kind = rows[seg[0]].site === 'home' ? 'homestand' : 'trip'
        seg.forEach((i, n) => {
          rows[i].segment = kind
          rows[i].segmentGame = n + 1
          rows[i].segmentLength = seg.length
          rows[i].segmentOpener = n === 0
          rows[i].segmentFinale = n === seg.length - 1
        })
      },
    )
    out.push(...rows)
  }
  return out
}

// ---------------------------------------------------------------------------
// The slots
// ---------------------------------------------------------------------------

// A SLOT is a recurring position in the schedule that a club arrives at over
// and over — the first game of a road trip, the last game of a homestand, a
// series opener on the road. Each one is a question of the form "when did we
// last win one of these", and the answer is only interesting because the slot
// comes around again.
//
// `id` is stable and is what a URL names; never renumber one. `every` is how
// many times a full season presents the slot, measured over 2015-2026 and
// rounded — it is not decoration. The gate below divides by it, because three
// straight losses means something different in a slot that comes around eleven
// times a year than in one that comes around forty-five.
export const SLOTS = [
  { id: 'trip-opener', label: 'Road-trip opener', short: 'Game 1 of a road trip', every: 13,
    p: (r) => r.segment === 'trip' && r.segmentOpener },
  { id: 'homestand-opener', label: 'Homestand opener', short: 'Game 1 of a homestand', every: 13,
    p: (r) => r.segment === 'homestand' && r.segmentOpener },
  { id: 'trip-finale', label: 'Road-trip finale', short: 'The last game of a road trip', every: 13,
    p: (r) => r.segment === 'trip' && r.segmentFinale },
  { id: 'homestand-finale', label: 'Homestand finale', short: 'The last game of a homestand', every: 13,
    p: (r) => r.segment === 'homestand' && r.segmentFinale },
  { id: 'long-trip-opener', label: 'Long-trip opener', short: 'Game 1 of a trip of six or more', every: 9,
    p: (r) => r.segment === 'trip' && r.segmentOpener && r.segmentLength >= 6 },
  { id: 'series-opener', label: 'Series opener', short: 'Game 1 of a series', every: 52,
    p: (r) => r.seriesOpener },
  { id: 'series-opener-away', label: 'Series opener on the road', short: 'Game 1 of a road series', every: 26,
    p: (r) => r.seriesOpener && r.site === 'away' },
  { id: 'series-opener-home', label: 'Series opener at home', short: 'Game 1 of a home series', every: 26,
    p: (r) => r.seriesOpener && r.site === 'home' },
  { id: 'series-finale', label: 'Series finale', short: 'The last game of a series', every: 52,
    p: (r) => r.seriesFinale },
  { id: 'getaway-day', label: 'Getaway day', short: 'The last game of a road series', every: 26,
    p: (r) => r.seriesFinale && r.site === 'away' },
]

export const SLOT_BY_ID = new Map(SLOTS.map((s) => [s.id, s]))

// ---------------------------------------------------------------------------
// Droughts
// ---------------------------------------------------------------------------

// How long since this club last WON in one slot, counted the way the stat is
// spoken: `sinceWin` is the number of chances it has had since, not days.
//
// `opponentId` narrows the slot to one rival, which is what turns "game 1 of a
// road series" into "game 1 of a series in Chicago". `seasonsBack` limits how
// far the count reaches; null is the whole file.
export function droughtFor(ledger, slot, { opponentId = null, seasonsBack = null, asOfSeason = null } = {}) {
  const floor = seasonsBack && asOfSeason ? asOfSeason - seasonsBack + 1 : null
  const hits = ledger.filter(
    (r) =>
      slot.p(r) &&
      r.result !== 'T' &&
      (opponentId == null || r.opponentId === opponentId) &&
      (floor == null || r.season >= floor),
  )
  if (!hits.length) return null
  const wins = hits.filter((r) => r.result === 'W').length
  // How often this slot comes around IN THE SCOPE BEING ASKED ABOUT, measured
  // rather than declared. `slot.every` counts a full season of the slot against
  // the whole league — 26 road series openers a year — but narrowing to one
  // rival cuts that to about 2.7, because a club visits any given park two or
  // three times a season. The gate divides by this, so it has to be the
  // narrowed figure or an opponent-scoped drought can never clear a bar set for
  // the unnarrowed one. That is not hypothetical: the bar was `slot.every / 4`
  // for both, which asked a 2.7-a-season slot for seven straight losses inside
  // three years, and no club in twelve seasons had ever done it.
  const seasonsSeen = new Set(hits.map((r) => r.season)).size
  let lastWinAt = -1
  for (let i = hits.length - 1; i >= 0; i--) {
    if (hits[i].result === 'W') { lastWinAt = i; break }
  }
  const streak = hits.slice(lastWinAt + 1)
  return {
    slotId: slot.id,
    opponentId,
    chances: hits.length,
    wins,
    losses: hits.length - wins,
    perSeason: hits.length / Math.max(1, seasonsSeen),
    lastWin: lastWinAt >= 0 ? { date: hits[lastWinAt].date, opponentId: hits[lastWinAt].opponentId } : null,
    sinceWin: streak.length,
    // The date the losing run began — what "since" means when the run is long
    // enough that a reader wants to place it.
    streakFrom: streak.length ? streak[0].date : null,
  }
}

// The noteworthiness gate, and the reason this module is not just a filter over
// teamRecords.js.
//
// A drought is two different facts wearing one sentence. "They have not won a
// series opener in Cleveland since 2016" sounds like a decade of futility; it
// is nine chances in eleven years, because an interleague club visits once
// every two or three seasons. Measured over 2015-2026, 45% of club-park pairs
// have fewer than six series openers on record at all, so a bare "since" would
// print schedule RARITY far more often than it printed anything a reader would
// call a drought. The failure is not that the number is wrong. It is that the
// sentence claims a struggle where the truth is an absence of opportunity.
//
// So a drought passes only when the chances were REAL:
//
//   1. `sinceWin >= minChances` — enough tries to mean something. Scaled off
//      the slot's own `every`, because eleven-a-year and fifty-two-a-year slots
//      cannot share a threshold.
//   2. the run fits inside `maxSpanYears` — the tries were recent enough to be
//      about this club rather than a franchise two rosters ago.
//
// Both thresholds were calibrated against all thirty clubs over 2015-2026; the
// table is in docs/schedule-shape.md. At four-and-three the league carries about
// thirty notable droughts at any moment — a median of one per club, never more
// than four, and eight clubs carrying none. Three-and-three triples that to
// ninety-eight and the card stops being a list of remarkable things; five-and-
// three cuts it to twelve and eighteen clubs go silent.
export const MIN_SPAN_CHANCES = 4
export const MAX_SPAN_YEARS = 3

export function isNotable(drought, slot, { asOfDate = null } = {}) {
  if (!drought || !drought.sinceWin) return false
  // A quarter of a season's chances, floored at three. A slot that comes around
  // 13 times a year needs 3; one that comes around 52 needs 13.
  //
  // The rate is the SMALLER of what the slot offers league-wide and what it has
  // actually offered in this drought's own scope, so narrowing by opponent
  // lowers the bar to match. Taking the minimum rather than the measured figure
  // alone keeps a partial season honest too: in April a club has had three
  // road-trip openers, and a bar set from that alone would drift all year.
  const rate = Math.min(slot.every, drought.perSeason ?? slot.every)
  const minChances = Math.max(MIN_SPAN_CHANCES, Math.round(rate / 4))
  if (drought.sinceWin < minChances) return false
  if (!drought.streakFrom) return false
  const end = asOfDate ?? drought.streakFrom
  const years = (new Date(end) - new Date(drought.streakFrom)) / 31557600000
  return years <= MAX_SPAN_YEARS
}

// Every notable drought this club is carrying, worst first — the whole card in
// one call. Slots are counted over the current season alone; opponent-narrowed
// series openers reach back the full file, because that is the only way the
// "in Chicago since..." question has enough chances to be asked at all.
export function droughtsFor(data, { cutoff = null, opponents = true } = {}) {
  const ledger = ledgerOf(data, { cutoff })
  if (!ledger.length) return []
  const asOfDate = ledger[ledger.length - 1].date
  const asOfSeason = ledger[ledger.length - 1].season
  const thisSeason = ledger.filter((r) => r.season === asOfSeason)
  const out = []

  for (const slot of SLOTS) {
    const d = droughtFor(thisSeason, slot)
    if (isNotable(d, slot, { asOfDate })) out.push({ ...d, scope: 'season', season: asOfSeason })
  }

  if (opponents) {
    const rivals = [...new Set(ledger.map((r) => r.opponentId))]
    for (const slot of SLOTS.filter((s) => s.id === 'series-opener-away' || s.id === 'series-opener-home')) {
      for (const opponentId of rivals) {
        const d = droughtFor(ledger, slot, { opponentId })
        if (isNotable(d, slot, { asOfDate })) out.push({ ...d, scope: 'rival' })
      }
    }
  }

  // Longest run first, then the one whose chances were most crowded together —
  // five in two seasons is a sharper fact than five in three.
  return out.sort((a, b) => b.sinceWin - a.sinceWin || (a.streakFrom < b.streakFrom ? 1 : -1))
}
