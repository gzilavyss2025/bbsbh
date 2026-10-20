// Hot and cold seasons (#1855): the player page's loader. Reads the league tails
// (`public/data/season-checkpoints/tails.json`, hand-run by gen-season-checkpoints.mjs)
// and the player's regular-season game log for each role, then runs rule.js.
//
// Spoiler-free on an open surface (ADR-0034). The cutoff the caller passes is what holds
// a game in progress back: rule.js counts only rows dated before it.
import { fetchPersonStats } from '../person-fetch.js'
import { staticJson, staticJsonBy } from '../staticJson.js'
import { FULL_SEASON } from './line.js'
import { hotColdFlags, mergeRoles, seasonsBeyond } from './rule.js'

const tailsFile = staticJson('/data/season-checkpoints/tails.json', { fallback: null })
const extremesFile = staticJsonBy((key) => `/data/season-checkpoints/extremes/${key}.json`, { fallback: null })

// { id, roles, season, sportId, cutoff } -> { flags, seasons }. `flags` is mergeRoles'
// list (at most two), each with `beyond`: the past seasons further out than his, from the
// flag's extremes file: the lines cut at his checkpoint, or from FULL_SEASON on the final
// lines of full seasons (null when that file fails; the card then says no number). `seasons` is the pooled span ([2017, …, 2026]) the hint counts.
// A MiLB player, a missing tails file or a failed read answers no flags.
export async function loadHotCold({ id, roles, season, sportId, cutoff }) {
  const none = { flags: [], seasons: [] }
  if (sportId !== 1 || !roles?.length) return none
  const tails = await tailsFile()
  if (!tails) return none
  const logs = await Promise.all(
    roles.map((role) => fetchPersonStats(id, { type: 'gameLog', group: role, season, gameType: 'R' })),
  )
  const byRole = Object.fromEntries(
    roles.map((role, i) => [role, hotColdFlags({ role, sportId, rows: logs[i], cutoff, tails })]),
  )
  const flags = await Promise.all(mergeRoles(byRole).map(async (f) => {
    const file = await extremesFile(`${f.role}-${f.checkpoint >= FULL_SEASON ? 'full' : f.checkpoint}`)
    return { ...f, beyond: file ? seasonsBeyond(f, file.stats, { id, season: Number(season) }) : null }
  }))
  return { flags, seasons: tails.seasons ?? [] }
}
