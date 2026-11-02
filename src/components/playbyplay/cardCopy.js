import { ordinal } from '../../lib/format.js'

// THE WORDS OF A NOTIFICATION CARD (ADR-0113, slice 2). Pure, so `npm test` can pin
// them. The tab names the event; the club is a logo at the card's right end, never text.

export const TABS = {
  batting: 'Now batting',
  pitching: 'Now pitching',
  reminder: 'Pitching',
  pinchRun: 'Pinch running',
  departing: 'Departing',
  final: 'Final line for',
  moundVisit: 'Mound visit',
  ejection: 'Ejection',
}

// `position` is the lowercase phrase select.js and notificationCards.js build ("third base").
export const fielderTab = (position) => `Now playing${position ? ` ${position}` : ''}`

// The feed's name is "Last, First" (and "Acuña Jr., Ronald"); prose reads First Last.
export function firstLast(name) {
  const at = (name ?? '').indexOf(', ')
  return at < 0 ? name : `${name.slice(at + 2)} ${name.slice(0, at)}`
}

export const forLine = (replacedName, base) => `For ${firstLast(replacedName)}${base ? ` at ${ordinal(base)} base` : ''}`

// A delay's tab is its headline ("Injury delay", "Rain delay"); its one sentence is the man
// who left, or, with nobody, how long play stopped. `format` is formatDelay (screens/gameday/next/notices.js).
export const delayTab = (title) => title || 'Delay'
export function delaySentence({ detail, minutes }, format) {
  if (detail) return `${detail}.`
  return minutes != null ? `Play stopped for ${format(minutes)}.` : ''
}

// The mound visit's five pips: used = filled ink, open = card yellow. A visit that was the
// trip that pulled the pitcher is uncharged (remaining null): no pips, no tag.
export function moundPips({ remaining, allowed }) {
  if (remaining == null || allowed == null) return null
  const used = Math.max(0, allowed - remaining)
  return {
    used,
    total: allowed,
    tag: `${remaining} left`,
    label: `${used} of ${allowed} mound visits used, ${remaining} left`,
  }
}

// The club a PLAYER plays for in this game: his boxscore roster's side (liveData.boxscore.teams
// [side].players; gameData.players has no club) mapped to that side's team id. A manager or coach
// is in no roster (verified, gamePk 824381), so he gets null.
export function playerClubId(feed, playerId) {
  if (playerId == null) return null
  const box = feed?.liveData?.boxscore?.teams
  const side = ['away', 'home'].find((k) => box?.[k]?.players?.[`ID${playerId}`])
  return side ? (feed.gameData?.teams?.[side]?.id ?? null) : null
}

// The club of the man ejected: his roster's, else (a manager) the club the sentence leads with
// ("Athletics manager Mark Kotsay ejected by ..."). `clubs` is [{ id, name }]; none, no logo.
export function ejectedClub(text, clubs, feed = null, playerId = null) {
  const teamId = playerClubId(feed, playerId)
  return clubs.find((c) => c.id === teamId) ?? clubs.find((c) => c.name && (text ?? '').startsWith(c.name)) ?? null
}

// The real scorer's shorthand for a baserunning/misc event with no plate
// appearance of its own — the same abbreviation a scorer pencils on paper,
// (the half report's `codeOf`, GamedayEngine.jsx).
//
// A pickoff is PK, not PO, and the tags here must keep matching the two places
// in api/playbyplay.js that write the same event onto a diamond —
// runnerOutCode's out notation ("PK 1-3", "PKCS 1-3") and interruptedCode's carry-over
// mark ("PK →"). Two spellings for one event on the same page reads as two
// different events, and "PO" is doubly wrong here: it's already this app's
// mark for a POP OUT (loadScorecard.js's classifyOut), besides being the
// scorebook's own abbreviation for a putout.
export const EVENT_CODES = {
  stolen_base_2b: 'SB', stolen_base_3b: 'SB', stolen_base_home: 'SB',
  caught_stealing_2b: 'CS', caught_stealing_3b: 'CS', caught_stealing_home: 'CS',
  pickoff_1b: 'PK', pickoff_2b: 'PK', pickoff_3b: 'PK',
  pickoff_caught_stealing_2b: 'PKCS', pickoff_caught_stealing_3b: 'PKCS', pickoff_caught_stealing_home: 'PKCS',
  wild_pitch: 'WP', passed_ball: 'PB', balk: 'BK',
  // Not observed as a standalone top-level play in either sampled game (both
  // always nested inside a real plate appearance) — included for the same
  // reason every other NON_PA-adjacent code above is, so IF one ever does
  // surface on its own, it gets this card's real shorthand instead of
  // EventNote's generic fallback icon.
  runner_placed: 'RP', defensive_indiff: 'DI',
}
