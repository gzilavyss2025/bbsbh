// BOX LINES — the door LABELS for the player page's Game lines card. One call
// answers every door on the card: `careerStatSplits` takes a comma-separated
// `sitCodes` list and returns one career row per code, so nine doors cost one
// request rather than nine (verified live 2026-09-02 on personId 656849
// pitching and 592885 hitting — `h`, `a`, `d`, `n` all came back with
// `split.code`, `stat.gamesPlayed`, and the rate stats each group's line
// prints).
//
// Class: spoiler-free (spoiler-manifest.json). A CAREER aggregate is open on
// every surface in this app — it is the same figure the Splits vs team card
// already prints beside its own door, and ADR-0034 is explicit that a stat
// line is not a score. Only the game-by-game rows BEHIND the door carry a
// result, and those go through boxlines/rows.js's cutoff gate. Nothing here
// takes a cutoff, because a career line does not have one.
import { getJson } from '../statsapi.js'

// Every field either group's line reads, in one list — statsapi ignores the
// names that do not apply to the group asked for.
const FIELDS =
  'fields=stats,splits,split,code,stat,gamesPlayed,era,inningsPitched,strikeOuts,baseOnBalls,' +
  'plateAppearances,avg,homeRuns,ops'

// The career line one door prints, in the vocabulary the Splits vs team door
// beside it already uses (api/vsTeamSplits.js's `vsTeamDoorLabel`), so two
// doors on one page cannot describe the same career two different ways.
// Issue #997 wrote the pitcher line without IP; it is kept here because that
// spec asked for "the vocabulary SplitsVsTeam.jsx already uses", and that
// vocabulary has it.
export function careerSplitLine(stat, group) {
  if (!stat) return null
  return group === 'pitching'
    ? `${stat.gamesPlayed} G, ${stat.inningsPitched} IP, ${stat.era} ERA, ${stat.strikeOuts} K, ${stat.baseOnBalls} BB`
    : `${stat.gamesPlayed} G, ${stat.plateAppearances} PA, ${stat.avg}, ${stat.homeRuns} HR, ${stat.ops} OPS`
}

// The career split rows for a set of situation codes, as a Map code -> stat.
// Returns an empty Map on any failure: a missing label is one missing door,
// not a broken card.
export async function fetchCareerSplits(personId, group, sitCodes) {
  const codes = [...new Set(sitCodes ?? [])].filter(Boolean)
  if (!personId || !codes.length) return new Map()
  let splits = []
  try {
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=careerStatSplits&group=${group}&sportId=1` +
        `&sitCodes=${codes.join(',')}&${FIELDS}`,
    )
    splits = data.stats?.[0]?.splits ?? []
  } catch {
    return new Map()
  }
  // A traded player's SEASON splits come back one row per club stint plus a
  // combined row for the same code (three `h` rows on 656849/2026).
  // `careerStatSplits` did not do that in testing, but the guard is cheap and
  // the failure it prevents — a door labelled with one club's half of a
  // career — is silent. Largest gamesPlayed per code wins, which is the
  // combined row whenever one exists.
  const best = new Map()
  for (const s of splits) {
    const code = s?.split?.code
    if (!code || !s.stat) continue
    const prior = best.get(code)
    if (!prior || Number(s.stat.gamesPlayed) > Number(prior.gamesPlayed)) best.set(code, s.stat)
  }
  return best
}
