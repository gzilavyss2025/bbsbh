// The per-club exposure file: every man who played, split by club (ADR-0076).
// Split out of export.mjs for the file-size cap (ADR-0038). The report file and
// the folded exposure file stay in export.mjs.
import { exposureByPlayer, hasExposure } from './exposure.mjs'
import { ofSeason } from './export.mjs'

// The same fold, keyed by CLUB as well as by man. A traded catcher's calls
// belong to whichever club he was squatting for when he made them, and the
// per-club file is the only place that distinction survives.
function rolesByPlayerTeam(rows) {
  const out = new Map()
  for (const r of rows ?? []) {
    if (r.player_id == null || r.team_id == null) continue
    const key = `${r.team_id}:${r.player_id}`
    const cur = out.get(key) ?? {}
    cur[r.role] = (cur[r.role] ?? 0) + 1
    out.set(key, cur)
  }
  return out
}

// The same fold with the OUTCOMES kept: per club and man, per role, a count of
// wins and a string of results, one character a challenge ('1' success, '0' fail),
// oldest first by (date, game_pk, seq). The same rows feed this and the counts
// above, so the string length is asBatter / asCatcher by construction.
function resultsByPlayerTeam(rows) {
  const sorted = [...(rows ?? [])]
    .filter((r) => r.player_id != null && r.team_id != null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_pk - b.game_pk || a.seq - b.seq))
  const out = new Map()
  for (const r of sorted) {
    const key = `${r.team_id}:${r.player_id}`
    const cur = out.get(key) ?? {}
    cur[r.role] = (cur[r.role] ?? '') + (r.outcome === 'success' ? '1' : '0')
    out.set(key, cur)
  }
  return out
}

// Pitches received, summed per `${teamId}:${playerId}` for one level. The
// sentinel row of a game with no catcher (player_id 0, received.mjs) is skipped.
function receivedByPlayerTeam(rows, level) {
  const out = new Map()
  for (const r of rows ?? []) {
    if (r.level !== level || !r.player_id) continue
    const key = `${r.team_id}:${r.player_id}`
    out.set(key, (out.get(key) ?? 0) + r.pitches)
  }
  return out
}

const countOf = (s, ch) => (s.match(new RegExp(ch, 'g')) ?? []).length

// THE SAME DENOMINATORS, SPLIT BY CLUB — a THIRD file, and the one cut the
// folded list above cannot give back.
//
// buildExposureExport folds a man's clubs into one row on purpose: a hitter
// traded in July clears a 200-plate-appearance floor on his SEASON, not on
// either half of it, and the league histograms would lose every traded regular
// if they did not. The same fold drops `team_id`, which the sweep's own rows
// carry — so a club board built on that file would have to attribute a traded
// man to whoever holds him now, counting a whole season against a club he
// played sixty games for.
//
// A THIRD FILE RATHER THAN A KEY IN THE SECOND is ADR-0076 applied again: one
// club's hub tab reads this, and abs-exposure.json is downloaded whole by
// every visitor to /abs-challenges. The duplication is small — 733 MLB rows
// against the fold's 659 — and docs/abs-challenges.md §6 carries the decision.
//
// IT SHIPS COUNTS AND DENOMINATORS, NEVER RATES. `per1000Pitches` prints as
// `11.224987798926305`, forty bytes for a number the reader divides in one
// line, and three of them a row was 210 KB of the first draft's 465. `name`
// DOES ride along: a team hub that had to fetch 418 KB to put a name on a dot
// would have paid for the file this one exists to avoid.
//
// BOTH LEVELS, AND ONE FILE EACH. Triple-A earns its rows: a club's dots hold
// 71.8% of its plate appearances against MLB's 84.2%, and its catcher table
// draws at every club (docs/abs-challenges.md §6). The rate the card leads with
// is not floored at all, so it is complete either way.
//
// THE FILE PER LEVEL IS ADR-0076 A THIRD TIME. Together the two levels are
// 222 KB and a club's hub tab reads ONE, so a single file would make a
// major-league club download the Triple-A half for nothing. The caller writes
// one file per level and the reader picks by level; nothing here ships two.
//
// ONE EXCEPTION TO "NEVER RATES": `resultsBatter` and `resultsCatcher` are
// strings, one character a challenge. They are not rates, they are the raw
// sequence behind a "last ten" strip, which no count can rebuild. They cost one
// byte a challenge, a few thousand in all. `wonBatter` and `wonCatcher` are the
// counts of '1' in them, shipped so the reader does not recount.
//
// `pitchesReceived` is the catcher's denominator (received.mjs). It is null for a
// man who never caught, and null for everyone while `catcherPitches` is empty.
export const EXPOSURE_CLUB_LEVELS = ['MLB', 'AAA']

export function buildExposureClubsExport(
  allRows,
  allExposure,
  { season, generatedAt, levels = EXPOSURE_CLUB_LEVELS, catcherPitches = [] } = {},
) {
  const rows = ofSeason(allRows, season)
  const received = ofSeason(catcherPitches, season)
  const exposure = ofSeason(allExposure, season)
  const out = {}
  for (const level of levels) {
    const levelRows = rows.filter((r) => r.level === level)
    const roles = rolesByPlayerTeam(levelRows)
    const results = resultsByPlayerTeam(levelRows)
    const caught = receivedByPlayerTeam(received, level)
    // Folded per man per club (exposureByPlayer): a no-op inside one season,
    // and across seasons it adds his seasons for that club, never lists him twice.
    const rowsByTeam = Map.groupBy(exposure.filter((x) => x.level === level && x.team_id != null), (x) => x.team_id)
    const byTeam = {}
    for (const [teamId, teamRows] of rowsByTeam) {
      for (const [playerId, seen] of exposureByPlayer(teamRows)) {
        // Same gate as the folded file: a man with no opportunity at all supports
        // no rate and cannot answer the never-challenged question either.
        if (!hasExposure(seen)) continue
        const calls = roles.get(`${teamId}:${playerId}`) ?? {}
        const strings = results.get(`${teamId}:${playerId}`) ?? {}
        const resultsBatter = strings.batter ?? ''
        const resultsCatcher = strings.catcher ?? ''
        const key = String(teamId)
        byTeam[key] = byTeam[key] ?? []
        byTeam[key].push({
          playerId,
          name: seen.name,
          pitches: seen.pitches,
          plateAppearances: seen.plateAppearances,
          catcherInnings: seen.catcherInnings,
          asBatter: calls.batter ?? 0,
          asCatcher: calls.catcher ?? 0,
          wonBatter: countOf(resultsBatter, '1'),
          wonCatcher: countOf(resultsCatcher, '1'),
          resultsBatter,
          resultsCatcher,
          pitchesReceived: caught.get(`${teamId}:${playerId}`) ?? null,
        })
      }
    }
    for (const list of Object.values(byTeam)) list.sort((a, b) => a.playerId - b.playerId)
    out[level] = { byTeam }
  }
  return {
    version: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    season: season ?? null,
    levels: out,
  }
}
