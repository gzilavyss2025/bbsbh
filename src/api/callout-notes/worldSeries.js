// The World Series' own "entering" notes (kind wsSeriesOdds): what the Series
// stood at heading into tonight, and how that has gone before. Entering-tense and
// spoiler-free (ADR-0014): the state comes from bundle.series, which holds only
// games that went Final before tonight's date, and the history is cut strictly
// before tonight by lib/worldSeries (ADR-0087). Nothing here reads tonight's score.
import { seriesBlockFor } from '../callouts.js'
import { seriesOdds, clubFacts } from '../../lib/worldSeries/odds.js'
import { ordinal } from '../../lib/format.js'
import { SCORE_BASE, clampScore, skewBonus, magnitudeOf } from './shared.js'

// A club that has not played in this many seasons gets the drought note.
export const WS_DROUGHT_SEASONS = 20
// Gap, in seasons, that earns the full magnitude bonus.
const GAP_FULL = 25

const times = (n) => `${n} ${n === 1 ? 'time' : 'times'}`

function note(family, text, bonus = 0, side = null) {
  return {
    text, personId: null, side, kind: 'wsSeriesOdds',
    dedupeKey: `wsSeriesOdds-${family}`,
    score: clampScore(SCORE_BASE.wsSeriesOdds + bonus),
  }
}

// Wins by club id from the games the block holds. A tie counts for nobody.
function winsFrom(games) {
  const wins = {}
  for (const g of games) {
    const { away, home } = g.runs ?? {}
    if (away == null || home == null || away === home) continue
    const w = home > away ? g.homeId : g.awayId
    wins[w] = (wins[w] ?? 0) + 1
  }
  return wins
}

export function buildWorldSeriesOddsNotes({ history, bundle, gameDate, gameType }) {
  const block = seriesBlockFor(bundle)
  if (gameType !== 'W' || !history || !block || !gameDate) return []
  const games = block.games ?? []
  const odds = seriesOdds(history, gameDate)
  const wn = odds.winsNeeded
  const counts = Object.values(winsFrom(games)).sort((a, b) => b - a)
  const [lead = 0, trail = 0] = counts
  const out = []

  if (games.length === 0) {
    const [a, h] = [bundle.away, bundle.home]
    if (!a?.teamId || !h?.teamId) return []
    const nameOf = (id) => [a, h].find((t) => t.teamId === id)?.name ?? null
    const f = clubFacts(history, gameDate, a.teamId, h.teamId)
    const season = Number(gameDate.slice(0, 4))
    const champ = [a, h].find((t) => t.teamId === f.champion)
    if (champ?.name) out.push(note('repeat', `The ${champ.name} won the ${season - 1} World Series.`, 0, champ === a ? 'away' : 'home'))
    out.push(f.lastMeeting == null
      ? note('meeting', `This is the first World Series meeting between the ${a.name} and the ${h.name}.`, magnitudeOf(1, 1))
      : note('meeting', `The ${a.name} and the ${h.name} last met in the World Series in ${f.lastMeeting}${nameOf(f.meetingWinner) ? `; the ${nameOf(f.meetingWinner)} won` : ''}.`, magnitudeOf(season - f.lastMeeting, GAP_FULL)))
    for (const [side, t] of [['away', a], ['home', h]]) {
      const gap = f.lastSeen[t.teamId] == null ? 0 : season - f.lastSeen[t.teamId]
      if (gap >= WS_DROUGHT_SEASONS) {
        out.push(note(`drought-${side}`, `The ${t.name} last played in the World Series in ${f.lastSeen[t.teamId]}${f.lastOpponentName[t.teamId] ? `, against the ${f.lastOpponentName[t.teamId]}` : ''}.`, magnitudeOf(gap, GAP_FULL), side))
      }
    }
    return out
  }

  if (games.length === 1 && lead === 1) {
    const { w, l } = odds.game1
    out.push(note('game1', `Game 1 winners are ${w}-${l} in the World Series.`, skewBonus(w, l)))
  }
  if (games.length === 2 && lead === 2 && trail === 0) {
    const { w, l } = odds.lead20
    out.push(note('lead20', `Teams that lead 2-0 are ${w}-${l} in the World Series.`, skewBonus(w, l)))
  }
  if (wn != null && lead === wn - 1 && trail === wn - 3) {
    const { w, l, last, lastName } = odds.trail31
    const lastText = last == null ? '' : lastName ? ` The last was the ${last} ${lastName}.` : ` The last was in ${last}.`
    out.push(note('trail31', `Teams that trailed ${wn - 1}-${wn - 3} have won the World Series ${times(w)} in ${w + l}.${lastText}`, skewBonus(w, l)))
  }
  if (wn != null && lead === wn - 1 && trail === wn - 1) {
    const { home, roadStreak } = odds.wta
    const streak = roadStreak >= 2 ? ` The road club has won the last ${roadStreak}.` : ''
    out.push(note('wta', `In winner-take-all World Series games the home club is ${home.w}-${home.l}.${streak}`, skewBonus(home.w, home.l)))
  }
  return out
}

// A starter's World Series start count, entering tonight (kind wsStarterStart).
// `starts[pid]` is his EARLIER starts, from api/postseason/pitcherWorldSeries.js,
// which ends the day before the game (ADR-0088): a pregame fact, no score.
const WS_START_MILESTONES = [5, 10]

export function buildWorldSeriesStarterNote({ starts, pid, side, gameType }) {
  const earlier = starts?.[pid]
  if (gameType !== 'W' || pid == null || earlier == null) return null
  const n = earlier + 1
  if (earlier !== 0 && !WS_START_MILESTONES.includes(n)) return null
  return {
    text: `His ${n === 1 ? 'first' : ordinal(n)} World Series start.`,
    personId: pid, side, kind: 'wsStarterStart',
    dedupeKey: `wsStarterStart-${pid}`,
    score: SCORE_BASE.wsStarterStart,
  }
}
