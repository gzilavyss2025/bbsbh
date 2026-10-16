import { useMemo, useState } from 'react'
import { prospectBadge } from '../../api/prospects.js'
import { SPORT_LABEL, isMlbTeamId } from '../../lib/teams.js'
import { takeBoardIn } from '../../lib/motion/boardIn.js'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { LeaderList, LeaderRow } from '../ui/frame/LeaderList.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Grid } from '../ui/layout/Grid.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { ProspectPill } from '../badges/ProspectPill.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { displayRanks, rankedCategories, rowLook } from './leaderBoard.js'

// TEAM LEADERS — per-category season leaderboards (ADR-0112's ledger board). Each category is
// a LeaderList (its name on the tab, a "Top 10" tag) of LeaderRows: the headshot in the mark
// slot, the name over a small line, the figure on the right. Rank 1 leads; the reader's club
// is "mine" (ADR-0030). Pool-agnostic: it ranks whatever normalized PoolPlayer[] it's handed
// (see api/teamLeaders.js), so one component serves /team/{id}/leaders, the league/level/org
// boards and the postseason boards alike.
//
// It is no longer what the team HUB renders. The hub renders TeamLeadersLedger — same pool,
// same computeLeaders, same descriptors, one row per category. This board stays where the
// page's whole job IS leaders.

const DASH = '—'

// The level a ranked row is tagged with. On a combining pool (org / all-minors)
// a row can span levels, so join every level its totals cover ("A+·AA", ordered
// low→high by the producer); otherwise fall back to the row's single level.
function levelLabel(entry) {
  const ids = entry.levels?.length ? entry.levels : entry.sportId ? [entry.sportId] : []
  return ids.map((id) => SPORT_LABEL[id]).filter(Boolean).join('·')
}

// The sub line under a leader's name: the club's logo and abbreviation, then the level and the
// prospect pill. Each is opt-in and draws nothing when off or inapplicable, so a single-team
// page has no sub line at all. The logo names the club the leader plays FOR — a MiLB entry
// shows its MLB parent affiliate's mark (`displayTeamId`/`displayTeamAbbr`, attached in
// api/statsLevels.js) — and rides with its abbreviation only on `showTeamAbbr`: on a
// single-team pool every row plays for the one club the page is about, so it is redundant.
// `showLevel` (a multi-level pool) tags the level(s) the row's total covers;
// `prospectSnapshot` (any MiLB scope) adds the same prospect pill the lineup/roster surfaces
// use, which self-hides when unranked.
function leaderSub({ entry, teamId, teamAbbr, showLevel, prospectSnapshot, showTeamAbbr }) {
  const level = showLevel ? levelLabel(entry) : ''
  const prospect = prospectSnapshot ? prospectBadge(prospectSnapshot, entry.id) : null
  const hasProspect = prospect && (prospect.rank || prospect.orgRank)
  const hasTeam = showTeamAbbr && teamId
  if (!hasTeam && !level && !hasProspect) return null
  return (
    <Cluster as="span" gap="snug" align="center" className="tlead__sub">
      {hasTeam && (
        <Cluster as="span" gap="tight" align="center" className="tlead__teamtag">
          <TeamLogo teamId={teamId} name={teamAbbr} size={16} className="tlead__logo" />
          {teamAbbr}
        </Cluster>
      )}
      {level && <Pill fill="paper" figure className="tlead__level">{level}</Pill>}
      {hasProspect && <ProspectPill {...prospect} />}
    </Cluster>
  )
}

// `favoriteTeamId` (league/level leader pages only — see TeamLeaders) makes the row "mine"
// when the leader plays for that club, so a fan's team jumps out on a board otherwise full of
// strangers. `filtering` (set only once the League Leaders page's TeamFilterStrip has an
// explicit pick, not the default "MLB" entry) dulls every OTHER row instead — the pick
// supersedes the favorite tint while active.
function LeaderCategory({
  category,
  entries,
  showLevel,
  prospectSnapshot,
  favoriteTeamId,
  filtering,
  showTeamAbbr,
}) {
  const ranks = displayRanks(entries)
  return (
    <LeaderList label={category.label} count="Top 10" className="tlead__cat">
      {entries.map((e, i) => {
        const teamId = e.displayTeamId ?? e.teamId
        const teamAbbr = e.displayTeamAbbr ?? e.teamAbbr
        const isFavorite = favoriteTeamId != null && teamId === favoriteTeamId
        const { state, className } = rowLook({ index: i, isFavorite, filtering })
        return (
          <LeaderRow
            key={e.id}
            rank={ranks[i].text}
            state={state}
            className={className}
            mark={
              <Headshot
                personId={e.id}
                name={e.name}
                teamId={teamId}
                isMlb={isMlbTeamId(e.teamId)}
                className="tlead__shot"
              />
            }
            name={
              <PlayerLink id={e.id} name={e.name} className="tlead__name">
                {e.name || DASH}
              </PlayerLink>
            }
            sub={leaderSub({ entry: e, teamId, teamAbbr, showLevel, prospectSnapshot, showTeamAbbr })}
            figure={e.display}
          />
        )
      })}
    </LeaderList>
  )
}

// `pool`: normalized PoolPlayer[]. `categories`: descriptor array to rank.
// `limit`: how many players per category (10 on every page that renders this
// board today). `title`: section
// heading (the broader leader pages pass their scope's title). `showLevel`:
// badge each leader's level (org scope, a multi-level pool). `prospectSnapshot`:
// fetchTopProspects() result to add prospect pills (any MiLB scope). `qualifier`:
// playing-time bar mode for rate categories, forwarded to computeLeaders
// ('leader-relative' for the large pools; see api/teamLeaders.js).
// `precomputed`: a { categoryKey: entries[] } map of ALREADY-RANKED rows
// (computeLeaders' output shape) — passed instead of `pool` when the ranking
// was baked at build time (the static all-minors board, too heavy to rank
// live; see api/minorsLeaders.js). When set, pool/qualifier are unused and
// entries are just sliced to `limit`. `favoriteTeamId`: highlights any row
// whose leader plays for that club — LeadersPage passes it for the league/
// level scopes only (not 'org', not the single-team pages), since a team's
// own leaders page has no "stranger" rows to pick the favorite out from.
// `filtering`: true once LeadersPage's TeamFilterStrip has an explicit team
// picked (not the default "MLB" entry) — dulls every OTHER leader instead of
// removing it, so the picked club's rows stand out without losing the
// board's category structure. `showTeamAbbr`: shows the club's logo and abbreviation
// in each row's sub line — on by default for the
// multi-team boards (league/level/org) where it's the only way to tell whose
// row is whose; the single-team pages (TeamLeadersPage, the postseason boards)
// pass false since every row already shares the one team the page is about.
//
// This board carries NO header action and no IL mark. It had `onSeeAll`,
// `secondaryAction` and `injuredIds` while the team hub rendered it; the hub
// renders TeamLeadersLedger now, and the four pages left here are destinations
// rather than doors, so nothing passed any of the three. They are gone rather
// than kept warm — an unreachable prop reads as a supported feature to the next
// reader, and the ledger is where a door or an IL mark actually belongs.
export function TeamLeaders({
  pool,
  categories,
  limit = 5,
  title = 'Team leaders',
  showLevel = false,
  prospectSnapshot = null,
  qualifier = 'roster',
  precomputed = null,
  favoriteTeamId = null,
  filtering = false,
  showTeamAbbr = true,
}) {
  const ranked = useMemo(
    () => rankedCategories({ pool, categories, limit, qualifier, precomputed }),
    [pool, categories, limit, qualifier, precomputed],
  )
  // The fade-in after a scope tap (styles/motion/board-in.css): spent on this board's FIRST
  // render only, so a cold load, a Back, a poll and a force-reveal never play it.
  const [playIn] = useState(takeBoardIn)

  if (ranked.length === 0) return null

  return (
    <div className={playIn ? 'tlead tlead--in' : 'tlead'}>
      <SectionHead look="label">{title}</SectionHead>
      <Grid min="20rem" gap="base">
        {ranked.map(({ category, entries }) => (
          <LeaderCategory
            key={category.key}
            category={category}
            entries={entries}
            showLevel={showLevel}
            prospectSnapshot={prospectSnapshot}
            favoriteTeamId={favoriteTeamId}
            filtering={filtering}
            showTeamAbbr={showTeamAbbr}
          />
        ))}
      </Grid>
    </div>
  )
}
