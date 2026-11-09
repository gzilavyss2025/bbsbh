import '../../styles/report/infield.css'
import { loadInfield } from '../../api/infield/infield.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { teamAbbr, teamClubName, teamFullName } from '../../lib/teams.js'
import { monthDayName } from '../../lib/dates.js'
import { gamePath } from '../../lib/route.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'

const n = (x) => x.toLocaleString('en-US')

// The file carries the game's own abbreviations (OAK in 2023, not ATH); today's are only a fallback.
function abbrs(r) {
  const [awayId, homeId] = r.home ? [r.oppId, r.teamId] : [r.teamId, r.oppId]
  return { away: r.awayAbbr || teamAbbr({ id: awayId }), home: r.homeAbbr || teamAbbr({ id: homeId }) }
}

function rowPath(r) {
  const { away, home } = abbrs(r)
  return gamePath(r.date, away, home, 'boxscore', r.gameNumber)
}

const oppAbbr = (r) => (r.home ? abbrs(r).away : abbrs(r).home)

function SeasonTable({ season, favoriteTeamId }) {
  return (
    <Table frame="bare" label={`${season.season} team-games with no outfield out`} className="infield">
      <thead>
        <tr>
          <th>Date</th>
          <th className="club">Batting club</th>
          <th className="club">Opponent</th>
          <th>OF hits</th>
        </tr>
      </thead>
      <tbody>
        {season.rows.map((r) => (
          <tr key={`${r.gamePk}:${r.teamId}`} className={r.teamId === favoriteTeamId ? 'infield__fav' : undefined}>
            <td>
              <a href={rowPath(r)}>{monthDayName(r.date)}</a>
            </td>
            <td className="club">
              <span className="infield__club">
                <TeamLogo teamId={r.teamId} name={teamFullName(r.teamId)} size={20} />
                {teamClubName(r.teamId) || '—'}
              </span>
            </td>
            <td className="club">
              {r.home ? 'vs' : 'at'} <abbr title={teamFullName(r.oppId)}>{oppAbbr(r)}</abbr>
            </td>
            <td>{r.ofHits}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// Team-games since 2021 in which a club made no out to an outfielder (#2976). A standalone
// report, not a scoring surface: it opens live with no seal, and it shows no scores (ADR-0034).
export function InfieldPage() {
  useDocumentTitle('Kept It in the Infield')
  const { loading, error, data } = useAsync(() => loadInfield(), [])
  const { favoriteTeamId } = useFavoriteTeam()
  const hasData = (data?.seasons?.length ?? 0) > 0

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Kept It in the Infield</h1>
      </header>

      <p className="hint">
        Regular-season games where one club made no out to an outfielder. Every out was a strikeout or a ball
        handled first by the pitcher, the catcher or an infielder. Hits to the outfield and home runs still count.
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={hasData}
        errorMessage="Couldn’t load these games. Try again."
        emptyMessage="No games yet."
      />

      {hasData && (
        <>
          <p className="infield__census">
            <strong>{n(data.qualifiers)}</strong> of {n(data.teamGames)} team-games, {data.first}–{data.last}.{' '}
            {n(data.nearMiss)} more made just one outfield out.
          </p>
          {/* Stamped cards stack in a Stack, never on sibling margins: margins collapse and
              leave each name tab touching the card above. */}
          <Stack gap="loose">
          {data.seasons.map((s) => (
            <Card
              key={s.season}
              frame="stamped"
              body="flush"
              label={String(s.season)}
              count={`${s.rows.length} of ${n(s.teamGames)} · ${s.nearMiss} near misses`}
              className="infield__section"
            >
              {s.rows.length ? (
                <SeasonTable season={s} favoriteTeamId={favoriteTeamId} />
              ) : (
                <p className="hint">None this season.</p>
              )}
            </Card>
          ))}
          </Stack>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
