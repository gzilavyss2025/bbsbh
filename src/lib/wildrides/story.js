// WILD RIDES: the game as a beat writer reads it. Pure functions over a ride (ride.js):
// the story numbers (runs down, leads blown, ties, lead changes), the one-line headline,
// and the summary the generator keeps for each game. Copy rules: past tense in headlines,
// present tense on a play; club nicknames, never abbreviations, in a sentence.
import { teamAbbr } from '../teams.js'
import { teamClubName } from '../teams/names.js'
import { decodeState } from './ride.js'

export const abbr = (id) => teamAbbr({ id })
export const club = (id) => teamClubName(id) ?? abbr(id)
export const ord = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`
export const lastName = (n) => (n ?? '').split(' ').filter((w) => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w)).slice(-1)[0] ?? ''

// Where the score stood after a beat: "CWS leads 9–8", "Tied 7–7", "Walk-off".
export function consequence(b, game) {
  const [a, h] = b.score
  if (b.walkoff) return 'Walk-off'
  if (a === h) return `Tied ${a}–${h}`
  return `${abbr(a > h ? game.away : game.home)} leads ${Math.max(a, h)}–${Math.min(a, h)}`
}

// What decided it, said from the side that gained: a hitter's hit, or a pitcher's out.
function decidedBy(b) {
  if (b.to >= b.from || b.type === 'strikeout') return b.title
  const p = lastName(b.pitcher.name)
  const h = lastName(b.batter.name)
  if (/double_play/.test(b.type)) return `${p} got a double play from ${h}`
  return `${p} retired ${h}`
}

// A beat's title is present tense ("Realmuto doubles"); a headline tells it after the fact.
const PAST = [
  [/\bstrikes out\b/, 'struck out'], [/\bis (walked|hit|out|forced)\b/, 'was $1'], [/\bhits\b/, 'hit'],
  [/\b(single|double|triple|score)s\b/, '$1d'],
  [/\bflies\b/, 'flied'], [/\blines\b/, 'lined'], [/\bpops\b/, 'popped'],
  [/\b(homer|walk|bunt|reach|ground)(e?)s\b/, '$1ed'],
]
export const past = (t) => PAST.reduce((x, [re, to]) => x.replace(re, to), t)

const list3 = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

// Runs, not percentages: the winner's biggest deficit, the loser's biggest lead in the
// 8th or later (built there or carried in), ties, lead changes, and the innings where the
// trailing winner answered. Lead changes are counted here and nowhere else.
export function storyOf(g) {
  const lead = (a, h) => (g.homeWon ? h - a : a - h) // the winner's lead; negative = trailing
  let prev = 0
  let lastLeader = 0
  let leadChanges = 0
  let ties = 0
  let maxDeficit = 0
  let deficitInning = null
  let lateDeficit = 0
  let lateInning = null
  const answers = []
  for (const [inning, top, a, h] of g.scoring ?? []) {
    const l = lead(a, h)
    if (l < 0 && -l > maxDeficit) { maxDeficit = -l; deficitInning = inning }
    if (prev < 0 && l >= 0 && (top ? !g.homeWon : g.homeWon)) answers.push(inning)
    if (l === 0 && prev !== 0) ties++
    if (Math.sign(l) && lastLeader && Math.sign(l) !== lastLeader) leadChanges++
    if (Math.sign(l)) lastLeader = Math.sign(l)
    prev = l
  }
  for (const v of g.states ?? []) {
    const st = decodeState(v)
    const l = lead(st.away, st.home)
    if (st.inning >= 8 && l < 0 && -l > lateDeficit) { lateDeficit = -l; lateInning = st.inning }
  }
  return { maxDeficit, deficitInning, answers, leadChanges, ties, lateDeficit, lateInning }
}

// Odds-shaped facts about the line: the loser's best chance late (and its inning), and
// whether the winner's low point came before the last fifth (a comeback, not a late steal).
export function oddsOf(g) {
  const forLoser = (h) => (g.homeWon ? 100 - h : h)
  const lateFrom = Math.min(Math.floor(g.line.length * 0.8), Math.max(0, g.line.length - 2))
  const late = g.line.slice(lateFrom, -1).map(forLoser)
  const latePeak = Math.max(0, ...late)
  const peakAt = lateFrom + late.indexOf(latePeak)
  const latePeakInning = peakAt > 0 ? decodeState(g.states?.[peakAt - 1]).inning : 9
  const wl = g.line.map((h) => (g.homeWon ? h : 100 - h))
  const mid = wl.slice(1, -1)
  const trailedLong = mid.length > 0 && 1 + mid.indexOf(Math.min(...mid)) < g.line.length * 0.8
  return { latePeak, latePeakInning, trailedLong }
}

// The one-line story, written the way a gamer leads. First rule that fits wins.
export function headlineFor(g, st = storyOf(g), odds = oddsOf(g)) {
  const winner = g.homeWon ? g.home : g.away
  const W = club(winner)
  const L = club(g.homeWon ? g.away : g.home)
  const [hi, lo] = [Math.max(...g.score), Math.min(...g.score)]
  const decider = g.beats.find((b) => b.decider) ?? g.beats.at(-1)
  if (!decider) return `The ${W} won ${hi}–${lo}`
  const said = past(decidedBy(decider))
  const walkoff = g.beats.find((b) => b.walkoff)
  const extras = g.innings > 9 ? ` in the ${ord(g.innings)}` : ''
  const finish = walkoff ? `then ${lastName(walkoff.batter.name)} walked it off${extras}` : `then the ${W} won it${extras}`
  if (st.lateDeficit >= 3) return `The ${L} led by ${st.lateDeficit} in the ${ord(st.lateInning)} and lost${walkoff ? ` on ${lastName(walkoff.batter.name)}'s walk-off` : ''}`
  const late = st.answers.filter((i) => i >= 8)
  if (late.length >= 2) return `The ${W} came back in the ${list3(late.map(ord))}, ${finish}`
  if (st.maxDeficit >= 4) return `The ${W} were down ${st.maxDeficit} in the ${ord(st.deficitInning)} and won anyway${walkoff ? `, on ${lastName(walkoff.batter.name)}'s walk-off` : ''}`
  if (odds.latePeak >= 90) return `The ${L} were ${Math.min(99, odds.latePeak)}% to win in the ${ord(odds.latePeakInning)}, until ${said}`
  if (st.leadChanges >= 4) return `The lead changed hands ${st.leadChanges} times, ${finish}`
  if (walkoff) return `${past(walkoff.title)} to walk it off${extras}`
  if (st.ties + st.leadChanges >= 4) return `Tied ${st.ties} ${st.ties === 1 ? 'time' : 'times'}, ${st.leadChanges} lead ${st.leadChanges === 1 ? 'change' : 'changes'}, and the ${W} won ${hi}–${lo}${extras}`
  if (hi - lo >= 4) return `The ${W} won ${hi}–${lo}${extras ? ` in ${g.innings}` : ''}, but it was close until ${said}`
  return `The ${W} won ${hi}–${lo}${extras}, sealed when ${said}`
}

// What the generator keeps of a game: enough to rank it, list it and head it, no line.
export function summarize(ride) {
  const st = storyOf(ride)
  const odds = oddsOf(ride)
  return {
    gamePk: ride.gamePk,
    date: ride.date,
    venue: ride.venue,
    away: ride.away,
    home: ride.home,
    score: ride.score,
    homeWon: ride.homeWon,
    innings: ride.innings,
    swing: ride.swing,
    low: ride.low,
    maxDeficit: st.maxDeficit,
    deficitInning: st.deficitInning,
    lateDeficit: st.lateDeficit,
    lateInning: st.lateInning,
    leadChanges: st.leadChanges,
    ties: st.ties,
    latePeak: odds.latePeak,
    trailedLong: odds.trailedLong,
    headline: headlineFor(ride, st, odds),
  }
}

// The four lists, each ranked on its own number. Read by the generator (to cut each to
// its top games) and the page (for the tab's lead number).
export const LISTS = [
  { key: 'wild', sort: (a, b) => b.swing - a.swing },
  { key: 'comeback', sort: (a, b) => b.maxDeficit - a.maxDeficit || a.low - b.low },
  { key: 'collapse', sort: (a, b) => b.lateDeficit - a.lateDeficit || b.latePeak - a.latePeak },
  { key: 'seesaw', sort: (a, b) => b.leadChanges - a.leadChanges || b.swing - a.swing },
]
