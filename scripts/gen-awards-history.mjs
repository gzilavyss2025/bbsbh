// Regenerates public/data/awards-history.json — who won which major MLB award
// (MVP, Cy Young, Rookie of the Year, Silver Slugger, Gold Glove, Platinum
// Glove, Reliever of the Year, Comeback Player, Hank Aaron, Roberto Clemente,
// All-MLB First/Second Team) each of the last several seasons, league-wide.
// The standalone counterpart to a player's own Trophy Case card
// (trophyCaseView in src/api/person.js) — that's "what has THIS player won",
// this is "who won THIS award, over the years".
//
// A season's award winners are decided once (announced Nov of that year) and
// never change, so this is a HAND-RUN regenerate (like gen-milb-history.mjs /
// gen-war-history.mjs), NOT a cron — re-run it once a year to fold in the
// season that just ended. No need to special-case the still-in-progress
// current season: the recipients endpoint simply comes back empty for an
// award not yet decided, and that season/award pair is dropped, same as any
// other empty result.
//
// Imports MAJOR_AWARDS straight from src/api/person.js (rather than keeping a
// separate copy, unlike the deliberate small duplication in e.g.
// gen-rehab.mjs) so this page can't drift from what the player page's own
// Trophy Case counts as hardware.
//
// Source: GET /api/v1/awards/{awardId}/recipients?season=YYYY (no sportId
// needed — unlike the All-Star recipients call in person-fetch.js's
// fetchAllStarRosterIds, which needs it to disambiguate ALAS/NLAS from roster
// context, a plain award id has no such ambiguity). Verified live: 2024 ALMVP
// returns Aaron Judge; ALSS returns one recipient per position.
//
// Run by hand: node scripts/gen-awards-history.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAJOR_AWARDS } from '../src/api/person.js'
import { teamFullName } from '../src/lib/teams.js'

// Hardware only, no All-Star selections — MAJOR_AWARDS carries ALAS/NLAS too
// (the Trophy Case's own All-Star tier), but this page is scoped to trophies/
// honors a player WINS, not a roster he's named to.
const HARDWARE_AWARDS = Object.fromEntries(
  Object.entries(MAJOR_AWARDS).filter(([id]) => id !== 'ALAS' && id !== 'NLAS'),
)

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'awards-history.json')
const BASE = 'https://statsapi.mlb.com'

const SEASON_COUNT = 5
const CURRENT_SEASON = new Date().getUTCFullYear()
const seasons = Array.from({ length: SEASON_COUNT }, (_, i) => CURRENT_SEASON - i)

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// Run an async mapper across items with a small concurrency cap, results in
// order (be polite to statsapi). Mirrors gen-milestones.mjs's helper.
async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// AL*/NL*-prefixed ids split by league; the MLB-wide ones (MLBRC,
// MLBAFIRST/MLBSECOND) carry no league split.
function leagueOf(awardId) {
  if (awardId.startsWith('AL')) return 'AL'
  if (awardId.startsWith('NL')) return 'NL'
  return null
}

// Silver Slugger + Gold Glove hand out one winner per fielding position, but
// the API's own `primaryPosition.abbreviation` is inconsistent about WHICH
// positions it splits out from year to year (Gold Glove sometimes reports
// specific LF/CF/RF, Silver Slugger's outfield winners always come back as
// plain "OF"; the "P" bucket has shown up as SP/RP/CP too). A naive
// left-to-right render of the API's own order would then reshuffle position
// to position every year, defeating the point of a scannable history. This
// bucket order fixes each position to the same slot regardless of which
// exact label the API used for it — OF ties LF's rank so the (ungrouped)
// Silver Slugger "OF" trio clusters at the front of the outfield block
// rather than sorting separately from Gold Glove's LF/CF/RF rows. Unknown
// positions sort last rather than erroring, same graceful-degradation rule
// as everywhere else in this app.
const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'OF', 'LF', 'CF', 'RF', 'DH', 'UT', 'P', 'SP', 'RP', 'CP']
const POSITION_RANK = Object.fromEntries(POSITION_ORDER.map((p, i) => [p, p === 'OF' ? POSITION_ORDER.indexOf('LF') : i]))
const POSITION_SORTED_FAMILIES = new Set(['Silver Slugger', 'Gold Glove'])

function sortByPosition(recipients) {
  return recipients
    .map((r, i) => ({ r, i, rank: POSITION_RANK[r.position] ?? 99 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ r }) => r)
}

const awardIds = Object.keys(HARDWARE_AWARDS)
const jobs = awardIds.flatMap((awardId) => seasons.map((season) => ({ awardId, season })))

const results = await mapConcurrent(jobs, 8, async ({ awardId, season }) => {
  const data = await getJson(`/api/v1/awards/${awardId}/recipients?season=${season}`)
  const recipients = (data.awards ?? [])
    .filter((a) => a.player?.id)
    .map((a) => ({
      league: leagueOf(awardId),
      playerId: a.player.id,
      name: a.player.nameFirstLast || '',
      teamId: a.team?.id ?? null,
      // The recipients endpoint's `team` object carries only an id/link, no
      // name — resolve it from the app's own static id->name table so the
      // page never has to render a blank team label next to the logo.
      teamName: teamFullName(a.team?.id) || '',
      position: a.player.primaryPosition?.abbreviation || '',
    }))
  return { awardId, season, recipients }
})

// Group by the shared label (ALMVP + NLMVP -> "MVP"), then by season, in the
// order HARDWARE_AWARDS itself first mentions each label — the same order the
// Trophy Case's hardware badges use, so both surfaces read consistently.
const familyOrder = []
const familyKeys = new Map()
for (const label of Object.values(HARDWARE_AWARDS)) {
  if (!familyKeys.has(label)) {
    familyKeys.set(label, true)
    familyOrder.push(label)
  }
}
const families = new Map(familyOrder.map((label) => [label, { key: label, label, years: {} }]))

for (const r of results) {
  if (!r || !r.recipients.length) continue
  const label = HARDWARE_AWARDS[r.awardId]
  const family = families.get(label)
  const yearRecipients = (family.years[r.season] ??= [])
  yearRecipients.push(...r.recipients)
}

// Re-sort each Silver Slugger/Gold Glove season by the fixed position order
// above. AwardsHistoryPage still splits AL from NL itself (by each
// recipient's own `league` field, not array order) before rendering, so
// sorting AL and NL together here is fine — a sorted array's AL-only
// subsequence is still sorted by rank.
for (const family of families.values()) {
  if (!POSITION_SORTED_FAMILIES.has(family.label)) continue
  for (const season of Object.keys(family.years)) {
    family.years[season] = sortByPosition(family.years[season])
  }
}

const familiesOut = familyOrder
  .map((label) => families.get(label))
  .filter((f) => Object.keys(f.years).length > 0)

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ generatedAt: new Date().toISOString(), seasons, families: familiesOut }),
)
console.log(`wrote ${out} (${familiesOut.length} awards, seasons ${seasons[seasons.length - 1]}–${seasons[0]})`)
