// BOX LINES — the door LABELS for the player page's Game lines card. Almost
// every door is answered by one call: `careerStatSplits` takes a comma-separated
// `sitCodes` list and returns one career row per code, so nine doors cost one
// request rather than nine (verified live 2026-09-02 on personId 656849
// pitching and 592885 hitting — `h`, `a`, `d`, `n` all came back with
// `split.code`, `stat.gamesPlayed`, and the rate stats each group's line
// prints).
//
// A DOOR WHOSE LINE IS NOT A SITUATION. `careerStatSplits` answers a question
// of the form "his career, in these situations", and most doors are exactly
// that. The postseason is not: it is a career under a different GAME TYPE, and
// statsapi keeps those two apart, and the stat type named for October is not
// the answer: `stats=careerPlayoffs` returns the REGULAR-SEASON career. <!-- word-choice-exempt: statsapi's own stat-type name, quoted -->
// Yelich comes back 1,715 G and .282 (verified 2026-09-03, ADR-0069). The working source is `stats=career` with
// `gameType=P`, which returns one row and the right one (Yelich: 27 G, .218;
// Scherzer pitching: 33 G, 157.1 IP, 3.78 ERA — verified 2026-09-10). 'P' is
// safe HERE, where an aggregate has no per-row type to be poisoned; on the
// game log it is not, and rows.js's POSTSEASON says why.
//
// So `fetchDoorLabels` below is the card's one entry point: it reads whichever
// of the two sources each registry entry names, in parallel, and hands back
// one Map the card can key by door. Two requests for a card with a postseason
// door, one for a card without.
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
// The career total under one game type, as a single stat, or null. Used for
// the postseason door; `gameType` is statsapi's own parameter and 'P' is its
// own spelling of the postseason.
export async function fetchCareerTotal(personId, group, gameType) {
  if (!personId || !gameType) return null
  try {
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=career&group=${group}&sportId=1` +
        `&gameType=${gameType}&${FIELDS}`,
    )
    // One split, no `split.code` — this is a total, not a situation.
    return data.stats?.[0]?.splits?.[0]?.stat ?? null
  } catch {
    return null
  }
}

// Every door's line for one card, as a Map keyed by the registry entry's
// `key`. An entry names its source: `sitCode` for a situation (all of them
// share ONE careerStatSplits call, whatever the count) or `careerGameType`
// for a career under a game type (one call each). A source that fails leaves
// its door out; the rest of the card is unaffected.
export async function fetchDoorLabels(personId, group, entries) {
  const list = entries ?? []
  if (!personId || !list.length) return new Map()
  const codes = list.map((e) => e.sitCode).filter(Boolean)
  const types = [...new Set(list.map((e) => e.careerGameType).filter(Boolean))]
  const [bySitCode, ...totals] = await Promise.all([
    fetchCareerSplits(personId, group, codes),
    ...types.map((t) => fetchCareerTotal(personId, group, t)),
  ])
  const byGameType = new Map(types.map((t, i) => [t, totals[i]]))
  const out = new Map()
  for (const e of list) {
    const stat = e.careerGameType ? byGameType.get(e.careerGameType) : bySitCode.get(e.sitCode)
    if (stat) out.set(e.key, stat)
  }
  return out
}

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
