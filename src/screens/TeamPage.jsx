import {
  fetchTeam,
  fetchTeamRoster,
  fetchStandings,
  fetchLeagueTeamStats,
  fetchAllStarRosterIds,
  fetchAffiliates,
} from '../api/mlb.js'
import { fetchWarData } from '../api/war.js'
import { rankTeam, ordinal, rosterPitcherRole, firstLast } from '../api/person.js'
import { useAsync } from '../hooks/useAsync.js'
import { LinkScope } from '../lib/nav.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'

const DASH = '—'
const POS_ORDER = { C: 1, '1B': 2, '2B': 3, SS: 3.5, '3B': 4, LF: 6, CF: 7, RF: 8, OF: 6.5, DH: 9 }
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

  const [roster, standings, league, allStarIds, warData, affiliates] = await Promise.all([
    fetchTeamRoster(id, season),
    team.league?.id
      ? fetchStandings(team.league.id, season, standingsDate)
      : Promise.resolve([]),
    sportId === 1 ? fetchLeagueTeamStats(season) : Promise.resolve({ hitting: [], pitching: [] }),
    sportId === 1 ? fetchAllStarRosterIds(season) : Promise.resolve(new Set()),
    sportId === 1 ? fetchWarData() : Promise.resolve({ season: null, bat: {}, pit: {} }),
    // Affiliate tree only makes sense from the MLB parent looking down.
    sportId === 1 ? fetchAffiliates(id, season) : Promise.resolve([]),
  ])
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
    isMe: t.team.id === id,
  }))

  const batting = league.hitting.length
    ? [
        statRank(league.hitting, id, 'runs', 'Runs', false),
        statRank(league.hitting, id, 'homeRuns', 'Home runs', false),
        statRank(league.hitting, id, 'avg', 'AVG', false),
        statRank(league.hitting, id, 'ops', 'OPS', false),
        statRank(league.hitting, id, 'stolenBases', 'Stolen bases', false),
      ]
    : null
  const pitching = league.pitching.length
    ? [
        statRank(league.pitching, id, 'era', 'ERA', true),
        statRank(league.pitching, id, 'whip', 'WHIP', true),
        statRank(league.pitching, id, 'strikeOuts', 'Strikeouts', false),
        statRank(league.pitching, id, 'saves', 'Saves', false),
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
    affiliates,
  }
}

export function TeamPage({ id, asOf, sportId }) {
  const teamId = Number(id)
  const { loading, error, data } = useAsync(() => loadTeam(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  if (loading && !data) {
    return (
      <div className="screen team-hub">
        <BackBtn onClick={back} />
        <p className="hint">Loading team…</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="screen team-hub">
        <BackBtn onClick={back} />
        <p className="hint hint--error">
          {error ? 'Couldn’t load this team. Try again.' : 'Team not found.'}
        </p>
      </div>
    )
  }

  const { team, season, record, standings, batting, pitching, position, pitchers, affiliates } = data

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className="screen team-hub">
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
                      <td className="team"><TeamLogo teamId={s.id} name={s.name} size={18} />{s.name}</td>
                      <td>{s.wins}</td><td>{s.losses}</td><td>{s.gb}</td>
                      <td>{s.streak}</td><td>{s.l10}</td><td>{s.diff}</td>
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
      </div>
    </LinkScope>
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
