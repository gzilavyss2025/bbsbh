import { useEffect, useMemo, useRef, useState } from 'react'
import { loadAllStarRosters } from '../api/allStarRosters.js'
import { topActiveByAppearances, currentRosterLegacyByTeam } from '../api/allStarLegacy.js'
import { fetchRosterEntriesForTeams } from '../api/team.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useColumnCount } from '../hooks/useColumnCount.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { ALL_MLB_TEAM_IDS, teamFullName } from '../lib/teams.js'

// How many honorees a team card shows before "Show all" — most clubs' full
// history runs well past this (a 90-year-old franchise can have 100+ distinct
// selectees), and rendering every headshot in every one of 30 cards up front
// is the kind of unbounded DOM/image cost the milestone/rehab pages avoid by
// precomputing; here the list itself is cheap (client-side reshape of data
// already on hand), so the cap is purely about how much a phone screen should
// show before asking.
const TEAM_PREVIEW_COUNT = 8

// The leader grid always wants at least this many cards, but a wide-enough
// screen fits more per row than a phone does — see useColumnCount —
// so the ACTUAL count shown rounds up to whatever fills every row completely
// rather than leaving an orphaned partial row. The pool fetched is generous
// enough to cover the widest realistic layout (the app's own wide-screen cap
// is 960px, see .screen's `min-width: 740px` media query in index.css) with
// room to spare.
const LEADER_MIN_COUNT = 10
const LEADER_POOL_SIZE = 20
// Must match .allstarlegacy__leadergrid's `minmax(240px, 1fr)` + gap
// (--space-3, 12px) in index.css — same "JS mirrors the CSS auto-fill math"
// convention as MasonryColumns.jsx, so the measured column count the grid
// actually renders and the number of cards we hand it always agree.
const LEADER_CARD_WIDTH = 240
const LEADER_GRID_GAP = 12

function yearsLabel(years) {
  return years.join(', ')
}

// One player card for the "most appearances, active players" header grid —
// same shape as MilestoneWatchPage's per-player card (portrait + identity
// block), but the "row" underneath is a single career-count headline instead
// of a stack of milestone chases.
function LeaderCard({ row }) {
  return (
    <article className="allstarlegacy__leadercard">
      <span className="allstarlegacy__leadermug">
        <Headshot
          personId={row.playerId}
          name={row.name}
          teamId={row.teamId}
          className="allstarlegacy__leadershot"
        />
      </span>
      <div className="allstarlegacy__leaderbody">
        <span className="allstarlegacy__leaderwho">
          <PlayerLink id={row.playerId}>{row.name}</PlayerLink>
          {row.teamId && (
            <TeamLink id={row.teamId} className="allstarlegacy__leaderteam">
              <TeamLogo teamId={row.teamId} size={16} />
              {teamFullName(row.teamId)}
            </TeamLink>
          )}
        </span>
        <span className="allstarlegacy__leadercount">
          {row.count}× All-Star
        </span>
        <span className="allstarlegacy__leaderyears">{yearsLabel(row.years)}</span>
      </div>
    </article>
  )
}

// One honoree row inside a team card — a bigger mug (his primary position as
// a pill over its corner, same treatment as MilestoneWatchPage's mug/pos),
// then the name on its OWN line (never truncated: a name sharing one line
// with a year list was getting squeezed down to "YUSEI KIK…", unreadable),
// with just the years he made it underneath — no redundant "3× All-Star"
// label, since every name in this list is already an All-Star by definition.
// The row stretches to the full card width rather than a narrow list line.
function HonoreeRow({ p }) {
  return (
    <li className="allstarlegacy__honoree">
      <span className="allstarlegacy__honoreemug">
        <Headshot personId={p.playerId} name={p.name} className="allstarlegacy__honoreeshot" />
        {p.position && <span className="allstarlegacy__honoreepos">{p.position}</span>}
      </span>
      <div className="allstarlegacy__honoreebody">
        <PlayerLink id={p.playerId} className="allstarlegacy__honoreename">
          {p.name}
        </PlayerLink>
        <span className="allstarlegacy__honoreeyears">{yearsLabel(p.years)}</span>
      </div>
    </li>
  )
}

// One of the 30 team cards, ranked #1 (most current All-Stars) to #30
// (fewest) — see rankedTeamIds in AllStarLegacyPage. Every player CURRENTLY
// on this club's roster who has ever been named an All-Star, for any club
// (see currentRosterLegacyByTeam in allStarLegacy.js — the honor travels
// with the player, not the jersey he earned it in). Collapsed to
// TEAM_PREVIEW_COUNT rows by default; "Show all" reveals the rest, same
// flat-expand convention as the All-Star Rosters page's own "Load more".
// `cardRef` tags the card with its rank (a `data-rank` attribute) and hands
// the DOM node to the page's scroll-spy IntersectionObserver, which drives
// the floating rank rail.
function TeamLegacyCard({ teamId, rank, honorees, cardRef }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? honorees : honorees.slice(0, TEAM_PREVIEW_COUNT)
  const remaining = honorees.length - visible.length

  return (
    <section className="allstarlegacy__teamcard" data-rank={rank} ref={cardRef}>
      <TeamLink id={teamId} className="allstarlegacy__teamhead">
        <span className="allstarlegacy__teamrank">{rank}</span>
        <TeamLogo teamId={teamId} size={28} />
        <span className="allstarlegacy__teamname">{teamFullName(teamId)}</span>
        <span className="allstarlegacy__teamtotal">
          {honorees.length} All-Star{honorees.length === 1 ? '' : 's'}
        </span>
      </TeamLink>
      {honorees.length > 0 ? (
        <>
          <ul className="allstarlegacy__honorees">
            {visible.map((p) => (
              <HonoreeRow key={p.playerId} p={p} />
            ))}
          </ul>
          {remaining > 0 && (
            <button
              type="button"
              className="allstarlegacy__more"
              onClick={() => setExpanded(true)}
            >
              Show all {honorees.length} (+{remaining} more)
            </button>
          )}
        </>
      ) : (
        <p className="hint">No one on the current roster has ever been named an All-Star.</p>
      )}
    </section>
  )
}

// How far down the track (in vh from the top of the viewport) the rail's
// thumb travels — rank 1 sits near the top of the screen, the last rank near
// the bottom, never flush against either edge.
const RANK_TRACK_TOP_VH = 10
const RANK_TRACK_BOTTOM_VH = 90

// A small indicator that travels along a fixed vertical line on the side of
// the viewport as you scroll past the team cards — near the top of the
// screen at rank 1, near the bottom at the last rank, sliding smoothly
// between the two as "current rank" changes (whichever card is crossing a
// thin band near the vertical center of the screen — see the
// IntersectionObserver in AllStarLegacyPage) rather than staying pinned in
// place. Purely decorative/orientational (the rank number is already printed
// on each card itself), hence aria-hidden.
function TeamRankRail({ rank, total }) {
  if (!rank) return null
  const fraction = total > 1 ? (rank - 1) / (total - 1) : 0
  const thumbTopVh = RANK_TRACK_TOP_VH + fraction * (RANK_TRACK_BOTTOM_VH - RANK_TRACK_TOP_VH)
  return (
    <div className="allstarlegacy__rankrail-wrap" aria-hidden="true">
      <div className="allstarlegacy__rankrail-track" />
      <div className="allstarlegacy__rankrail" style={{ top: `${thumbTopVh}vh` }}>
        <span className="allstarlegacy__rankrail-num">{rank}</span>
        <span className="allstarlegacy__rankrail-of">of {total}</span>
      </div>
    </div>
  )
}

// All-Star Legacy: who's ever been named an All-Star, distilled two ways from
// the same All-Star Rosters data (see api/allStarLegacy.js) — the all-time
// appearance leaders among today's active players up top, then every
// CURRENT roster's All-Star alumni below (a traded veteran's honor shows up
// under his new club, not the one he earned it with). Selection membership
// carries no individual game's score (same footing as Awards History/League
// Leaders/WAR), so this page needs no SealBox.
export function AllStarLegacyPage() {
  useDocumentTitle('All-Star Legacy')
  const rostersAsync = useAsync(() => loadAllStarRosters(), [])
  // One live roster fetch, reused for BOTH sections below: who's active
  // (the leader grid's eligibility filter) and who's on each of the 30
  // current rosters (the team cards' membership).
  const rosterEntriesAsync = useAsync(
    () => fetchRosterEntriesForTeams(ALL_MLB_TEAM_IDS, '40Man'),
    [],
  )

  const rosters = rostersAsync.data?.rosters
  const hasRosters = (rostersAsync.data?.seasons ?? []).length > 0
  const updated = rostersAsync.data?.generatedAt?.slice(0, 10) ?? null

  const activeIds = useMemo(() => {
    if (!rosterEntriesAsync.data) return null
    const set = new Set()
    for (const entries of Object.values(rosterEntriesAsync.data)) {
      for (const { id } of entries) set.add(id)
    }
    return set
  }, [rosterEntriesAsync.data])

  const [leaderGridRef, leaderCols] = useColumnCount(LEADER_CARD_WIDTH, LEADER_GRID_GAP)

  const leaderPool = useMemo(() => {
    if (!hasRosters || !activeIds) return []
    return topActiveByAppearances(rosters, activeIds, LEADER_POOL_SIZE)
  }, [hasRosters, rosters, activeIds])

  // Round the shown count UP to the nearest full row for however many
  // columns the grid currently measures — never fewer than LEADER_MIN_COUNT,
  // but a wide screen with room for more per row shows more cards so the
  // last row is never an orphaned partial one. Falls back to whatever the
  // pool actually has if it's thinner than a full row (very unlikely — see
  // LEADER_POOL_SIZE — but a real edge case if very few active players have
  // ANY All-Star appearance).
  const leaders = useMemo(() => {
    if (leaderPool.length === 0) return []
    const rows = Math.max(1, Math.ceil(LEADER_MIN_COUNT / leaderCols))
    const wanted = leaderCols * rows
    if (leaderPool.length >= wanted) return leaderPool.slice(0, wanted)
    const fullRows = Math.floor(leaderPool.length / leaderCols) * leaderCols
    return leaderPool.slice(0, fullRows || leaderPool.length)
  }, [leaderPool, leaderCols])

  const byTeam = useMemo(() => {
    if (!hasRosters || !rosterEntriesAsync.data) return null
    return currentRosterLegacyByTeam(rosters, rosterEntriesAsync.data)
  }, [hasRosters, rosters, rosterEntriesAsync.data])

  // Most current All-Stars first, fewest last — falls back to the plain
  // 30-team id list (unranked) while byTeam is still loading, so the grid can
  // render immediately rather than waiting on this live roster join.
  const rankedTeamIds = useMemo(() => {
    if (!byTeam) return ALL_MLB_TEAM_IDS
    return [...ALL_MLB_TEAM_IDS].sort((a, b) => {
      const diff = (byTeam.get(b)?.length ?? 0) - (byTeam.get(a)?.length ?? 0)
      return diff !== 0 ? diff : teamFullName(a).localeCompare(teamFullName(b))
    })
  }, [byTeam])

  // Scroll-spy for the floating rank rail: watch every team card with a thin
  // horizontal band near the viewport's vertical center (rootMargin below),
  // and treat whichever card(s) cross it as "current" — the topmost-ranked
  // one when the grid's multi-column layout puts more than one in that band
  // at once. Cards don't unmount when rankedTeamIds reorders (same keys, just
  // repositioned), so refs stay valid and the effect only needs to run once
  // the data driving the sort has actually loaded.
  const [currentRank, setCurrentRank] = useState(null)
  const cardEls = useRef(new Set())
  useEffect(() => {
    if (!byTeam) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleRanks = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number(e.target.dataset.rank))
        if (visibleRanks.length > 0) setCurrentRank(Math.min(...visibleRanks))
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    for (const el of cardEls.current) observer.observe(el)
    return () => observer.disconnect()
  }, [byTeam])

  const loading = rostersAsync.loading || rosterEntriesAsync.loading
  // Either fetch failing is a real error — a cold rostersAsync failure blocks
  // (no data ever landed), while a rosterEntriesAsync failure with rostersAsync
  // already loaded is a stale-data case: the leader/team sections below would
  // otherwise render their live-roster join as genuinely empty (see byTeam/
  // activeIds' null guards) rather than as a load failure.
  const error = rostersAsync.error || rosterEntriesAsync.error

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">All-Star Legacy</h1>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={hasRosters}
        errorMessage="Couldn’t load All-Star Legacy. Try again."
        staleErrorMessage="Couldn’t load current rosters — the leader board and team lists below may be incomplete."
        emptyMessage="No All-Star history is available right now."
        emptyProse
      />

      {hasRosters && (
        <>
          <section className="allstarlegacy__section">
            <h2 className="allstarlegacy__sectiontitle">
              Most All-Star Appearances — Active Players
            </h2>
            {leaders.length > 0 ? (
              <div className="allstarlegacy__leadergrid" ref={leaderGridRef}>
                {leaders.map((row) => (
                  <LeaderCard key={row.playerId} row={row} />
                ))}
              </div>
            ) : (
              <p className="hint">Couldn’t determine which All-Stars are still active right now.</p>
            )}
          </section>

          <section className="allstarlegacy__section">
            <h2 className="allstarlegacy__sectiontitle">Every Franchise’s All-Stars, Most to Fewest</h2>
            <div className="allstarlegacy__teamgrid">
              {rankedTeamIds.map((teamId, i) => (
                <TeamLegacyCard
                  key={teamId}
                  teamId={teamId}
                  rank={i + 1}
                  honorees={byTeam?.get(teamId) ?? []}
                  cardRef={(el) => {
                    if (el) cardEls.current.add(el)
                  }}
                />
              ))}
            </div>
          </section>

          {updated && <p className="hint prospects__caption">Roster data updated {updated}.</p>}
          <TeamRankRail rank={currentRank} total={rankedTeamIds.length} />
        </>
      )}
    </div>
  )
}
