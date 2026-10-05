import { pitchFamily, pitchLabel } from '../../../api/pitchArsenal.js'
import { totalsOf } from '../../../api/scout/headToHead.js'

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

export const ordinal = (n) => {
  if (n == null) return ''
  const t = n % 100
  const s = t >= 11 && t <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')
  return `${n}${s}`
}

// A pitch's full name: the board's pill name, else pitchLabel's.
export const nameOf = (code, board) => board?.types.find((t) => t.code === code)?.name ?? (code ? pitchLabel(code) : 'Pitch')

// The play's text with the batter's name taken off the front: "grounds out,
// shortstop Jose Iglesias to first baseman Luis Arraez."
export function playText(description, hitterName) {
  const d = (description ?? '').trim()
  if (hitterName && d.startsWith(hitterName)) return d.slice(hitterName.length).trim()
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
  // `shade` tells two pitches of one family apart (a fastball and a cutter
  // share the family's green): 0 for the first, 1 for the next, and so on.
  const families = new Map()
  return codes.map((code) => {
    const family = pitchFamily(code)
    const shade = families.get(family) ?? 0
    families.set(family, shade + 1)
    return {
      code,
      name: nameOf(code, board),
      family,
      shade,
      meet: total ? Math.round(((seen.get(code) ?? 0) / total) * 100) : 0,
      season: all && board.byType[code] ? Math.round((board.byType[code].n / all) * 100) : 0,
    }
  })
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
    .map((list) => ({ gamePk: list[0].gamePk, date: list[0].date, round: list[0].round, pas: [...list].sort((a, b) => a.atBat - b.atBat) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.gamePk - a.gamePk)
}

// Every pitch in the list, in the order the list draws them: what the pitch
// modal's Prev / Next walk ("8 of 12" counts this list, never a game).
export function pitchWalk(games) {
  return games.flatMap((g) => g.pas.flatMap((pa) => (pa.pitchList ?? []).map((p, i) => ({ pa, pitch: p, k: i + 1, of: pa.pitchList.length }))))
}
