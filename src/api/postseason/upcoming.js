// What the live series page knows about the games still to play: each one's
// park and its announced probable pitchers, plus those pitchers' throwing hand.
//
// SPOILER FOOTING. Nothing here is a result. The caller hands this module the
// gamePks of today's game and of the DATED upcoming ones, never an "if
// necessary" game, which has no gamePk (bracket.js, docs/api/postseason.md).
// Today's game is safe to name here only because of the field list below: it
// carries no state, score, winner, linescore, `seriesStatus` or `leagueRecord`
// (trap 1), so even a wrong pk could not bring one back. The page still never
// reads today's /boxscore or feed. test/postseason/upcoming-games.test.js pins
// the list.
//
// Field paths checked against live statsapi on 2026-10-01 (NLDS gamePks 849830,
// 849825, 849826): `venue.{id,name}`, `teams.{away,home}.probablePitcher.
// {id,fullName}` under `hydrate=probablePitcher,venue`. The schedule's
// probablePitcher carries NO throwing hand, so hand is one `/people` read:
// `people[].pitchHand.code`. A side with no announced probable simply has no
// probablePitcher key.

import { getJson } from '../statsapi.js'

const GAME_FIELDS =
  'dates,games,gamePk,officialDate,gameDate,venue,id,name,teams,away,home,team,id,probablePitcher,id,fullName'

export function upcomingUrl(gamePks) {
  return `/api/v1/schedule?gamePks=${gamePks.join(',')}&hydrate=probablePitcher,venue&fields=${GAME_FIELDS}`
}

export function handsUrl(personIds) {
  return `/api/v1/people?personIds=${personIds.join(',')}&fields=people,id,pitchHand,code`
}

const arm = (side) =>
  side?.probablePitcher?.id
    ? { id: side.probablePitcher.id, name: side.probablePitcher.fullName ?? '', hand: '' }
    : null

// The shaped read: { [gamePk]: { date, venue: { id, name }, away: arm|null, home: arm|null } }.
export function shapeUpcoming(data, hands = {}) {
  const out = {}
  for (const d of data?.dates ?? []) {
    for (const g of d.games ?? []) {
      const withHand = (a) => (a ? { ...a, hand: hands[a.id] ?? '' } : null)
      out[g.gamePk] = {
        date: g.officialDate ?? '',
        awayId: g.teams?.away?.team?.id ?? null,
        homeId: g.teams?.home?.team?.id ?? null,
        venue: { id: g.venue?.id ?? null, name: g.venue?.name ?? '' },
        away: withHand(arm(g.teams?.away)),
        home: withHand(arm(g.teams?.home)),
      }
    }
  }
  return out
}

// Degrades to {} on any failure: the page then draws its rows without a park or
// a pitcher line, never an error.
export async function fetchUpcomingSeriesGames(gamePks) {
  const list = [...new Set((gamePks ?? []).filter(Boolean))]
  if (!list.length) return {}
  try {
    const data = await getJson(upcomingUrl(list))
    const ids = [
      ...new Set(
        (data?.dates ?? []).flatMap((d) =>
          (d.games ?? []).flatMap((g) => [g.teams?.away?.probablePitcher?.id, g.teams?.home?.probablePitcher?.id]),
        ),
      ),
    ].filter(Boolean)
    let hands = {}
    if (ids.length) {
      try {
        const people = await getJson(handsUrl(ids))
        hands = Object.fromEntries((people?.people ?? []).map((p) => [p.id, p.pitchHand?.code ?? '']))
      } catch {
        // No hand is fine: the line just omits the RHP/LHP code.
      }
    }
    return shapeUpcoming(data, hands)
  } catch {
    return {}
  }
}
