// Regenerates public/data/awards-history.json — who won which major MLB award
// (MVP, Cy Young, Rookie of the Year, Silver Slugger, Gold Glove, Platinum
// Glove, Reliever of the Year, Comeback Player, Hank Aaron, Roberto Clemente,
// All-MLB First/Second Team) each of the last several seasons, league-wide.
// The standalone counterpart to a player's own Trophy Case card
// (trophyCaseView in src/api/person.js) — that's "what has THIS player won",
// this is "who won THIS award, over the years".
//
// A season's award winners are decided once and never change. A full run (no
// flag) rebuilds the last five seasons by hand. `--nightly` is the cron's mode
// (update-nightly-data.yml): it does NOTHING outside the awards window (October to
// February, awardsSeasonInPlay) and inside it refreshes only the season in play,
// carrying the others forward from the committed file (lib/awards/history-merge.mjs),
// so the winners MLB announces from mid-October to December reach the history view
// within a night (#2510). It writes only when the rows changed, so a quiet night is
// no commit and no deploy. The still-in-progress season needs no special case: the
// recipients endpoint answers 404 for an award not yet decided, which would end
// the run, so a 404 is read as "no recipients" below, same as any empty result.
//
// Imports the award list (MAJOR_AWARDS, via SEASON_AWARDS) and the recipient row
// from src/api (rather than keeping a separate copy, unlike the deliberate small
// duplication in e.g. gen-rehab.mjs) so this page can't drift from what the player
// page's own Trophy Case counts as hardware, or from the live "so far" block.
//
// Source: GET /api/v1/awards/{awardId}/recipients?season=YYYY (no sportId
// needed — unlike the All-Star recipients call in person-fetch.js's
// fetchAllStarRosterIds, which needs it to disambiguate ALAS/NLAS from roster
// context, a plain award id has no such ambiguity). Verified live: 2024 ALMVP
// returns Aaron Judge; ALSS returns one recipient per position.
//
// A second pass adds a `statLine` string (e.g. ".322 AVG · 41 HR · 112 RBI")
// to EVERY recipient, via
// GET /api/v1/people/{id}/stats?stats=season&season=YYYY&group=hitting|pitching
// — the group is picked off each recipient's own position, not the award,
// since several awards (MVP, ROY, Silver Slugger's "P" slot, ...) can go to
// either a hitter or a pitcher. A recipient the stats endpoint has nothing
// for (an incomplete/malformed season row) just renders without one —
// same graceful degradation as everywhere else in this app.
//
// Run by hand: node scripts/gen-awards-history.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { isPostseasonAward } from '../src/api/person.js'
import { awardsSeasonInPlay, recipientsOf, SEASON_AWARDS } from '../src/api/awardsHistory.js'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { mergeSeasons } from './lib/awards/history-merge.mjs'

// Hardware only, no All-Star selections — SEASON_AWARDS (src/api/awardsHistory.js, the
// same list the page's live "so far" block reads) is MAJOR_AWARDS minus ALAS/NLAS.
const HARDWARE_AWARDS = Object.fromEntries(SEASON_AWARDS)

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'awards-history.json')
const SEASON_COUNT = 5
const NIGHTLY = process.argv.includes('--nightly')
if (NIGHTLY && awardsSeasonInPlay(new Date()) == null) {
  console.log('outside the awards window (October to February) — nothing to do')
  process.exit(0)
}
const CURRENT_SEASON = await fetchSeasonInPlay()
const windowSeasons = Array.from({ length: SEASON_COUNT }, (_, i) => CURRENT_SEASON - i)
// A nightly run needs the committed file to carry the other seasons forward; with
// none (missing, unparseable, or no families) it falls back to the full run.
const committed = NIGHTLY ? await readFile(out, 'utf8').then(JSON.parse, () => null) : null
const prev = committed?.families?.length ? committed : null
const seasons = prev ? [CURRENT_SEASON] : windowSeasons

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
  // 404 = not announced yet (see src/api/awardsHistory.js); anything else throws.
  const data = await getJson(`/api/v1/awards/${awardId}/recipients?season=${season}`).catch((err) => {
    if (err?.status === 404) return { awards: [] }
    throw err
  })
  // The recipient row (league, team name from the static id->name table, position) is
  // src/api/awardsHistory.js's, shared with the page's live block.
  const recipients = recipientsOf(awardId, data)
  return { awardId, season, recipients }
})

const PITCHER_POSITIONS = new Set(['P', 'SP', 'RP', 'CP'])

function formatStatLine(group, stat) {
  if (!stat) return null
  if (group === 'pitching') {
    if (stat.era == null || stat.wins == null || stat.strikeOuts == null) return null
    return `${stat.era} ERA · ${stat.wins} W · ${stat.strikeOuts} K`
  }
  if (stat.avg == null || stat.homeRuns == null || stat.rbi == null) return null
  return `${stat.avg} AVG · ${stat.homeRuns} HR · ${stat.rbi} RBI`
}

const statLineJobs = []
for (const r of results) {
  if (!r || !r.recipients.length) continue
  // A postseason MVP is decided on a series, so the regular-season line this pass
  // fetches would read as the reason he won. Those recipients carry no statLine
  // (the page renders a recipient without one), and keep the recipients endpoint's own team.
  if (isPostseasonAward(r.awardId)) continue
  for (const rec of r.recipients) statLineJobs.push({ rec, season: r.season })
}
await mapConcurrent(statLineJobs, 8, async ({ rec, season }) => {
  const group = PITCHER_POSITIONS.has(rec.position) ? 'pitching' : 'hitting'
  const data = await getJson(`/api/v1/people/${rec.playerId}/stats?stats=season&season=${season}&group=${group}`)
  const split = data.stats?.[0]?.splits?.[0]
  const line = formatStatLine(group, split?.stat)
  if (line) rec.statLine = line
  // The awards/recipients endpoint occasionally attaches the wrong "team" —
  // verified live: Andrés Giménez's 2023 AL Platinum Glove record comes back
  // with team 944, "Venezuela" (his World Baseball Classic entry), not the
  // Guardians. The season stats split's own team is the reliable source
  // (it's keyed off his actual game log, not a roster snapshot), so prefer
  // it whenever this fetch succeeds and is actually MLB-sourced.
  if (split?.team?.id && split.sport?.id === 1) {
    rec.teamId = split.team.id
    rec.teamName = split.team.name || rec.teamName
  }
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

const finalFamilies = prev
  ? mergeSeasons({ prev: prev.families, fresh: familiesOut, keep: windowSeasons, order: familyOrder })
  : familiesOut
if (prev && JSON.stringify(finalFamilies) === JSON.stringify(prev.families) && JSON.stringify(windowSeasons) === JSON.stringify(prev.seasons)) {
  console.log(`awards-history.json unchanged (${CURRENT_SEASON})`)
} else {
  await writeJsonAtomic(out, { generatedAt: new Date().toISOString(), seasons: windowSeasons, families: finalFamilies })
  console.log(`wrote ${out} (${finalFamilies.length} awards, seasons ${windowSeasons[windowSeasons.length - 1]}–${windowSeasons[0]})`)
}
