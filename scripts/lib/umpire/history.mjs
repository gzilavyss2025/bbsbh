// The pure half of scripts/gen-umpire-history.mjs (issue 1565): umpire history for
// the seasons before Tally's own umpire files (public/data/umpires/, from 2023).
//
// THE SOURCE is the Stats API schedule with officials, one call a season, the same
// call gen-umpires.mjs makes. Measured 2026-10-20: a home-plate umpire is listed for
// 98.6% of 2000's Final games and for every game from 2001 on, but for only 61-88%
// of games in 1990-1999. So the store starts at 2000. Retrosheet was the first plan;
// its umpire ids bridge to MLBAM ids for only 49-77% of 1990s umpire-games, so it
// does not fill those seasons either.
//
// THE FILTER is gen-umpires.mjs's: Final games only, and a game listed twice (a
// postponed game, under its first date too) counts once, under its officialDate.
// The All-Star Game is left out: its sides are not clubs.
//
// THE RECORD is each club's wins and losses in the games this umpire worked at home
// plate. A tie (a game called and never resumed) counts as a game worked, in no record.
//
// Ids are numbers. No clock: the same input writes the same bytes.
import { shardKey100 } from '../../../src/lib/shardKey.js'

// The column order of a season row: [season, HP, 1B, 2B, 3B, LF, RF].
const ROLES = ['Home Plate', 'First Base', 'Second Base', 'Third Base', 'Left Field', 'Right Field']

// schedules: [{ season, dates }], each the body of
// /api/v1/schedule?sportId=1&season={Y}&gameType=R,F,D,L,W&hydrate=officials
// -> { umpires: Map(id -> { name, seasons: [[season, ...counts]], record: { teamId: [w, l] } }), report }
export function buildUmpireHistory(schedules) {
  const umpires = new Map()
  let games = 0
  let noOfficials = 0
  for (const { season, dates } of schedules) {
    for (const d of dates ?? []) {
      for (const g of d.games ?? []) {
        if (g.status?.abstractGameState !== 'Final' || d.date !== g.officialDate || g.gameType === 'A') continue
        const officials = g.officials ?? []
        if (!officials.length) {
          noOfficials++
          continue
        }
        games++
        for (const o of officials) {
          const at = ROLES.indexOf(o.officialType)
          const id = o.official?.id
          if (at < 0 || !id) continue
          if (!umpires.has(id)) umpires.set(id, { name: o.official.fullName ?? '', bySeason: new Map(), record: {} })
          const u = umpires.get(id)
          if (!u.bySeason.has(season)) u.bySeason.set(season, [season, 0, 0, 0, 0, 0, 0])
          u.bySeason.get(season)[at + 1]++
          const sides = [g.teams?.away, g.teams?.home]
          if (at !== 0 || !sides.some((s) => s?.isWinner)) continue
          for (const side of sides) {
            if (side?.team?.id) (u.record[side.team.id] ??= [0, 0])[side.isWinner ? 0 : 1]++
          }
        }
      }
    }
  }
  for (const u of umpires.values()) {
    u.seasons = [...u.bySeason.values()].sort((a, b) => a[0] - b[0])
    delete u.bySeason
  }
  const report = { seasons: schedules.map((s) => s.season), games, noOfficials, umpires: umpires.size }
  return { umpires, report }
}

// -> Map(shardKey -> { firstSeason, throughSeason, umpires: { id: { name, seasons, record } } })
export function shardUmpireHistory(umpires, { firstSeason, throughSeason }) {
  const shards = new Map()
  for (const id of [...umpires.keys()].sort((a, b) => a - b)) {
    const key = shardKey100(id)
    if (!shards.has(key)) shards.set(key, { firstSeason, throughSeason, umpires: {} })
    shards.get(key).umpires[id] = umpires.get(id)
  }
  return shards
}
