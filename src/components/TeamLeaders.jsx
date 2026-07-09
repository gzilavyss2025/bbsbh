import { useMemo } from 'react'
import { computeLeaders } from '../api/teamLeaders.js'
import { prospectBadge } from '../api/prospects.js'
import { SPORT_LABEL } from '../lib/teams.js'
import { SectionTitle } from './SectionTitle.jsx'
import { Headshot } from './Headshot.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { ProspectPill } from './ProspectPill.jsx'

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
// stat stack (`.shot.tlead__shot` mirrors `.topperf__shot`'s 2:3 sizing). The
// team logo shows only when the pool spans multiple clubs (`showTeamLogo`);
// on a single-team page it would be the same mark on every card, so it's hidden.
function FeaturedLeader({ entry, category, showTeamLogo, showLevel, prospectSnapshot }) {
  return (
    <div className="tlead__featured">
      <Headshot personId={entry.id} name={entry.name} className="tlead__shot" />
      {showTeamLogo && entry.teamId && (
        <TeamLogo teamId={entry.teamId} name={entry.teamAbbr} size={20} className="tlead__logo" />
      )}
      <div className="tlead__who">
        <div className="tlead__head">
          <PlayerLink id={entry.id} className="tlead__name">
            {entry.name}
          </PlayerLink>
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

function LeaderCategory({ category, entries, showTeamLogo, showLevel, prospectSnapshot }) {
  const [leader, ...rest] = entries
  return (
    <section className="tlead__cat">
      <h4 className="tlead__cat-title">{category.label}</h4>
      <FeaturedLeader
        entry={leader}
        category={category}
        showTeamLogo={showTeamLogo}
        showLevel={showLevel}
        prospectSnapshot={prospectSnapshot}
      />
      {rest.length > 0 && (
        <ol className="tlead__rest">
          {rest.map((e) => (
            <li key={e.id} className="tlead__row">
              <span className="tlead__rank">{e.rank}</span>
              <PlayerLink id={e.id} className="tlead__rowname">
                {e.name}
              </PlayerLink>
              <LeaderBadges entry={e} showLevel={showLevel} prospectSnapshot={prospectSnapshot} />
              <span className="tlead__rowval">{e.display}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// `pool`: normalized PoolPlayer[]. `categories`: descriptor array to rank.
// `limit`: how many players per category (5 on the team page, more on the
// full page). `onSeeAll`: optional — renders a "See all ›" affordance in the
// header (the team page links to the dedicated leaders page). `showTeamLogo`:
// set once the pool spans multiple teams. `title`: section heading (the broader
// leader pages pass their scope's title). `showLevel`: badge each leader's level
// (org scope, a multi-level pool). `prospectSnapshot`: fetchTopProspects() result
// to add prospect pills (any MiLB scope). `qualifier`: playing-time bar mode for
// rate categories, forwarded to computeLeaders ('leader-relative' for the large
// pools; see api/teamLeaders.js).
export function TeamLeaders({
  pool,
  categories,
  limit = 5,
  onSeeAll,
  showTeamLogo = false,
  title = 'Team leaders',
  showLevel = false,
  prospectSnapshot = null,
  qualifier = 'roster',
}) {
  const ranked = useMemo(
    () =>
      categories
        .map((category) => ({ category, entries: computeLeaders(pool, category, { limit, qualifier }) }))
        // A category with no qualifying players (thin MiLB data) is hidden
        // rather than rendered empty.
        .filter((r) => r.entries.length > 0),
    [pool, categories, limit, qualifier],
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
            showTeamLogo={showTeamLogo}
            showLevel={showLevel}
            prospectSnapshot={prospectSnapshot}
          />
        ))}
      </div>
    </div>
  )
}
