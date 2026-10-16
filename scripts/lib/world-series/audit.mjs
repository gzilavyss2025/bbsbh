// The World Series half of scripts/audit-callouts.mjs (`--world-series=2025`): build the bundle a
// World Series game would have had that night, and the history as it stood before that season.
// Hand-run only. Same builders as gen-callouts.mjs's nightly "series" and "wsEvents" blocks.
import { getJson } from '../statsapi.mjs'
import { mapConcurrent } from '../concurrency.mjs'
import { deriveBracket } from '../../../src/api/postseason/bracket.js'
import { resultRowsFrom, resultsUrl, skeletonRowsFrom, skeletonUrl } from '../../../src/api/postseason/fetch.js'
import { seriesBlock } from '../../../src/lib/postseason/primer/seriesBlock.js'
import { wsEventsBlock, wsCountedPks } from '../../../src/lib/postseason/primer/wsEventsBlock.js'
import { fetchPlays } from './plays.mjs'

// The two history files without the replayed season or later. The replayed Series itself reaches
// the builders the way it does live: through bundle.series and bundle.wsEvents, cut before the date.
export const historyBefore = (series, events, season) => ({
  seriesHistory: { ...series, series: series.series.filter((s) => s.season < season) },
  eventHistory: { ...events, events: events.events.filter((r) => r.season < season) },
})

export async function wsGames(season) {
  const sched = await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=W`)
  return (sched.dates ?? []).flatMap((d) => d.games ?? []).map((g) => ({ gamePk: g.gamePk, date: g.officialDate }))
}

// One game's bundle, heading into its own date. Throws if any counted game is not strictly earlier.
export async function wsBundle(season, { gamePk, date }, skel) {
  const bracket = deriveBracket(skeletonRowsFrom(skel), resultRowsFrom(await getJson(resultsUrl(season, date))), date)
  const pks = wsCountedPks(bracket, [gamePk])
  const dataByPk = {}
  await mapConcurrent(pks, 4, async (pk) => { dataByPk[pk] = { box: await getJson(`/api/v1/game/${pk}/boxscore`) } })
  const block = seriesBlock(bracket, gamePk, dataByPk)
  if (!block || block.games.some((g) => g.date >= date)) throw new Error(`${gamePk}: series block missing or not cut before ${date}`)
  const box = await getJson(`/api/v1/game/${gamePk}/boxscore`)
  const club = (s) => ({ teamId: box.teams[s].team.id, name: box.teams[s].team.name })
  return {
    sportId: 1, away: club('away'), home: club('home'), series: block,
    wsEvents: wsEventsBlock(bracket, gamePk, dataByPk, await fetchPlays(pks)) ?? undefined,
  }
}

export const wsSkeleton = (season) => getJson(skeletonUrl(String(season)))
