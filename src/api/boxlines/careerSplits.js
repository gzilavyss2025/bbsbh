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
// A DOOR WHOSE LINE IS NOT A STAT LINE AT ALL. A hitter's Started and Came in
// doors (#1003) count GAMES and nothing else, because the source that knows
// how often he was in the starting lineup is the FIELDING career — one row per
// position, each carrying `gamesStarted` — and a fielding row holds no batting
// average to print. So those two doors print "1,674 G" where their neighbours
// print a five-figure line, and `doorLine` below is what lets one card hold
// both. That source is the whole reason #1003's hitter half was ever blocked:
// it was read as "MLB publishes no started/substitute split for a hitter",
// which is true of `situationCodes` — all 602 of them — and not true of the
// fielding group, which nobody had asked.
//
// So `fetchDoorLabels` below is the card's one entry point: it reads whichever
// of the three sources each registry entry names, in parallel, and hands back
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

// A door that counts GAMES and says nothing else — the two lineup doors. The
// figure comes from a fielding career, which carries no rate stat, and the
// count IS the question those doors ask ("how often did he come off the
// bench?"), so there is nothing missing from this line.
export function gamesLine(stat) {
  if (!stat) return null
  return `${stat.gamesPlayed} G`
}

// The line ONE registry entry prints, whichever kind of figure it has. The
// card asks for this rather than choosing, so a new kind of source is one case
// here instead of a branch on every surface that draws a door.
export function doorLine(entry, stat, group) {
  return entry?.lineKind === 'games' ? gamesLine(stat) : careerSplitLine(stat, group)
}

// THE SAME CAREER AS FIVE CELLS, for a card that names its columns once at the
// top instead of on every line. `careerSplitLine` above prints one door's
// career as a sentence; this prints the identical five figures in the identical
// order, for the sheet's headline and the card's table to stay in step. They
// are two renderings of one stat object and the suite pins them to each other.
//
// A cell is null where the figure does not exist — the two lineup doors count
// GAMES off a fielding career and it carries no rate stat, so their last four
// cells are empty rather than zero. The card draws a quiet mark there; a zero
// would be a lie and a dash reads as data MLB failed to send.
export function doorCells(entry, stat, group) {
  if (!stat) return null
  const text = (v) => (v == null ? null : String(v))
  if (entry?.lineKind === 'games') return [text(stat.gamesPlayed), null, null, null, null]
  return (
    group === 'pitching'
      ? [stat.gamesPlayed, stat.inningsPitched, stat.era, stat.strikeOuts, stat.baseOnBalls]
      : [stat.gamesPlayed, stat.plateAppearances, stat.avg, stat.homeRuns, stat.ops]
  ).map(text)
}

// What those five cells are CALLED, in the order `doorCells` returns them and
// the vocabulary the Splits vs team card's own stat grid already prints on the
// same page (26-player-page.css's .player__statgrid). The card heads each of
// its sections with this row, so a reader who scrolls past one heading meets
// the names again at the next.
export const DOOR_COLUMNS = {
  hitting: ['G', 'PA', 'AVG', 'HR', 'OPS'],
  pitching: ['G', 'IP', 'ERA', 'K', 'BB'],
}

// WHICH CELL CARRIES THE QUESTION. A split is asked to answer "how well", and
// four of the five figures are context for the one that does — so the rate
// stats take the page's darkest ink and the counting stats step back. It is
// not the same cell for both groups: a bat is read on OPS with AVG beside it,
// an arm on ERA alone, and the column that sits under OPS on a pitcher's card
// is BB, which carries nothing.
export const DOOR_EMPHASIS = {
  hitting: [null, null, 'mid', null, 'key'],
  pitching: [null, null, 'key', null, null],
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

// HOW OFTEN HE WAS IN THE STARTING LINEUP, over a career, in one call.
// `stats=career&group=fielding` returns a row per position he has played, and
// every row carries `gamesStarted`; one game contributes one start, to the
// position he STARTED at, so the sum over positions is his career starts.
//
// Measured against the truth — the schedule's own `hydrate=lineups`, game by
// game — over eleven hitters on 2026-09-15: the starts figure lands within 5
// and the BENCH figure, which is the small one and the one a reader looks at,
// within 2 every time. Cain 11 against 11, Soto 15 against 15, Yelich 53
// against 51, Turang 136 against 138, Taylor 158 against 159. It reaches back
// as far as the app will ever ask: Bonds (debut 1986) returns 2,848 starts of
// 2,986 games.
//
// That margin is the same KIND as the one the Home and Road doors carry
// (ADR-0069): MLB's aggregate on the door, MLB's per-game record in the rows,
// and no rule that reconciles them. It is not a bug to be closed by loosening
// the gate or by counting the rows instead — the rows stop at the page's
// cutoff and the door states a whole career.
export async function fetchFieldingStarts(personId) {
  if (!personId) return null
  try {
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=career&group=fielding&sportId=1&gameType=R` +
        `&fields=stats,splits,stat,gamesStarted`,
    )
    const splits = data.stats?.[0]?.splits ?? []
    if (!splits.length) return null
    return splits.reduce((a, s) => a + (Number(s.stat?.gamesStarted) || 0), 0)
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
  // The two lineup doors share ONE pair of calls — his starts and his career
  // games — and a card without them asks neither.
  const wantsLineup = list.some((e) => e.fielding)
  const [bySitCode, starts, whole, ...totals] = await Promise.all([
    fetchCareerSplits(personId, group, codes),
    wantsLineup ? fetchFieldingStarts(personId) : Promise.resolve(null),
    wantsLineup ? fetchCareerTotal(personId, group, 'R') : Promise.resolve(null),
    ...types.map((t) => fetchCareerTotal(personId, group, t)),
  ])
  const byGameType = new Map(types.map((t, i) => [t, totals[i]]))
  const games = Number(whole?.gamesPlayed)
  const byFielding = new Map()
  if (starts != null && Number.isFinite(games) && games > 0) {
    byFielding.set('starts', { gamesPlayed: starts })
    // He played, and he did not start: the bench count is a subtraction, so
    // the two doors can never add up to more than the career they came from.
    byFielding.set('bench', { gamesPlayed: Math.max(0, games - starts) })
  }
  const out = new Map()
  for (const e of list) {
    const stat = e.fielding
      ? byFielding.get(e.fielding)
      : e.careerGameType
        ? byGameType.get(e.careerGameType)
        : bySitCode.get(e.sitCode)
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
