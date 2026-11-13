import { useMemo, useState } from 'react'
import { loadAwardsHistory, loadSeasonAwards, awardsSeasonInPlay } from '../api/awards/history.js'
import { ALL_MLB_KEY, countAnnounced, isRosterAward, mergeAllMlb, pastWinners, seasonRows, splitName } from '../api/awards/ledger.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { Card } from '../components/ui/frame/Card.jsx'
import { EmptyState } from '../components/ui/state/EmptyState.jsx'
import { Notice } from '../components/ui/state/Notice.jsx'
import { Button } from '../components/ui/control/Button.jsx'
import { Chips } from '../components/ui/control/Chips.jsx'
import { Table } from '../components/ui/table/Table.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { Stack } from '../components/ui/layout/Stack.jsx'
import { teamAbbr } from '../lib/teams.js'
import { monthDayName } from '../lib/dates.js'

// The Awards page (#2546, "the ledger"): two stamped cards of plain tables. This
// season's winners first, read live as MLB announces them; then past winners, one
// award at a time, a row per year. The season in play shows only in the first card,
// so no winner prints twice. AL and NL keep their filled league banners.

const BANNER_CLASS = { AL: 'awardhistory__leaguetag--al', NL: 'awardhistory__leaguetag--nl' }
// The white knockout league marks gen-mono-logos.mjs writes for Standings' bars
// (159 American League, 160 National League; ADR-0031: art, never a CSS filter).
const LEAGUE_MARK = { AL: { id: 159, name: 'American League' }, NL: { id: 160, name: 'National League' } }

// One winner: logo, first name on a small line, last name, then club (and position
// for a roster award). The reader's club gets --surface-mine.
function Winner({ r, favoriteTeamId, showPosition }) {
  const [first, last] = splitName(r.name)
  const mine = favoriteTeamId != null && r.teamId === favoriteTeamId
  const club = r.teamId ? teamAbbr({ id: r.teamId }) : r.teamName
  return (
    <li className={`awardhistory__winner${mine ? ' awardhistory__winner--mine' : ''}`}>
      <PlayerLink id={r.playerId} name={r.name} className="awardhistory__name">
        {first && <span className="awardhistory__first">{first}</span>}
        <span className="awardhistory__last">{last}</span>
      </PlayerLink>
      <span className="awardhistory__club t-label">
        {r.teamId ? (
          <TeamLink id={r.teamId} ariaLabel={r.teamName}>
            <TeamLogo teamId={r.teamId} name={r.teamName} size={18} />
          </TeamLink>
        ) : null}
        {showPosition && r.position ? `${r.position} · ${club}` : club}
      </span>
    </li>
  )
}

// showPosition: a roster award (Gold Glove, All-MLB, ...) names each winner's position.
function Winners({ recipients, favoriteTeamId, showPosition = false }) {
  return (
    <ul className="awardhistory__winners">
      {recipients.map((r, i) => (
        <Winner key={`${r.playerId}-${r.position}-${i}`} r={r} favoriteTeamId={favoriteTeamId} showPosition={showPosition} />
      ))}
    </ul>
  )
}

function Banner({ league, children }) {
  const mark = LEAGUE_MARK[league]
  return (
    <th scope="col" className={`awardhistory__leaguetag ${BANNER_CLASS[league] ?? 'awardhistory__leaguetag--plain'}`}>
      {mark ? (
        <>
          <TeamLogo teamId={mark.id} name={mark.name} variant="mono" size={22} />
          <span className="sr-only">{mark.name}</span>
        </>
      ) : (
        children
      )}
    </th>
  )
}

function RetryButton({ retry }) {
  return (
    <Button onClick={retry.run} busy={retry.busy}>
      Try again
    </Button>
  )
}

// One live cell: the winners once announced, else the date-free "not announced yet",
// else an error with a retry of the whole season read.
function SeasonCell({ cell, favoriteTeamId, retry, colSpan, showPosition }) {
  return (
    <td colSpan={colSpan}>
      {cell.status === 'announced' ? (
        <Winners recipients={cell.recipients} favoriteTeamId={favoriteTeamId} showPosition={showPosition} />
      ) : cell.status === 'error' ? (
        <Notice tone="error" size="compact" role="status" action={<RetryButton retry={retry} />}>
          Couldn’t load.
        </Notice>
      ) : (
        <span className="hint">Not announced yet</span>
      )}
    </td>
  )
}

function SeasonTable({ rows, label, favoriteTeamId, retry }) {
  return (
    <Table frame="bare" density="keep" label={label} className="awardhistory__table">
      <thead>
        <tr>
          <th scope="col" className="awardhistory__award">Award</th>
          <Banner league="AL" />
          <Banner league="NL" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className="awardhistory__award">{row.label}</th>
            {row.split ? (
              ['AL', 'NL'].map((lg) => {
                const cell = row.cells.find((c) => c.league === lg)
                return cell ? (
                  <SeasonCell key={lg} cell={cell} favoriteTeamId={favoriteTeamId} retry={retry} showPosition={isRosterAward(row.key)} />
                ) : (
                  <td key={lg} />
                )
              })
            ) : (
              <SeasonCell cell={row.cells[0]} colSpan={2} favoriteTeamId={favoriteTeamId} retry={retry} showPosition={isRosterAward(row.key)} />
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// This season's winners. The roster awards (Silver Slugger, Gold Glove, All-MLB)
// open in place behind one button, so the table stays a screen tall.
function ThisSeason({ season, favoriteTeamId }) {
  const { loading, error, data, reload } = useAsync(() => loadSeasonAwards(season), [season])
  const [open, setOpen] = useState(false)
  const rows = seasonRows(data ?? [])
  const main = rows.filter((r) => !isRosterAward(r.key))
  const roster = rows.filter((r) => isRosterAward(r.key))
  const rosterCount = roster.reduce((n, r) => n + r.cells.reduce((m, c) => m + c.recipients.length, 0), 0)
  const rosterFailed = roster.some((r) => r.cells.some((c) => c.status === 'error'))
  const cells = rows.flatMap((r) => r.cells)
  // Nothing came back at all (offline, the API down): one message, not one per cell.
  const allFailed = !!error || (cells.length > 0 && cells.every((c) => c.status === 'error'))
  const retry = { run: reload, busy: loading }
  const announced = countAnnounced(data ?? [])
  return (
    <Card frame="stamped" label={`${season} winners`} className="awardhistory__card">
      {loading && !data && !error && <EmptyState size="compact" role="status">Checking {season} winners…</EmptyState>}
      {allFailed && (
        <Notice tone="error" size="compact" action={<RetryButton retry={retry} />}>
          Couldn’t load the {season} winners.
        </Notice>
      )}
      {!!data && !allFailed && (
        <Stack>
          <p className="hint">{`${announced} of ${rows.length} awards announced`}</p>
          <SeasonTable rows={main} label={`${season} award winners`} favoriteTeamId={favoriteTeamId} retry={retry} />
          {roster.length > 0 &&
            (open ? (
              <SeasonTable rows={roster} label={`${season} position award winners`} favoriteTeamId={favoriteTeamId} retry={retry} />
            ) : (
              <Button
                block
                hint={rosterFailed ? 'Some couldn’t load' : rosterCount ? `${rosterCount} winners` : 'Not announced yet'}
                onClick={() => setOpen(true)}
              >
                {roster.map((r) => r.label).join(' · ')}
              </Button>
            ))}
        </Stack>
      )}
    </Card>
  )
}

function PastWinners({ families, season, favoriteTeamId }) {
  const [picked, setPicked] = useState(families[0]?.key)
  const family = families.find((f) => f.key === picked) ?? families[0]
  const { columns, rows } = useMemo(() => pastWinners(family, season), [family, season])
  const rosterFamily = isRosterAward(family.key) || family.key === ALL_MLB_KEY
  return (
    <Card frame="stamped" label="Past winners" className="awardhistory__card">
      <Stack>
        <Chips
          label="Award"
          layout="rail"
          options={families.map((f) => ({ value: f.key, label: f.label }))}
          value={family.key}
          onChange={setPicked}
        />
        {rows.length === 0 ? (
          <EmptyState size="compact">No past winners on file</EmptyState>
        ) : (
          <Table frame="bare" density="keep" label={`${family.label} winners by year`} className="awardhistory__table">
            <thead>
              <tr>
                <th scope="col" className="awardhistory__year">Year</th>
                {columns.map((c) => (
                  <Banner key={c.key} league={c.key}>{c.short}</Banner>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year}>
                  <th scope="row" className="awardhistory__year">{row.year}</th>
                  {columns.map((c) => (
                    <td key={c.key}>
                      <Winners recipients={row.cells[c.key]} favoriteTeamId={favoriteTeamId} showPosition={rosterFamily} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Stack>
    </Card>
  )
}

export function AwardsHistoryPage() {
  useDocumentTitle('Awards')
  const { loading, error, data } = useAsync(() => loadAwardsHistory(), [])
  const { favoriteTeamId } = useFavoriteTeam()
  const season = awardsSeasonInPlay()
  const families = useMemo(() => mergeAllMlb(data?.families ?? []), [data])
  const updated = monthDayName(data?.generatedAt)

  return (
    <div className="screen awardhistory">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Awards</h1>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={families.length > 0}
        errorMessage="Couldn’t load Awards History. Try again."
        emptyMessage="No award history is available right now."
      />

      <Stack gap="loose">
        {season && <ThisSeason season={season} favoriteTeamId={favoriteTeamId} />}
        {families.length > 0 && <PastWinners families={families} season={season} favoriteTeamId={favoriteTeamId} />}
      </Stack>
      {families.length > 0 && updated && <p className="hint prospects__caption">Updated {updated}.</p>}

      <ReportFooter />
    </div>
  )
}
