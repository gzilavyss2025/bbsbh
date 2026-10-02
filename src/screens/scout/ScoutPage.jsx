import '../../styles/scout/scout.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useNav } from '../../lib/nav.js'
import { baseballToday } from '../../lib/time/standingsDates.js'
import { scoutPath } from '../../lib/scout/path.js'
import { stanceFor } from '../../lib/scout/roles.js'
import { METRICS } from '../../lib/scout/metrics.js'
import { scenePitches } from '../../lib/pitcherCard/scene.js'
import { arsenalFor } from '../../api/matchup/savant.js'
import { MIN_COMMAND_PITCHES } from '../../api/commandMap.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Pill } from '../../components/ui/control/Pill.jsx'
import { PitchScene } from '../../components/playbyplay/pitcherCard/PitchScene.jsx'
import { Choice } from '../../components/scout/Choice.jsx'
import { Matchup } from '../../components/scout/Matchup.jsx'
import { ScoutMap } from '../../components/scout/ScoutMap.jsx'
import { loadScout } from './loadScout.js'
import { pitcherBoard } from './board.js'
import { hitterSide, metricsFor } from './hitterBoard.js'
import { Answer, Key, Readout, Sides } from './MapParts.jsx'
import { Pickers } from './Pickers.jsx'
import { HitterLine } from './HitterLine.jsx'
import { HeadToHead } from './HeadToHead.jsx'

// THE MATCHUP SCOUT (#1410, #1411; design docs/scout-design.md, ADR-0093,
// ADR-0095). Pick a pitcher and a hitter. The page shows who is facing whom,
// where the pitcher throws each pitch to this hitter's stance, where the
// hitter does damage against it, the expected value that joins the two, and
// every time they met.
//
// AN OPEN SURFACE (ADR-0034): no SealBox, and none may be added. Everything
// here is a season aggregate over final games, except the head-to-head list,
// which holds back every game dated on or after its cutoff (HeadToHead.jsx).
//
// THE ADDRESS HOLDS THE CHOICES (lib/scout/route.js): `?view`, `?scope`,
// `?pitch`, `?hand`, `?metric`, `?d`. A change replaces the address, so Back leaves the page
// rather than undoing a tap. The view also persists in localStorage
// (ADR-0093), never in My Tally (ADR-0039).
//
// SCOPE. Once the stores carry the postseason beside the regular season
// (ADR-0094, `post` in each shard), Scope moves the maps and the list
// together, and the control sits under the maps. Before that the maps wear a
// "Regular season" tag and Scope sits on the list, the only thing it moves
// (Gary, item 9; board.js).
//
// THE HITTER'S MAP (#1411 Part B, hitterBoard.js) comes from the hitter-grid
// store. Until it is posted, his slot prints his Savant line per pitch type
// (HitterLine.jsx), and there is no expected value: with no hitter regions it
// would be his whole-type value, the same for every pitcher.

const VIEWS = [['pitcher', 'Pitcher’s'], ['hitter', 'Hitter’s']]
const VIEW_KEY = 'bbsbh:scout:view'
// What the maps hold. Until the stores carry the postseason (ADR-0094), always
// the regular season, whatever Scope says (Gary, item 9).
const SCOPE_TAG = { reg: 'Regular season', post: 'Postseason', all: 'Regular season + postseason' }
const SCOPES = [['reg', 'Regular'], ['post', 'Postseason'], ['all', 'All']]
// A switch hitter's two stances are two maps, so "All" hands is off for him:
// it would pool the third-base side as inside for one and away for the other
// (spec, C; Gary, item 1).
const HANDS = [[null, 'All'], ['R', 'vs R'], ['L', 'vs L']]
const other = (h) => (h === 'R' ? 'L' : 'R')
const noPicks = { pitcher: null, hitter: null }

function storedView() {
  try {
    const v = window.localStorage.getItem(VIEW_KEY)
    return v === 'hitter' || v === 'pitcher' ? v : null
  } catch {
    return null
  }
}

export function ScoutPage({ pitcherId, hitterId, asOf, view: viewParam, scope, pitch, hand: handParam, metric: metricParam }) {
  useDocumentTitle('Matchup Scout')
  const navigate = useNav()
  const [savedView, setSavedView] = useState(storedView)
  const view = viewParam ?? savedView ?? 'pitcher'
  const [picks, setPicks] = useState(noPicks)
  const [changing, setChanging] = useState(false)
  const [picked, setPicked] = useState(null)
  const [turns, setTurns] = useState(0)
  const [inFlight, setInFlight] = useState(null)

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
  const mapScope = board?.scoped ? scope : 'reg'
  const side = useMemo(
    () => hitterSide({ board, grid, league: data?.league, hands: hand ? [hand] : ['R', 'L'], scope: mapScope, metric }),
    [board, grid, data, hand, mapScope, metric],
  )
  const hmap = side ? (sel ? side.byType[sel] : side.all) : null
  const scene = useMemo(
    () => (board ? scenePitches(sel ? board.tiles.filter((t) => t.code === sel) : board.types, lefty) : []),
    [board, sel, lefty],
  )
  const onActive = useCallback((idx) => setInFlight(scene[idx]?.code ?? null), [scene])
  // On a phone the pill row scrolls sideways: bring the selected pill into
  // view, so a shared `?pitch=` link shows which pitch the maps are on.
  const pillRow = useRef(null)
  useEffect(() => {
    pillRow.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [sel, board])

  // Every choice rewrites the address in place.
  const go = (patch, replace = true) => {
    const pair = data ? { pitcher: data.pitcher, hitter: data.hitter } : picks
    navigate(scoutPath({ ...pair, view, scope, pitch: sel, hand: handParam, metric: metricParam, d: asOf, ...patch }), { replace })
  }
  const setView = (v) => {
    try {
      window.localStorage.setItem(VIEW_KEY, v)
    } catch {
      // A blocked store only costs the default on the next visit.
    }
    setSavedView(v)
    setTurns((n) => n + 1)
    go({ view: v })
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
      {!hasPair && <p className="hint">Pick a pitcher and a hitter</p>}
      {hasPair && load.loading && <AsyncStatus loading hasData={false} />}
      {hasPair && !load.loading && !data && <p className="hint hint--error">Couldn’t load this pair</p>}

      {data && (
        <>
          {!changing && <Matchup pitcher={data.pitcher} hitter={data.hitter} onChange={() => setChanging(true)} />}
          <div className="scout__body">
            <section className="scout__board" aria-label="Maps">
              {board && (
                <div ref={pillRow} className="scout__control scout__control--scroll" role="group" aria-label="Pitch">
                  <span className="scout__controllabel">Pitch</span>
                  <Pill role="control" fill="paper" pressed={sel === null} onClick={() => go({ pitch: null })}>All</Pill>
                  {board.types.map((t) => (
                    <Pill
                      key={t.code}
                      role="control"
                      fill="paper"
                      className={`scout__pitchbtn${view === 'hitter' && inFlight === t.code ? ' is-inflight' : ''}`}
                      data-family={t.family}
                      pressed={sel === t.code}
                      onClick={() => go({ pitch: t.code })}
                    >
                      {t.name} <span className="scout__pilln">{t.pct}%</span>
                      <span className="scout__usage" style={{ '--usage': t.pct }} aria-hidden="true" />
                    </Pill>
                  ))}
                </div>
              )}

              {side && (
                <Answer
                  metric={metric}
                  typeName={selType ? selType.name : 'All pitches'}
                  mph={selType?.mph}
                  value={sel ? hmap?.exp : side.overall.value}
                  league={sel ? hmap?.league : side.overall.league}
                  covered={sel ? null : side.overall.covered}
                />
              )}

              <div className="scout__controls">
                <Choice label="View" options={VIEWS} value={view} onChange={setView} />
                {side && (
                  <Choice
                    label="Metric"
                    options={metrics.map((k) => [k, METRICS[k].label])}
                    value={metric}
                    onChange={(k) => go({ metric: k === metrics[0] ? null : k })}
                  />
                )}
              </div>

              {view === 'hitter' && scene.length > 0 && (
                <div className="pcard scout__scene">
                  <PitchScene key={sel ?? 'all'} pitches={scene} lefty={lefty} name={data.pitcher.name} onActive={onActive} />
                </div>
              )}

              <p className="scout__season">
                <Pill>{board?.scoped ? SCOPE_TAG[scope] : SCOPE_TAG.reg}</Pill>
                {data.season && <span className="scout__cap">{data.season}</span>}
              </p>

              <div key={turns} className={`scout__maps${turns ? ' is-turning' : ''}`}>
                <figure className="scout__fig">
                  <figcaption className="scout__cap">Pitcher · location %</figcaption>
                  {map ? (
                    <>
                      <ScoutMap
                        view={view}
                        stance={stance}
                        cells={map.cells}
                        picked={picked}
                        onSelect={(r) => setPicked((p) => (p === r ? null : r))}
                        label={`${selType ? selType.name : 'All pitches'}: location share by region, ${view} view`}
                      />
                      <Sides view={view} />
                      <span className="scout__cap">
                        {map.thin ? `Under ${MIN_COMMAND_PITCHES} pitches · ` : ''}
                        {map.n.toLocaleString()} pitches{selType ? ` · ${selType.mph} mph` : ''}
                      </span>
                    </>
                  ) : (
                    <p className="hint scout__notposted">Not posted</p>
                  )}
                </figure>
                {side ? (
                  <figure className="scout__fig">
                    <figcaption className="scout__cap">Hitter · {METRICS[metric].label}</figcaption>
                    {hmap ? (
                      <>
                        <ScoutMap
                          view={view}
                          stance={hitterStance}
                          cells={hmap.cells}
                          picked={picked}
                          onSelect={(r) => setPicked((p) => (p === r ? null : r))}
                          label={`${selType ? selType.name : 'All pitches'}: hitter’s ${METRICS[metric].label} by region, ${view} view`}
                        />
                        <Sides view={view} />
                        <span className="scout__cap">{hmap.seen.toLocaleString()} pitches seen</span>
                      </>
                    ) : (
                      <p className="hint scout__notposted">Not posted</p>
                    )}
                  </figure>
                ) : (
                  <figure className="scout__fig">
                    <figcaption className="scout__cap">Hitter · {selType ? selType.name : 'by pitch'}</figcaption>
                    <HitterLine line={arsenalFor(data.savant, data.hitter.id, 'batting')} types={board?.types ?? []} code={sel} />
                  </figure>
                )}
              </div>

              {map && (
                <Readout
                  picked={picked}
                  map={map}
                  hit={hmap?.hit}
                  metric={metric}
                  stance={!side || stance === hitterStance ? stance : null}
                />
              )}

              <Key metric={side ? metric : null} />

              {(side || board?.scoped) && (
                <div className="scout__controls">
                  {side && (
                    <Choice
                      label="Hand"
                      options={HANDS}
                      value={hand}
                      onChange={(h) => go({ hand: h })}
                      disabledKey={switchHitter ? null : undefined}
                    />
                  )}
                  {board?.scoped && <Choice label="Scope" options={SCOPES} value={scope} onChange={(k) => go({ scope: k })} />}
                </div>
              )}
            </section>

            <HeadToHead
              pitcherId={pitcherId}
              hitterId={hitterId}
              cutoff={cutoff}
              asOf={asOf}
              scope={scope}
              onScope={board?.scoped ? null : (s) => go({ scope: s })}
            />
          </div>
        </>
      )}
      <ReportFooter />
    </div>
  )
}
