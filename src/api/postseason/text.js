// The words the slate cards and the series page print about a series (#1224,
// slice 3). Pure, and they read only a series from ./bracket.js, so they
// inherit its rule: the state HEADING INTO the cutoff date. A game on the
// slate never changes its own card. The wording is neutral to both clubs:
//   "Game 1"           no result yet
//   "CHC leads 1–0"    the leader first, by abbreviation, en dash
//   "Series tied 1–1"  level, and neither club is one win from the series
//   "Winner take all"  each club one win from the series (1–1 of 3, 2–2 of 5, 3–3 of 7)
//   "TOR won 3–1"      decided (no card shows this: a decided series plays no game)
//
// The heading title (slice 4, Gary's copy decision 2026-09-28) drops the word
// "Series" from every round but the World Series itself: "Game 2 · NL Wild
// Card", "Game 3 · ALDS", "Game 5 · NLCS", "Game 1 · World Series".

import { seriesForGame } from './bracket.js'
import { seriesMark } from '../../lib/postseason/seriesMarks.js'
import { teamClubNameShort } from '../../lib/teams.js'

export function recordLine(series) {
  if (!series) return ''
  const [a, b] = series.slots
  const hi = Math.max(a.wins, b.wins)
  const lo = Math.min(a.wins, b.wins)
  const leader = a.wins >= b.wins ? a.club : b.club
  if (series.decided) return `${series.winner.abbreviation} won ${hi}–${lo}`
  if (series.gamesPlayed === 0) return 'Game 1'
  if (a.wins === series.winsNeeded - 1 && b.wins === series.winsNeeded - 1) return 'Winner take all'
  if (a.wins === b.wins) return `Series tied ${hi}–${lo}`
  return `${leader?.abbreviation ?? ''} leads ${hi}–${lo}`
}

// "NL Wild Card", "ALDS", "NLCS", "World Series" — Gary's copy decision
// (2026-09-28): every round but the World Series drops the word "Series".
function roundTitle(series) {
  if (series.round === 'worldseries') return 'World Series'
  if (series.round === 'wildcard') return `${series.league} Wild Card`
  if (series.round === 'division') return `${series.league}DS`
  return `${series.league}CS`
}

// "Game 2 · NL Wild Card"
export function seriesLine(series, gameNumber) {
  if (!series || !gameNumber) return ''
  return `Game ${gameNumber} · ${roundTitle(series)}`
}

// The line under a game's own series mark: the game's number and the series
// as it stood heading into it, by club NICKNAME (the mark already names the
// round, and the lineup page has room to spell a club out):
//   "Game 1 · Series Tied, 0–0"   "Game 2 · Braves Lead 1–0"
// Same footing as recordLine: wins counted before the cutoff, never this game.
// Empty for a decided series, which plays no game to head into.
export function gameStatusLine(series, gameNumber) {
  if (!series || !gameNumber || series.decided) return ''
  const [a, b] = series.slots
  const hi = Math.max(a.wins, b.wins)
  const lo = Math.min(a.wins, b.wins)
  if (a.wins === b.wins) return `Game ${gameNumber} · Series Tied, ${hi}–${lo}`
  const leader = a.wins > b.wins ? a.club : b.club
  const name = leader ? teamClubNameShort(leader.id) : ''
  return `Game ${gameNumber} · ${name} Lead ${hi}–${lo}`.replace('  ', ' ')
}

// "Best of 3" — the series' length, for the live page's banner before any
// game has a result to head the page with.
export function bestOfLine(series) {
  return series?.bestOf ? `Best of ${series.bestOf}` : ''
}

// Both lines for one slate game row (anything with a `gamePk`), or null when
// the game is not in this bracket (a regular-season game) or there is no
// bracket yet. `mark` is the series' art ({ src, alt }), or null for a season
// with none on file (lib/postseason/seriesMarks.js). A card that draws the
// mark prints `gameLine` ("Game 2") beside it in place of `seriesLine`, since
// the mark already names the round.
export function cardLines(game, bracket) {
  const hit = seriesForGame(bracket, game?.gamePk)
  if (!hit) return null
  return {
    seriesLine: seriesLine(hit.series, hit.gameNumber),
    gameLine: `Game ${hit.gameNumber}`,
    recordLine: recordLine(hit.series),
    mark: seriesMark({ season: bracket.season, round: hit.series.round, league: hit.series.league }),
  }
}
