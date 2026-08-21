// Loader + pre-pitch staging view for the scorecard sheet.
//
// SPOILER CLASSIFICATION — spoiler-free, at last honestly. For most of its
// life this module was MIXED: the staging view below shared a file with the
// full-reveal at-bat grid (`scorecardPlays`) and the finished scoreboard,
// importing revealInning/revealTotals while its header claimed otherwise —
// the false-header case that motivated spoiler-manifest.json. The grid now
// lives in scorecardGame.js (reveal-gated, ADR-0009 pattern, its own
// `importers` allowlist), and everything HERE reads api/select.js and the two
// out-of-feed side fetches only: the same staging information the lineup
// pages already show before first pitch.
//
//   loadScorecardGame   — fetches the feed plus the two out-of-feed sources
//   scorecardView       — pre-pitch staging only: lineup, defensive alignment,
//                         umpire crew, starters, header write-in fields
//
// Managers and uniforms aren't in the live feed (see api/game.js +
// api/uniforms.js), so they ride their own fetches alongside it; both degrade
// to null/'' and the sheet just shows a blank write-in line, same as the
// empty template.

import { fetchGameFeed, fetchManager, managerLabel } from './game.js'
import { fetchGameUniforms, uniformSummary } from './uniforms.js'
import {
  selectLineup,
  selectOpposingDefense,
  selectOpposingPitcher,
  selectTeamMeta,
  selectOfficials,
  selectGameInfo,
} from './select.js'

// Fetch the raw pieces for a gamePk: the live feed plus the two out-of-feed
// sources (managers, uniforms), in parallel once the feed resolves the team ids
// and season. Throws only if the feed itself fails — the side fetches each
// degrade to null on their own. Used by the DEV-only Scorecard Lab; the
// product surfaces already hold all three via useGameData and hand
// scorecardView a `{ feed, managers, uniformBrief }` instead.
export async function loadScorecardGame(gamePk) {
  const feed = await fetchGameFeed(gamePk)
  const season = feed?.gameData?.game?.season
  const awayId = feed?.gameData?.teams?.away?.id
  const homeId = feed?.gameData?.teams?.home?.id
  const [awayMgr, homeMgr, uniforms] = await Promise.all([
    fetchManager(awayId, season),
    fetchManager(homeId, season),
    fetchGameUniforms(gamePk),
  ])
  return { feed, managers: { away: awayMgr, home: homeMgr }, uniforms }
}

// Shape the loaded game into everything one half's sheet renders. `side` picks
// which team's card this is: 'top' = the visitors bat (home team defends),
// 'bottom' = the home team bats (visitors defend). The batting team fills the
// header + lineup; the fielding team fills the defense diamond + pitcher table
// (the arms that face this lineup). Every field falls back to '' / [] so a
// MiLB feed missing lineups or a crew renders blanks instead of crashing.
//
// `loaded` accepts two uniform shapes: the Lab's raw `uniforms` (fed through
// uniformSummary here), or a screen's already-summarized `uniformBrief`
// strings — useGameData synthesizes those once for the lineup pages and the
// box score, and re-deriving them from a second raw fetch here would just be
// a chance for the two to disagree.
export function scorecardView(loaded, side /* 'top' | 'bottom' */) {
  if (!loaded?.feed) return null
  const { feed, managers, uniforms, uniformBrief } = loaded
  const battingSide = side === 'bottom' ? 'home' : 'away'
  const fieldingSide = battingSide === 'away' ? 'home' : 'away'

  const batMeta = selectTeamMeta(feed, battingSide)
  const fieldMeta = selectTeamMeta(feed, fieldingSide)
  const officials = selectOfficials(feed)
  const umpiresByRole = {}
  for (const o of officials) umpiresByRole[o.role] = o.name ?? ''
  const info = selectGameInfo(feed)
  const pitcher = selectOpposingPitcher(feed, battingSide)

  return {
    teamId: batMeta.id,
    teamName: batMeta.name,
    manager: managerLabel(managers?.[battingSide]),
    uniforms:
      uniformBrief?.[battingSide] ??
      uniformSummary(uniforms?.[battingSide], battingSide, batMeta.clubName),
    firstPitch: info.firstPitch,
    umpiresByRole,
    // The BOTTOM page's own header block. The #22 does not reprint the crew on
    // its second page — it prints where the game was played and what it was
    // played in, which is the club's own page to record it on. All four come
    // off selectGameInfo, which is spoiler-free: a ballpark and a wind reading
    // are known before first pitch, and a turnstile count is not a score.
    // The block's fourth field — the time of the FINAL OUT — is deliberately
    // not here. It is the one line in the family with a tell (against first
    // pitch it gives the game's length, and a long one says extras), so it
    // rides the reveal-gated scoreboard instead, behind the same `done` as the
    // FINAL line: scorecardGame.js + scorecard/finalout.js.
    venue: info.venue,
    weather: info.weather,
    attendance: info.attendance,
    lineup: selectLineup(feed, battingSide).map((r) => ({
      // `id` is what lets the rail hang a player's hover card off his name on a
      // sheet that has not been revealed yet — the pre-pitch lineup is the only
      // name source on this view that had no id of its own.
      id: r.id,
      pos: r.position,
      name: r.nameLastFirst,
      jersey: r.jersey,
    })),
    // The fielding team's name titles the diamond ("Brewers Defense"); its
    // starting nine (minus the pitcher, plus the DH) is the alignment this
    // lineup bats against, and its probable starter opens the pitcher table.
    fieldingTeamName: fieldMeta.teamName || fieldMeta.name,
    defense: selectOpposingDefense(feed, battingSide),
    pitcherName: pitcher?.nameLastFirst ?? '',
  }
}
