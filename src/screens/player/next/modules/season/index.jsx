import { useEffect, useMemo, useRef, useState } from 'react'
import { Ledger, spanCell } from '../../../../../components/player/Ledger.jsx'
import { StatTile } from '../../../../../components/ui/frame/StatTile.jsx'
import { ModalPortal } from '../../../../../components/ui/ModalPortal.jsx'
import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { EmptyState } from '../../../../../components/ui/state/EmptyState.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { lastCompleteSeason, leagueAverage } from '../../../../../api/player/leagueAverages.js'
import { fetchPostseasonByRound } from '../../../../../api/player/postseasonRegister.js'
import { yearByYearCells } from '../../../../../api/person/careerRegister.js'
import { loadSeason } from './seasonData.js'
import { compareView, scopesOf, tableFor, tilesFor } from './seasonView.js'
import '../../../../../styles/player-next/both/season.css'

const DASH = '—'
// The secondary columns a phone sheds until "All columns" is on (the board's narrow set).
const NARROW = new Set(['AB', 'GS', 'K', 'BB', 'WHIP'])

// The Season statistics module (#1885): one scope switch (MLB, Minors, All, Postseason) drives the
// five tiles and the year-by-year table. Tap a season's AVG (ERA for an arm) to set it beside the league.
// The card carries no count tag (Gary, 2026-10-30): the scope switch already names the scope.
export default function SeasonModule({ bio, role, asOf, season, onEmpty }) {
  const { data, error, loading } = useAsync(() => loadSeason({ bio, role, asOf }), [bio.id, role, asOf])
  const [pick, setPick] = useState(null)
  const [allCols, setAllCols] = useState(false)
  const [open, setOpen] = useState(null)
  // Read when the scope that needs them is first chosen. `undefined` is "not read yet".
  const [milbCareer, setMilbCareer] = useState()
  const [postseason, setPostseason] = useState()

  const register = useMemo(() => data?.build(milbCareer ?? []), [data, milbCareer])
  const scopes = register ? scopesOf(register, data.hasDebuted) : []
  const scope = scopes.find((s) => s.id === pick)?.id ?? scopes[0]?.id
  const needMilb = Boolean(data?.hasMilb) && (scope === 'milb' || scope === 'all')
  const needPost = scope === 'post'
  useEffect(() => {
    if (!needMilb || milbCareer !== undefined) return
    let live = true
    data.loadMilbCareer().catch(() => []).then((splits) => live && setMilbCareer(splits))
    return () => { live = false }
  }, [needMilb, milbCareer, data])
  useEffect(() => {
    if (!needPost || postseason !== undefined) return
    let live = true
    data.loadPostseason().catch(() => ({ post: null, line: null })).then((got) => live && setPostseason(got))
    return () => { live = false }
  }, [needPost, postseason, data])

  const empty = Boolean(error) || (!loading && !scope)
  const post = postseason?.post ?? null
  const view = scope && tilesFor({ scope, group: role, role: data.armRole, lines: { ...data.lines, post: postseason?.line ?? null }, war: data.war, season, retired: data.retired })

  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])

  // A card that has not loaded yet reserves its height; Slot reads a bare first render as "no data".
  if (!scope) return <div className="seasonmod seasonmod--wait" aria-busy={!empty} />

  const table = scope !== 'post' || post ? tableFor(register, post, scope) : null

  return (
    <Stack gap="loose" className="seasonmod">
      <Cluster gap="base" align="center" className="seasonmod__bar">
        <Segmented
          label="Show stats for"
          value={scope}
          onChange={(id) => { setPick(id); setOpen(null) }}
          options={scopes.map((s) => ({ value: s.id, label: s.label }))}
        />
      </Cluster>

      {scope === 'post' && postseason === undefined ? (
        <p className="hint">Loading the postseason…</p>
      ) : scope === 'mlb' ? null : view.tiles.length ? (
        // The MLB tiles repeat the hero's tiles at the top of the page, so that scope draws none
        // (Gary, 2026-10-30); the other scopes' lines appear nowhere else.
        <div className="seasonmod__tiles">
          {view.tiles.map((t) => (
            <StatTile key={t.k} label={t.k} value={t.v} tone={t.tone} className="seasonmod__tile stattile--compact" />
          ))}
        </div>
      ) : table?.rows.length ? null : (
        // No line this season: the table below says enough, so the note shows only with no table
        // either (Gary, 2026-10-30).
        <EmptyState size="compact">{view.empty}</EmptyState>
      )}

      {table && (
        <YearTable
          table={table}
          label={`${role === 'pitching' ? 'Pitching' : 'Batting'} by year, ${scopes.find((s) => s.id === scope).label}`}
          allCols={allCols}
          onAllCols={() => setAllCols(!allCols)}
          onCompare={setOpen}
          openKey={open?.key}
          rounds={scope === 'post' ? { playerId: bio.id, group: role, asOf, showSaves: data.armRole === 'CL' } : null}
        />
      )}

      {open && <Compare row={open} columns={table.columns} group={role} onClose={() => setOpen(null)} />}
    </Stack>
  )
}

// The register's rows as a ledger, the "All columns" switch and the WAR hint.
// `rounds` (the Postseason scope only): a year's row opens to one row per round of that October
// (Gary, 2026-10-30), read on the tap from the game log (fetchPostseasonByRound).
function YearTable({ rounds, table, label, allCols, onAllCols, onCompare, openKey }) {
  // The league comparison is of AVG (a bat) or ERA (an arm), so that figure is the one to tap
  // (Gary, 2026-10-30), not WAR.
  const cmpKey = table.columns.includes('ERA') ? 'ERA' : 'AVG'
  const cmpAt = table.columns.indexOf(cmpKey)
  const hideNarrow = allCols ? [] : table.columns.flatMap((c, i) => (NARROW.has(c) ? [i + 2] : []))
  // year -> null while loading, [] for none, else the round rows
  const [byYear, setByYear] = useState({})
  const [openYears, setOpenYears] = useState(() => new Set())
  const toggleYear = (year) => {
    setOpenYears((prev) => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
    if (byYear[year] !== undefined) return
    setByYear((m) => ({ ...m, [year]: null }))
    fetchPostseasonByRound(rounds.playerId, rounds.group, { season: year, cutoff: rounds.asOf })
      .catch(() => null)
      .then((got) => setByYear((m) => ({ ...m, [year]: got ?? [] })))
  }
  // A traded October has a row per club; the round split is the whole October, so only the year's
  // first row opens, and once.
  const firstOfYear = new Map()
  for (const r of table.rows) if (!r.gap && !firstOfYear.has(r.year)) firstOfYear.set(r.year, r)
  const opensRounds = (r) => Boolean(rounds) && firstOfYear.get(r.year) === r
  const roundRowsFor = (r) => {
    if (!opensRounds(r) || !openYears.has(r.year)) return []
    const got = byYear[r.year]
    if (!got?.length) {
      return [{ key: `${r.key}-wait`, className: 'reg-round', cells: [<>{''}</>, spanCell(<span className="reg-gap__note">{got ? 'No round split on file.' : 'Loading the rounds…'}</span>)] }]
    }
    return got.map((g) => ({
      key: `${r.key}-${g.gameType}`,
      className: 'reg-round',
      cells: [<span key="round" className="reg-round__name">{g.series}</span>, <>{''}</>, ...yearByYearCells(g.stat, rounds.group, rounds.showSaves)],
    }))
  }
  const yearCell = (r) => {
    const inner = (
      <>
        {r.year}
        {r.allStar && <span className="ledger__allstar" title="All Star">★</span>}
      </>
    )
    return opensRounds(r) ? (
      <button type="button" className="seasonmod__year" aria-expanded={openYears.has(r.year)} onClick={() => toggleYear(r.year)}>
        {inner}
        <span className="seasonmod__chev" aria-hidden="true">{openYears.has(r.year) ? '▾' : '▸'}</span>
      </button>
    ) : inner
  }
  const rows = table.rows.flatMap((r) => [{
    key: r.key,
    className: r.className,
    allStar: r.allStar,
    cells: r.gap
      ? [<>{r.year}</>, spanCell(<span className="reg-gap__note">{r.note}</span>)]
      : [
          yearCell(r),
          <>
            {r.teamId ? (
              <span className="seasonmod__club" title={r.team || undefined}>
                <TeamLogo teamId={r.teamId} name={r.team} size={20} />
                <span className="sr-only">{r.team}</span>
              </span>
            ) : (
              r.team || DASH
            )}
            {r.pill && <span className="reg-pill">{r.pill}</span>}
          </>,
          ...r.cells.map((c, i) =>
            i === cmpAt && r.compare ? (
              <button
                key="cmp"
                type="button"
                className="seasonmod__war"
                aria-haspopup="dialog"
                aria-expanded={openKey === r.key}
                aria-label={`${cmpKey} ${c}, ${r.year}. Compare with the league`}
                onClick={() => onCompare(r)}
              >
                {c}
              </button>
            ) : (
              c
            ),
          ),
        ],
  }, ...roundRowsFor(r)])
  return (
    <>
      <Ledger label={label} leftCols={2} head={['Year', 'Team', ...table.columns]} rows={rows} hideNarrow={hideNarrow} totals={table.totals} />
      <Cluster gap="tight" align="center" className="seasonmod__foot">
        {table.columns.some((c) => NARROW.has(c)) && (
          <button type="button" className="seasonmod__link" aria-pressed={allCols} onClick={onAllCols}>
            {allCols ? 'Show fewer columns' : 'Show all columns'}
          </button>
        )}
      </Cluster>
    </>
  )
}

// The season's AVG (bat) or ERA (arm) against the league's. The league figure is read on the tap.
function Compare({ row, columns, group, onClose }) {
  const { data: lg, loading } = useAsync(
    async () => {
      const [league, last] = await Promise.all([leagueAverage(row.year, group), lastCompleteSeason()])
      return { league, last }
    },
    [row.year, group],
  )
  const view = lg && compareView({ row, columns, group, league: lg.league, last: lg.last })
  const close = useRef(null)
  // The parent passes a fresh onClose each render; the ref keeps the effect to one run per open.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const prior = document.activeElement
    close.current?.focus()
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prior?.focus?.()
    }
  }, [])
  return (
    <ModalPortal>
      <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="seasonmod__pop" role="dialog" aria-modal="true" aria-label={`${row.year} compared with the league`}>
          <div className="seasonmod__pophead">
            <span>{row.year} vs league</span>
            <button ref={close} type="button" className="seasonmod__x" aria-label="Close" onClick={onClose}>×</button>
          </div>
          {view && !view.empty ? (
            <>
              <p className="seasonmod__popline"><span>{view.mineLabel}</span><b>{view.mine}</b></p>
              <p className="seasonmod__popline"><span>{view.lgLabel}</span><b>{view.lg}</b></p>
              <p className="seasonmod__popline">
                <span>Difference</span>
                <b className={view.good ? 'seasonmod__good' : 'seasonmod__bad'}>{view.diff}</b>
              </p>
              <p className="seasonmod__popnote">{view.note}</p>
            </>
          ) : (
            <p className="seasonmod__popnote">{view?.empty ?? (loading ? 'Loading the league figure…' : `No league figure for ${row.year}.`)}</p>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
