// The player hub's shared fetch vocabulary — the pieces MORE THAN ONE tab
// loader genuinely needs, and nothing else.
//
// The player page is four real routes (`/player/{id}`, `/stats`, `/analytics`,
// `/history`) and each one loads ONLY its own data, the same rule the team hub
// keeps (ADR-0034, src/screens/team/data/). The loaders in this directory were
// split out of the old single `loadPlayer`, so they read as that function's
// sections rather than as new code; what changed is WHO fetches what.
//
// Three rules govern this directory:
//
//  1. **A tab fetches only what its own sections render.** The Analytics tab
//     does not pull a career register; the History tab does not pull a pitch
//     mix. Some overlap between tabs is expected and accepted — the year-by-year
//     tables are read by three of them — exactly as the team hub's tab loaders
//     overlap. Duplicated FETCHES across tabs are the price of tabs that load
//     independently; a shared mega-fetch is the thing being avoided.
//
//  2. **`buildBlock` stays the one block shaper.** A tab hands it the splits it
//     fetched and empty arrays for the rest, so the fields that tab does not
//     render come back empty or null (`careerRegisterView` answers null with
//     nothing to shape). It is pure — no fetch rides on it — so the cost of a
//     field a tab ignores is nil, and there is exactly one place where a tile,
//     a register row or a milestone is shaped.
//
//  3. **The context below is cheap and every tab pays for it**, the same way
//     every team-hub tab pays for `loadTeamIdentity`. Two requests: the person
//     and his transaction feed. If you are tempted to add a fetch here because
//     two tabs happen to want it, put it in both tabs' loaders instead. It stays
//     cheap for a second reason as well — the shell and the tab that mounts
//     beside it SHARE one context (see the coalescer below), so the pair pays
//     for it once rather than twice.

import {
  fetchPerson,
  fetchPersonStats,
  fetchMilbByDateRange,
  fetchMilbYearByYear,
  fetchTransactions,
} from '../person-fetch.js'
import { fetchGamesByPk } from '../schedule.js'
import {
  aggregateSplits,
  detectInjuredList,
  detectRehabAssignment,
  personBio,
  personSportId,
  rosterStatusView,
  signedFallback,
} from '../person.js'
import { gamePath } from '../../lib/route.js'

export function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
export function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// The "Current season" tiles' stat line, plus the LEVEL that line belongs to
// (`sportId`) — the two must travel together: the register keys its date-cut
// current-season row on this level, and the promoted other-level tiles skip it,
// so a mismatch would strand a whole level's line (an up-and-down player's AAA
// season vanishing behind his MLB row). `levelStat` (already fetched at the
// player's current team's level) covers the common cases as-is: an active MLB
// player, or a MiLB player who's spent the whole year at one level. Two cases
// need extra fetches: a player who has debuted before but shows no MLB games
// this season (a rehab assignment or a full-season option down, `sportId` !=
// 1) should still prefer his MLB line if he's actually appeared there this
// year (so the resolved level is MLB, NOT his live MiLB club); and a player
// with no MLB action at all this season should get his stints at every MiLB
// level combined, not just the level he's at right now (e.g. a mid-season
// AA -> AAA promotion), reported at his current MiLB level.
//
// That blended `stat` is right for the TILES (one "how's he doing this year"
// line) but wrong for the career register's current-level row, which must stay
// level-scoped (see careerRegisterView) — so this also returns `levelOnlyStat`,
// the same date-cut window filtered to just `sportId`. A recent AA -> AAA
// call-up would otherwise show his AAA row as AA+AAA combined while a separate,
// correct AA row also exists (the AA line double-counted into both rows). And
// `levelOnlySplits` is that window's RAW rows, still one per club: the register
// prints a line per club, which only rows that still carry a `team` allow.
export async function resolveCurrentSeasonStat({ id, group, season, startDate, endDate, sportId, hasDebuted, levelStat, levelSplits }) {
  if (sportId === 1) return { stat: levelStat, sportId: 1, levelOnlyStat: levelStat, levelOnlySplits: levelSplits ?? [] }
  if (hasDebuted) {
    const mlbSplits = await fetchPersonStats(id, {
      type: 'byDateRange', group, season, startDate, endDate, sportId: 1,
    })
    const mlbStat = aggregateSplits(mlbSplits, group)
    if (mlbStat && Number(mlbStat.gamesPlayed) > 0) return { stat: mlbStat, sportId: 1, levelOnlyStat: mlbStat, levelOnlySplits: mlbSplits }
  }
  const milbSplits = await fetchMilbByDateRange(id, group, season, startDate, endDate)
  const levelRows = milbSplits.filter((s) => s.sport?.id === sportId)
  const stat = aggregateSplits(milbSplits, group)
  return { stat, sportId, levelOnlyStat: aggregateSplits(levelRows, group), levelOnlySplits: levelRows }
}

// Two loaders always mount together on this hub — the shell's (`core.js`) and
// the tab's — and both open by asking the same two questions. This joins that
// pair into ONE pass: a call that arrives while an identical one is still in
// flight gets the same promise, and therefore the same context object.
//
// It is a COALESCER, NOT A CACHE. The entry is dropped the moment the promise
// settles, so a later visit to the same player always asks again and nothing
// here can serve a stale roster status, IL stint or rehab assignment. What it
// removes is the duplicate only — React runs both `useAsync` effects in the same
// commit, so the tab's call always lands while the shell's fetch is still open.
//
// Sharing the object is the point, not a side effect: `currentSeasonFor` memoises
// on the context, so the hero's role word (core.js) and the tab's own tiles
// resolve one season line between them instead of one each. Before this, every
// pitcher paid a duplicate byDateRange request per tab — and a MiLB pitcher up to
// three, since resolveCurrentSeasonStat early-returns only for sportId 1.
const inFlightContexts = new Map()

export function playerContext(id, asOf) {
  const key = `${id}|${asOf ?? ''}`
  const joined = inFlightContexts.get(key)
  if (joined) return joined
  const pending = buildPlayerContext(id, asOf)
  inFlightContexts.set(key, pending)
  // Settled either way, the entry goes. `then(drop, drop)` rather than
  // `finally` so the rejection is HANDLED here — a derived promise nobody
  // awaits would otherwise report itself as an unhandled rejection while the
  // real caller is handling the same failure perfectly well.
  const drop = () => {
    if (inFlightContexts.get(key) === pending) inFlightContexts.delete(key)
  }
  pending.then(drop, drop)
  return pending
}

// Everything a tab has to know about WHO this is and WHERE he is playing before
// it can ask for a single stat: which level his current-activity sections track,
// which level his career-shaped sections are pinned to, which stat groups he
// has, and the day every dated fetch is cut off at. Two requests.
async function buildPlayerContext(id, asOf) {
  // The spoiler cutoff for every date-bound fetch — "entering today" for a
  // game-scoped view, else the live current day. The transaction feed is capped
  // by it too, because a live rehab assignment has to be detected before any
  // stat block is built.
  const endDate = asOf ? dayBefore(asOf) : isoToday()
  const [person, txns] = await Promise.all([fetchPerson(id), fetchTransactions(id, endDate)])
  if (!person) return null
  const bio = personBio(person)
  // Draft fact fallback for undrafted/international signees (see
  // signedFallback) — cheap, txns is already fetched above.
  bio.signedYear = bio.draft?.year ? null : signedFallback(txns)
  const debutYear = bio.debut ? Number(bio.debut.slice(0, 4)) : null
  // Free agent / retired / released — set only when he is on NO club as of the
  // page's cutoff, in which case `bio.team` is a stale pointer the hero must not
  // render as his club. See rosterStatusView.
  const rosterStatus = rosterStatusView(person, endDate)
  // Where he's playing RIGHT NOW (a big leaguer's is MLB; a demoted or
  // now-a-lifer minor leaguer's is his current MiLB level). For an unrostered
  // big leaguer that same stale `currentTeam` would pin the whole page to a
  // level he isn't at — Céspedes's winter-league club would send every
  // current-activity fetch and every outgoing link to sportId 17 — so a player
  // who has reached the majors falls back to MLB. A never-debuted minor leaguer
  // keeps his last level: it's still the right one for his MiLB register.
  const liveSportId = rosterStatus && bio.debut ? 1 : personSportId(person)
  // IL status from the same spoiler-capped feed.
  const il = detectInjuredList(txns, endDate)
  const onIL = Boolean(il)
  // A rehab assignment is by definition an IL rehab, so it's gated on onIL: a
  // rehab ASG whose closing transaction went uncaptured (esp. across a season
  // boundary) must not paint a since-activated player with the amber banner.
  const rehab = detectRehabAssignment(txns, debutYear, endDate)
  const onRehab = Boolean(rehab) && onIL
  // A big leaguer currently on a minor-league REHAB assignment is a major
  // leaguer passing through the minors, not a demotion — so his current-activity
  // sections (season tiles, splits, game log, the register's current-season row)
  // are pinned to MLB even though his live club is a MiLB affiliate.
  const currentActivitySportId = onRehab ? 1 : liveSportId
  // Where his career-shaped sections are pinned. A player who has reached the
  // majors gets the major-league treatment even while he's currently in the
  // minors (Ben Gamel — a longtime big leaguer now at AAA): his year-by-year
  // table, career total and team-history timeline stay on MLB (sportId 1) so
  // his major-league body of work fills the prominent slots.
  const careerSportId = bio.debut ? 1 : liveSportId
  const season = Number((asOf || isoToday()).slice(0, 4))
  const groups = bio.twoWay
    ? ['hitting', 'pitching']
    : [bio.isPitcher ? 'pitching' : 'hitting']
  // "Path to the Majors" and the Firsts card always tell their story in the
  // page's primary stat group (hitting for a two-way player: the more common
  // progression story, and the one whose gamesPlayed reads naturally as
  // "games at that level").
  const primaryGroup = bio.isPitcher ? 'pitching' : 'hitting'

  return {
    id,
    person,
    bio,
    txns,
    asOf,
    endDate,
    cutoff: asOf || null,
    season,
    startDate: `${season}-01-01`,
    currentYear: Number(isoToday().slice(0, 4)),
    debutYear,
    rosterStatus,
    liveSportId,
    il,
    onIL,
    rehab,
    onRehab,
    currentActivitySportId,
    careerSportId,
    groups,
    primaryGroup,
  }
}

// One group's year-by-year tables, MLB and every MiLB level. Read by three of
// the four tabs (the Overview's promoted other-level tiles, the Stats tab's
// register, the History tab's progression/timeline), each fetching its own —
// see rule 1 at the top of this file.
export async function yearByYearFor(ctx, group) {
  const [mlbYbySplits, milbYbySplits] = await Promise.all([
    // A pre-debut player has no MLB line at all, so the request is skipped.
    ctx.bio.debut
      ? fetchPersonStats(ctx.id, { type: 'yearByYear', group, sportId: 1 })
      : Promise.resolve([]),
    fetchMilbYearByYear(ctx.id, group),
  ])
  return { mlbYbySplits, milbYbySplits }
}

// The current season's date-cut window at the player's current-activity level,
// plus the resolved tile stat and the level it belongs to. Read by the Overview
// (the tiles themselves), the Stats tab (the register's current-season row), the
// Analytics tab (which level a pitch-mix pool or a Statcast card belongs to) and
// the shell (a pitcher's hero role word).
//
// Memoised ON THE CONTEXT, keyed by group — which is what makes the shell's read
// free. A context lives exactly as long as the mount that built it (see the
// coalescer above), so this can no more go stale than the context itself can.
export function currentSeasonFor(ctx, group) {
  const byGroup = (ctx.seasonByGroup ??= new Map())
  const joined = byGroup.get(group)
  if (joined) return joined
  const pending = resolveSeasonFor(ctx, group)
  byGroup.set(group, pending)
  return pending
}

async function resolveSeasonFor(ctx, group) {
  const { id, bio, season, startDate, endDate, currentActivitySportId } = ctx
  const seasonSplits = await fetchPersonStats(id, {
    type: 'byDateRange', group, season, startDate, endDate, sportId: currentActivitySportId,
  })
  const resolved = await resolveCurrentSeasonStat({
    id, group, season, startDate, endDate, sportId: currentActivitySportId,
    hasDebuted: Boolean(bio.debut), levelStat: aggregateSplits(seasonSplits, group), levelSplits: seasonSplits,
  })
  return { seasonSplits, ...resolved }
}

// Point a set of gamePks at their (sealed) box scores, via the normal
// date/matchup/boxscore route — one batched schedule lookup resolves every
// abbreviation the slugs need. Returns a `path(pk)` reader plus the raw rows,
// which the Firsts card also reads for the opponent's name.
export async function boxscoreLinks(pks) {
  const byPk = await fetchGamesByPk([...new Set([...pks].filter(Boolean))])
  return {
    byPk,
    path(pk) {
      const g = byPk[pk]
      return g ? gamePath(g.apiDate, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber) : null
    },
  }
}
