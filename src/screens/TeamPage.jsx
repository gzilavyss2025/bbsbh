import { useMemo, useState } from 'react'
import {
  fetchTeam,
  fetchTeamRoster,
  fetchStandings,
  fetchLeagueTeamStats,
  fetchAllStarRosterIds,
  fetchAffiliates,
  fetchRosterIdsForTeams,
  fetchTeamRosterIds,
  fetchTeamSchedule,
} from '../api/mlb.js'
import { fetchWarData } from '../api/war.js'
import { rankTeam, ordinal, rosterPitcherRole, firstLast, POS_ORDER } from '../api/person.js'
import { fetchTopProspects, orgProspectsForTeam, prospectAffiliateMap } from '../api/prospects.js'
import { SPORT_LABEL, teamPrimaryColor } from '../lib/teams.js'
import { gamePath } from '../lib/route.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { LinkScope } from '../lib/nav.jsx'
import { useNav } from '../lib/nav.js'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'

const DASH = '—'
const ROLE_ORDER = { SP: 0, CL: 1, RP: 2 }

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
function nickname(name) {
  return (name || '').split(/\s+/).slice(-1)[0] || name || DASH
}
function lastTen(rec) {
  const t = (rec.records?.splitRecords ?? []).find((s) => s.type === 'lastTen')
  return t ? `${t.wins}-${t.losses}` : DASH
}
function runDiff(rec) {
  const d = rec.runDifferential
  if (!Number.isFinite(d)) return DASH
  return d > 0 ? `+${d}` : `${d}`
}
function runDiffTone(rec) {
  const d = rec.runDifferential
  if (!Number.isFinite(d) || d === 0) return ''
  return d > 0 ? 'is-positive' : 'is-negative'
}

function statRank(rows, teamId, key, label, lowerBetter) {
  const mine = rows.find((r) => r.teamId === teamId)
  const r = rankTeam(rows, teamId, key, lowerBetter)
  const tone = r ? (r.rank <= 5 ? 'good' : r.rank >= 20 ? 'bad' : '') : ''
  return { k: label, v: mine?.stat?.[key] ?? DASH, rank: r ? ordinal(r.rank) : DASH, tone }
}

async function loadTeam(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = Number((asOf || isoToday()).slice(0, 4))
  const standingsDate = asOf ? dayBefore(asOf) : null
  // The MLB parent's own id — same value whether this page IS the parent or
  // one of its affiliates (team.parentOrgId rides along on a MiLB team's
  // /teams response). Every prospect belongs to the org, not to one specific
  // affiliate, so both the parent's page and every affiliate's page show the
  // same org-wide leaderboard (see the Prospects section below).
  const orgId = sportId === 1 ? id : team.parentOrgId ?? null

  const [roster, standings, league, allStarIds, warData, affiliates, prospectsSnapshot, schedule] =
    await Promise.all([
      fetchTeamRoster(id, season),
      team.league?.id
        ? fetchStandings(team.league.id, season, standingsDate)
        : Promise.resolve([]),
      sportId === 1 ? fetchLeagueTeamStats(season) : Promise.resolve({ hitting: [], pitching: [] }),
      sportId === 1 ? fetchAllStarRosterIds(season) : Promise.resolve(new Set()),
      sportId === 1 ? fetchWarData() : Promise.resolve({ season: null, bat: {}, pit: {} }),
      // The affiliate tree is keyed off the ORG id (not `id`), so an
      // affiliate's own page gets the same tree its MLB parent would.
      orgId ? fetchAffiliates(orgId, season) : Promise.resolve([]),
      fetchTopProspects(),
      fetchTeamSchedule(id, season, sportId),
    ])

  // Each org prospect's CURRENT level, resolved by live roster membership
  // (not the scraped, sometimes-ambiguous level string, e.g. "ALL (2)") — a
  // second small fan-out over this org's affiliates PLUS the MLB roster
  // itself, so a prospect who's been called up resolves to MLB rather than
  // his last MiLB stop. `fetchAffiliates` excludes the org's own MLB team, so
  // it's added in here; on the org's own page `roster` already IS that MLB
  // roster and needs no extra fetch.
  const affiliateRosterIds = affiliates.length
    ? await fetchRosterIdsForTeams(affiliates.map((a) => a.id))
    : {}
  if (orgId) {
    affiliateRosterIds[orgId] =
      sportId === 1 ? roster.map((r) => r.person?.id).filter(Boolean) : await fetchTeamRosterIds(orgId)
  }
  const affiliateByPlayer = prospectAffiliateMap(affiliateRosterIds)
  const affiliateById = new Map(affiliates.map((a) => [a.id, a]))
  if (orgId) {
    affiliateById.set(orgId, { id: orgId, sportId: 1, name: sportId === 1 ? team.name : team.parentOrgName })
  }
  const prospects = orgId
    ? orgProspectsForTeam(prospectsSnapshot.orgProspects, orgId).map((p) => {
        const affTeamId = affiliateByPlayer.get(p.playerId) ?? null
        const aff = affTeamId ? affiliateById.get(affTeamId) : null
        return {
          ...p,
          affiliateTeamId: aff ? aff.id : null,
          levelLabel: aff ? SPORT_LABEL[aff.sportId] ?? p.levelRaw : p.levelRaw,
        }
      })
    : []
  // WAR data is a single current-season file (see src/api/war.js); only trust
  // it when its season matches the team page's — otherwise (a historical
  // `asOf` team page, or MiLB with no WAR source) every badge shows DASH
  // rather than mislabeling a stale/wrong-season figure as current.
  const warBat = warData.season === season ? warData.bat : {}
  const warPit = warData.season === season ? warData.pit : {}

  const div = standings.find((r) => r.division?.id === team.division?.id)
  const myRec = div?.teamRecords?.find((t) => t.team.id === id)
  const standingsRows = (div?.teamRecords ?? []).map((t) => ({
    id: t.team.id,
    name: nickname(t.team.name),
    wins: t.wins,
    losses: t.losses,
    gb: t.gamesBack,
    streak: t.streak?.streakCode ?? DASH,
    l10: lastTen(t),
    diff: runDiff(t),
    diffTone: runDiffTone(t),
    isMe: t.team.id === id,
  }))

  const batting = league.hitting.length
    ? [
        statRank(league.hitting, id, 'runs', 'Runs', false),
        statRank(league.hitting, id, 'homeRuns', 'Home runs', false),
        statRank(league.hitting, id, 'avg', 'AVG', false),
        statRank(league.hitting, id, 'ops', 'OPS', false),
        statRank(league.hitting, id, 'stolenBases', 'Stolen bases', false),
        statRank(league.hitting, id, 'hits', 'Hits', false),
        statRank(league.hitting, id, 'groundIntoDoublePlay', 'GIDP', true),
        statRank(league.hitting, id, 'atBatsPerHomeRun', 'AB/HR', true),
        statRank(league.hitting, id, 'babip', 'BABIP', false),
      ]
    : null
  const pitching = league.pitching.length
    ? [
        statRank(league.pitching, id, 'era', 'ERA', true),
        statRank(league.pitching, id, 'whip', 'WHIP', true),
        statRank(league.pitching, id, 'strikeOuts', 'Strikeouts', false),
        statRank(league.pitching, id, 'saves', 'Saves', false),
        statRank(league.pitching, id, 'shutouts', 'Shutouts', false),
        statRank(league.pitching, id, 'completeGames', 'Complete games', false),
        statRank(league.pitching, id, 'avg', 'AVG against', true),
        statRank(league.pitching, id, 'strikeoutsPer9Inn', 'SO/9', false),
        statRank(league.pitching, id, 'walksPer9Inn', 'BB/9', true),
        statRank(league.pitching, id, 'strikeoutWalkRatio', 'K/BB', false),
        statRank(league.pitching, id, 'groundIntoDoublePlay', 'GDP', false),
        statRank(league.pitching, id, 'wildPitches', 'WP', true),
        statRank(league.pitching, id, 'pitchesPerInning', 'P/IP', true),
      ]
    : null

  const position = roster
    .filter((r) => r.position?.type !== 'Pitcher')
    .map((r) => ({
      id: r.person?.id,
      name: firstLast(r.person),
      jersey: r.jerseyNumber ?? '',
      pos: r.position?.abbreviation ?? '',
      allStar: allStarIds.has(r.person?.id),
      war: sportId === 1 ? warBat[r.person?.id] ?? null : undefined,
    }))
    .sort((a, b) => (POS_ORDER[a.pos] ?? 5) - (POS_ORDER[b.pos] ?? 5) || a.name.localeCompare(b.name))

  const pitchers = roster
    .filter((r) => r.position?.type === 'Pitcher')
    .map((r) => ({
      id: r.person?.id,
      name: firstLast(r.person),
      jersey: r.jerseyNumber ?? '',
      role: rosterPitcherRole(r),
      allStar: allStarIds.has(r.person?.id),
      war: sportId === 1 ? warPit[r.person?.id] ?? null : undefined,
    }))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3) || Number(a.jersey) - Number(b.jersey))

  return {
    team, season, sportId,
    record: myRec
      ? { wins: myRec.wins, losses: myRec.losses, rank: myRec.divisionRank, div: team.division?.name }
      : null,
    standings: standingsRows,
    batting, pitching, position, pitchers,
    affiliates, prospects, schedule,
  }
}

export function TeamPage({ id, asOf, sportId }) {
  const teamId = Number(id)
  const { loading, error, data } = useAsync(() => loadTeam(teamId, asOf), [teamId, asOf])
  useDocumentTitle(data?.team?.name || null)
  const back = () => window.history.back()

  if (loading && !data) {
    return (
      <div className="screen team-hub">
        <SiteHeader />
        <BackBtn onClick={back} />
        <p className="hint">Loading team…</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="screen team-hub">
        <SiteHeader />
        <BackBtn onClick={back} />
        <p className="hint hint--error">
          {error ? 'Couldn’t load this team. Try again.' : 'Team not found.'}
        </p>
      </div>
    )
  }

  const { team, season, record, standings, batting, pitching, position, pitchers, affiliates, prospects, schedule } = data
  // An affiliate's own page shows the same org-wide list as its MLB parent,
  // so it accentuates the rows that are also on the overall Top 100 and
  // dulls the rest — the parent's own page shows the list plainly.
  const highlightTop100 = sportId !== 1

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className="screen team-hub">
        <SiteHeader />
        <BackBtn onClick={back} />

        <header className="team-hub__id">
          <div className="team-hub__logo">
            <TeamLogo teamId={team.id} name={team.name} size={64} />
            {team.parentOrgId && (
              <TeamLogo
                teamId={team.parentOrgId}
                name={team.parentOrgName}
                variant="wordmark"
                size={22}
                className="team-hub__logo-affiliate"
              />
            )}
          </div>
          <div>
            <h1>{team.name}</h1>
            {record && (
              <p className="team-hub__rec">
                <span className="mono">{record.wins}–{record.losses}</span>
                {record.rank && record.div && (
                  <span className="team-hub__div">{ordinal(record.rank)} · {record.div}</span>
                )}
                {asOf && <em>· entering today</em>}
              </p>
            )}
          </div>
        </header>

        {schedule.length > 0 && (
          <>
            <SectionTitle title="Schedule" />
            <ScheduleCalendar
              key={`${team.id}-${asOf ?? ''}`}
              primaryColor={teamPrimaryColor(team.id)}
              games={schedule}
              refDate={asOf || isoToday()}
            />
          </>
        )}

        {standings.length > 0 && (
          <>
            <SectionTitle title={team.division?.name || 'Standings'} note={asOf ? 'entering today' : ''} />
            <div className="ledger-wrap">
              <table className="standings">
                <thead>
                  <tr>
                    <th className="team">Team</th>
                    <th>W</th><th>L</th><th>GB</th><th>Streak</th><th>L10</th><th>RD</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr key={s.id} className={s.isMe ? 'is-me' : ''}>
                      <td className="team">
                        <TeamLink id={s.isMe ? null : s.id}>
                          <TeamLogo teamId={s.id} name={s.name} size={18} />{s.name}
                        </TeamLink>
                      </td>
                      <td>{s.wins}</td><td>{s.losses}</td><td>{s.gb}</td>
                      <td>{s.streak}</td><td>{s.l10}</td>
                      <td className={s.diffTone}>{s.diff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {batting && <TeamStats title="Team batting" stats={batting} />}
        {pitching && <TeamStats title="Team pitching" stats={pitching} />}

        {position.length > 0 && (
          <>
            <SectionTitle title="Position players" note={sportId === 1 ? 'season WAR' : ''} />
            <RosterList
              season={season}
              rows={position.map((p) => ({ ...p, badge: p.pos, badgeClass: 'thub-pos' }))}
            />
          </>
        )}
        {pitchers.length > 0 && (
          <>
            <SectionTitle title="Pitchers" note={sportId === 1 ? 'role inferred · season WAR' : 'role inferred'} />
            <RosterList
              season={season}
              rows={pitchers.map((p) => ({
                ...p,
                badge: p.role ?? DASH,
                badgeClass: `rolechip${p.role === 'RP' ? ' rolechip--rp' : p.role === 'CL' ? ' rolechip--cl' : ''}`,
              }))}
            />
          </>
        )}

        {affiliates.length > 0 && (
          <>
            <SectionTitle title="Affiliates" />
            <div className="thub-affiliates">
              {affiliates.map((a) => (
                <TeamLink key={a.id} id={a.id} className="thub-affiliate">
                  <TeamLogo teamId={a.id} name={a.name} size={48} />
                  <span className="thub-affiliate__name">{a.name}</span>
                  <span className="thub-affiliate__loc">
                    {a.city}{a.state ? `, ${a.state}` : ''}
                  </span>
                </TeamLink>
              ))}
            </div>
          </>
        )}

        {prospects.length > 0 && (
          <>
            <SectionTitle
              title="Prospects"
              note={highlightTop100 ? 'org rank · Top 100 highlighted' : 'org rank'}
            />
            <div className="ledger-wrap">
              <table className="ledger prospecttable">
                <thead>
                  <tr>
                    <th className="lft">Rk</th>
                    <th className="lft">Player</th>
                    <th>Pos</th>
                    <th>Level</th>
                    <th>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => {
                    const isTop = p.topRank != null
                    const rowClass = highlightTop100 && !isTop ? 'is-dull' : ''
                    return (
                      <tr key={p.playerId} className={rowClass}>
                        <td className="lft yr">{p.orgRank}</td>
                        <td className="lft opp">
                          <PlayerLink id={p.playerId} className="prospecttable__name">{p.name}</PlayerLink>
                          {isTop && <span className="prospecttable__top">#{p.topRank}</span>}
                        </td>
                        <td>{p.position || DASH}</td>
                        <td className="prospecttable__level">
                          <span>{p.levelLabel || DASH}</span>
                          {p.affiliateTeamId && (
                            <TeamLogo teamId={p.affiliateTeamId} name={p.levelLabel} size={16} crop />
                          )}
                        </td>
                        <td className="prospecttable__line">{p.statLine || DASH}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </LinkScope>
  )
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Monthly schedule grid for the team page. `games` is spoiler-free (dates,
// opponents, home/away — see fetchTeamSchedule), so every game renders
// regardless of whether it's already been played; only the destination page
// (lineup1) manages its own sealing from there. `refDate` seeds which month
// opens first (the game this page was opened from, or today for a bare
// visit) — the calendar itself can page anywhere from there.
function ScheduleCalendar({ primaryColor, games, refDate }) {
  const [cursor, setCursor] = useState(() => ({
    year: Number(refDate.slice(0, 4)),
    month: Number(refDate.slice(5, 7)) - 1,
  }))
  const navigate = useNav()

  const byDate = useMemo(() => {
    const m = new Map()
    for (const g of games) {
      if (!m.has(g.apiDate)) m.set(g.apiDate, [])
      m.get(g.apiDate).push(g)
    }
    for (const list of m.values()) list.sort((a, b) => a.gameNumber - b.gameNumber)
    return m
  }, [games])

  const startDow = new Date(Date.UTC(cursor.year, cursor.month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate()
  const cells = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const goMonth = (delta) => {
    setCursor((c) => {
      const total = c.year * 12 + c.month + delta
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
    })
  }

  const openGame = (g) => {
    navigate(gamePath(g.apiDate, g.away.abbreviation, g.home.abbreviation, 'lineup1', g.gameNumber))
  }

  return (
    <div className="tcal">
      <div className="tcal__nav">
        <button type="button" className="tcal__navbtn" onClick={() => goMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <span className="tcal__month">{MONTH_NAMES[cursor.month]} {cursor.year}</span>
        <button type="button" className="tcal__navbtn" onClick={() => goMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="tcal__dow">
        {DOW_LABELS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="tcal__grid">
        {cells.map((d, i) => {
          if (d == null) return <div key={`b${i}`} className="tcal__cell tcal__cell--blank" />
          const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const dayGames = byDate.get(iso) ?? []
          return (
            <div key={iso} className="tcal__cell">
              <span className="tcal__daynum">{d}</span>
              {dayGames.map((g) => (
                <button
                  key={g.gamePk}
                  type="button"
                  className={`tcal__game${g.isHome ? ' tcal__game--home' : ''}`}
                  style={g.isHome && primaryColor ? { background: primaryColor } : undefined}
                  onClick={() => openGame(g)}
                  title={`${g.isHome ? 'vs' : 'at'} ${g.opponent.name}${g.doubleHeader !== 'N' ? ` · Gm ${g.gameNumber}` : ''}`}
                >
                  <TeamLogo teamId={g.opponent.id} name={g.opponent.name} size={16} />
                  {g.doubleHeader !== 'N' && <span className="tcal__gm">{g.gameNumber}</span>}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TeamStats({ title, stats }) {
  return (
    <>
      <SectionTitle title={title} note="rank of 30" />
      <div className="tstats">
        {stats.map((s) => (
          <div key={s.k} className="tstat">
            <div>
              <div className="tstat__k">{s.k}</div>
              <div className="tstat__v">{s.v}</div>
            </div>
            <span className={`rankchip${s.tone ? ` rankchip--${s.tone}` : ''}`}>{s.rank}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function RosterList({ rows, season }) {
  return (
    <ul className="thub-roster">
      {rows.map((r) => (
        <li key={`${r.id}-${r.jersey}`} className="thub-row">
          <span className="thub-jersey">{r.jersey}</span>
          <PlayerLink id={r.id} className="thub-name">
            {r.name}
            {r.allStar && (
              <span className="thub-allstar" title={`${season} All Star`}>★</span>
            )}
          </PlayerLink>
          {r.war !== undefined && (
            <span
              className={`rankchip${r.war == null ? '' : r.war >= 3 ? ' rankchip--good' : r.war < 0 ? ' rankchip--bad' : ''}`}
              title="Season WAR (FanGraphs)"
            >
              {r.war == null ? DASH : r.war.toFixed(1)}
            </span>
          )}
          <span className={r.badgeClass}>{r.badge}</span>
          <span className="thub-chev">›</span>
        </li>
      ))}
    </ul>
  )
}

function SectionTitle({ title, note }) {
  return (
    <h3 className="section__title">
      <span>{title}</span>
      {note && <em>{note}</em>}
    </h3>
  )
}

function BackBtn({ onClick }) {
  return (
    <button type="button" className="backbtn" onClick={onClick}>
      ‹ back
    </button>
  )
}
