import { readSeasonShard, staticJsonBy } from './staticJson.js'
import { shardKey100 } from '../lib/shardKey.js'
import { combineSprayEntries, coveringRuns } from '../lib/seasons/combine.js'
import { HIT_COORD_ORIGIN, HARD_HIT_MPH } from '../lib/ballpark/hitProjection.js'
import { resolveBallparkLayout } from '../lib/ballpark/layout/resolveLayout.js'

// The season spray map's reader — where one batter's balls in play landed, and
// how that changes against a right-handed or a left-handed pitcher.
//
// SPOILER FOOTING: SPOILER-FREE, AND DELIBERATELY SO. Every ball here comes
// from a game that was already Final when scripts/gen-spray.mjs swept it (the
// generator never touches today's slate), so this is a completed-game season
// aggregate on exactly the footing war.js, fouls.js and pitchArsenal.js stand
// on — an open surface, no SealBox, no reveal gate (ADR-0034). It is worth
// saying plainly because the same COORDINATES are reveal-only one file over:
// api/hitchart.js plots a single game's batted balls, and there a dot in the
// left-field seats IS tonight's home run. The difference is the sweep, not the
// mark. The projection both cards share therefore lives in
// lib/ballpark/hitProjection.js, so nothing here imports the reveal-only file.
//
// THE FILE SHAPE, and why it is written in numbers rather than words. One
// folder per season (`spray/{season}/`, ADR-0086; `spray/seasons.json` names the
// season served), and in it one shard per `personId % 100` bucket (shardKey100 — the same join the rookie
// records, career WAR and the pitch arsenal use), each holding every batter in
// that bucket:
//
//   { season, asOf, bat: { [batterId]: {
//       n: name, t: teamId, b: 'R' | 'L' | 'S',
//       p: [ [coordX, coordY, launchSpeed, result, hand, side, level, pitcherId], … ],
//       g: [ [count, venueId], … ],
//       o: { R: [bip, hits, xbh, hr, hard], L: [ … ] } } } }
//
// `g` (schema version 2, the bucket's `v`) names the PARK of each row without a
// column on every row: the next `count` rows of `p` were hit at Stats API venue
// `venueId` (null: the feed named none). Consecutive games at one park merge
// into one run. An entry written before version 2 has no `g`; its balls read as
// "park unknown", never as a guessed park. Venue and season pick the wall, since
// every ballpark configuration covers whole seasons (#1859).
//
// `p` is one row per ball in play the park gave a landing point, in RAW Gameday
// coordinates — the projection to SVG happens at render time, so the stored
// file never has to be regenerated if the drawing it plots onto changes. Rows
// are fixed-length arrays, not objects: a season is ~190,000 balls in play
// across the two levels, and spelling out eight keys per row multiplies the
// committed bytes by roughly four for nothing a reader gains.
//
// `o` is the honest denominator beside it. Not every ball in play carries
// coordinates — a home run with no landing point is rare but real — so the
// counts are swept independently of the plot and the card prints a footnote
// when its diamonds fall short of them. A card that derived its totals from
// what it could draw would under-report a man's home runs forever, silently.
//
// THE POSTSEASON IS A SECOND MAP BESIDE `bat`. A bucket may also carry
// `post: { [batterId]: entry }`, the same entry shape over MLB postseason games
// (ADR-0103). It is a new key rather than a column so a reader that knows only
// `bat` is unchanged, and it is never blended into `bat`: a home-run chart and a
// hard-hit rate read as season facts, and twelve October balls folded into five
// hundred would be invisible. The card shows Regular, Postseason or All; All is
// the two entries added, never a third stored row. A bucket with no postseason
// batter has no `post` key at all.
//
// THE CONTACT STORE (#1912) is a sibling file, `NN.contact.json`, because five more
// columns and a gamePk run per game would take the busiest bucket past its size
// ceiling. A batter's entry there is `{ n, c, g }`: `n` is how many spray rows `p`
// held when it was written; `c` is FLAT triples, [launchAngle, totalDistance, xBA in
// thousandths, …], for the LAST `c.length / 3` of them (rows swept before the store
// existed have none and come first); `g` is FLAT pairs, [count, gamePk, …], over those
// rows. `withContact` aligns it onto the entry as `k` (one [launchAngle, distance, xBA,
// gamePk] or null per row) ONLY when `n` equals `p.length` and `g` covers the rows;
// otherwise the entry reads as having no contact columns, never as shifted ones. The
// barrel flag is not stored: isBarrel derives it.
//
// The stored `pitcherId` is for nobody on this card. It rides so a pitcher-side
// spray card can read these same shards rather than sweeping the season twice.
const shard = staticJsonBy((key) => `/data/spray/${key}.json`, { fallback: null })
// The contact store (#1912), `NN.contact.json` beside each shard: launch angle,
// distance, xBA and the gamePk of each run, for the Contact card alone. The spray map
// never asks for it.
const contactShard = staticJsonBy((key) => `/data/spray/${key}.contact.json`, { fallback: null })

// `{ seasonYear }` is a year, 'all', or nothing for the current season
// (staticJson.js's seasonFolderOf). 'all' adds his seasons into one entry, in
// the shard's own shape, so sprayView reads it unchanged. `{ contact: true }` also
// reads the contact store and aligns it (the Contact card; the spray map leaves it off).
export async function fetchSprayFor(personId, { seasonYear, strict, contact = false } = {}) {
  if (personId == null) return null
  const key = shardKey100(personId)
  const readOne = async (season) => {
    const [d, c] = await Promise.all([shard(`${season}/${key}`), contact ? contactShard(`${season}/${key}`) : null])
    return c && d ? attachContact(d, c, personId) : d
  }
  return readSeasonShard(
    'spray',
    seasonYear,
    readOne,
    (shards, seasons) => {
      // Each season's runs carry their season into the joined entry, so a ball
      // from 2022 at Comerica resolves the 2022 wall, not today's.
      const tagged = (part) => shards.map((d) => withSeasonRuns(entryFor(d, personId, part), d?.season))
      const entry = combineSprayEntries(tagged('bat'))
      const post = combineSprayEntries(tagged('post'))
      if (!entry && !post) return null
      return { season: null, seasons, bat: entry ? { [personId]: entry } : {}, ...(post && { post: { [personId]: post } }) }
    },
    { strict },
  )
}

// One entry with its contact rows aligned as `k`, or the entry as it was when the
// two do not line up (see the header).
export function withContact(entry, ce) {
  const n = entry?.p?.length ?? 0
  const rows = (ce?.c?.length ?? 0) / 3
  const g = ce?.g ?? []
  let covered = 0
  for (let i = 0; i < g.length; i += 2) covered += g[i]
  if (!ce || ce.n !== n || !Number.isInteger(rows) || rows > n || covered !== rows || g.length % 2) return entry
  const k = new Array(n - rows).fill(null)
  for (let i = 0; i < g.length; i += 2) {
    for (let j = 0; j < g[i]; j++) {
      const at = 3 * (k.length - (n - rows))
      k.push([ce.c[at], ce.c[at + 1], ce.c[at + 2], g[i + 1]])
    }
  }
  return { ...entry, k }
}

// A season shard with `personId`'s contact rows aligned onto his entries.
function attachContact(d, c, personId) {
  const swap = (part) => {
    const entry = entryFor(d, personId, part)
    const joined = withContact(entry, entryFor(c, personId, part))
    return joined === entry ? d[part] : { ...d[part], [personId]: joined }
  }
  return { ...d, ...(d.bat && { bat: swap('bat') }), ...(d.post && { post: swap('post') }) }
}

// Savant's barrel zone, from exit velocity and launch angle. MLB's glossary
// (mlb.com/glossary/statcast/barrel) gives the anchors: at least 98 mph, 26-30 degrees
// at 98 mph, widening with speed to 8-50 degrees at 116 mph. The line pair below is the
// community fit of that zone (baseballr's code_barrel), an APPROXIMATION: it reproduces
// both anchors, but fits of it can sit a barrel or two off Savant's own count.
// Null when either input is missing.
export function isBarrel(ev, la) {
  if (ev == null || la == null) return null
  return ev >= 98 && la >= 8 && la <= 50 && 1.5 * ev - la >= 117 && ev + la >= 124
}

// The card floor: how many balls in play a season needs before a spray map is
// a picture of anything. Below it the dots are anecdotes and the direction bar
// is three numbers that would move by a third on the next ground ball, so the
// card renders nothing at all rather than a confident-looking sketch. Same idea
// as fouls.js's qualifier floors and MIN_ARSENAL_PITCHES.
export const MIN_SPRAY_BIP = 40

// The split floor, kept SEPARATE because it answers a different question. The
// card can be worth drawing while one of its two halves is not: a bench bat
// with 120 balls in play may have seen a left-hander forty times. Under this,
// the chip still renders — hiding it would tell the reader nothing about why —
// but it renders grayed, with its own count, and it is never where the card
// opens.
export const MIN_SPLIT_BIP = 30

// The `p` row's coded columns, in order. Positional so the file stays compact;
// named here once so nothing downstream indexes a magic number.
const RESULTS = ['out', 'single', 'double', 'triple', 'hr']
const HANDS = ['R', 'L']
const LEVELS = ['mlb', 'aaa']

// The centre third of fair territory, in degrees either side of dead centre.
// Fair ground spans roughly ±45°, so ±15° cuts it in three — the same split
// every published pull/centre/oppo rate uses.
const CENTER_BAND_DEG = 15

// One batter's stored entry, or null. Ids arrive from the app as numbers and
// sit in JSON as strings, so both spellings are tried — the same lookup
// fouls.js's `batterFoulLine` makes.
function entryFor(data, personId, part = 'bat') {
  if (personId == null) return null
  return data?.[part]?.[personId] ?? data?.[part]?.[String(personId)] ?? null
}

// An entry's park runs, each stamped with `season` and covering every ball
// (a pre-run entry gets one unknown run). Null in, null out.
export function withSeasonRuns(entry, season) {
  if (!entry) return null
  return { ...entry, g: coveringRuns(entry).map(([n, v, s]) => [n, v, s ?? season]) }
}

// The compact rows as objects. Called once per view; every filter downstream
// works on the decoded list. `season` is the folder's season, for runs that do
// not carry their own (a single-season file); a ball outside every run has no
// park (`venueId: null`).
export function decodeSprayBalls(entry, season = null) {
  const park = []
  for (const [n, v, s] of entry?.g ?? []) for (let i = 0; i < n; i++) park.push([v ?? null, s ?? season])
  return (entry?.p ?? []).map(([x, y, ev, r, h, s, l, pid], i) => {
    const [la, dist, xba, gamePk] = entry.k?.[i] ?? []
    return {
      x,
      y,
      exitVelo: ev ?? null,
      result: RESULTS[r] ?? 'out',
      hand: HANDS[h] ?? 'R',
      side: HANDS[s] ?? 'R',
      level: LEVELS[l] ?? 'mlb',
      pitcherId: pid ?? null,
      venueId: park[i]?.[0] ?? null,
      season: park[i]?.[1] ?? season,
      // The contact columns (#1912): null on a ball with none, never 0.
      launchAngle: la ?? null,
      distance: dist ?? null,
      xba: xba == null ? null : xba / 1000,
      gamePk: gamePk ?? null,
      barrel: isBarrel(ev, la),
    }
  })
}

// Where a ball went, as an angle off dead centre in degrees: negative toward
// left field, positive toward right. Read straight off the RAW Gameday
// coordinate rather than off the projected SVG point, because the scale factor
// cancels in the ratio — the angle is the one thing about a hit coordinate that
// needs no empirical constant at all.
export function sprayAngle(coordX, coordY) {
  if (coordX == null || coordY == null) return null
  const dx = coordX - HIT_COORD_ORIGIN.x
  const dy = HIT_COORD_ORIGIN.y - coordY
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

// Pull, centre or oppo — a fact about the BATTER, so the angle is read through
// the side he hit from. A right-handed hitter pulls to left field (a negative
// angle); a left-handed hitter pulls to right (a positive one). A ball hooked
// foul past the line keeps its third rather than falling into a fourth bucket:
// it was still pulled, it just stayed pulled past the pole.
export function directionOf(angleDeg, side) {
  if (angleDeg == null) return null
  const pullward = side === 'L' ? angleDeg : -angleDeg
  if (pullward > CENTER_BAND_DEG) return 'pull'
  if (pullward < -CENTER_BAND_DEG) return 'oppo'
  return 'center'
}

// The sentence under the bar, so "pull" is never a word the reader has to
// translate. Null when there is no single side to speak for — see directionMix.
export function directionCaption(side) {
  if (side === 'R') return 'Bats right — pull side is left field.'
  if (side === 'L') return 'Bats left — pull side is right field.'
  return null
}

// How small a side's share has to be before it stops making a split
// two-sided. See directionMix.
export const MIX_MINORITY_MAX = 0.1

// The three thirds over a set of balls, or NULL when the sample was genuinely
// hit from both sides of the plate.
//
// THE SWITCH-HITTER RULE. A switch-hitter's two halves are mirror images: he
// pulls to right against a right-hander and to left against a left-hander. Add
// them and "pull" describes left field and right field at once, which is not a
// distribution — it is two of them printed on top of each other. So the All
// view of a switch-hitter has no direction bar, and each split still has its
// own. Decided from the BALLS rather than from his listed `b: 'S'`, so a listed
// switch-hitter who batted only right-handed all season still gets his bar.
//
// A MAJORITY, NOT UNANIMITY, and the difference is not theoretical. Ozzie
// Albies turned around for exactly one of his 240 balls in play against
// right-handers this season; under a stricter rule that single at-bat withheld
// the other 239 from the reader. A side holding under MIX_MINORITY_MAX of the
// sample does not make the split two-sided, and its balls are dropped from the
// count rather than folded into the other stance — the bar then describes one
// stance and still sums to what it counted.
export function directionMix(balls) {
  if (!balls?.length) return null
  const right = balls.filter((b) => b.side === 'R').length
  const minority = Math.min(right, balls.length - right)
  if (minority / balls.length > MIX_MINORITY_MAX) return null

  const side = right * 2 > balls.length ? 'R' : 'L'
  const mix = { side, pull: 0, center: 0, oppo: 0, n: 0 }
  for (const b of balls) {
    if (b.side !== side) continue
    const third = directionOf(sprayAngle(b.x, b.y), side)
    if (!third) continue
    mix[third] += 1
    mix.n += 1
  }
  return mix
}

// The balls a chip shows. 'all' is everything; 'R'/'L' is the hand that threw
// the pitch, which is what "vs RHP" means.
export function splitBalls(balls, split) {
  if (split === 'all') return balls ?? []
  return (balls ?? []).filter((b) => b.hand === split)
}

const ZERO = [0, 0, 0, 0, 0]

// A chip's counts, read from the stored totals rather than from the plotted
// balls — see the header on why the two are not the same number. 'all' is the
// two hands ADDED, never a third stored row, so a chip can never disagree with
// the pair beside it.
export function splitTotals(entry, split) {
  const pick = (hand) => entry?.o?.[hand] ?? ZERO
  const [bip, hits, xbh, hr, hard] =
    split === 'all'
      ? pick('R').map((n, i) => n + (pick('L')[i] ?? 0))
      : pick(split)
  return { bip, hits, xbh, hr, hard }
}

// The footnote under a chart whose diamonds under-count the season. Silent when
// every home run had a landing point, and silent again if the plot somehow runs
// AHEAD of the totals — that would be a generator bug, and a card is the wrong
// place to announce one.
export function hrNote(plotted, total) {
  if (total <= 0 || plotted >= total) return null
  return `${plotted} of ${total} HR had tracked landing points`
}

const SPLITS = [
  ['all', 'All'],
  ['R', 'vs RHP'],
  ['L', 'vs LHP'],
]

// The scopes, in the order the control shows them.
export const SCOPES = [
  ['R', 'Regular'],
  ['P', 'Postseason'],
  ['A', 'All'],
]

// The scope a card can actually show for a view. The reader's pick lives in state
// and outlasts a season change; the new season may carry no October balls (no
// `scoped`), and the card is then the regular one. Report Regular for it too.
export const sprayScopeOf = (view, want) => (want !== 'R' && view?.scoped?.[want] ? want : 'R')

// One scope's card body over an entry, or null for an entry with no balls in
// play at all. The card floor is NOT applied here — see sprayView.
function viewOf(entry, personId, bip, season = null) {
  const splits = SPLITS.map(([key, label]) => {
    const totals = splitTotals(entry, key)
    return { key, label, ...totals, thin: key !== 'all' && totals.bip < MIN_SPLIT_BIP }
  })
  if (splits[0].bip < bip) return null

  const balls = decodeSprayBalls(entry, season)
  // Majors first, always, so a call-up's card reads MLB + AAA rather than in
  // whatever order his season happened to run. Taken from the plotted balls
  // because the totals carry no level of their own — safe in practice, since
  // both levels are Hawk-Eye parks and a ball in play without coordinates is
  // roughly one in two thousand.
  const levels = LEVELS.filter((l) => balls.some((b) => b.level === l))

  return {
    id: personId,
    name: entry.n ?? '',
    teamId: entry.t ?? null,
    bats: entry.b ?? null,
    levels,
    balls,
    splits,
  }
}

// One batter's whole card, or null when he has no regular-season entry or falls
// under the card floor. The component filters `balls` per chip; everything else
// here is already the number it will print.
//
// THE REGULAR SEASON IS THE CARD. The floor and the card's very existence are
// decided on `bat`, exactly as before the postseason was stored, so every card
// that opened still opens and every one that did not still does not. The
// postseason hangs off it as `scoped.P` and `scoped.A`, present ONLY for a
// batter with at least one postseason ball in play: a hitter with none gets no
// control. Those two take no card floor, because October is a handful of games
// and a floor would hide the very balls the reader came to see; a thin sample
// shows as grayed split chips, with its own counts, as a thin split always has.
export function sprayView(data, personId) {
  const season = data?.season ?? null
  const entry = entryFor(data, personId)
  if (!entry) return null
  const view = viewOf(entry, personId, MIN_SPRAY_BIP, season)
  if (!view) return null

  const post = entryFor(data, personId, 'post')
  const postView = post && viewOf(post, personId, 1, season)
  if (!postView) return view
  const all = viewOf(combineSprayEntries([entry, post]), personId, 1, season)
  return { ...view, scoped: { P: postView, A: all } }
}

// --- one park at a time (#1859) ----------------------------------------------
//
// A season is many parks, so the card's default field is a generic one. The
// park view draws ONE configuration's real wall and only the balls hit there.
// A ball is grouped by the wall it was hit at, not by the venue: the 2022 and
// 2023 Comerica walls are two groups, never one drawing with both seasons' balls.

// The configuration a ball was hit at, resolved once per venue and season. The
// date is mid-season: every configuration covers whole seasons.
function layoutKey(cache, venueId, season) {
  const k = `${venueId}:${season}`
  if (!cache.has(k)) {
    cache.set(k, venueId != null && season != null
      ? resolveBallparkLayout({ venueId, gameDate: `${season}-07-01` })
      : null)
  }
  return cache.get(k)
}

// The parks a view's balls were hit at, most balls first, plus the two counts
// the card's coverage note needs: balls with no park on record (`unknown`, a
// season stored before parks were kept) and balls at a park the app cannot
// draw (`offFile`, a minor-league park with no layout).
export function sprayParks(balls) {
  const cache = new Map()
  const groups = new Map()
  let unknown = 0
  let offFile = 0
  for (const b of balls ?? []) {
    if (b.venueId == null) { unknown++; continue }
    const layout = layoutKey(cache, b.venueId, b.season)
    if (!layout) { offFile++; continue }
    const g = groups.get(layout.configurationId) ??
      { key: layout.configurationId, venueId: b.venueId, name: layout.name, layout, n: 0, seasons: new Set() }
    g.n += 1
    if (b.season != null) g.seasons.add(b.season)
    groups.set(layout.configurationId, g)
  }
  // Two walls of one park in one view (an All-seasons view across a
  // renovation) carry their seasons in the label, so the picker can tell them apart.
  const list = [...groups.values()].map((g) => ({ ...g, seasons: [...g.seasons].sort() }))
  const perVenue = new Map()
  for (const g of list) perVenue.set(g.venueId, (perVenue.get(g.venueId) ?? 0) + 1)
  for (const g of list) {
    const span = g.seasons.length ? `${g.seasons[0]}${g.seasons.length > 1 ? `–${g.seasons.at(-1)}` : ''}` : ''
    g.label = perVenue.get(g.venueId) > 1 && span ? `${g.name} (${span})` : g.name
  }
  list.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
  return { groups: list, unknown, offFile, total: (balls ?? []).length }
}

// A view narrowed to one park group. Every count is RECOMPUTED from the balls
// hit there, because the stored denominators (`o`) are season totals with no
// park: the chips, the facts and the foot all describe this park alone. They
// count balls with a landing point (the rows), which is what a park can know.
export function parkSubview(view, group) {
  const balls = view.balls.filter((b) => b.venueId === group.venueId && group.seasons.includes(b.season))
  const count = (bs) => ({
    bip: bs.length,
    hits: bs.filter((b) => b.result !== 'out').length,
    xbh: bs.filter((b) => b.result === 'double' || b.result === 'triple' || b.result === 'hr').length,
    hr: bs.filter((b) => b.result === 'hr').length,
    hard: bs.filter((b) => b.exitVelo != null && b.exitVelo >= HARD_HIT_MPH).length,
  })
  const splits = SPLITS.map(([key, label]) => {
    const totals = count(key === 'all' ? balls : balls.filter((b) => b.hand === key))
    return { key, label, ...totals, thin: key !== 'all' && totals.bip < MIN_SPLIT_BIP }
  })
  return { ...view, balls, splits, park: group }
}
