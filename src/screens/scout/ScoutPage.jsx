import '../../styles/scout/scout.css'
import '../../styles/scout/panels.css'
import '../../styles/scout/edge.css'
import '../../styles/scout/pitches.css'
import '../../styles/scout/where.css'
import '../../styles/scout/meet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchHeadToHead } from '../../api/scout/headToHead.js'
import { METRICS } from '../../lib/scout/metrics.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useNav } from '../../lib/nav.js'
import { baseballToday } from '../../lib/time/standingsDates.js'
import { scoutPath } from '../../lib/scout/path.js'
import { stanceFor } from '../../lib/scout/roles.js'
import { scenePitches } from '../../lib/pitcherCard/scene.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Pill } from '../../components/ui/control/Pill.jsx'
import { EmptyState } from '../../components/ui/state/EmptyState.jsx'
import { Notice } from '../../components/ui/state/Notice.jsx'
import { Choice } from '../../components/scout/Choice.jsx'
import { HubTabBar } from '../../components/chrome/HubTabBar.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Matchup } from '../../components/scout/Matchup.jsx'
import { loadScout } from './loadScout.js'
import { pitcherBoard } from './board.js'
import { hitterSide, metricsFor } from './hitterBoard.js'
import { Pickers } from './Pickers.jsx'
import { ScoutScene } from './ScoutScene.jsx'
import { FilterSheet, filterSummary } from './FilterSheet.jsx'
import { PitchRows } from './pitches/PitchRows.jsx'
import { EdgePanel } from './edge/EdgePanel.jsx'
import { ZonesPanel } from './zones/ZonesPanel.jsx'
import { MeetingsPanel } from './meetings/MeetingsPanel.jsx'

// THE MATCHUP SCOUT (#1410, #1411, #1490; design docs/scout-design.md,
// ADR-0093, ADR-0095, ADR-0099). Pick a pitcher and a hitter. Top to bottom:
// the pair, the context chips (season and scope, the sample, the filter
// sheet), the pitch scene, then one scroll of four sections under a jump bar
// (ADR-0118): EDGE (who the matchup favors, by pitch type and by location),
// PITCHES (the pills and the ledger), WHERE (where he throws and where the
// hitter does damage) and MEETINGS (every past plate appearance, pitch by
// pitch). The scene and every section share one selection (`?pitch=`).
//
// AN OPEN SURFACE (ADR-0034): no SealBox, and none may be added. Everything
// here is a season aggregate over final games, except the meetings, which
// hold back every game dated on or after the cutoff (MeetingsPanel.jsx).
//
// THE ADDRESS HOLDS THE CHOICES (lib/scout/route.js): `?scope`,
// `?pitch`, `?hand`, `?metric`, `?d`. A change replaces the address, so
// Back leaves the page rather than undoing a tap. There is one view, the
// hitter's (ADR-0118); an old `?view=` link opens the page and is ignored.
//
// SCOPE moves the maps, the ledger and the meetings together (the stores keep
// the postseason beside the regular season, ADR-0094); the chip names it.
//
// THE HITTER'S SIDE (#1411 Part B, hitterBoard.js) comes from the hitter-grid
// store, once per metric: the Edge tab's verdict reads xwOBA (est.) and Whiff %
// whatever the Metric is. Until the grid is posted, the hitter's slot prints
// his Savant line per pitch type (HitterLine.jsx), and there is no expected
// value: with no hitter regions it would be his whole-type value, the same
// for every pitcher.

const SCOPE_TAG = { reg: 'Regular season', post: 'Postseason', all: 'Regular season + postseason' }
// The sticky jump bar's height, as on the team page (TeamNextPage.jsx BAR_H).
const BAR_H = 68
const other = (h) => (h === 'R' ? 'L' : 'R')
const noPicks = { pitcher: null, hitter: null }

export function ScoutPage({ pitcherId, hitterId, asOf, scope, pitch, hand: handParam, metric: metricParam }) {
  useDocumentTitle('Matchup Scout')
  const navigate = useNav()
  const view = 'hitter'
  const [picks, setPicks] = useState(noPicks)
  const [changing, setChanging] = useState(false)
  const [picked, setPicked] = useState(null)
  const [inFlight, setInFlight] = useState(null)
  const [filters, setFilters] = useState(false)

  const hasPair = Boolean(pitcherId && hitterId)
  const load = useAsync(() => (hasPair ? loadScout(pitcherId, hitterId) : Promise.resolve(null)), [pitcherId, hitterId])
  const data = hasPair ? load.data : null
  // The same today the Savant module clamps to (US Pacific, the last zone to
  // roll over), clamped the same way, so the list's "before" date is the date
  // it asked for.
  const today = baseballToday()
  const cutoff = asOf && asOf < today ? asOf : today

  const stance = data ? stanceFor(data.hitter.bats, data.pitcher.throws) : null
  const board = useMemo(
    () => (data && stance ? pitcherBoard({ arsenal: data.arsenal, command: data.command, pitcherId: data.pitcher.id, stance, scope }) : null),
    [data, stance, scope],
  )
  // A `?pitch=` this pitcher has no pill for falls back to All.
  const sel = board && pitch && board.byType[pitch] ? pitch : null
  const map = board ? (sel ? board.byType[sel] : board.all) : null
  const selType = sel ? board.types.find((t) => t.code === sel) : null
  const lefty = data?.pitcher.throws === 'L'

  // The hitter's side. `hitterHand` is the pitcher hand his map reads; a
  // switch hitter stands on the side opposite it, so his map can stand on a
  // different side from the pitcher's (then the readout names the field side
  // only, Gary item 11).
  const grid = data?.grid ?? null
  const switchHitter = data?.hitter.bats === 'S'
  const hand = switchHitter ? handParam ?? data.pitcher.throws : handParam
  const hitterStance = switchHitter ? other(hand) : data?.hitter.bats
  const metrics = useMemo(() => metricsFor(grid), [grid])
  const metric = metrics.includes(metricParam) ? metricParam : metrics[0]
  const sides = useMemo(
    () => Object.fromEntries(metrics.map((m) => [m, hitterSide({ board, grid, league: data?.league, hand, stand: hitterStance, scope, metric: m })])),
    [metrics, board, grid, data, hand, hitterStance, scope],
  )
  const side = sides[metric] ?? null
  const hmap = side ? (sel ? side.byType[sel] : side.all) : null
  const scene = useMemo(
    () => (board ? scenePitches(sel ? board.tiles.filter((t) => t.code === sel) : board.types, lefty, view) : []),
    [board, sel, lefty, view],
  )
  const onActive = useCallback((idx) => setInFlight(scene[idx]?.code ?? null), [scene])
  // On a phone the pill row scrolls sideways: bring the selected pill into
  // view, so a shared `?pitch=` link shows which pitch the page is on.
  const pillRow = useRef(null)
  useEffect(() => {
    pillRow.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [sel, board])

  // Every choice rewrites the address in place.
  const go = (patch, replace = true) => {
    const pair = data ? { pitcher: data.pitcher, hitter: data.hitter } : picks
    navigate(scoutPath({ ...pair, scope, pitch: sel, hand: handParam, metric: metricParam, d: asOf, ...patch }), { replace })
  }
  const setMetric = (k) => go({ metric: k === metrics[0] ? null : k })
  const selectPitch = (code) => {
    setPicked(null)
    go({ pitch: code })
  }
  const onPick = (role, person) => {
    const next = { ...(data ? { pitcher: data.pitcher, hitter: data.hitter } : picks), [role]: person }
    setPicks(next)
    if (next.pitcher && next.hitter) {
      setChanging(false)
      setPicked(null)
      // A new pair is a new page: push, so Back returns to the old one.
      go({ ...next, pitch: null, hand: null }, false)
    }
  }

  // The meetings are read here, so the jump bar can count them.
  const h2h = useAsync(
    () => (data ? fetchHeadToHead(data.hitter.id, data.pitcher.id, cutoff) : Promise.resolve(null)),
    [data, cutoff],
  )
  const pas = useMemo(
    () => (h2h.data?.pas ?? []).filter((r) => scope === 'all' || (scope === 'reg') === (r.round === 'R')),
    [h2h.data, scope],
  )

  const names = data ? { hitter: data.hitter.last, pitcher: data.pitcher.last } : null
  // The section list: flip `show` to hide a section (slice 7b hides by this).
  const sections = data
    ? [
        {
          key: 'scout-edge',
          label: 'Edge',
          show: true,
          node: <EdgePanel data={data} board={board} sides={sides} metric={metric} sel={sel} stance={stance} scope={scope} hand={hand} />,
        },
        {
          key: 'scout-pitches',
          label: 'Pitches',
          count: board?.types.length,
          show: true,
          node: (
            <>
              {board && (
                <div ref={pillRow} className="scout__control scout__control--scroll" role="group" aria-label="Pitch">
                  <Pill role="control" fill="paper" pressed={sel === null} onClick={() => selectPitch(null)}>All</Pill>
                  {board.types.map((t) => (
                    <Pill
                      key={t.code}
                      role="control"
                      fill="paper"
                      className={`scout__pitchbtn${!sel && inFlight === t.code ? ' is-inflight' : ''}`}
                      data-family={t.family}
                      pressed={sel === t.code}
                      onClick={() => selectPitch(t.code)}
                    >
                      {t.name} <span className="scout__pilln">{t.pct}%</span>
                      <span className="scout__usage" style={{ '--usage': t.pct }} aria-hidden="true" />
                    </Pill>
                  ))}
                </div>
              )}
              {!board && <EmptyState size="compact">No pitch mix posted for this pitcher</EmptyState>}
              <PitchRows board={board} side={side} metric={metric} names={names} sel={sel} onSelect={selectPitch} />
            </>
          ),
        },
        {
          key: 'scout-where',
          label: 'Where',
          show: true,
          node: (
            <>
              {side && (
                <Choice label="Metric" options={metrics.map((k) => [k, METRICS[k].label])} value={metric} onChange={setMetric} />
              )}
              <ZonesPanel
                data={data}
                board={board}
                side={side}
                xside={sides.xwoba ?? null}
                map={map}
                hmap={hmap}
                sel={sel}
                selType={selType}
                view={view}
                stance={stance}
                hitterStance={hitterStance}
                metric={metric}
                picked={picked}
                onPick={setPicked}
              />
            </>
          ),
        },
        {
          key: 'scout-meet',
          label: 'Meetings',
          count: h2h.loading ? undefined : pas.length,
          show: true,
          node: (
            <MeetingsPanel
              data={data}
              board={board}
              h2h={h2h}
              pas={pas}
              cutoff={cutoff}
              asOf={asOf}
              view={view}
              stance={stance}
              hitterStance={hitterStance}
            />
          ),
        },
      ].filter((x) => x.show)
    : []

  const sceneCaption = `${selType ? selType.name : 'His mix, in turn'} · typical shape · ⅓ speed`
  const crowd = stance === 'L' ? 'lefties' : 'righties'

  return (
    <div className="screen scout">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Matchup Scout</h1>
      </header>

      {/* A pair that failed to load keeps the pickers open: the way out of a
          bad link. */}
      {(!hasPair || changing || (!load.loading && !data)) && (
        <Pickers
          pitcher={data?.pitcher ?? picks.pitcher}
          hitter={data?.hitter ?? picks.hitter}
          onPick={onPick}
        />
      )}
      {!hasPair && <EmptyState>Pick a pitcher and a hitter</EmptyState>}
      {hasPair && load.loading && <AsyncStatus loading hasData={false} />}
      {hasPair && !load.loading && !data && <Notice tone="error" className="scout__notice">Couldn’t load this pair</Notice>}

      {data && (
        <>
          {!changing && <Matchup pitcher={data.pitcher} hitter={data.hitter} onChange={() => setChanging(true)} />}
          <p className="scout__chips">
            <Pill>{data.season ? `${data.season} · ` : ''}{SCOPE_TAG[scope]}</Pill>
            {board && <Pill>{board.all.n.toLocaleString()} pitches to {crowd}</Pill>}
            <Pill role="control" fill="paper" className="scout__filterchip" aria-haspopup="dialog" onClick={() => setFilters(true)}>
              {filterSummary({ hand, scope, metric, showHitter: Boolean(side) })} ▾
            </Pill>
          </p>

          <div className="scout__body">
            <div className="scout__stage">
              {scene.length > 0 ? (
                <ScoutScene
                  key={`${sel ?? 'all'}-${view}`}
                  pitches={scene}
                  lefty={lefty}
                  name={data.pitcher.name}
                  view={view}
                  onActive={onActive}
                  caption={sceneCaption}
                />
              ) : null}
            </div>

            <div className="scout__main">
              <HubTabBar
                variant="anchor"
                tabs={sections.map((x) => ({ key: x.key, label: x.label, count: x.count }))}
                ariaLabel="Scout sections"
                className="scout__jump"
                offset={BAR_H}
                hold
              />
              {sections.map((x) => (
                <Stack key={x.key} id={x.key} className="scout__section">
                  {x.node}
                </Stack>
              ))}
            </div>
          </div>

          {filters && (
            <FilterSheet
              onClose={() => setFilters(false)}
              showHitter={Boolean(side)}
              hand={hand}
              onHand={(h) => go({ hand: h })}
              switchHitter={switchHitter}
              scope={scope}
              onScope={(k) => go({ scope: k })}
              metric={metric}
              metrics={metrics}
              onMetric={setMetric}
            />
          )}
        </>
      )}
      <ReportFooter />
    </div>
  )
}
