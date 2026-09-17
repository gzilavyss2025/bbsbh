import { useMemo, useState } from 'react'
import {
  inningSeries,
  roleInnings,
  roleSpan,
  ROLE_LABEL,
} from '../../../api/around-the-game/absChallenges.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { ColumnChart, LineChart } from '../../../components/around-the-game/BroadcastBar.jsx'
import { commas, num2, pct1 } from './format.js'

// WHEN THEY CALL FOR ONE — and the correction that turns the answer round.
//
// THE RAW COUNT SAYS NOTHING, TWICE OVER. Ask which innings draw the most
// challenges and the rows answer that the ninth barely beats the eighth, which
// reads as a flat appetite that sags at the end. Both halves of that are the
// denominator:
//
//   1. NOT EVERY GAME REACHES THE NINTH, and in a good half of the ones that
//      do, the home club never bats in it.
//   2. A CLUB THAT HAS LOST TWO CANNOT ASK AT ALL, so by the ninth a large
//      share of the league is silent by rule rather than by choice.
//
// Divided by the half-innings a club played still holding a challenge, the
// answer inverts: the appetite MORE THAN DOUBLES from the first to the ninth,
// and the share won falls the other way across the same span. Clubs ask more as
// the game gets late and are right less often when they do.
//
// SO THE CHIP PAIR IS THE ARGUMENT, not a convenience. "Raw count" is not an
// alternative view offered for balance — it is the wrong answer, kept on the
// page so a reader can see what the correction is worth by tapping between
// them. Per chance leads, because it is the true one.
//
// IT READS THE `summary` IT IS HANDED and never the file, so the page's MLB /
// Triple-A chip switches this board for free.

// The two ways of counting, in the order the page offers them. The corrected
// one leads.
const CUTS = [
  { key: 'perChance', label: 'Per 100 chances' },
  { key: 'n', label: 'Raw count' },
]

// A rate is shipped as a share and printed per hundred, the same scale the
// club and umpire boards use.
const per100 = (x) => (x == null ? null : x * 100)

function cutValue(row, cut) {
  return cut === 'n' ? row.n : per100(row.perChance)
}

// Ticks a reader can count on: a round step that clears the tallest column,
// and never more than four lines across the plot.
function ticksTo(max, step) {
  const out = []
  for (let v = step; v <= max; v += step) out.push({ value: v, label: String(v) })
  return out
}

export function WhenTheyCall({ summary }) {
  const [cut, setCut] = useState('perChance')

  const innings = useMemo(() => inningSeries(summary), [summary])

  // THE ROLES SHARE THE CLUB'S SCALE, which is the only way the two panels can
  // be read against the chart above them. Each role's chances are the CLUB's
  // chances — a batter can only challenge in his club's batting half, so his
  // own opportunity is half the club total, and a panel drawn that way sums to
  // exactly twice the club rate. On the club denominator the three roles add
  // back up to the club figure.
  const scale = useMemo(() => {
    let max = 0
    for (const r of innings) {
      const v = cutValue(r, cut)
      if (v != null && v > max) max = v
    }
    return max
  }, [innings, cut])

  // Each role's whole-season count, which is what the roles table prints.
  const roleTotals = useMemo(
    () => new Map((summary?.byRole ?? []).map((r) => [r.role, r.n])),
    [summary],
  )

  const pitchers = useMemo(() => roleSpan(summary, 'pitcher'), [summary])

  if (innings.length === 0) return null

  const step = cut === 'n' ? 400 : 8
  const columns = innings.map((r) => ({
    key: r.inning,
    label: r.extras ? `${r.inning}+` : String(r.inning),
    value: cutValue(r, cut),
    hollow: r.extras,
  }))
  const extras = innings.find((r) => r.extras)

  // The share won, on its own scale with its own ticks. Regulation only: the
  // pooled extras column has a share too, and putting it on a line whose x axis
  // is "the inning" would draw a tenth point that is really four.
  const won = innings.filter((r) => !r.extras)
  const wonPoints = won.map((r) => ({
    key: r.inning,
    label: String(r.inning),
    value: per100(r.rate),
  }))
  const first = wonPoints[0]
  const last = wonPoints[wonPoints.length - 1]

  return (
    <BroadcastSection title="When they call for one">
      <div className="rpt-controls" role="group" aria-label="How to count challenges">
        {CUTS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`rpt-chip${c.key === cut ? ' is-on' : ''}`}
            aria-pressed={c.key === cut}
            onClick={() => setCut(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ColumnChart
        columns={columns}
        max={scale}
        ticks={ticksTo(scale, step)}
        label={
          cut === 'n'
            ? 'Challenges called in each inning'
            : 'Challenges per 100 half-innings a club played still holding one'
        }
      />

      {/* THE CAPTION HAS TO DEFINE THE DENOMINATOR, because nothing else on the
          page does and "per 100 chances" means nothing without it. It is one of
          the few real sentences on this page, so it takes .rptprose — `#root *`
          shouts every word in this app and a shouted paragraph is unreadable. */}
      <p className="hint rptprose">
        {cut === 'n' ? (
          <>
            The raw count, which the ninth inning wins narrowly — and only because far
            fewer clubs reach it still able to argue. Tap “Per 100 chances” for what
            the innings look like once that is taken out.
          </>
        ) : (
          <>
            A chance is one half-inning a club played while it still held a challenge.
            Both clubs are exposed in every half-inning, and a club that has lost two
            cannot ask at all, so its silence is the rulebook rather than a decision.
          </>
        )}
        {extras ? (
          <>
            {' '}
            The last column pools the tenth inning and beyond — {commas(extras.n)}{' '}
            {extras.n === 1 ? 'challenge' : 'challenges'} over {commas(extras.chances)}{' '}
            chances — and is drawn hollow because it is a fraction of the season the
            other columns each carry.
          </>
        ) : null}
      </p>

      {/* TWO PANELS, NOT THREE. A pitcher's nine values span a third of one
          challenge per hundred chances, so on the shared scale every one of his
          bars rounds to the same hairline: a third panel would draw a thicker
          axis rule and call it a chart. The line below says what it would have
          shown, in fewer words and without the false precision. */}
      <div className="colchart__multiples">
        {['catcher', 'batter'].map((role) => {
          const rows = roleInnings(summary, role)
          if (rows.length === 0) return null
          return (
            <div key={role} className="colchart__panel">
              {/* THE SEASON TOTAL, not the nine innings drawn below it. The
                  panel covers regulation only, but the figure beside the name
                  is the one the roles table three sections up prints, so a
                  reader can tie the two together instead of finding two
                  different counts for the same man's job. */}
              <span className="colchart__paneltitle">
                {ROLE_LABEL[role] ?? role} · {commas(roleTotals.get(role))}
              </span>
              <ColumnChart
                size="small"
                columns={rows.map((r) => ({
                  key: r.inning,
                  label: String(r.inning),
                  value: cutValue(r, cut),
                }))}
                max={scale}
                label={`${ROLE_LABEL[role] ?? role} challenges by inning, on the club's own scale`}
              />
            </div>
          )
        })}
      </div>

      {pitchers ? (
        <p className="hint rptprose">
          Pitchers called for {commas(roleTotals.get('pitcher'))} of the season’s{' '}
          {commas(summary.total)}{' '}
          reviews, and they do it at the same rate all game — between{' '}
          {num2(per100(pitchers.low))} and {num2(per100(pitchers.high))} per 100 chances, first inning to
          ninth. The panels above are drawn for the two men who actually argue, on the
          same club scale as the chart at the top — so the three roles add back up to it.
        </p>
      ) : null}

      {/* THE SHARE WON, ON ITS OWN CHART. Never a second axis on the first one:
          the appetite rises across the game and the share won falls across it,
          and on one pair of axes the two lines cross wherever the second scale
          is pinned. That crossing is an artefact and a reader cannot tell it
          from a finding. */}
      <div className="colchart__panel colchart__panel--wide">
        <span className="colchart__paneltitle">Share won, by inning</span>
        <LineChart
          points={wonPoints}
          min={0}
          max={75}
          ticks={[
            { value: 25, label: '25%' },
            { value: 50, label: '50%' },
            { value: 75, label: '75%' },
          ]}
          label="Share of challenges overturned, by inning"
          endLabels={[
            { key: 'first', side: 'start', value: first?.value ?? 0, text: pct1(won[0]?.rate) },
            {
              key: 'last',
              side: 'end',
              value: last?.value ?? 0,
              text: pct1(won[won.length - 1]?.rate),
            },
          ]}
        />
      </div>
    </BroadcastSection>
  )
}
