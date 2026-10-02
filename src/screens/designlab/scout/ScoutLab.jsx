import '../../../styles/designlab/scout.css'
import { useCallback, useMemo, useState } from 'react'
import { Pill } from '../../../components/ui/control/Pill.jsx'
import { AsyncStatus } from '../../../components/ui/AsyncGate.jsx'
import { PitchScene } from '../../../components/playbyplay/pitcherCard/PitchScene.jsx'
import { MIN_COMMAND_PITCHES } from '../../../api/commandMap.js'
import { isRealDate, isoToday } from '../../../lib/dates.js'
import { pitchTiles } from '../../../lib/pitcherCard/card.js'
import { scenePitches } from '../../../lib/pitcherCard/scene.js'
import { ZoneMap } from './ZoneMap.jsx'
import { HeadToHead } from './HeadToHead.jsx'
import { Matchup } from './Matchup.jsx'
import { HITTERS, LEAGUE, PITCHER } from './fixture.js'
import {
  METRICS, REGIONS, band, expected, fmtCell, fmtMetric, hitterRegions, regionLabel, rollUp, sidesInOrder, typeValue,
} from './model.js'

// THE MATCHUP SCOUT PROTOTYPE (issue #1408; spec docs/scout-design.md). A
// design specimen on invented data, not the page: no route, no fetch, no
// persistence. The "Lab" rows pick the fixture and force each page state;
// everything below them is the proposed page.
//
// THE ORDER IS THE HIERARCHY: who (the pair, with headshots), then the answer
// (the expected line for the selected pitch), then the two maps that explain
// it, then the readout for a tapped region, then the controls that change the
// data pool, then the head-to-head list.
//
// TWO MAPS, NOT A STACK OF THEM. The pitcher's map and the hitter's map sit
// side by side, and the Pitch pills flip both through his arsenal, All first.
// The pills are the Now Pitching card's tiles turned into controls: the same
// usage % (pitchTiles), the same pitch names, and a usage bar in the family's
// colour. Its animated scene plays the selected pitch above the maps, in the
// Hitter's view only — the scene's camera is behind the plate, which is that
// view's camera (spec, B). In that view the pitch in flight lights its pill.

const VIEWS = [['pitcher', 'Pitcher’s'], ['hitter', 'Hitter’s']]
const SCOPES = [['reg', 'Regular'], ['post', 'Postseason'], ['all', 'All']]
const HANDS = [[null, 'All'], ['R', 'vs R'], ['L', 'vs L']]
const METRIC_OPTS = Object.entries(METRICS).map(([k, m]) => [k, m.label])
const STATES = [['pair', 'Pair'], ['empty', 'Empty'], ['loading', 'Loading'], ['noh2h', 'No head-to-head'], ['notposted', 'Not posted']]
const HITTER_OPTS = [['lefty', 'Bats L'], ['switch', 'Bats both']]
const USAGE_FLOOR = 5 // percent: a type under it is in All, with no pill
const MAX_TYPES = 6

const other = (h) => (h === 'R' ? 'L' : 'R')
const add = (a, b) => a.map((x, i) => x + b[i])
const sum = (a) => a.reduce((x, y) => x + y, 0)
const scopesOf = (scope) => (scope === 'all' ? ['reg', 'post'] : [scope])
const pct = (x) => `${Math.round(x * 100)}`
const toneOf = (b) => (b == null ? null : b < 0 ? `lo${-b}` : b > 0 ? `hi${b}` : 'mid')
const Swatch = ({ tone }) => <svg className="scout__swatch" aria-hidden="true"><rect className={`scout__region scout__region--${tone}`} width="14" height="14" /></svg>

function Choice({ label, options, value, onChange, disabledKey }) {
  return (
    <div className="scout__control" role="group" aria-label={label}>
      <span className="scout__controllabel">{label}</span>
      {options.map(([k, text]) => (
        <Pill
          key={String(k)}
          role="control"
          fill="paper"
          pressed={value === k}
          disabled={disabledKey !== undefined && k === disabledKey}
          onClick={() => onChange(k)}
        >
          {text}
        </Pill>
      ))}
    </div>
  )
}

// The league's rate per region, for the given types: the fixture's cell rates
// averaged. The real sweep (#1411) stores league sums, read like a hitter's.
function leagueRegions(codes, metric) {
  const rates = codes.map((c) => LEAGUE[c][metric]).reduce(add).map((x) => x / codes.length)
  const sums = rollUp(rates)
  const sizes = rollUp(rates.map(() => 1))
  return Object.fromEntries(REGIONS.map((r) => [r, sums[r] / sizes[r]]))
}

const sumCounters = (list) =>
  list.reduce((acc, c) => Object.fromEntries(Object.keys(c).map((k) => [k, add(acc[k], c[k])])))

// Everything the page draws, for one set of choices. `codes` is the pitch
// types the maps pool: one type, or every type for All.
function scout({ hitter, scope, hand, hitterHand, metric, stance, notPosted }) {
  const byScope = scopesOf(scope).map((s) => PITCHER.cells[s])
  const allCodes = Object.keys(PITCHER.mph)
  const typeCells = (code) => byScope.map((b) => b[code][stance]).reduce(add)
  const counts = allCodes.map((code) => ({ code, pitches: sum(typeCells(code)), avgVelo: PITCHER.mph[code] }))
  const tiles = pitchTiles(counts.sort((a, b) => b.pitches - a.pitches))
  const types = tiles.filter((t) => !t.other && Number(t.pct) >= USAGE_FLOOR).slice(0, MAX_TYPES)

  const hitterCounters = (codes) =>
    sumCounters(scopesOf(scope).flatMap((s) => codes.flatMap((c) => (hand ? [hitterHand] : ['R', 'L']).map((h) => hitter.counters[s][c][h]))))

  function maps(codes) {
    const cells = codes.map(typeCells).reduce(add)
    const n = sum(cells)
    const regionN = rollUp(cells)
    const thin = n < MIN_COMMAND_PITCHES
    const share = Object.fromEntries(REGIONS.map((r) => [r, n ? regionN[r] / n : 0]))
    const max = Math.max(...REGIONS.map((r) => share[r]))
    const pitcherCells = Object.fromEntries(
      REGIONS.map((r) => [r, thin
        ? { tone: 'gray', count: regionN[r] }
        : { tone: `s${max ? Math.ceil((share[r] / max) * 4) : 0}`, value: pct(share[r]) }]),
    )
    if (notPosted) return { n, thin, regionN, share, pitcherCells }
    const counters = hitterCounters(codes)
    const hit = hitterRegions(counters, metric)
    const league = leagueRegions(codes, metric)
    const hitterCells = Object.fromEntries(
      REGIONS.map((r) => {
        const b = band(metric, hit[r].value, league[r])
        return [r, b == null
          ? { tone: 'gray', count: hit[r].n }
          : { tone: toneOf(b), value: fmtCell(metric, hit[r].value), count: hit[r].n }]
      }),
    )
    // The league's expected value on the same locations: what this hitter's
    // line is read against. Every league region has a rate, so no fallback.
    const leagueCells = Object.fromEntries(REGIONS.map((r) => [r, { value: league[r] }]))
    const exp = thin ? null : expected(share, hit, typeValue(counters, metric))
    const leagueExp = thin ? null : expected(share, leagueCells, 0)
    return { n, thin, regionN, share, pitcherCells, hit, hitterCells, exp, leagueExp, seen: sum(counters.pitches) }
  }

  // The overall line: each pilled type's expected value, weighted by usage.
  const byType = Object.fromEntries(types.map((t) => [t.code, maps([t.code])]))
  const scored = types.filter((t) => byType[t.code].exp != null)
  const covered = sum(scored.map((t) => Number(t.pct))) / 100
  const weigh = (key) => (covered ? sum(scored.map((t) => Number(t.pct) * byType[t.code][key])) / 100 / covered : null)
  return { tiles, types, byType, all: maps(allCodes), overall: weigh('exp'), overallLeague: weigh('leagueExp'), covered }
}

// `asOf`: the cutoff, when a host passes one (the standalone review build
// does); otherwise the page's own ?d=, as on /design-lab.
export function ScoutLab({ asOf: asOfProp }) {
  const [state, setState] = useState('pair')
  const [who, setWho] = useState('lefty')
  const [view, setView] = useState('pitcher')
  const [scope, setScope] = useState('all')
  const [hand, setHand] = useState(null)
  const [metric, setMetric] = useState('xwoba')
  const [code, setCode] = useState(null)
  const [picked, setPicked] = useState(null)
  const [turns, setTurns] = useState(0)
  const [inFlight, setInFlight] = useState(null)

  const hitter = HITTERS[who]
  const switchHitter = hitter.bats === 'S'
  // A switch hitter's two stances are two maps: "All" would pool the third-
  // base side as inside for one and away for the other (spec, C).
  const effHand = switchHitter ? hand ?? PITCHER.throws : hand
  const hitterHand = effHand ?? PITCHER.throws
  const stance = switchHitter ? other(PITCHER.throws) : hitter.bats
  const hitterStance = switchHitter ? other(hitterHand) : hitter.bats
  const d = asOfProp !== undefined ? asOfProp : new URLSearchParams(window.location.search).get('d')
  const asOf = isRealDate(d) ? d : null
  const cutoff = asOf ?? isoToday()
  const pickedPair = state !== 'empty'
  const loaded = pickedPair && state !== 'loading'
  const notPosted = state === 'notposted'

  const s = useMemo(
    () => (loaded ? scout({ hitter, scope, hand: effHand, hitterHand, metric, stance, notPosted }) : null),
    [loaded, hitter, scope, effHand, hitterHand, metric, stance, notPosted],
  )
  // A pill whose type left the list (a scope change) falls back to All.
  const sel = s && code && s.byType[code] ? code : null
  const m = s ? (sel ? s.byType[sel] : s.all) : null
  const scene = useMemo(
    () => (s ? scenePitches(sel ? s.tiles.filter((t) => t.code === sel) : s.types, PITCHER.throws === 'L') : []),
    [s, sel],
  )
  const onActive = useCallback((idx) => setInFlight(scene[idx]?.code ?? null), [scene])
  const selType = sel ? s.types.find((t) => t.code === sel) : null
  const typeName = selType ? selType.name : 'All pitches'
  const value = sel ? m.exp : s?.overall
  const league = sel ? m.leagueExp : s?.overallLeague
  // The mirror turns the maps over (scout.css): on a View tap only, never on
  // a cold load, so the key changes with the tap and the class follows it.
  const turn = (v) => { setView(v); setTurns((n) => n + 1) }
  const pick = (r) => setPicked((p) => (p === r ? null : r))
  const sides = sidesInOrder(view)

  return (
    <div className="scout">
      <div className="scout__lab">
        <Choice label="Lab" options={STATES} value={state} onChange={setState} />
        <Choice label="Fixture" options={HITTER_OPTS} value={who} onChange={(k) => { setWho(k); setHand(null) }} />
      </div>

      {pickedPair ? (
        <Matchup pitcher={PITCHER} hitter={hitter} onChange={() => setState('empty')} />
      ) : (
        <div className="scout__pickers">
          <label className="scout__picker">
            <span className="scout__controllabel">Pitcher</span>
            <input type="search" readOnly value="" placeholder="Search pitchers" />
          </label>
          <label className="scout__picker">
            <span className="scout__controllabel">Hitter</span>
            <input type="search" readOnly value="" placeholder="Search hitters" />
          </label>
          <p className="hint scout__empty">Pick a pitcher and a hitter</p>
          <Pill role="control" fill="paper" className="scout__pickbtn" onClick={() => setState('pair')}>Use the invented pair</Pill>
        </div>
      )}

      {pickedPair && !loaded && <AsyncStatus loading hasData={false} />}
      {loaded && (
        <div className="scout__body">
          <section className="scout__board" aria-label="Maps">
            <div className="scout__control scout__control--scroll" role="group" aria-label="Pitch">
              <span className="scout__controllabel">Pitch</span>
              <Pill role="control" fill="paper" pressed={sel === null} onClick={() => setCode(null)}>All</Pill>
              {s.types.map((t) => (
                <Pill
                  key={t.code}
                  role="control"
                  fill="paper"
                  className={`scout__pitchbtn${view === 'hitter' && inFlight === t.code ? ' is-inflight' : ''}`}
                  data-family={t.family}
                  pressed={sel === t.code}
                  onClick={() => setCode(t.code)}
                >
                  {t.name} <span className="scout__pilln">{t.pct}%</span>
                  <span className="scout__usage" style={{ '--usage': t.pct }} aria-hidden="true" />
                </Pill>
              ))}
            </div>

            <div className="scout__answer">
              <span className="scout__controllabel">
                Expected {METRICS[metric].label} · {typeName}{selType ? ` · ${selType.mph} mph` : ''}
              </span>
              <span key={value} className="scout__answervalue">{fmtMetric(metric, value)}</span>
              {value != null && league != null && (
                <span className="scout__answerleague">
                  <Swatch tone={toneOf(band(metric, value, league))} />
                  <span className="scout__cap">League {fmtMetric(metric, league)}</span>
                </span>
              )}
              {!sel && s.overall != null && <span className="scout__cap">{pct(s.covered)}% of pitches</span>}
            </div>

            <div className="scout__controls">
              <Choice label="View" options={VIEWS} value={view} onChange={turn} />
              <Choice label="Metric" options={METRIC_OPTS} value={metric} onChange={setMetric} />
            </div>

            {view === 'hitter' && scene.length > 0 && (
              <div className="pcard scout__scene">
                <PitchScene key={sel ?? 'all'} pitches={scene} lefty={PITCHER.throws === 'L'} name={PITCHER.name} onActive={onActive} />
              </div>
            )}

            <div key={turns} className={`scout__maps${turns ? ' is-turning' : ''}`}>
              <figure className="scout__fig">
                <figcaption className="scout__cap">Pitcher · location %</figcaption>
                <ZoneMap view={view} stance={stance} cells={m.pitcherCells} picked={picked} onSelect={pick}
                  label={`${typeName}: pitcher’s location share by region, ${view} view`} />
                <span className="scout__sides" aria-hidden="true"><span>{sides[0]}</span><span>{sides[1]}</span></span>
                <span className="scout__cap">
                  {m.thin ? `Under ${MIN_COMMAND_PITCHES} pitches · ` : ''}{m.n.toLocaleString()} pitches
                </span>
              </figure>
              <figure className="scout__fig">
                <figcaption className="scout__cap">Hitter · {METRICS[metric].label}</figcaption>
                {m.hitterCells ? (
                  <>
                    <ZoneMap view={view} stance={hitterStance} cells={m.hitterCells} picked={picked} onSelect={pick}
                      label={`${typeName}: hitter’s ${METRICS[metric].label} by region, ${view} view`} />
                    <span className="scout__sides" aria-hidden="true"><span>{sides[0]}</span><span>{sides[1]}</span></span>
                    <span className="scout__cap">{m.seen.toLocaleString()} pitches seen</span>
                  </>
                ) : (
                  <p className="hint scout__notposted">Not posted yet<span className="scout__cap">Pitcher map only · nightly</span></p>
                )}
              </figure>
            </div>

            <Readout picked={picked} m={m} metric={metric} stance={stance} />

            <div className="scout__key" aria-label="Colour scale">
              <p className="scout__keyrow">
                <span className="scout__keylabel">Location share: less</span>
                {[1, 2, 3, 4].map((k) => <Swatch key={k} tone={`s${k}`} />)}
                <span className="scout__keylabel">more</span>
              </p>
              <p className="scout__keyrow">
                <span className="scout__keylabel">{METRICS[metric].label} vs league: below</span>
                {['lo2', 'lo1', 'mid', 'hi1', 'hi2'].map((k) => <Swatch key={k} tone={k} />)}
                <span className="scout__keylabel">above</span>
              </p>
              <p className="scout__keyrow">
                <span className="scout__swatch scout__swatch--hatch" />
                <span className="scout__keylabel">Under {METRICS[metric].floor} {METRICS[metric].unit}: count only</span>
              </p>
            </div>

            <div className="scout__controls">
              <Choice label="Hand" options={HANDS} value={effHand} onChange={setHand} disabledKey={switchHitter ? null : undefined} />
              <Choice label="Scope" options={SCOPES} value={scope} onChange={setScope} />
            </div>
          </section>
          <HeadToHead scope={scope} cutoff={cutoff} asOf={asOf} missing={state === 'noh2h'} />
        </div>
      )}
      <p className="hint scout__fixture">Invented players · invented numbers · no feed</p>
    </div>
  )
}

// THE READOUT: the tapped region's exact figures, from both maps. It keeps
// its height when nothing is picked, so a tap never moves the maps.
function Readout({ picked, m, metric, stance }) {
  if (!picked) return <p className="scout__readout"><span className="scout__cap">Tap a region for its numbers</span></p>
  const unit = METRICS[metric].unit
  const hit = m.hit?.[picked]
  const under = hit && hit.value == null
  return (
    <p className="scout__readout" aria-live="polite">
      <span className="scout__readoutlabel">{regionLabel(picked, stance)}</span>
      <span className="scout__readoutfact">
        <span className="scout__cap">Pitcher</span>
        <span className="scout__readoutvalue">{m.thin ? '—' : `${pct(m.share[picked])}%`}</span>
        <span className="scout__cap">{m.regionN[picked].toLocaleString()} of {m.n.toLocaleString()} pitches</span>
      </span>
      {hit && (
        <span className="scout__readoutfact">
          <span className="scout__cap">Hitter</span>
          <span className="scout__readoutvalue">{under ? '—' : fmtMetric(metric, hit.value)}</span>
          <span className="scout__cap">{under ? `${hit.n} of ${METRICS[metric].floor} ${unit}` : `${hit.n.toLocaleString()} ${unit}`}</span>
        </span>
      )}
    </p>
  )
}
