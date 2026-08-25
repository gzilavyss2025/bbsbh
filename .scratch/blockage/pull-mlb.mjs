// Pull MLB season lines for the "job above the man" study.
// One call per season per group returns every player's season split, so the
// whole 2008-2024 MLB record costs ~51 requests.
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const SEASONS = []
for (let y = 2008; y <= 2024; y += 1) SEASONS.push(y)

const CACHE = 'mlb-cache.json'
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
    }
  }
}

function splitsOf(json) {
  return json?.stats?.[0]?.splits || []
}

for (const season of SEASONS) {
  for (const group of ['fielding', 'hitting', 'pitching']) {
    const key = `${season}:${group}`
    if (cache[key]) continue
    const url =
      `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}` +
      `&season=${season}&sportId=1&gameType=R&playerPool=All&limit=8000`
    const json = await get(url)
    const total = json?.stats?.[0]?.totalSplits
    const splits = splitsOf(json)
    const rows = splits.map((s) => {
      const st = s.stat || {}
      const base = {
        p: s.player?.id,
        t: s.team?.id,
      }
      if (group === 'fielding') {
        return {
          ...base,
          pos: s.position?.abbreviation,
          gs: st.gamesStarted ?? 0,
          g: st.games ?? st.gamesPlayed ?? 0,
          inn: Number(st.innings) || 0,
        }
      }
      if (group === 'hitting') {
        return {
          ...base,
          pa: st.plateAppearances ?? 0,
          ops: Number(st.ops) || 0,
          hr: st.homeRuns ?? 0,
          age: st.age ?? null,
        }
      }
      return {
        ...base,
        ip: Number(st.inningsPitched) || 0,
        era: st.era === '-.--' || st.era == null ? null : Number(st.era),
        whip: Number(st.whip) || 0,
        gs: st.gamesStarted ?? 0,
        g: st.gamesPlayed ?? 0,
        age: st.age ?? null,
      }
    })
    cache[key] = rows
    console.log(`${key}  splits=${splits.length}/${total}`)
    writeFileSync(CACHE, JSON.stringify(cache))
    await new Promise((r) => setTimeout(r, 250))
  }
}
console.log('done')
