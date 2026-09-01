import '../../styles/26c-mound-card.css'
import {
  availabilityFor,
  dayStripFor,
  fetchWorkload,
  moundRateFor,
  restRunsFor,
  turnStripFor,
  workloadFor,
  workloadVsBaseline,
} from '../../api/workload.js'
import { DayStrip, DayStripKey } from '../workload/DayStrip.jsx'
import { ThresholdBullets } from '../workload/ThresholdBullets.jsx'
import { useAsync } from '../../hooks/useAsync.js'

// THE MOUND CARD — the pitcher's counterpart to a hitter's Recent form.
//
// A hitter plays every day, so his last three lines answer "how is he going".
// A pitcher works every fifth or sixth day, so his last three lines never say
// the thing a scorer wants the moment a reliever starts throwing: DID HE PITCH
// YESTERDAY. So this card carries both halves — what he threw, and where that
// leaves him — and it shapes itself to the three ways a pitcher is used.
//
// ONE CARD, THREE ROLES.
//   - A STARTER's story is his turn, so he gets days-since-his-last-start
//     against the gap his own recent turns have kept.
//   - A RELIEVER's and a CLOSER's story is availability, so they get a
//     fourteen-day strip, one cell per day, shaded by what he threw.
// The role word comes from the CALLER (the hub hero's own reading) so the page
// says one thing about a man; the baseline caption keeps its own SP/RP wording,
// because that is the pool gen-workload.mjs actually averages.
//
// NOTHING HERE PREDICTS. It never names a next start and never calls a pitcher
// available — a manager decides both. Where a verdict IS wanted, the card shows
// the one the app already ships: availabilityFor's fresh/limited/down, the same
// call the Bullpen Board and the callout notes make off this same file. The
// pitcher's own page was the one surface not showing it.
//
// Data is the nightly gen-workload.mjs precompute — completed appearances only,
// spoiler-free. Current-day only (hidden under a spoiler `asOf`), same rule as
// FoulCard/Milestone Watch.
//
// MLB-ONLY, and this is the sharp edge: workload.json is built from the thirty
// ACTIVE MLB rosters, so a Triple-A arm has no record — and an MLB pitcher
// OPTIONED DOWN loses his mid-season. That is rendered as "not posted yet"
// rather than an empty frame, per the degrade convention.
const ROLE_WORD = { SP: 'starter', RP: 'reliever', CL: 'closer' }

// Outing rows read best with the opponent and the line beside the pitch count,
// and the page already holds both — `gameLog` is the same view the Game log
// renders, joined here by date. Optional: without it the rows still print the
// date and the pitch count, which is what workload.json alone can say.
const OUTING_ROWS = 3

export function PitcherWorkloadCard({ playerId, asOf, role = null, gameLog = null }) {
  const skip = !!asOf
  const { data } = useAsync(() => (skip ? Promise.resolve(null) : fetchWorkload()), [skip])
  if (skip || !data) return null

  // TWO DATES, deliberately. The buckets read one day PAST the file's cutoff so
  // an appearance dated on it still counts (workloadFor excludes asOfDate
  // itself). Every CALENDAR reading — the availability verdict, both strips,
  // days-since — reads the cutoff itself, because that day is today. Letting
  // the shifted date reach those made "yesterday" mean today, added a day to
  // days-since, and slid availabilityFor's three-day window off the end: this
  // card called a reliever fresh while the Bullpen Board, reading the real game
  // date off this same file, called him limited. Same file, same man, two
  // verdicts.
  const bucketDate = dayAfter(data.asOf)
  const asOfDate = data.asOf
  const load = workloadFor(data, playerId, bucketDate)
  if (!load || (load.season?.g ?? 0) === 0) return null

  const fileRole = load.role ?? 'RP'
  const word = ROLE_WORD[role] ?? ROLE_WORD[fileRole] ?? 'pitcher'
  const turn = turnStripFor(data, playerId, asOfDate)
  const rates = moundRateFor(data, playerId)
  const vs = workloadVsBaseline(data, playerId, bucketDate)
  const outings = outingRows(data, playerId, asOfDate, gameLog)

  return (
    <div className="moundcard">
      <h3 className="section__title section__title--bar">
        <span>On the mound</span>
        <em>{word}</em>
      </h3>

      {turn ? <TurnLead turn={turn} /> : <BullpenLead data={data} playerId={playerId} asOfDate={asOfDate} />}

      {outings.length > 0 && (
        <ul className="moundcard__outings">
          {outings.map((o) => (
            <li className="moundcard__outing" key={o.date}>
              <span className="moundcard__when">{o.label}</span>
              <span className="moundcard__line">{o.line}</span>
            </li>
          ))}
        </ul>
      )}

      {turn
        ? !turn.outOfTurn && <TurnStrip turn={turn} />
        : <MoundDayStrip data={data} playerId={playerId} asOfDate={asOfDate} />}

      <dl className="factgrid moundcard__foot">
        <Fact label={`Last ${load.last10.apps}`} value={`${load.last10.pitches} pitches`} />
        {vs?.vsOwnPct != null && <Fact label="Vs. his norm" value={signedPct(vs.vsOwnPct)} />}
        {turn
          ? rates?.ipPerStart && (
              <Fact label="Avg per start" value={`${rates.ipPerStart} IP · ${rates.pitchesPerStart} P`} />
            )
          : rates && (
              <Fact
                label="Outs per outing"
                value={`${rates.outsPerOuting}${rates.multiInning ? ' · multi-inning' : ''}`}
              />
            )}
      </dl>
    </div>
  )
}

// A starter's lead: when he last took the ball, and how long ago. Not a next
// start — that is the manager's call and the card does not make it.
function TurnLead({ turn }) {
  return (
    <p className="moundcard__lead">
      <span className="moundcard__leadbig">{relativeDay(turn.daysSince)}</span>
      <span className="moundcard__leadsub">
        Last start {monthDay(turn.lastStart)}
        {turn.lastStartPitches != null && ` · ${turn.lastStartPitches} P`}
      </span>
    </p>
  )
}

// A bullpen arm's lead: the app's OWN availability verdict, not a second
// opinion — then the rule that reached it, DRAWN.
//
// The reasons string used to sit here ("42 pitches yesterday · 42 pitches over
// 3 days"), which handed the reader two numbers and no scale to read them
// against. The threshold bullets are those same flags against the thresholds
// they are judged by, so the bar past its tick is the flag tripping. Same call,
// same file, no sentence.
function BullpenLead({ data, playerId, asOfDate }) {
  const avail = availabilityFor(data, playerId, asOfDate)
  const status = avail?.status ?? 'fresh'
  return (
    <div className="moundcard__verdict">
      <p className="moundcard__lead">
        <span className={`moundcard__avail moundcard__avail--${status}`}>{status}</span>
      </p>
      <ThresholdBullets flags={avail?.flags} />
    </div>
  )
}

// The days-since strip. Filled cells are days elapsed; the dashed cell is TODAY,
// the same meaning it carries on the bullpen strip. The trailing band is the
// range his own recent turns have kept — a range, because a single number would
// be a prediction wearing a description's clothes.
function TurnStrip({ turn }) {
  const cells = Array.from({ length: Math.max(turn.daysSince, 1) }, (_, i) => i + 1)
  const band = turn.typicalMin != null
  return (
    <div className="moundstrip">
      <p className="moundstrip__head">
        <span className="moundstrip__label">Days since · dashed is today</span>
        {band && (
          <span className="moundstrip__note">
            his last turns came every {turn.typicalMin}
            {turn.typicalMax !== turn.typicalMin && `–${turn.typicalMax}`} days
          </span>
        )}
      </p>
      <div className="moundstrip__row">
        {cells.map((n) => (
          <span
            className={`moundstrip__day moundstrip__day--elapsed${n === turn.daysSince ? ' moundstrip__day--today' : ''}`}
            key={n}
          >
            {n}
          </span>
        ))}
        {band && (
          <span className="moundstrip__band">
            {turn.typicalMin}
            {turn.typicalMax !== turn.typicalMin && `–${turn.typicalMax}`} d
          </span>
        )}
      </div>
    </div>
  )
}

// The fourteen-day availability strip: one cell per day, shaded by what he
// threw, with the REST RAIL under runs of days worked back to back. The bands
// are the app's own tired thresholds (LOAD_BANDS) and the rail's solid weight
// is the hard flag's three straight days, so nothing drawn here can disagree
// with the verdict above it.
function MoundDayStrip({ data, playerId, asOfDate }) {
  const strip = dayStripFor(data, playerId, asOfDate)
  if (!strip) return null
  return (
    <div className="moundstrip">
      <p className="moundstrip__head">
        <span className="moundstrip__label">Last 14 days · dashed is today</span>
      </p>
      <DayStrip cells={strip} runs={restRunsFor(strip)} />
      <div className="moundstrip__legend">
        <DayStripKey />
      </div>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value}</dd>
    </div>
  )
}

// His last few outings, joined to the game log by date when the page has it.
function outingRows(data, playerId, asOfDate, gameLog) {
  const p = data?.pitchers?.[String(playerId)]
  const apps = (p?.apps ?? []).filter((a) => a.d < asOfDate).slice(0, OUTING_ROWS)
  const byDate = new Map((gameLog?.rows ?? []).map((r) => [r.date, r]))
  return apps.map((a) => {
    const row = byDate.get(monthDay(a.d))
    return {
      date: a.d,
      label: row ? `${monthDay(a.d)} · ${row.home ? 'vs' : '@'} ${row.opp}` : monthDay(a.d),
      line: row ? `${row.line} · ${a.p} P` : `${a.p} P`,
    }
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(ymd) {
  const [, m, d] = String(ymd).split('-')
  return m && d ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : String(ymd)
}

function relativeDay(n) {
  return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`
}

function dayAfter(ymd) {
  const t = Date.parse(`${ymd}T00:00:00Z`)
  if (!Number.isFinite(t)) return ymd
  return new Date(t + 86400000).toISOString().slice(0, 10)
}

function signedPct(n) {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`
}
