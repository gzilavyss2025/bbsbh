import { useEffect, useMemo, useRef, useState } from 'react'
import { Ledger } from '../../../../../components/player/Ledger.jsx'
import { StatTile } from '../../../../../components/ui/frame/StatTile.jsx'
import { ModalPortal } from '../../../../../components/ui/ModalPortal.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { EmptyState } from '../../../../../components/ui/state/EmptyState.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { lastCompleteSeason, leagueAverage } from '../../../../../api/player/leagueAverages.js'
import { spanCell } from '../../../../../lib/ledger.js'
import { loadSeason } from './seasonData.js'
import { compareView, scopesOf, tableFor, tilesFor } from './seasonView.js'
import '../../../../../styles/player-next/both/season.css'

const DASH = '—'
// The secondary columns a phone sheds until "All columns" is on (the board's narrow set).
const NARROW = new Set(['AB', 'GS', 'K', 'BB', 'WHIP'])
const CAPTION = { mlb: 'MLB · by year', milb: 'Minor leagues · by year', all: 'Every level · by year', post: 'Postseason · by year' }

// The Season statistics module (#1885): one scope switch (MLB, Minors, All, Postseason) drives the
// five tiles and the year-by-year table. Tap a season's WAR to set it beside the league.
export default function SeasonModule({ bio, role, asOf, season, onEmpty, onCount }) {
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
  useEffect(() => {
    onCount(view?.badge || undefined)
  }, [view?.badge, onCount])

  // A card that has not loaded yet reserves its height; Slot reads a bare first render as "no data".
  if (!scope) return <div className="seasonmod seasonmod--wait" aria-busy={!empty} />

  const table = scope !== 'post' || post ? tableFor(register, post, scope) : null

  return (
    <Stack gap="loose" className="seasonmod">
      <Cluster gap="base" align="center" className="seasonmod__bar">
        <Cluster gap="tight" role="group" aria-label="Show stats for">
          {scopes.map((s) => (
            <button key={s.id} type="button" className="pnext-pick" aria-pressed={s.id === scope} onClick={() => { setPick(s.id); setOpen(null) }}>
              {s.label}
            </button>
          ))}
        </Cluster>
        <span className="seasonmod__caption">{CAPTION[scope]}</span>
      </Cluster>

      {scope === 'post' && postseason === undefined ? (
        <p className="hint">Loading the postseason…</p>
      ) : view.tiles.length ? (
        <div className="seasonmod__tiles">
          {view.tiles.map((t) => (
            <StatTile key={t.k} label={t.k} value={t.v} tone={t.tone} className="seasonmod__tile" />
          ))}
        </div>
      ) : (
        <EmptyState size="compact">{view.empty}</EmptyState>
      )}

      {table && (
        <YearTable
          table={table}
          label={`${role === 'pitching' ? 'Pitching' : 'Batting'} by year, ${scopes.find((s) => s.id === scope).label}`}
          allCols={allCols}
          onAllCols={() => setAllCols(!allCols)}
          note={scope !== 'post' && scope !== 'milb'}
          onCompare={setOpen}
        />
      )}

      {open && <Compare row={open} columns={table.columns} group={role} onClose={() => setOpen(null)} />}
    </Stack>
  )
}

// The register's rows as a ledger, the "All columns" switch and the WAR hint.
function YearTable({ table, label, allCols, onAllCols, note, onCompare }) {
  const warAt = table.columns.indexOf('WAR')
  const hideNarrow = allCols ? [] : table.columns.flatMap((c, i) => (NARROW.has(c) ? [i + 2] : []))
  const rows = table.rows.map((r) => ({
    key: r.key,
    className: r.className,
    allStar: r.allStar,
    cells: r.gap
      ? [<>{r.year}</>, spanCell(<span className="reg-gap__note">{r.note}</span>)]
      : [
          <>
            {r.year}
            {r.allStar && <span className="ledger__allstar" title="All Star">★</span>}
          </>,
          <>
            {r.team || DASH}
            {r.pill && <span className="reg-pill">{r.pill}</span>}
          </>,
          ...r.cells.map((c, i) =>
            i === warAt && r.compare ? (
              <button
                key="war"
                type="button"
                className="seasonmod__war"
                aria-haspopup="dialog"
                aria-label={`WAR ${c}, ${r.year}. Compare with the league`}
                onClick={() => onCompare(r)}
              >
                {c}
              </button>
            ) : (
              c
            ),
          ),
        ],
  }))
  return (
    <>
      <Ledger label={label} leftCols={2} head={['Year', 'Team', ...table.columns]} rows={rows} hideNarrow={hideNarrow} totals={table.totals} />
      <Cluster gap="tight" align="center" className="seasonmod__foot">
        {table.columns.some((c) => NARROW.has(c)) && (
          <button type="button" className="seasonmod__link" aria-pressed={allCols} onClick={onAllCols}>
            {allCols ? 'Fewer columns' : 'All columns'}
          </button>
        )}
        {note && <span>Tap a season’s WAR to compare it with the league.</span>}
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
