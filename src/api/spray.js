import { staticJsonBy } from './staticJson.js'
import { shardKey100 } from '../lib/shardKey.js'
import { HIT_COORD_ORIGIN } from '../lib/ballpark/hitProjection.js'

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
// shard per `personId % 100` bucket (shardKey100 — the same join the rookie
// records, career WAR and the pitch arsenal use), each holding every batter in
// that bucket:
//
//   { season, asOf, bat: { [batterId]: {
//       n: name, t: teamId, b: 'R' | 'L' | 'S',
//       p: [ [coordX, coordY, launchSpeed, result, hand, side, level, pitcherId], … ],
//       o: { R: [bip, hits, xbh, hr, hard], L: [ … ] } } } }
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
// The stored `pitcherId` is for nobody on this card. It rides so a pitcher-side
// spray card can read these same shards rather than sweeping the season twice.
const shard = staticJsonBy((key) => `/data/spray/${key}.json`, { fallback: null })

export const fetchSprayFor = (personId) =>
  personId == null ? Promise.resolve(null) : shard(shardKey100(personId))

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
function entryFor(data, personId) {
  if (personId == null) return null
  return data?.bat?.[personId] ?? data?.bat?.[String(personId)] ?? null
}

// The compact rows as objects. Called once per view; every filter downstream
// works on the decoded list.
export function decodeSprayBalls(entry) {
  return (entry?.p ?? []).map(([x, y, ev, r, h, s, l, pid]) => ({
    x,
    y,
    exitVelo: ev ?? null,
    result: RESULTS[r] ?? 'out',
    hand: HANDS[h] ?? 'R',
    side: HANDS[s] ?? 'R',
    level: LEVELS[l] ?? 'mlb',
    pitcherId: pid ?? null,
  }))
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

// One batter's whole card, or null when he has no entry or falls under the card
// floor. The component filters `balls` per chip; everything else here is
// already the number it will print.
export function sprayView(data, personId) {
  const entry = entryFor(data, personId)
  if (!entry) return null

  const splits = SPLITS.map(([key, label]) => {
    const totals = splitTotals(entry, key)
    return { key, label, ...totals, thin: key !== 'all' && totals.bip < MIN_SPLIT_BIP }
  })
  if (splits[0].bip < MIN_SPRAY_BIP) return null

  const balls = decodeSprayBalls(entry)
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
