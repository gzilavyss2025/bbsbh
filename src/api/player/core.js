// The player hub's shared header data — everything PlayerHubShell draws around
// a tab's body (the hero, the four banners, the prospect pills), and NOTHING
// else.
//
// Every tab pays for this on top of its own loader, so it must stay cheap: the
// two requests playerContext already makes, plus one All-Star roster, one
// session-memoized prospect file, and — only for an unrostered player — his
// year-by-year tables, which are the only way to say "last played in 2022".
// If you are tempted to add a fetch here because two tabs happen to want it,
// put it in both tabs' loaders instead; that is the whole point of the split
// (src/api/player/context.js, rule 1).

import { fetchAllStarRosterIds, isProbableStarterToday } from '../person-fetch.js'
import { lastPlayedSeason, pitcherRole } from '../person.js'
import { fetchTopProspects, prospectRankById, orgProspectRankById } from '../prospects.js'
import { currentSeasonFor, playerContext, yearByYearFor } from './context.js'

export async function loadPlayerCore(id, asOf) {
  const ctx = await playerContext(id, asOf)
  if (!ctx) return null
  const { bio, il, onIL, rosterStatus, careerSportId, currentYear, season, groups } = ctx

  // A player the transaction feed still shows on rehab/the IL may already be
  // announced as tonight's probable starter — MLB posts that days before the
  // club files the activation that would clear the banner (see
  // isProbableStarterToday, schedule.js). Live view only (`!asOf`): a game-
  // scoped historical page reflects that game's own cutoff, never "today".
  const startingToday =
    !asOf && onIL && il.team?.id ? await isProbableStarterToday(il.team.id, id, ctx.endDate) : false
  // Stands the banner down and swaps `bio.team` from his rehab affiliate to
  // the parent org he's actually pitching for tonight — no `parentOrgId` on
  // the swapped-in club, since he isn't an affiliate of anyone, he simply IS
  // on that club tonight, so the hero drops the affiliate mark and
  // themes/links to the parent org directly. The context is shared with the tab
  // mounted beside this one, so the swap now reaches its `bio` too — which is
  // the consistent answer: the club under the hero and the club a tab names are
  // the same club.
  if (startingToday) bio.team = { id: il.team.id, name: il.team.name, parentOrgId: null, parentOrgName: '' }

  const [prospects, allStarIds, yby, pitchSeason] = await Promise.all([
    // Session-memoized after the first call anywhere in the app — cheap even
    // though every player page asks for it.
    fetchTopProspects(),
    // The banner is a "how's he doing right now" badge, so it always checks the
    // real current year — never the (possibly past) season a game link is
    // scoped to, so viewing an old game never shows a stale "20XX All-Star"
    // banner. The register's own per-season stars are the Stats tab's, since
    // that is where the register renders. Spoiler-safe.
    careerSportId === 1 ? fetchAllStarRosterIds(currentYear) : Promise.resolve(null),
    // "Last played in 2022" — only the unrostered can show it, so only they pay
    // for the tables it is read off.
    rosterStatus
      ? Promise.all(groups.map((group) => yearByYearFor(ctx, group)))
      : Promise.resolve(null),
    // The hero's position line says "SP"/"RP"/"CL" for a pitcher, and that word
    // is a reading of his current-season line — so the hero, which every tab
    // draws, is what pays for it. A two-way player reads "DH/P" and a position
    // player his own posAbbr, so neither fetches anything here.
    bio.isPitcher && !bio.twoWay ? currentSeasonFor(ctx, 'pitching') : Promise.resolve(null),
  ])

  // The banner under the masthead for someone who isn't on a club AND hasn't
  // appeared in a game this season. Only for the unrostered: a signed player who
  // has missed the whole year is an injury story the IL banner already tells,
  // and stamping him "last played in 2025" would read as an obituary. Measured
  // against the season IN VIEW, so an old box score's player links don't accuse
  // anyone of being retired years before he was.
  const lastPlayed = yby
    ? lastPlayedSeason(ctx.person, yby.flatMap((r) => [...r.mlbYbySplits, ...r.milbYbySplits]), season)
    : null

  return {
    bio,
    season,
    currentYear,
    asOf,
    sportId: ctx.currentActivitySportId,
    onRehab: ctx.onRehab,
    rehab: ctx.rehab,
    onIL,
    il,
    startingToday,
    rosterStatus,
    lastPlayedYear: lastPlayed && lastPlayed < season ? lastPlayed : null,
    isAllStar: allStarIds?.has(bio.id) ?? false,
    heroRole: pitchSeason ? pitcherRole(pitchSeason.stat) : null,
    prospectRank: prospectRankById(prospects.players, bio.id),
    // The player's rank on his own org's farm-system list — shown as a second
    // pill for anyone who's on their org's list but not the overall Top 100.
    orgProspectRank: orgProspectRankById(prospects.orgProspects, bio.id),
  }
}
