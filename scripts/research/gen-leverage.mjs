// Builds public/data/leverage-index.json (#3141): the Leverage Index of each game state,
// read by /research (src/api/research/winprob.js has the state and the method). Savant's
// pitch CSV has no LI, so this reads every day of the given seasons, sums each PA's
// delta_home_win_exp, and takes a state's mean |WPA| over the league's.
//
// HAND-RUN, not nightly: LI by state barely moves season to season. Rerun after a rule
// change (the extra-inning runner, the pitch clock).
//
//   node scripts/research/gen-leverage.mjs --seasons=2024,2025

import { writeFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs, strOpt } from '../lib/args.mjs'
import { withRetry } from '../lib/net/retry.mjs'
import { csvObjects } from '../lib/savant.mjs'
import { monthDays, savantDayUrl, seasonMonths } from '../lib/research/store.mjs'
import { baseballToday } from '../../src/lib/time/standingsDates.js'
import { decodePlateAppearances, encodeMonth } from '../../src/api/research/shard.js'
import { buildLeverage } from '../../src/api/research/winprob.js'

const args = parseArgs(process.argv.slice(2))
const seasons = (strOpt(args, 'seasons') ?? '2024,2025').split(',').map(Number)
const out = strOpt(args, 'out') ?? 'public/data/leverage-index.json'
const today = baseballToday()

const pas = []
for (const season of seasons) {
  for (const month of seasonMonths(season, today)) {
    for (const day of monthDays(season, month, today)) {
      const text = await withRetry(async () => {
        const res = await fetch(savantDayUrl(day), { signal: AbortSignal.timeout(60_000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      }, { label: `savant ${day}` })
      // Regular season only: the table is the league's, not October's.
      const rows = csvObjects(text).filter((r) => r.game_type === 'R')
      if (!rows.length) continue
      const swing = new Map()
      for (const r of rows) {
        const k = `${r.game_pk}-${r.at_bat_number}`
        swing.set(k, (swing.get(k) ?? 0) + (Number(r.delta_home_win_exp) || 0))
      }
      for (const pa of decodePlateAppearances(encodeMonth(rows, { season, month }))) {
        pas.push({ inning: pa.inning, top: pa.top, outs: pa.outs, runners: pa.runners, margin: pa.margin, swing: Math.abs(swing.get(pa.key) ?? 0) })
      }
      console.log(`${day}: ${pas.length} PAs so far`)
      await sleep(400)
    }
  }
}

const table = buildLeverage(pas)
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), seasons, ...table }) + '\n')
console.log(`${out}: ${Object.keys(table.states).length} states, ${Object.keys(table.coarse).length} coarse, from ${table.pas} PAs`)
