import { useMemo } from 'react'
import { computeLeaders } from '../api/teamLeaders.js'
import { SectionTitle } from './SectionTitle.jsx'
import { Headshot } from './Headshot.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { PlayerLink } from './PlayerLink.jsx'

// TEAM LEADERS — per-category season leaderboards for a team. Each category
// features its leader as a headshot card (styled like the slate's Top Performers
// row) with the chasers (ranks 2–N) as plain rows beneath. Pool-agnostic: it
// ranks whatever normalized PoolPlayer[] it's handed (see api/teamLeaders.js),
// so the same component serves both the team page's Phase-1 cross-section and the
// dedicated leaders page's full list — and, later, a league/level pool.

// Rank 1 — the featured card. Reuses the Top Performers headshot frame + name/
// stat stack (`.shot.tlead__shot` mirrors `.topperf__shot`'s 2:3 sizing). The
// team logo shows only when the pool spans multiple clubs (`showTeamLogo`);
// on a single-team page it would be the same mark on every card, so it's hidden.
function FeaturedLeader({ entry, category, showTeamLogo }) {
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
        <div className="tlead__stat">
          <span className="tlead__statval">{entry.display}</span>
          <span className="tlead__statlabel">{category.short}</span>
        </div>
      </div>
    </div>
  )
}

function LeaderCategory({ category, entries, showTeamLogo }) {
  const [leader, ...rest] = entries
  return (
    <section className="tlead__cat">
      <h4 className="tlead__cat-title">{category.label}</h4>
      <FeaturedLeader entry={leader} category={category} showTeamLogo={showTeamLogo} />
      {rest.length > 0 && (
        <ol className="tlead__rest">
          {rest.map((e) => (
            <li key={e.id} className="tlead__row">
              <span className="tlead__rank">{e.rank}</span>
              <PlayerLink id={e.id} className="tlead__rowname">
                {e.name}
              </PlayerLink>
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
// set once the pool spans multiple teams.
export function TeamLeaders({ pool, categories, limit = 5, onSeeAll, showTeamLogo = false }) {
  const ranked = useMemo(
    () =>
      categories
        .map((category) => ({ category, entries: computeLeaders(pool, category, { limit }) }))
        // A category with no qualifying players (thin MiLB data) is hidden
        // rather than rendered empty.
        .filter((r) => r.entries.length > 0),
    [pool, categories, limit],
  )

  if (ranked.length === 0) return null

  return (
    <div className="tlead">
      <SectionTitle
        title="Team leaders"
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
          />
        ))}
      </div>
    </div>
  )
}
