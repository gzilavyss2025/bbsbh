// Diagnose how much the ordering-heuristic disagreements actually matter:
// which levels they involve, how many unique players are touched, and how
// much the headline percentiles shift if disputed players are dropped
// entirely versus kept under the ascending-rank assumption.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const f = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))

const disagree = f.validation.disagree
const involvesAAA = disagree.filter((d) => d.sportIds.includes(11)).length
console.log(`disagreements involving AAA(11): ${involvesAAA}/${disagree.length} (${(involvesAAA / disagree.length * 100).toFixed(0)}%)`)
const onlyLowLevels = disagree.filter((d) => !d.sportIds.includes(11) && !d.sportIds.includes(12)).length
console.log(`disagreements among A/High-A only (no AA/AAA): ${onlyLowLevels}/${disagree.length}`)

const uniquePlayers = new Set(disagree.map((d) => d.playerId))
console.log(`unique players with >=1 disputed season: ${uniquePlayers.size} / 881 cohort (${(uniquePlayers.size / 881 * 100).toFixed(0)}%)`)

// which level PAIRS are in dispute
const pairCounts = {}
for (const d of disagree) {
  const key = [...d.sportIds].sort().join('-')
  pairCounts[key] = (pairCounts[key] || 0) + 1
}
console.log('disputed level-set breakdown:', JSON.stringify(pairCounts))
