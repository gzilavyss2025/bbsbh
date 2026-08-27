// Captures each club's OWN season total — plate appearances for hitters,
// innings pitched for pitchers — for every club and every season
// build-roster-age.mjs covers, and writes them to
// test/fixtures/roster-age-club-totals.json.
//
// WHY THIS FIXTURE EXISTS. roster-age-cache.json stores one row per player per
// club stint, and eight other scripts read it as the authority on which club a
// player's playing time belongs to. A stint that goes missing is invisible in
// the file itself: the remaining rows still look like a roster. The only way to
// see the loss is to add the stints up and compare them to what the club says
// its own season was. statsapi dropped the SELLING club's stint from the
// club-filtered player pull for the 2024 and 2025 seasons, and the loss stayed
// in the committed cache until that sum was taken.
//
// The unit test roster-age-cache-completeness.test.js takes that sum against
// these captured numbers, so the check runs offline and gates CI. Recapture
// only when a new season is added, and read the diff before committing it — a
// number that moves for a CLOSED season is statsapi restating history, not a
// routine refresh.
//
// SOURCE: GET /api/v1/teams/{teamId}/stats?stats=season&group={hitting,pitching}
// &season=YYYY — one call per club/season/group (30 x 26 x 2 = 1,560 calls).
//
// Run: node .scratch/team-success/capture-club-totals.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', '..', 'test', 'fixtures', 'roster-age-club-totals.json')

const ALL_MLB_TEAM_IDS = [
  108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133,
  134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
]
const SEASONS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i)

async function fetchWithRetry(url, attempts = 4) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`statsapi ${res.status} ${url}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }
  throw lastErr
}

// "180.1" -> 180 + 1/3 (baseball's fractional-inning notation, not tenths).
function parseInnings(ip) {
  const [whole, frac] = String(ip ?? '0').split('.')
  return (Number(whole) || 0) + (frac === '1' ? 1 / 3 : frac === '2' ? 2 / 3 : 0)
}

async function main() {
  const totals = {}
  let done = 0
  for (const season of SEASONS) {
    for (const teamId of ALL_MLB_TEAM_IDS) {
      for (const group of ['hitting', 'pitching']) {
        const json = await fetchWithRetry(
          `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats` +
            `?stats=season&group=${group}&season=${season}`,
        )
        const stat = json.stats?.[0]?.splits?.[0]?.stat
        totals[`${group}-${teamId}-${season}`] =
          group === 'hitting' ? (stat?.plateAppearances ?? 0) : parseInnings(stat?.inningsPitched)
        done += 1
      }
    }
    console.log(`${done} club-season-groups captured (through ${season})`)
  }
  writeFileSync(OUT_PATH, JSON.stringify(totals, null, 0) + '\n')
  console.log(`Wrote ${Object.keys(totals).length} club-season-group totals to ${OUT_PATH}`)
}

main()
