// Rebuilds the World Series fixtures beside this file from live statsapi, with
// the SAME URLs the schedule and play-by-play readers send, so a fixture can never
// ask for a field the app does not. Run by hand (it needs the network):
//
//   node test/fixtures/world-series/capture.mjs
//
// Each play-by-play is pruned with the `fields` parameter to what the classifier
// reads. The script fetches the full feed too, and stops if the pruned copy lost a
// play. The schedule files are the whole season, unpruned. README.md says what
// each file is for.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('.', import.meta.url))
const BASE = 'https://statsapi.mlb.com'
const MAX_BYTES = 120 * 1024

const PLAY_FIELDS = [
  'allPlays', 'about', 'atBatIndex', 'halfInning', 'isTopInning', 'inning',
  'result', 'event', 'eventType', 'description', 'rbi', 'awayScore', 'homeScore',
  'matchup', 'batter', 'pitcher', 'id', 'fullName',
  'playEvents', 'details', 'player', 'isSubstitution',
].join(',')

// Every gamePk the fixtures need. 813031 (2025 "G1" in the first plan) is a
// regular-season NLCS game (type L, Brewers at Dodgers, 2025-10-17), so the 2025
// Game 1 used here is 813027 (Dodgers at Blue Jays, 2025-10-24). 67266 is 1912
// Game 2, the tied game (6-6).
const GAMES = [
  [67524, '1956 G5'],
  [67553, '1960 G7'],
  [67878, '1986 G6'],
  [67961, '1991 G7'],
  [813024, '2025 G7'],
  [813027, '2025 G1'],
  [813032, '2025 G3, 18 innings'],
  [563409, '2018 G3, 18 innings'],
  [775300, '2024 G1, walk-off grand slam'],
  [813022, '2025 G5, two home runs to open'],
  [67697, '1975 G7'],
  [67272, '1912 G8'],
  [67266, '1912 G2, tied 6-6'],
  [67237, '1907 G1, tied 3-3'],
]

async function getJson(path, params = {}) {
  const url = new URL(path, BASE)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

async function save(name, path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  writeFileSync(`${DIR}${name}.json`, JSON.stringify(await res.json()))
  console.log(`wrote ${name}.json`)
}

for (const [pk, label] of GAMES) {
  const path = `/api/v1/game/${pk}/playByPlay`
  const full = await getJson(path)
  const pruned = await getJson(path, { fields: PLAY_FIELDS })
  const fullIndex = full.allPlays.map(p => p.about.atBatIndex).join(',')
  const prunedIndex = pruned.allPlays.map(p => p.about.atBatIndex).join(',')
  if (fullIndex !== prunedIndex) throw new Error(`${pk} (${label}): pruned play list differs from the full feed`)
  const text = JSON.stringify(pruned)
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error(`${pk} (${label}): ${Buffer.byteLength(text)} bytes, over 120 KB`)
  writeFileSync(`${DIR}${pk}-plays.json`, text)
  console.log(`wrote ${pk}-plays.json (${label}, ${pruned.allPlays.length} plays)`)
}

for (const year of [1912, 2006, 2022]) {
  await save(`schedule-${year}`, `/api/v1/schedule?sportId=1&season=${year}&gameType=W&hydrate=linescore,team`)
}
