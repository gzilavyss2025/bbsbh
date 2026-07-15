import { useMemo } from 'react'
import { computeLeaders } from '../api/teamLeaders.js'
import { prospectBadge } from '../api/prospects.js'
import { SPORT_LABEL, favoriteAccentColor } from '../lib/teams.js'
import { SectionTitle } from './SectionTitle.jsx'
import { Headshot } from './Headshot.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { ProspectPill } from './ProspectPill.jsx'
import { InjuredMark } from './InjuredMark.jsx'

// TEAM LEADERS — per-category season leaderboards for a team. Each category
// features its leader as a headshot card (styled like the slate's Top Performers
// row) with the chasers (ranks 2–N) as plain rows beneath. Pool-agnostic: it
// ranks whatever normalized PoolPlayer[] it's handed (see api/teamLeaders.js),
// so the same component serves both the team page's Phase-1 cross-section and the
// dedicated leaders page's full list — and, later, a league/level pool.

// The level a ranked row is tagged with. On a combining pool (org / all-minors)
// a row can span levels, so join every level its totals cover ("A+·AA", ordered
// low→high by the producer); otherwise fall back to the row's single level.
function levelLabel(entry) {
  const ids = entry.levels?.length ? entry.levels : entry.sportId ? [entry.sportId] : []
  return ids.map((id) => SPORT_LABEL[id]).filter(Boolean).join('·')
}

// The badges that ride next to a leader's name on the broader (league/level/org)
// pools — none on a single-team page, so both are opt-in and render nothing when
// off or inapplicable. `showLevel` (a multi-level pool) tags the level(s) the
// row's total covers; `prospectSnapshot` (any MiLB scope) adds the same prospect
// pill the lineup/roster surfaces use, which self-hides when unranked.
function LeaderBadges({ entry, showLevel, prospectSnapshot }) {
  const level = showLevel ? levelLabel(entry) : ''
  return (
    <>
      {level && <span className="tlead__level">{level}</span>}
      {prospectSnapshot && <ProspectPill {...prospectBadge(prospectSnapshot, entry.id)} />}
    </>
  )
}

// Rank 1 — the featured card. Reuses the Top Performers headshot frame + name/
// stat stack, sized up from that shared pattern for readability at this card's
// larger footprint (see `.shot.tlead__shot`). The team tag always names the
// club the leader plays FOR via its logo — a MiLB entry shows its MLB parent
// affiliate's mark rather than its own farm club's, since that's the identity
// a fan skimming the board actually recognizes (see `displayTeamId`/
// `displayTeamAbbr`, attached in api/statsLevels.js). The abbreviation text
// underneath is opt-in (`showTeamAbbr`) — on a single-team pool every leader
// plays for the same club, so it's redundant with the page's own header; a
// multi-team board (league/level/org scope) needs it to tell strangers apart.
//
// `favoriteTeamId` (league/level leader pages only — see TeamLeaders) tints
// the row in that club's own accent when the leader plays for it, so a fan's
// team jumps out on a board otherwise full of strangers. `filtering` (set
// only once the League Leaders page's TeamFilterStrip has an explicit pick,
// not the default "MLB" entry) dulls every OTHER leader instead — the pick
// supersedes the favorite-team tint while active.
function FeaturedLeader({
  entry,
  category,
  showLevel,
  prospectSnapshot,
  favoriteTeamId,
  filtering,
  showTeamAbbr,
  injuredIds,
}) {
  const teamId = entry.displayTeamId ?? entry.teamId
  const teamAbbr = entry.displayTeamAbbr ?? entry.teamAbbr
  const isFavorite = favoriteTeamId != null && teamId === favoriteTeamId
  const isDimmed = filtering && !isFavorite
  const favStyle = isFavorite ? { '--fav-accent': favoriteAccentColor(teamId) } : undefined
  const classes = [
    'tlead__featured',
    isFavorite && 'tlead__featured--fav',
    isDimmed && 'tlead__featured--dim',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} style={favStyle}>
      <Headshot personId={entry.id} name={entry.name} teamId={teamId} className="tlead__shot" />
      {teamId && (
        <div className="tlead__teamtag">
          <TeamLogo teamId={teamId} name={teamAbbr} size={24} className="tlead__logo" />
          {showTeamAbbr && teamAbbr && <span className="tlead__teamabbr">{teamAbbr}</span>}
        </div>
      )}
      <div className="tlead__who">
        <div className="tlead__head">
          <PlayerLink id={entry.id} className="tlead__name">
            {entry.name}
          </PlayerLink>
          <InjuredMark hurt={injuredIds?.has(entry.id)} />
          {entry.position && <span className="tlead__pos">{entry.position}</span>}
        </div>
        <div className="tlead__badges">
          <LeaderBadges entry={entry} showLevel={showLevel} prospectSnapshot={prospectSnapshot} />
        </div>
      </div>
      <div className="tlead__stat">
        <span className="tlead__statval">{entry.display}</span>
        <span className="tlead__statlabel">{category.short}</span>
      </div>
    </div>
  )
}

// Competition ("1224") ranking with tie flags, keyed off the numeric `value`
// each entry already carries — so ties surface identically on the live and the
// precomputed (all-minors) boards without regenerating the static JSON. For each
// entry: its rank is the 1-based position of the FIRST entry sharing its value,
// and `tie` is true when 2+ entries share that value (the displayed rank then
// gets a "T" prefix — a three-way tie at the top reads "T1", "T1", "T1", and the
// next player is rank 4). Exact numeric equality only (two ".302"s that differ at
// the 4th decimal are NOT a tie; equal values tie regardless of formatting).
function displayRanks(entries) {
  return entries.map((e, i) => {
    let first = i
    while (first > 0 && entries[first - 1].value === e.value) first -= 1
    let last = i
    while (last < entries.length - 1 && entries[last + 1].value === e.value) last += 1
    const tie = last > first
    return { rank: first + 1, tie, text: `${tie ? 'T' : ''}${first + 1}` }
  })
}

function LeaderCategory({
  category,
  entries,
  showLevel,
  prospectSnapshot,
  favoriteTeamId,
  filtering,
  showTeamAbbr,
  injuredIds,
}) {
  const [leader, ...rest] = entries
  const ranks = displayRanks(entries)
  return (
    <section className="tlead__cat">
      <h4 className="tlead__cat-title">{category.label}</h4>
      <FeaturedLeader
        entry={leader}
        category={category}
        showLevel={showLevel}
        prospectSnapshot={prospectSnapshot}
        favoriteTeamId={favoriteTeamId}
        filtering={filtering}
        showTeamAbbr={showTeamAbbr}
        injuredIds={injuredIds}
      />
      {rest.length > 0 && (
        <ol className="tlead__rest">
          {rest.map((e, i) => {
            const teamId = e.displayTeamId ?? e.teamId
            const teamAbbr = e.displayTeamAbbr ?? e.teamAbbr
            const isFavorite = favoriteTeamId != null && teamId === favoriteTeamId
            const isDimmed = filtering && !isFavorite
            const favStyle = isFavorite ? { '--fav-accent': favoriteAccentColor(teamId) } : undefined
            const classes = [
              'tlead__row',
              isFavorite && 'tlead__row--fav',
              isDimmed && 'tlead__row--dim',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={e.id} className={classes} style={favStyle}>
                <span className="tlead__rank">{ranks[i + 1].text}</span>
                <PlayerLink id={e.id} className="tlead__rowname">
                  {e.name}
                </PlayerLink>
                {showTeamAbbr && teamAbbr && <span className="tlead__rowteam">{teamAbbr}</span>}
                <InjuredMark hurt={injuredIds?.has(e.id)} />
                <LeaderBadges entry={e} showLevel={showLevel} prospectSnapshot={prospectSnapshot} />
                <span className="tlead__rowval">{e.display}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// `pool`: normalized PoolPlayer[]. `categories`: descriptor array to rank.
// `limit`: how many players per category (5 on the team page, more on the
// full page). `onSeeAll`: optional — renders a "See all ›" affordance in the
// header (the team page links to the dedicated leaders page). `title`: section
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
// board's category structure. `showTeamAbbr`: shows the club abbreviation
// under the featured leader's logo, and inline next to each chaser's
// name — on by default for the
// multi-team boards (league/level/org) where it's the only way to tell whose
// row is whose; the single-team pages (TeamPage, TeamLeadersPage) pass false
// since every row already shares the one team the page is about. `injuredIds`:
// a Set of person ids currently on that team's IL, flagging a leader's name
// with the same ✚ mark as the
// player page's il-banner — TeamPage passes its own already-fetched IL list
// (see loadTeam's `injured`); null everywhere else (see InjuredMark above).
export function TeamLeaders({
  pool,
  categories,
  limit = 5,
  onSeeAll,
  title = 'Team leaders',
  showLevel = false,
  prospectSnapshot = null,
  qualifier = 'roster',
  precomputed = null,
  favoriteTeamId = null,
  filtering = false,
  showTeamAbbr = true,
  injuredIds = null,
}) {
  const ranked = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          entries: precomputed
            ? (precomputed[category.key] ?? []).slice(0, limit)
            : computeLeaders(pool, category, { limit, qualifier }),
        }))
        // A category with no qualifying players (thin MiLB data) is hidden
        // rather than rendered empty.
        .filter((r) => r.entries.length > 0),
    [pool, categories, limit, qualifier, precomputed],
  )

  if (ranked.length === 0) return null

  return (
    <div className="tlead">
      <SectionTitle
        title={title}
        action={
          onSeeAll ? (
            <button type="button" className="tlead__seeall" onClick={onSeeAll}>
              See all ›
            </button>
          ) : null
        }
      />
      <div className="tlead__grid">
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
            injuredIds={injuredIds}
          />
        ))}
      </div>
    </div>
  )
}
