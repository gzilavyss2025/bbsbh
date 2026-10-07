// Round 4 mock (#1389): three directions for the at-bat console, drawn with the
// app's OWN blocks. The page chrome (site bar, masthead, section tabs, half nav,
// console band, reference rail or chips, trail, running line, bottom bar) is the
// live app's markup captured at the same state (tools/capture.mjs → frag/*.json).
// The at-bat content is the app's real React components fed by the app's own
// selectors (computeHalfInningFeed, pitchLadder, atBatScenePitches …).
//
// NOT THE APP. The page fetches the whole feed and draws only the chosen step,
// but every at-bat value is computed inside a real SealBox reveal render
// function, so even here nothing score-bearing exists before "revealed". The
// build must keep that (ADR-0001, ADR-0002).
//
// URL: index.html?d=1|2|3&s=hr|abs|sb&v=sealed|rev[&sheet=1]
import '/src/index.css'
import './directions.css'
import { useId, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { SealBox } from '/src/components/SealBox.jsx'
import { computeHalfInningFeed } from '/src/api/playbyplay/halfInningFeed.js'
import { pitchLadder } from '/src/api/playbyplay/pitchInfo.js'
import { scorecardCenterCode } from '/src/api/scorecardGame.js'
import { AtBatHero } from '/src/components/playbyplay/AtBatHero.jsx'
import { EventCard, EVENT_CODES, BASERUNNER_EVENTS } from '/src/components/playbyplay/EventCards.jsx'
import { FielderNotice } from '/src/components/playbyplay/FielderNotice.jsx'
import { PitchScene } from '/src/components/playbyplay/pitcherCard/PitchScene.jsx'
import { AtBatBox } from '/src/components/scoring/AtBatBox.jsx'
import { PlayDiamond } from '/src/components/scoring/PlayDiamond.jsx'
import { PitchLadder } from '/src/components/scoring/PitchLadder.jsx'
import { PitchList, StrikeZone } from '/src/components/scoring/StrikeZone.jsx'
import { BallparkDiagram } from '/src/components/ballpark/BallparkDiagram.jsx'
import { Button } from '/src/components/ui/control/Button.jsx'
import { atBatScenePitches, atBatZone } from '/src/lib/pitcherCard/atBat.js'
import { ballparkFor } from '/src/lib/ballpark/ballparkData.js'
import { PLOT_VIEWBOX } from '/src/lib/ballpark/ballparkGeometry.js'
import { ballFlightPath } from '/src/lib/ballpark/ballFlight.js'
import { noticeClass } from '/src/lib/design/noticeClass.js'
import { defensiveChangeFielder } from '/src/api/playbyplay/notificationCards.js'

const q = new URLSearchParams(location.search)
const D = q.get('d') ?? '1'
const S = q.get('s') ?? 'hr'
const V = q.get('v') ?? 'rev'
const SHEET = q.has('sheet')

// The moments. `upto` = entries revealed (the step cap), `win` = the window on
// screen (an at-bat plus the notes that lead it, as focusWindows groups them).
// `bases` is the runners chip after the window — read off the feed by hand for
// these three moments (mocked; S4 derives it from runnersOnBase at the cap).
const SCENES = {
  hr: { pk: 823035, inning: 6, half: 'bottom', upto: 6, win: [5], frag: { sealed: 'hr-sealed', rev: 'hr-rev' },
    bases: { label: 'Walker scored', kraft: true, runners: [{ entry: 4, who: 'Walker', where: 'scored on the HR' }] }, sealedBases: null,
    slot: 'Bats 4th', next: 'Wetherholt' },
  abs: { pk: 824624, inning: 3, half: 'bottom', upto: 1, win: [0], frag: { sealed: 'sb-sealed', rev: 'abs-rev' },
    bases: null, slot: 'Bats 9th', next: 'Kelly' },
  sb: { pk: 824624, inning: 3, half: 'bottom', upto: 5, win: [3, 4], frag: { sealed: 'sb-sealed', rev: 'sb-rev' },
    bases: { label: 'Left on 2nd', kraft: false, runners: [{ entry: 2, who: 'Crow-Armstrong', where: 'stranded on 2nd' }] },
    slot: 'Bats 2nd', next: 'Kelly' },
}
const sc = SCENES[S]
const wideMq = matchMedia('(min-width: 740px)')
const allFrags = (await import(`./frag/${sc.frag[V]}.json`)).default
const frags = allFrags[wideMq.matches ? 'wide' : 'phone']
// D3 on wide folds the rail to the phone's own chip row (taken from the phone capture).
const phoneRefbar = new DOMParser().parseFromString(allFrags.phone.screen, 'text/html').querySelector('.refbar')?.outerHTML
const feed = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${sc.pk}/feed/live`)).json()
const side = sc.half === 'bottom' ? 'home' : 'away'
const battingTeamId = feed.gameData.teams[side].id
const pitchingTeamId = feed.gameData.teams[side === 'home' ? 'away' : 'home'].id
const gameDate = feed.gameData.datetime.officialDate

// ---------- small blocks, each the app's own component or its markup ----------

const Html = ({ html, className }) => (html ? <div className={className} dangerouslySetInnerHTML={{ __html: html }} /> : null)

// The #22 box: the scorecard's own AtBatBox, zoomed like the lens's carry strip.
function Box22({ entry, zoom = 2, label }) {
  const atbat = entry && { ...entry, centerCode: scorecardCenterCode(entry.code), ladder: pitchLadder(entry.pitches ?? []) }
  return (
    <figure className="r4box" style={{ '--r4-zoom': zoom }}>
      {label && <figcaption className="r4box__label">{label}</figcaption>}
      <div className="r4box__cell"><AtBatBox atbat={atbat} /></div>
    </figure>
  )
}

// The at-bat card's own right column: ladder, code + RBI, diamond, out circle.
function PlayCell({ e, size }) {
  const out = e.codeKind === 'out'
  return (
    <div className="pbp__side">
      <PitchLadder ladder={pitchLadder(e.pitches)} />
      <div className="pbp__play">
        {!out && e.code && (
          <span className={`pbp__code pbp__code--${e.codeKind}`}>
            {e.code}
            {e.rbi > 0 && <span className="pbp__code__rbi">{e.rbi}<span className="pbp__code__rbi-unit"> RBI</span></span>}
          </span>
        )}
        <PlayDiamond reached={e.reached} scored={e.scored} earned={e.earned} legNotations={e.legNotations} outAt={e.outAt} outCode={e.outCode} size={size} />
        {out && (e.calledLooking
          ? <span className="pbp__code pbp__code--center pbp__klooking">K</span>
          : <span className="pbp__code pbp__code--center pbp__code--out">{e.code}</span>)}
        {e.outNumber != null && <span className="pbp__outcircle">{e.outNumber}</span>}
      </div>
    </div>
  )
}

const Sentence = ({ e }) => (
  <p className="pbp__desc">{e.descSegments.map((s, i) => (s.id != null ? <span key={i} className="pbp__name">{s.text}</span> : s.text))}</p>
)

// The Now Pitching scene in its at-bat look (AtBatReplay's ReplayScene, inline).
function Scene({ e }) {
  const pitches = atBatScenePitches(e.pitchDetails)
  if (!pitches.length) return <div className="r4-note">No tracked flights at this park: the zone plot and the list carry the at-bat.</div>
  return (
    <div className="pcard pbp__replay r4-scene">
      <PitchScene pitches={pitches} lefty={e.pitcher?.hand === 'L'} name={e.pitcher?.last ?? 'the pitcher'} zone={atBatZone(e.pitchDetails)} atBat={e.pitchDetails.length} />
    </div>
  )
}

// Wide: the scene goes where the app already puts an at-bat's replay, the top
// of the reference rail, by portal (AtBatReplay's ReplayRail idiom). Phone: in
// the stage, inline. D3 keeps it in the stage at every width.
const railSlot = () => document.querySelector('.focusrail__replay')
function SceneSlot({ e, inline = false }) {
  const slot = railSlot()
  return wideMq.matches && slot && !inline ? createPortal(<Scene e={e} />, slot) : <Scene e={e} />
}

// A baserunning or substitution note, as PlayByPlay renders it.
function Note({ n }) {
  if (EVENT_CODES[n.eventType]) {
    return <EventCard code={EVENT_CODES[n.eventType]} runnerId={n.playerId} pitchLabel={n.pitchLabel} teamId={BASERUNNER_EVENTS.has(n.eventType) ? battingTeamId : pitchingTeamId} segments={n.segments} />
  }
  if (n.eventType === 'defensive_switch' || n.eventType === 'defensive_substitution') {
    const f = defensiveChangeFielder(feed, n.playerId, n.position)
    return f && <FielderNotice fielder={f} teamId={pitchingTeamId} teamName={feed.gameData.teams[side === 'home' ? 'away' : 'home'].teamName} className={noticeClass({ tone: 'event', className: 'change--framed' })} />
  }
  return <p className="pbp__note"><span className="pbp__notetext">{n.text}</span></p>
}

// The runners chip and its sheet (Gary's round-2 decision). The chip is a .btn;
// the sheet is the app's .scrim/.sheet with each runner's own #22 box.
function Runners({ entries, bases, open }) {
  const [o, setO] = useState(open)
  if (!bases) return <Button size="control" className="r4chip" disabled>Bases empty</Button>
  return (
    <>
      <Button size="control" skin="outline" className="r4chip" onClick={() => setO(true)}>{bases.label} ›</Button>
      {o && createPortal(
        <div className="scrim" onClick={() => setO(false)}>
          <div className="sheet r4sheet" role="dialog" aria-label="Runners">
            <h2 className="sheet__title">Runners · pencil each box</h2>
            <div className="r4sheet__boxes">
              {bases.runners.map((r) => <Box22 key={r.who} entry={entries[r.entry]} zoom={1.6} label={`${r.who} · ${r.where}`} />)}
            </div>
          </div>
        </div>, document.body)}
    </>
  )
}

// The flight on the real park outline (BallFlight's FlightPlot, ported here
// because the app keeps it private; the build exports it instead).
function Field({ e, empty = false }) {
  const park = ballparkFor(feed.gameData.venue.name)
  const id = useId()
  if (!park) return null
  const b = e?.battedBall
  const fl = b && b.x != null ? ballFlightPath({ x: b.x, y: b.y }, b.launchAngle, b.trajectory) : null
  return (
    <div className="r4-field">
      <BallparkDiagram className="bflight__field" dist={park.dist} wall={park.wall} arc={park.arc} viewBox={PLOT_VIEWBOX} label={`${park.name}`}>
        {!empty && fl && <path className={`bflight__path${fl.grounded ? ' bflight__path--ground' : ''}`} d={fl.d} />}
        {!empty && fl && (b.homeRun
          ? <rect className="bflight__hr" x={b.x - 13} y={b.y - 13} width="26" height="26" transform={`rotate(45 ${b.x} ${b.y})`} />
          : <circle className={b.hit ? 'bflight__hit' : 'bflight__out'} cx={b.x} cy={b.y} r="12" />)}
        <title id={id}>{park.name}</title>
      </BallparkDiagram>
      {!empty && b && (
        <div className="bflight__facts">
          <div className="bflight__fact"><p className="bflight__factlabel">Exit velo</p><p className="bflight__factvalue">{b.exitVelo?.toFixed(1) ?? '—'}<span className="bflight__unit"> mph</span></p></div>
          <div className="bflight__fact"><p className="bflight__factlabel">Launch</p><p className="bflight__factvalue">{b.launchAngle ?? '—'}°</p></div>
          <div className="bflight__fact"><p className="bflight__factlabel">Distance</p><p className="bflight__factvalue">{b.distance ?? '—'}<span className="bflight__unit"> ft</span></p></div>
        </div>
      )}
    </div>
  )
}

// Where in the at-bat a mid-at-bat note fell: the number of pitches thrown
// before it, read from the play's own playEvents (mocked here; S3 carries it as
// the note's pitchLabel, which runnerNotes.js leaves null today for WP/BK/PB).
function pitchesBefore(e, note) {
  const play = feed.liveData.plays.allPlays.find((p) => p.atBatIndex === e.atBatIndex)
  let n = 0
  for (const ev of play?.playEvents ?? []) {
    if (ev.details?.eventType === note.eventType) return n
    if (ev.isPitch) n += 1
  }
  return n
}

// ---------- the three directions (revealed) ----------

function useWindow() {
  const entries = computeHalfInningFeed(feed, sc.inning, sc.half, side, sc.upto)
  const win = sc.win.map((i) => entries[i])
  return { entries, e: win.find((x) => x.kind === 'atbat'), notes: win.filter((x) => x.kind === 'event') }
}

// D1, THE BOX: the #22 box you copy is the hero; everything else explains it.
function D1() {
  const { entries, e, notes } = useWindow()
  return (
    <div className="r4 r4--d1">
      {notes.map((n, i) => <div className="r4-a-notes" key={i}><Note n={n} /></div>)}
      <section className="pbp__atbat r4-a-hero"><AtBatHero batter={e.batter} pitcher={e.pitcher} pinchRunners={e.pinchRunners} battingTeamId={battingTeamId} pitchingTeamId={pitchingTeamId} gameDate={gameDate} /></section>
      <section className="card card--sheet r4-a-copy">
        <Box22 entry={e} zoom={2.2} label={`Pencil this · ${sc.slot}`} />
        <div className="r4-a-copytext">
          <Sentence e={e} />
          <Runners entries={entries} bases={sc.bases} open={SHEET} />
        </div>
      </section>
      <section className="r4-a-scene"><SceneSlot e={e} /></section>
      <section className="card r4-a-pitches"><PitchList pitchDetails={e.pitchDetails} /><StrikeZone pitchDetails={e.pitchDetails} batSide={e.batSide} className="strikezone--inline" /></section>
    </div>
  )
}

// D2, THE LOG: the at-bat as one ordered list, pitch by pitch, with the
// mid-at-bat notes in their place and a pencil gutter that names each mark.
function D2() {
  const { entries, e, notes } = useWindow()
  const ladder = pitchLadder(e.pitches)
  const at = new Map(notes.map((n) => [pitchesBefore(e, n), n]))
  const rows = []
  e.pitchDetails.forEach((p, i) => {
    if (at.has(i)) rows.push({ note: at.get(i) })
    rows.push({ p, mark: ladder[i] })
  })
  return (
    <div className="r4 r4--d2">
      <section className="pbp__atbat r4-b-hero"><AtBatHero batter={e.batter} pitcher={e.pitcher} pinchRunners={e.pinchRunners} battingTeamId={battingTeamId} pitchingTeamId={pitchingTeamId} gameDate={gameDate} /></section>
      <section className="r4-b-scene"><SceneSlot e={e} /></section>
      <section className="card r4-b-log">
        <header className="r4-b-head"><span>Pitch</span><span>What happened</span><span>Pencil</span></header>
        <ol className="pitchlist r4-b-rows">
          {rows.map((r, i) => r.note ? (
            <li key={i} className="r4-b-noterow"><Note n={r.note} /><span className="r4-b-pencil r4-b-pencil--run">{EVENT_CODES[r.note.eventType] ?? '—'}<small>runner box</small></span></li>
          ) : (
            <li key={i} className={`pitchlist__row r4-b-row${i === rows.length - 1 ? ' pitchlist__row--decisive' : ''}`}>
              <span className={`pitchlist__num pitchlist__num--${r.p.cat}`}>{r.p.no}</span>
              <span className="pitchlist__type">{r.p.type || '—'}</span>
              <span className="pitchlist__meta">{r.p.mph != null ? `${r.p.mph} MPH, ` : ''}{r.p.callDesc}{r.p.challenge && <b className="r4-b-abs"> · ABS {r.p.challenge.outcome === 'success' ? 'overturned' : 'upheld'}</b>}</span>
              <span className="r4-b-pencil">{r.mark.label}<small>{r.mark.side === 'ball' ? 'ball col' : 'strike col'}</small></span>
            </li>
          ))}
          <li className="r4-b-result">
            <PlayCell e={e} size={96} />
            <div><Sentence e={e} /><Runners entries={entries} bases={sc.bases} open={SHEET} /></div>
          </li>
        </ol>
      </section>
      <section className="r4-b-sum"><Box22 entry={e} zoom={1.5} label="The box, filled" /><StrikeZone pitchDetails={e.pitchDetails} batSide={e.batSide} className="strikezone--inline" /></section>
    </div>
  )
}

// D3, THE FIELD: where it happened. The pitch scene and the park share one
// stage; the diamond with every leg's mark sits on top as the scorebook key.
function D3() {
  const { entries, e, notes } = useWindow()
  const inPlay = e.battedBall?.x != null
  return (
    <div className={`r4 r4--d3${inPlay ? ' r4--inplay' : ''}`}>
      <section className="pbp__atbat r4-c-hero"><AtBatHero batter={e.batter} pitcher={e.pitcher} pinchRunners={e.pinchRunners} battingTeamId={battingTeamId} pitchingTeamId={pitchingTeamId} gameDate={gameDate} /></section>
      <section className="r4-c-stage">
        <div className="r4-c-scene"><Scene e={e} /></div>
        <div className="r4-c-park">{inPlay ? <Field e={e} /> : <Field empty />}</div>
      </section>
      <section className="card card--sheet r4-c-key">
        <PlayCell e={e} size={150} />
        <div className="r4-c-keytext">
          <Sentence e={e} />
          {notes.map((n, i) => <Note n={n} key={i} />)}
          <Runners entries={entries} bases={sc.bases} open={SHEET} />
        </div>
      </section>
      <section className="card r4-c-pitches"><PitchList pitchDetails={e.pitchDetails} /><StrikeZone pitchDetails={e.pitchDetails} batSide={e.batSide} className="strikezone--inline" /></section>
    </div>
  )
}

// ---------- sealed: fixed shapes that depend on nothing hidden (ADR-0046) ----------

function Sealed() {
  return (
    <div className={`r4 r4--d${D} r4--sealed`}>
      <Html html={frags.prepitch} />
      <Html html={frags.upnext} />
      {D === '1' && <section className="card card--sheet r4-a-copy r4-seal"><Box22 zoom={2.2} label="Next box · blank until you reveal" /><p className="r4-seal__text">The box, the play and the pitches arrive together on Next at-bat.</p></section>}
      {D === '2' && <section className="card r4-b-log r4-seal"><header className="r4-b-head"><span>Pitch</span><span>What happened</span><span>Pencil</span></header><ol className="r4-b-blank">{[1, 2, 3, 4, 5, 6].map((i) => <li key={i} />)}</ol></section>}
      {D === '3' && <section className="r4-c-stage r4-seal"><div className="r4-c-park"><Field empty /></div></section>}
    </div>
  )
}

const DIRS = { 1: D1, 2: D2, 3: D3 }
function Stage() {
  const Dir = DIRS[D]
  return (
    <>
      <Html html={frags.trail} className="r4-trail" />
      {V === 'sealed' ? <Sealed /> : <SealBox coverless forceRevealed>{() => <Dir />}</SealBox>}
      <Html html={frags.dueup} />
      {D === '3' && wideMq.matches && <Html html={phoneRefbar} className="r4-refbar" />}
      <Html html={frags.rolling} />
    </>
  )
}

document.getElementById('root').outerHTML = frags.screen
document.querySelector('.screen').classList.add(`r4screen`, `r4screen--d${D}`)
// The captured rail carries the live app's own replay; empty it so this mock's
// scene (or none, in D3) is the only one.
if (railSlot()) railSlot().innerHTML = ''
const host = document.getElementById('r4stage')
createRoot(host).render(<Stage />)
