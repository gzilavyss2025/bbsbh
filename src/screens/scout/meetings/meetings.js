import { pitchLabel } from '../../../api/pitchArsenal.js'
import { totalsOf } from '../../../api/scout/headToHead.js'
import { ordinal as withSuffix } from '../../../lib/format.js'
import { resultShort } from '../../../lib/scout/format.js'

// THE MEETINGS TAB, PURE (#1490): every past meeting pitch by pitch, from the
// head-to-head's `pitchList` (api/scout/headToHead.js). test/scout-meetings
// .test.js pins it. Nothing here fetches.
//
// NO PITCH CODE REACHES THE PAGE. A name is the pitcher board's pill name when
// he still throws that pitch, else pitchLabel's full name ("Fastball", never
// "FF").

// Savant `description` -> the call in words, and the tone it is drawn in.
const CALLS = {
  called_strike: ['Called strike', 'strike'],
  swinging_strike: ['Swinging strike', 'strike'],
  swinging_strike_blocked: ['Swinging strike', 'strike'],
  foul_tip: ['Foul tip', 'strike'],
  missed_bunt: ['Missed bunt', 'strike'],
  foul: ['Foul', 'foul'],
  foul_bunt: ['Foul bunt', 'foul'],
  bunt_foul_tip: ['Foul bunt', 'foul'],
  ball: ['Ball', 'ball'],
  blocked_ball: ['Ball', 'ball'],
  pitchout: ['Pitchout', 'ball'],
  hit_by_pitch: ['Hit by pitch', 'ball'],
  hit_into_play: ['In play', 'play'],
}
const words = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '') // caps-js-exempt: a Savant key into words
export const callOf = (call) => {
  const [word, tone] = CALLS[call] ?? [words(call), 'foul']
  return { word, tone }
}

export const meetingOrdinal = (n) => (n == null ? '' : withSuffix(n))

// A pitch's full name: the board's pill name, else pitchLabel's.
export const nameOf = (code, board) => board?.types.find((t) => t.code === code)?.name ?? (code ? pitchLabel(code) : 'Pitch')

// The play's text with the batter's full name cut down to his last name:
// "Arraez grounds out, shortstop Jose Iglesias to first baseman Luis Arraez."
// A line that does not open with his name ("Wild pitch.") stays as it is.
export function playText(description, hitterName, hitterLast) {
  const d = (description ?? '').trim()
  if (hitterName && d.startsWith(hitterName)) return `${hitterLast || ''} ${d.slice(hitterName.length).trim()}`.trim()
  return d
}

export const inPlay = (p) => p.call === 'hit_into_play' && p.launchSpeed != null
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)

// The facts row: "{h}-for-{ab}" with its PA, the pitches, and on the balls in
// play the average exit velocity and xwOBA on contact (null with none).
export function meetingFacts(pas) {
  const t = totalsOf(pas)
  const pitches = pas.flatMap((pa) => pa.pitchList ?? [])
  const bip = pitches.filter(inPlay)
  return {
    h: t.h,
    ab: t.ab,
    pa: t.pa,
    pitches: pitches.length,
    avgExit: mean(bip.map((p) => p.launchSpeed)),
    xwobaContact: mean(bip.filter((p) => p.xwoba != null).map((p) => p.xwoba)),
  }
}

// THE MIX COMPARISON: the share of each pitch type in the meetings against
// the pitcher's season share to this stance (board.byType[c].n / board.all.n).
// One row per type in either, season order first. Shares are whole percents.
export function mixRows(pas, board) {
  const seen = new Map()
  for (const p of pas.flatMap((pa) => pa.pitchList ?? [])) if (p.code) seen.set(p.code, (seen.get(p.code) ?? 0) + 1)
  const total = [...seen.values()].reduce((a, b) => a + b, 0)
  const all = board?.all?.n ?? 0
  const codes = [...new Set([...(board?.types ?? []).map((t) => t.code), ...[...seen.keys()].sort((a, b) => seen.get(b) - seen.get(a))])]
  // The page draws each row's colour and shape from pitchMark(code), like the Pitches section.
  return codes.map((code) => ({
    code,
    name: nameOf(code, board),
    meet: total ? Math.round(((seen.get(code) ?? 0) / total) * 100) : 0,
    season: all && board.byType[code] ? Math.round((board.byType[code].n / all) * 100) : 0,
  }))
}

// The note under the bars: each pitch he throws this season that the hitter
// never saw in the meetings. `years` the distinct meeting years.
export function unseenNote(rows, names, crowd, years) {
  const fresh = rows.filter((r) => r.meet === 0 && r.season > 0)
  if (!fresh.length) return null
  const when = years.length === 1 ? `in ${years[0]}` : 'in their meetings'
  return fresh
    .map((r) => {
      const plural = `${r.name.charAt(0).toLowerCase()}${r.name.slice(1)}s` // caps-js-exempt: a pitch name inside a sentence
      return `${names.hitter} saw no ${plural} ${when}. ${names.pitcher} now throws it ${r.season}% of the time to ${crowd}.`
    })
    .join(' ')
}

// The list, grouped: games newest first, and inside a game the plate
// appearances in the order they happened, so a game reads top to bottom.
export function gamesOf(pas) {
  const by = new Map()
  for (const pa of pas) by.set(pa.gamePk, [...(by.get(pa.gamePk) ?? []), pa])
  return [...by.values()]
    .map((list) => ({ gamePk: list[0].gamePk, date: list[0].date, tag: list[0].roundTag ?? '', label: list[0].roundLabel ?? '', pas: [...list].sort((a, b) => a.atBat - b.atBat) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.gamePk - a.gamePk)
}

// Every pitch in the list, in the order the list draws them: what the pitch
// modal's Prev / Next walk ("8 of 12" counts this list, never a game).
export function pitchWalk(games) {
  return games.flatMap((g) => g.pas.flatMap((pa) => (pa.pitchList ?? []).map((p, i) => ({ pa, pitch: p, k: i + 1, of: pa.pitchList.length }))))
}

// THE SCOREBOOK CELL (#2319, V05). The mark in the diamond is the fielders the play text names,
// in order ("shortstop X to first baseman Y" is 6-3), read from the first sentence only: a second
// sentence ("Throwing error by shortstop X.") is another play. Savant's CSV has no fielder list
// for the batter's own out, so the text is the source. A play that names no fielder, or a result
// with no fielder's mark (a hit, a walk, a strikeout), shows resultShort's code instead.
const POSITIONS = {
  pitcher: 1, catcher: 2, 'first baseman': 3, 'second baseman': 4, 'third baseman': 5,
  shortstop: 6, 'left fielder': 7, 'center fielder': 8, 'right fielder': 9,
}
const POSITION_RE = new RegExp(`\\b(${Object.keys(POSITIONS).join('|')})\\b`, 'gi')
const FLIGHT = { fly_ball: 'F', line_drive: 'L', popup: 'P' }
const CHAINED = new Set(['field_out', 'grounded_into_double_play', 'double_play'])

export function scoringMark({ event, bbType, description }) {
  const code = resultShort({ event, bbType })
  const first = (description ?? '').split(/\.\s+(?=[A-Z])/)[0]
  const at = [...first.matchAll(POSITION_RE)].map((m) => POSITIONS[m[1].toLowerCase()])
  if (!at.length) return code
  if (event === 'field_error') return `E${at[0]}`
  if (event === 'sac_fly') return `SF${at[0]}`
  if (event === 'force_out' || event?.startsWith('fielders_choice')) return 'FC'
  if (!CHAINED.has(event)) return code
  if (FLIGHT[bbType]) return `${FLIGHT[bbType]}${at[0]}`
  return at.length === 1 ? `${at[0]}U` : at.join('-')
}

// The result in words, for the cell's caption: "Groundout", "Single", "Strikeout".
const RESULTS = {
  strikeout: 'Strikeout', strikeout_double_play: 'Strikeout', walk: 'Walk', intent_walk: 'Intentional walk', hit_by_pitch: 'Hit by pitch',
  single: 'Single', double: 'Double', triple: 'Triple', home_run: 'Home run', sac_fly: 'Sac fly', sac_bunt: 'Sac bunt',
  field_error: 'Error', grounded_into_double_play: 'Double play', double_play: 'Double play', force_out: 'Force out',
  fielders_choice: 'Fielder’s choice', fielders_choice_out: 'Fielder’s choice',
}
const OUTS = { ground_ball: 'Groundout', fly_ball: 'Flyout', line_drive: 'Lineout', popup: 'Popout' }
export const resultWord = ({ event, bbType }) => RESULTS[event] ?? OUTS[bbType] ?? 'Out'
