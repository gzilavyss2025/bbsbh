// The prospect's position WHILE AT Triple-A. raw.json carries only hitting and
// pitching splits, and ped.posAbbr is the position he holds today - which a
// conversion would have already changed. Pull the fielding record instead.
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const CACHE = 'milb-field-cache.json'
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}

for (let season = 2008; season <= 2023; season += 1) {
  const key = `${season}:11`
  if (cache[key]) continue
  const url =
    `/api/v1/stats?stats=season&group=fielding` +
    `&season=${season}&sportId=11&gameType=R&playerPool=All&limit=9000`
  const json = await getJson(url)
  const total = json?.stats?.[0]?.totalSplits
  const splits = json?.stats?.[0]?.splits || []
  cache[key] = splits.map((s) => ({
    p: s.player?.id,
    t: s.team?.id,
    pos: s.position?.abbreviation,
    gs: s.stat?.gamesStarted ?? 0,
    g: s.stat?.games ?? s.stat?.gamesPlayed ?? 0,
  }))
  console.log(`${key}  splits=${splits.length}/${total}`)
  writeFileSync(CACHE, JSON.stringify(cache))
  await new Promise((r) => setTimeout(r, 250))
}
console.log('done')
