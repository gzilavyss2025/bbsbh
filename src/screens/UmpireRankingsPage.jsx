import { useState } from 'react'
import { loadUmpireRankings } from '../api/umpires.js'
import { fetchTodayPlateUmpireIds } from '../api/schedule.js'
import { toApiDate } from '../lib/dates.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { UmpireLink } from '../components/umpire/UmpireLink.jsx'
import { TierPill } from '../components/badges/TierPill.jsx'
import { HomePlateIcon } from '../components/badges/UmpireTierGlyph.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { Table } from '../components/ui/table/Table.jsx'
import { umpireRankingsPath } from '../lib/route.js'
import { SeasonPicker } from '../components/season/SeasonPicker.jsx'
import { useSeasonView } from '../hooks/seasons/useSeasonView.js'
import { boardCompare } from '../lib/seasons/view.js'

const pct1 = (x) => `${(x * 100).toFixed(1)}%`

// Every qualifying MLB plate umpire this season, ranked by called-pitch
// accuracy, with the statistical tier (api/umpires.js's tierForZ — SD buckets
// over the whole qualifying pool, not equal thirds) his accuracy falls into.
// Ball/strike judgment counts carry no score, so — like the per-umpire page —
// this needs no SealBox. A row for an umpire slated behind the plate TODAY
// gets a highlight + chip (fetchTodayPlateUmpireIds) — a schedule assignment,
// same spoiler-free footing as the rest of this page.
//
// A season view (#1202): `seasonYear` and `vs` come from the address. The
// highlight is TODAY's plate, so it lights a row whatever season is shown.
export function UmpireRankingsPage({ seasonYear, vs }) {
  useDocumentTitle('Home Plate Umpire Rankings')
  const view = useSeasonView('umpire-accuracy', { seasonYear, vs })
  const shown = view?.shown
  const rankings = useAsync(
    () => (view ? loadUmpireRankings({ seasonYear: shown }) : Promise.resolve(null)),
    [view != null, shown],
  )
  const { error, data } = rankings
  const loading = !view || rankings.loading
  const { data: prev } = useAsync(
    () => (view?.vs ? loadUmpireRankings({ seasonYear: view.vs }) : Promise.resolve(null)),
    [view?.vs],
  )
  const [mode, setMode] = useState('change')
  const prevById = new Map((prev?.ranked ?? []).map((u) => [u.id, u]))
  const compare = prev
    ? boardCompare({ vs: view.vs, mode, format: 'pct', value: (u) => u.accuracy, prevOf: (u) => prevById.get(u.id) })
    : null
  const { data: todayIds } = useAsync(
    () => fetchTodayPlateUmpireIds(toApiDate()),
    [],
  )
  const todayPlateIds = todayIds ?? new Set()
  const ranked = data?.ranked ?? []
  const spread = ranked.length > 1 ? ranked[0].accuracy - ranked[ranked.length - 1].accuracy : null

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Home Plate Umpire Rankings</h1>
      </header>

      <SeasonPicker view={view} pathFor={umpireRankingsPath} mode={mode} onMode={setMode} />

      <p className="hint">
        {view?.label ? `${view.label} ${shown === 'all' ? 'seasons' : 'season'} ` : 'Season '}
        called-pitch accuracy for every plate umpire with at least a handful of starts behind
        the plate. Tiers are set by standard deviation from the league mean, not an even split —
        {spread != null
          ? ` the whole field spans under ${(spread * 100).toFixed(1)} points.`
          : ' the gap between the best and worst plate umpires is small.'}
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={ranked.length > 0}
        errorMessage="Couldn’t load umpire rankings. Try again."
        emptyMessage="No umpire accuracy data available yet."
      />

      {ranked.length > 0 && (
        <Table label="Home plate umpire accuracy" className="umprank">
          <thead>
            <tr>
              <th className="team">Umpire</th>
              <th>Tier</th>
              <th>Accuracy</th>
              {compare && <th>{compare.head}</th>}
              <th>Games</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((u) => (
              <tr
                key={u.id}
                className={todayPlateIds.has(u.id) ? 'umprank__row--today' : undefined}
              >
                <td className="team">
                  <span className="umprank__rank">{u.rank}</span>
                  <UmpireLink id={u.id} seasonYear={shown}>
                    {u.name}
                  </UmpireLink>
                  {todayPlateIds.has(u.id) && (
                    <span className="umprank__todaychip" role="img" aria-label="Behind the plate today">
                      <HomePlateIcon />
                    </span>
                  )}
                </td>
                <td>
                  <TierPill tier={u.tier} />
                </td>
                <td>{pct1(u.accuracy)}</td>
                {compare && <td>{compare.cell(u)}</td>}
                <td>{u.games}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ReportFooter />
    </div>
  )
}
