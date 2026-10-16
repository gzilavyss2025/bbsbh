// The "last time" callouts for the feat index (public/data/notable/): a triple play or a
// cycle on the revealed play card, a no-hitter in the box score's Final roll-up.
//
//   club line    always: "The Brewers' first triple play since Aug. 3, 2019."
//   player line  cycles and no-hitters, only past the player's first: "His 2nd cycle; the first was ..."
//   league line  only after a long league-wide gap (LEAGUE_GAP_DAYS)
//
// REVEAL-ONLY (ADR-0101). The docs hold results, so this module takes them as an argument and
// never fetches. The hook that fetches them (hooks/callouts/useLastTime.js) runs only for a play card
// already on screen or inside the box score's reveal. Every lookup is cut strictly before
// tonight (a feat of tonight's own never counts as the earlier one). No link yet (#1570).
//
// Era floors (plan.md section 3): the index measured recall back to 1901 for no-hitters and
// cycles, and to 1960 for triple plays. A last-found event older than the floor reads "since
// at least {floor}". A club with no earlier row in the index gets no note: it never invents a span.
import { ordinal } from '../../lib/format.js'
import { orderedPlays } from '../../lib/worldSeries/classify.js'
import { SCORE_BASE, clampScore, magnitudeOf, otherSide, gameResult, dateText } from './shared.js'

export const LAST_TIME_FLOOR = { nohitters: 1901, cycles: 1901, tripleplays: 1960 }
// A year. Set from the measured league-wide gaps between consecutive feats (1960 and later for
// triple plays, 1901 and later for the rest; the offseason counts, so most gaps are short):
//   p95 of the gap:  no-hitters 520 d, cycles 440 d, triple plays 297 d (p99 370 d).
// A year is where a gap crosses a whole offseason without a feat. It fires on about 5% of
// no-hitters and cycles and about 1% of triple plays.
export const LEAGUE_GAP_DAYS = 365
const NOUN = { nohitters: 'no-hitter', cycles: 'cycle', tripleplays: 'triple play' }
const WORDS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
const CLUB_GAP_FULL = 10 // seasons for the full magnitude bonus
const LEAGUE_GAP_FULL = 3 * LEAGUE_GAP_DAYS

// "Brewers'" and "Red Sox'", but "Athletics'"; every club nickname ends in s or x.
const possessive = (name) => (/[sx]$/i.test(name) ? `${name}'` : `${name}'s`)
const wordOf = (n) => WORDS[n] ?? ordinal(n)
const yearOf = (iso) => Number(iso.slice(0, 4))
const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5

// The game being annotated; null when the feed does not say when it was played.
function tonightOf(feed) {
  const date = feed?.gameData?.datetime?.officialDate
  if (!date) return null
  return { gamePk: feed.gamePk, date, gameNumber: feed.gameData.game?.gameNumber ?? 1 }
}

// Newest first, strictly before tonight. Same-day games order by game number.
function priorRows(docs, kind, t) {
  const before = (r) => r.gamePk !== t.gamePk && (r.officialDate < t.date || (r.officialDate === t.date && (r.gameNumber ?? 1) < t.gameNumber))
  return (docs?.[kind]?.rows ?? []).filter(before).sort((a, b) => (a.officialDate < b.officialDate ? 1 : a.officialDate > b.officialDate ? -1 : 0))
}

const since = (kind, prev) =>
  yearOf(prev.officialDate) < LAST_TIME_FLOOR[kind] ? `since at least ${LAST_TIME_FLOOR[kind]}` : `since ${dateText(prev.officialDate)}`

// The year a gap is measured from: the floor when the last find is older than it.
const gapStart = (kind, prev) => Math.max(yearOf(prev.officialDate), LAST_TIME_FLOOR[kind])

// feat: { kind, side, player?: { id, name }, pitchers?: [{ id, name }] }. `side` is the club that
// did it (the batter's for a cycle, the fielders' for a triple play, the pitchers' for a no-hitter).
// ctx: { atBatIndex? } names the play for the dedupe key.
export function buildLastTimeNotes(docs, feed, feat, { atBatIndex = null } = {}) {
  const t = tonightOf(feed)
  if (!t || !feat || !docs) return []
  const { kind, side } = feat
  const rows = priorRows(docs, kind, t)
  if (!rows.length) return []
  const noun = NOUN[kind]
  const key = (line) => `lastTime-${line}-${kind}-${atBatIndex ?? 'game'}-${feat.player?.id ?? side}`
  const notes = []

  const club = feed.gameData?.teams?.[side]
  const clubName = club?.teamName ?? club?.name
  const prevClub = rows.find((r) => r[r.side]?.id === club?.id)
  if (prevClub && clubName) {
    notes.push({
      text: `The ${possessive(clubName)} first ${noun} ${since(kind, prevClub)}.`,
      personId: null, side, kind: 'lastTimeClub', dedupeKey: key('club'),
      score: clampScore(SCORE_BASE.lastTimeClub + magnitudeOf(t.date.slice(0, 4) - gapStart(kind, prevClub), CLUB_GAP_FULL)),
    })
  }

  const people = kind === 'cycles' ? [feat.player] : kind === 'nohitters' ? feat.pitchers ?? [] : []
  for (const p of people) {
    const mine = rows.filter((r) => (kind === 'cycles' ? r.player?.id === p?.id : (r.pitchers ?? []).some((x) => x.id === p?.id)))
    if (!p || !mine.length) continue
    const n = mine.length + 1
    notes.push({
      text: `His ${wordOf(n)} ${noun}; the ${n === 2 ? 'first' : 'last'} was ${dateText(mine[0].officialDate)}.`,
      personId: p.id, side, kind: 'lastTimePlayer', dedupeKey: `lastTime-player-${kind}-${p.id}-${atBatIndex ?? 'game'}`,
      score: clampScore(SCORE_BASE.lastTimePlayer + magnitudeOf(t.date.slice(0, 4) - yearOf(mine[0].officialDate), CLUB_GAP_FULL)),
    })
  }

  const gap = daysBetween(rows[0].officialDate, t.date)
  if (gap >= LEAGUE_GAP_DAYS) {
    notes.push({
      text: `The first ${noun} in the majors ${since(kind, rows[0])}.`,
      personId: null, side, kind: 'lastTimeLeague', dedupeKey: key('league'),
      score: clampScore(SCORE_BASE.lastTimeLeague + magnitudeOf(gap, LEAGUE_GAP_FULL)),
    })
  }
  return notes
}

// --- what happened on a play, or in a game -------------------------------------------------
const HITS = ['single', 'double', 'triple', 'home_run']

// The feat a revealed play completes, from the feed's own plays: a triple play, or the hit that
// finishes the batter's cycle. null otherwise. `battingSide` is the side at bat in this half.
export function detectPlayFeat(feed, atBatIndex, battingSide) {
  const plays = orderedPlays(feed?.liveData?.plays)
  const i = plays.findIndex((p) => p.about?.atBatIndex === atBatIndex)
  if (i < 0 || !battingSide) return null
  const play = plays[i]
  if (/triple_play/.test(play.result?.eventType ?? '') || /triple play/i.test(play.result?.description ?? '')) {
    return { kind: 'tripleplays', side: otherSide(battingSide) }
  }
  const batter = play.matchup?.batter
  if (!HITS.includes(play.result?.eventType) || !batter?.id) return null
  const seen = new Set(plays.slice(0, i + 1).filter((p) => p.matchup?.batter?.id === batter.id).map((p) => p.result?.eventType))
  const wasFour = plays.slice(0, i).filter((p) => p.matchup?.batter?.id === batter.id).map((p) => p.result?.eventType)
  const done = (s) => HITS.every((h) => s.has(h))
  return done(seen) && !done(new Set(wasFour)) ? { kind: 'cycles', side: battingSide, player: { id: batter.id, name: batter.fullName ?? '' } } : null
}

// The no-hitters in a Final game: a club whose opponent had no hits. Reveal-only, as the roll-up is.
export function detectNoHitters(feed) {
  if (!gameResult(feed).final) return []
  const box = feed.liveData?.boxscore?.teams
  return ['away', 'home'].flatMap((side) => {
    const hits = box?.[otherSide(side)]?.teamStats?.batting?.hits
    if (hits !== 0) return []
    const pitchers = (box[side]?.pitchers ?? []).map((id) => ({ id, name: box[side].players?.[`ID${id}`]?.person?.fullName ?? '' }))
    return [{ kind: 'nohitters', side, pitchers }]
  })
}
