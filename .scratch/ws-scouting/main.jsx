// WIREFRAME ONLY (#2316, step 0). Not product code: it never merges to main and
// .scratch/ is outside eslint. It draws the World Series home's scroll with the
// scouting-report cards placed among the existing ones, from the app's own parts
// (Card, StatStrip, SectionHead, Door, Pill, Key, Grid, Stack, TeamLogo, PitchMark)
// and the app's own sheets, so the tokens are real.
//
//   ?day=off   an off day before Game 1 (2026-10-22, the day before gamePk 849805)
//   ?day=game  Game 1's day (2026-10-23, gamePk 849805, Milwaukee)
//
// Existing cards are grey stubs (they do not change). New and reused-into-WS cards
// are drawn in full. Data: the Film room meetings and the Nine Keys ranks are REAL
// (meetings.json from the MLB feed, public/data/nine-keys.json). Every other number
// is a PLACEHOLDER and says so on the card.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import '../../src/styles/worldseries/home.css'
import '../../src/styles/postseason/primer-main.css'
import '../../src/styles/postseason/series-parts.css'
import '../../src/styles/pitcher-card/table.css'
import './proto.css'
import nineKeys from '../../public/data/nine-keys.json'
import meetings from './meetings.json'
import { Card } from '../../src/components/ui/frame/Card.jsx'
import { SectionHead } from '../../src/components/ui/frame/SectionHead.jsx'
import { StatCell, StatStrip } from '../../src/components/ui/frame/StatStrip.jsx'
import { Key } from '../../src/components/ui/frame/Key.jsx'
import { Door } from '../../src/components/ui/control/Door.jsx'
import { Pill } from '../../src/components/ui/control/Pill.jsx'
import { Grid } from '../../src/components/ui/layout/Grid.jsx'
import { Stack } from '../../src/components/ui/layout/Stack.jsx'
import { TeamLogo } from '../../src/components/logo/TeamLogo.jsx'
import { PitchMark } from '../../src/components/playbyplay/pitcherCard/PitchMark.jsx'
import { MatchupEdges } from '../../src/components/postseason/edges/MatchupEdges.jsx'
import { UmpireEdge } from '../../src/components/postseason/edges/UmpireEdge.jsx'
import { SeriesNineKeys } from '../../src/components/postseason/SeriesNineKeys.jsx'
import { pitchMark } from '../../src/lib/pitch/pitchTypes.js'

const MIL = 158
const TB = 139
const params = new URLSearchParams(location.search)
const DAY = params.get('day') === 'game' ? 'game' : 'off'
const WIDE = window.matchMedia('(min-width: 740px)').matches

// ---------- small parts ----------

const Placeholder = () => (
  <Pill fill="outline" ink="--clay-deep">
    Placeholder numbers
  </Pill>
)

// Where a card sits in the plan: slice and day types. A wireframe tag, not product copy.
function Tag({ slice, days, verdict }) {
  return (
    <p className="wsx-tag">
      <span>Slice {slice}</span>
      <span>{days}</span>
      <span>Verdict: {verdict}</span>
    </p>
  )
}

// An existing World Series home card: unchanged, drawn as a grey stub.
function Stub({ label, note, tall = false }) {
  return (
    <Card frame="stamped" label={label} className={`wsx-stub${tall ? ' wsx-stub--tall' : ''}`}>
      <p className="wsx-stub__note">Existing card, unchanged. {note}</p>
    </Card>
  )
}

const Club = ({ id, abbr, size = 20 }) => (
  <span className="wsx-club">
    <TeamLogo teamId={id} name={abbr} size={size} />
    {abbr}
  </span>
)

// ---------- 4b. Defense and baserunning (new, slice 2) ----------
// A mirror like Tale of the tape (it reuses ww-tape rows). Edge mark: the
// leading club's figure is ink-filled. All PLACEHOLDER: no source is confirmed.
const FIELD_ROWS = [
  { label: 'Outs above avg', tb: 21, mil: 34 },
  { label: 'Catcher framing runs', tb: 4, mil: 9 },
  { label: 'Sprint speed (ft/s)', tb: 27.6, mil: 27.4 },
  { label: 'Stolen bases', tb: 148, mil: 161 },
  { label: 'SB success', tb: '79%', mil: '83%' },
  { label: 'Extra bases taken', tb: '44%', mil: '41%' },
]
const num = (v) => parseFloat(String(v))
function FieldAndFeet() {
  return (
    <Card frame="stamped" label="Glove and legs" className="ww-tape wsx-field">
      <Tag slice="2" days="Off days" verdict="mark on the leader" />
      <div className="ww-tape__heads">
        <Club id={TB} abbr="Rays" size={28} />
        <span className="ww-tape__club ww-tape__club--home">
          Brewers <TeamLogo teamId={MIL} name="Brewers" size={28} />
        </span>
      </div>
      <ul className="ww-tape__rows">
        {FIELD_ROWS.map((r) => {
          const lead = num(r.tb) === num(r.mil) ? null : num(r.tb) > num(r.mil) ? 'tb' : 'mil'
          return (
            <li key={r.label} className="ww-tape__row">
              <span className="ww-tape__val">
                <span className={lead === 'tb' ? 'wsx-lead' : undefined}>{r.tb}</span>
              </span>
              <span className="ww-tape__label">{r.label}</span>
              <span className="ww-tape__val ww-tape__val--home">
                <span className={lead === 'mil' ? 'wsx-lead' : undefined}>{r.mil}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="wsx-foot">
        <Placeholder /> No club-level defense or baserunning file is confirmed yet; this card may need a new generator.
      </p>
    </Card>
  )
}

// ---------- 1. Film room (new, slice 1) ----------
// The regular-season meetings, open (issue #2316 "show everything"). REAL data.
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`
const DOW = (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${d}T12:00:00`).getDay()]

function MixBar({ mix }) {
  const total = Object.values(mix).reduce((a, b) => a + b, 0)
  const rows = Object.entries(mix).sort((a, b) => b[1] - a[1])
  return (
    <div className="wsx-mix">
      <span className="wsx-mix__bar" aria-hidden="true">
        {rows.map(([c, n]) => (
          <i key={c} style={{ flexGrow: n, background: pitchMark(c).color }} />
        ))}
      </span>
      <span className="wsx-mix__codes">
        {rows.map(([c, n]) => (
          <span key={c} className="wsx-mix__code">
            <PitchMark mark={pitchMark(c)} size={12} />
            {c} {Math.round((n / total) * 100)}
          </span>
        ))}
      </span>
    </div>
  )
}

function Starter({ side }) {
  const s = side.starter
  return (
    <div className="wsx-sp">
      <p className="wsx-sp__who">
        <TeamLogo teamId={side.id} name={side.abbr} size={16} />
        <b>{s.name}</b> <span className="wsx-dim">{s.hand}HP</span>
      </p>
      <p className="wsx-sp__line">
        {s.ip} IP · {s.h} H · {s.er} ER · {s.bb} BB · {s.k} K · {s.pitches} P
      </p>
      <MixBar mix={s.mix} />
    </div>
  )
}

function Meeting({ g, compact }) {
  const tbWon = g.away.runs > g.home.runs
  return (
    <Card frame="stamped" as="article" label={`${DOW(g.date)} ${md(g.date)}`} count={`HP ${g.ump}`} className="wsx-meet">
      <ul className="wsx-meet__score">
        {[g.away, g.home].map((t) => (
          <li key={t.id} className={t.runs > (t === g.away ? g.home.runs : g.away.runs) ? 'is-win' : ''}>
            <Club id={t.id} abbr={t.abbr} />
            <span className="wsx-meet__runs">{t.runs}</span>
            <span className="wsx-dim">
              {t.hits} H {t.errors} E
            </span>
          </li>
        ))}
      </ul>
      <p className="wsx-dim wsx-meet__dec">
        W {g.decisions.w} · L {g.decisions.l}
        {g.decisions.s ? ` · S ${g.decisions.s}` : ''}
      </p>
      {!compact && (
        <>
          <Starter side={g.away} />
          <Starter side={g.home} />
          <details className="wsx-meet__more">
            <summary>Scoring plays ({g.scoring.length})</summary>
            <ol>
              {g.scoring.map((s, i) => (
                <li key={i}>
                  <b>{s.inning}</b> {s.text.replace(/ {2,}/g, ' ')}
                </li>
              ))}
            </ol>
          </details>
          <details className="wsx-meet__more">
            <summary>Lineups</summary>
            <Grid min={130} gap="snug">
              {[g.away, g.home].map((t) => (
                <ol key={t.id} className="wsx-lineup">
                  {t.lineup.map((p) => (
                    <li key={p.id}>
                      {p.name} <span className="wsx-dim">{p.pos}</span>
                    </li>
                  ))}
                </ol>
              ))}
            </Grid>
          </details>
        </>
      )}
      <div className="wsx-meet__doors">
        <Door href={`/game/${g.gamePk}/box?nointro`}>Box score</Door>
        {!compact && <Door href={`/scout`}>Scout {g.away.starter.name.split(' ').at(-1)}</Door>}
      </div>
      <span className="sr-only">{tbWon ? 'Rays won' : 'Brewers won'}</span>
    </Card>
  )
}

function FilmRoom({ compact }) {
  const tbW = meetings.filter((g) => g.away.runs > g.home.runs).length
  return (
    <section className="wsx-section">
      <SectionHead look="rule" note={`Brewers ${meetings.length - tbW}–${tbW} · all at American Family Field`}>
        Film room: the regular-season meetings
      </SectionHead>
      <Tag slice="1" days={compact ? 'Game days: compact rows' : 'Off days: full'} verdict="numbers only" />
      {WIDE || compact ? (
        <Grid min={240} gap="loose">
          {meetings.map((g) => (
            <Meeting key={g.gamePk} g={g} compact={compact} />
          ))}
        </Grid>
      ) : (
        // Phone, off day: a snap rail like the Reel, so three full games cost one card's height.
        <ol className="wsx-rail">
          {meetings.map((g) => (
            <li key={g.gamePk}>
              <Meeting g={g} />
            </li>
          ))}
        </ol>
      )}
      <p className="wsx-foot">Real data, gamePks 823809, 823807, 823806. Box score opens by its date (ADR-0117); the innings viewer stays sealed.</p>
    </section>
  )
}

// ---------- 2. Matchup edges + 7. Umpire (reused from the primer, slice 1) ----------
const EDGES = [
  { kind: 'hitter', id: 665833, name: 'Yandy Díaz', vs: 'Misiorowski', line: '3-for-5, HR' },
  { kind: 'hitter', id: 691406, name: 'Junior Caminero', vs: 'Misiorowski', line: '2-for-4, 2B' },
  { kind: 'hitter', id: 621446, name: 'Christian Yelich', vs: 'McClanahan', line: '4-for-9, 2 BB' },
  { kind: 'pitcher', id: 663556, name: 'Shane McClanahan', vs: 'William Contreras', line: '0-for-7, 4 K' },
]

function Edges({ day }) {
  return (
    <section className="wsx-section">
      <Tag slice="1" days="Off days (next game: 849805) and game days" verdict="numbers only (as built)" />
      <Grid min={300} gap="loose">
        <MatchupEdges edges={EDGES} />
        {day === 'game' ? (
          <UmpireEdge name="Plate umpire (posted)" lean={{ tier: 'pitcher', z: -0.8 }} />
        ) : (
          <PitchType />
        )}
      </Grid>
      <p className="wsx-foot">
        <Placeholder /> Names are real; lines are placeholders. Umpire Edge shows only on game days, once the crew posts.
      </p>
    </section>
  )
}

// ---------- 3. Pitch-type matchup (new, slice 2) ----------
// Game 1's projected Brewers starter's mix (Misiorowski's 4/1 mix, REAL) against
// the Rays lineup's xwOBA by pitch type (PLACEHOLDER). Edge mark per row.
const PT = [
  { code: 'FF', use: 62, xw: 0.318, lg: 0.341 },
  { code: 'SL', use: 27, xw: 0.276, lg: 0.289 },
  { code: 'CU', use: 6, xw: 0.331, lg: 0.296 },
  { code: 'CH', use: 5, xw: 0.302, lg: 0.305 },
]
const f3 = (n) => n.toFixed(3).replace(/^0/, '')
function PitchType() {
  return (
    <Card frame="stamped" label="Pitch by pitch" count="Misiorowski vs TB" className="wsx-pt">
      <Tag slice="2" days="Off days and game days" verdict="edge mark, number behind" />
      <table className="wsx-table">
        <thead>
          <tr>
            <th scope="col">Pitch</th>
            <th scope="col">Uses</th>
            <th scope="col">TB xwOBA</th>
            <th scope="col">Lg</th>
            <th scope="col">Edge</th>
          </tr>
        </thead>
        <tbody>
          {PT.map((r) => {
            const m = pitchMark(r.code)
            const pitcher = r.xw < r.lg - 0.01
            const hitter = r.xw > r.lg + 0.01
            return (
              <tr key={r.code}>
                <th scope="row" className="wsx-pt__pitch">
                  <PitchMark mark={m} size={14} /> {m.name}
                </th>
                <td>
                  <span className="wsx-pt__use">
                    <i style={{ width: `${r.use}%` }} />
                  </span>
                  {r.use}%
                </td>
                <td>{f3(r.xw)}</td>
                <td className="wsx-dim">{f3(r.lg)}</td>
                <td>
                  {pitcher && <span className="wsx-edge wsx-edge--p">Arm</span>}
                  {hitter && <span className="wsx-edge wsx-edge--h">Bats</span>}
                  {!pitcher && !hitter && <span className="wsx-dim">Even</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="wsx-foot">
        <Placeholder /> Mix is real (4/1 vs TB). xwOBA would read hitter-grid by pitch, hand and stand.{' '}
        <Door href="/scout">Full Scout</Door>
      </p>
    </Card>
  )
}

// ---------- 5. Platoon view (new, slice 2) ----------
// Each lineup by pitcher hand; the row that matches the opposing probable is
// highlighted. Mark on the leading club (ww-best). PLACEHOLDER.
function Platoon() {
  const rows = [
    { label: 'vs RHP', tb: '.731', mil: '.758', on: true, note: 'Misiorowski (R) starts G1 for MIL' },
    { label: 'vs LHP', tb: '.702', mil: '.689', on: false, note: 'McClanahan (L) starts G1 for TB' },
  ]
  return (
    <Card frame="stamped" label="Platoon" count="lineup OPS" className="wsx-plat">
      <Tag slice="2" days="Off days and game days" verdict="mark on the leader" />
      {rows.map((r) => (
        <div key={r.label} className={`wsx-plat__row${r.on ? ' is-on' : ''}`}>
          <p className="wsx-plat__label">
            {r.label} <span className="wsx-dim">{r.note}</span>
          </p>
          <StatStrip>
            <StatCell label="Rays" value={r.tb} className={r.tb > r.mil ? 'ww-best' : ''} />
            <StatCell label="Brewers" value={r.mil} className={r.mil > r.tb ? 'ww-best' : ''} />
          </StatStrip>
        </div>
      ))}
      <p className="wsx-foot">
        <Placeholder /> Wide screens could add the nine regulars by hand under each strip.
      </p>
    </Card>
  )
}

// ---------- 6. Park fit (new, slice 2) ----------
// Milwaukee's wall against each club's spray. A simple fan with pull, centre and
// oppo shares. PLACEHOLDER shares; the real card reads public/data/spray and
// src/lib/ballpark (the Trip card's fence art).
function ParkFit() {
  const fan = [
    { k: 'Pull', tb: 41, mil: 38 },
    { k: 'Center', tb: 35, mil: 37 },
    { k: 'Oppo', tb: 24, mil: 25 },
  ]
  return (
    <Card frame="stamped" label="Park fit" count="American Family Field" className="wsx-park">
      <Tag slice="2" days="Off days; game days at MIL only" verdict="numbers only" />
      <svg viewBox="-115 -150 230 155" className="wsx-park__fan" role="img" aria-label="Field fan, placeholder">
        <path d="M0 0 L-100 -100 A141 141 0 0 1 100 -100 Z" className="wsx-park__grass" />
        <path d="M0 0 L-100 -100 A141 141 0 0 1 100 -100" className="wsx-park__wall" />
        <path d="M0 0 L-38 -38 L0 -76 L38 -38 Z" className="wsx-park__dirt" />
        <text x="-66" y="-58">LF 344</text>
        <text x="0" y="-122" textAnchor="middle">CF 400</text>
        <text x="66" y="-58" textAnchor="end">RF 345</text>
      </svg>
      <table className="wsx-table">
        <thead>
          <tr>
            <th scope="col">Fly balls</th>
            <th scope="col">TB</th>
            <th scope="col">MIL</th>
          </tr>
        </thead>
        <tbody>
          {fan.map((r) => (
            <tr key={r.k}>
              <th scope="row">{r.k}</th>
              <td>{r.tb}%</td>
              <td>{r.mil}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="wsx-foot">
        <Placeholder /> Games 1, 2, 6, 7 are here. A Tropicana/Steinbrenner panel would join for Games 3 to 5.
      </p>
    </Card>
  )
}

// ---------- the scroll ----------

function ReportHead() {
  return (
    <SectionHead look="band" house as="h2" note="Rays · Brewers" action={<Door href="/print/ws?nointro">One-sheet</Door>}>
      Scouting report
    </SectionHead>
  )
}

function OffDay() {
  return (
    <Stack gap="section" className="ww">
      <Stub label="Game 1 · Thu 10/23" note="Hero: clubs, records, schedule strip (phone)." tall />
      {WIDE && <Stub label="Ledger" note="Wide only." />}
      <Stub label="Road here" note="Reel." />
      <ReportHead />
      <Tag slice="1 + 2" days="One-sheet door: both day types" verdict="—" />
      <section className="wsx-section">
        <Tag slice="1 (Nine Keys as built) · 2 (Glove and legs)" days="Off days only" verdict="Nine Keys: numbers on a 1–30 track" />
        <Grid min={340} gap="loose">
          <SeriesNineKeys data={nineKeys} clubs={[{ id: TB }, { id: MIL }]} season={2026} />
          <FieldAndFeet />
        </Grid>
      </section>
      <Edges day="off" />
      <Grid min={300} gap="loose">
        <Platoon />
        <ParkFit />
      </Grid>
      <FilmRoom />
      {!WIDE && <Stub label="Played" note="Phone only; empty before Game 1." />}
      <Stub label="The trip" note="" />
      <Grid min={340} gap="loose">
        <Stub label="Home and road" note="" />
        <Stub label="Bullpen" note="Gary keeps it as is." />
      </Grid>
    </Stack>
  )
}

function GameDay() {
  return (
    <Stack gap="section" className="ww">
      <Stub label="Game 1 · Tonight" note="Hero: no score slot for today (ADR-0116)." tall />
      {WIDE && <Stub label="Ledger" note="Wide only." />}
      <Stub label="Road here" note="Reel." />
      <Stub label="Probables" note="Starting pitching; Series Starters stays off (overlap)." tall />
      <ReportHead />
      <Edges day="game" />
      <Grid min={300} gap="loose">
        <PitchType />
        <Platoon />
      </Grid>
      <Grid min={340} gap="loose">
        <Stub label="Tale of the tape" note="Shows the meeting wins." />
        <Stub label="Hot bats" note="" />
      </Grid>
      <FilmRoom compact />
      <Grid min={300} gap="loose">
        <ParkFit />
        <Stub label="Bullpen" note="" />
      </Grid>
    </Stack>
  )
}

function Frame() {
  return (
    <div className="app wsx">
      <header className="wsx-bar">
        <b>Wireframe · #2316</b>
        <span>
          {DAY === 'off' ? 'Off day · Wed 10/22 · before 849805' : 'Game day · Thu 10/23 · 849805 at MIL'} · {WIDE ? 'wide (740+)' : 'phone'}
        </span>
        <span className="wsx-dim">Opponent placeholder: Rays (lead ALCS 3–2)</span>
      </header>
      <main className="screen screen--slate wsx-main">{DAY === 'off' ? <OffDay /> : <GameDay />}</main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Frame />
  </StrictMode>,
)
