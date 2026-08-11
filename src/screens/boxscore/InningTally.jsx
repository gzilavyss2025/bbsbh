import { useState } from 'react'
import { TeamLink } from '../../components/team/TeamLink.jsx'
import { TeamTreatmentMark } from '../../components/logo/TeamTreatmentMark.jsx'

// A per-half-inning tally the printed line score never carries: pitches thrown,
// whiffs (swing-and-miss), fouls, and runners left on base (see
// computeInningDigest). Everything here is plain play-by-play, so unlike the
// Statcast/win-prob cards it renders at MiLB parks too — the box score's one
// enrichment that never goes dark below AAA. Hidden only if the feed carried no
// plays at all.
//
// FOUR FIGURES, FOUR ROWS — not four figures in one box. The card used to read
// its cube (2 clubs x N innings x 4 measures) as a second line score, one row
// per club, with each inning cell holding all four numbers slash-joined
// ("25/1/7/3"). That asked a cell 54px wide to carry eight characters, so the
// digits overran their own boxes on a phone and the last inning clipped
// mid-number; and a reader had to hold the order of the four in their head from
// a legend printed above the grid. It was a code, not a cell.
//
// So the cube is unfolded the other way: one row per measure per club, one
// number per box, and the measure NAMED down the left edge instead of decoded
// from a legend. Nine innings of two-digit boxes fit a phone with no scroll at
// all, which the old layout never did; extras still scroll, in .bs__scroll, as
// before.
//
// THE CLUB PILL FILTERS, IT DOES NOT REPLACE. Both clubs stay adjacent inside
// each measure by default, because the question this card answers first is "who
// was grinding in the 4th?" — a comparison between the clubs in one inning. But
// eight rows of numbers is a lot to hold when you are following ONE staff, so
// the pill drops the other club's four rows away.
//
// Three segments, the unfiltered one FIRST and default: the shape every other
// filter in the app uses (LogbookStatsPage's level bar, VsLevelSlider's rung 0,
// the Foul Tracker's All column). It says "Both" rather than "All" only because
// the set here is exactly two — the same reason SplitsSection's reference row
// says "Season": the word has to be true, and "all" of two things is "both".
//
// The two staffs stay comparable across a switch because the shading scale does
// not move when you filter (see below).
//
// THE SHADING ADDS NO INFORMATION — every number is printed, in full, in its
// own box. It is a redundant encoding of that same number: a pencil wash whose
// weight is the value's share of the biggest box in ITS OWN measure, so the
// shape of the night reads before any digit does (the 30-pitch inning is the
// dark one). Scaled per measure and never across measures, because pitches and
// whiffs share no scale — and never including the Total column, which is an
// order of magnitude larger and would flatten every inning to nothing.
//
// Reveal-only by position, like every other part of this sheet: rendered from
// inside BoxScore's SealBox reveal function, never above it.
const TALLY_MEASURES = [
  { key: 'pitches', label: 'Pitches' },
  { key: 'whiffs', label: 'Whiffs' },
  { key: 'fouls', label: 'Fouls' },
  { key: 'lob', label: 'LOB' },
]

const CLUB_ALL = 'both'

export function InningTally({ rows, away, home, treatments }) {
  const [shownSide, setShownSide] = useState(CLUB_ALL)
  if (!rows || rows.length === 0) return null

  const byInningAndSide = new Map()
  for (const r of rows) {
    if (!byInningAndSide.has(r.inning)) byInningAndSide.set(r.inning, {})
    byInningAndSide.get(r.inning)[r.side] = r
  }
  const innings = [...byInningAndSide.keys()].sort((a, b) => a - b)

  // The busiest half-inning in a measure, over BOTH clubs — one scale per
  // measure, and deliberately not narrowed to the club on show: a wash that
  // rescaled itself on every tap of the club pill would make the two staffs
  // look alike no matter how far apart their nights were. Floored at 1 so a
  // measure that never happened (a game with no whiffs) divides safely and
  // washes nothing.
  const peaks = Object.fromEntries(
    TALLY_MEASURES.map(({ key }) => [key, Math.max(1, ...rows.map((r) => r[key] ?? 0))]),
  )
  // Each club's own halves summed across the whole game — the same rows the
  // inning columns already carry, just added up instead of read one at a time.
  const totalFor = (side, key) =>
    rows.reduce((sum, r) => (r.side === side ? sum + (r[key] ?? 0) : sum), 0)

  const sides = [
    { side: 'away', team: away },
    { side: 'home', team: home },
  ]
  const shown = shownSide === CLUB_ALL ? sides : sides.filter((s) => s.side === shownSide)

  return (
    <div className="bs__tally">
      <div className="bs__tallyHead">
        <span className="bs__insightsTitle">Pitching stats</span>
        {/* Which club's staff the rows belong to. A club segment is labelled
            with its abbreviation where the feed carries one, and with the plain
            side otherwise — a thin MiLB feed often has no abbreviation at all. */}
        <div className="bs__tallyScope" role="group" aria-label="Club">
          <button
            type="button"
            aria-pressed={shownSide === CLUB_ALL}
            className={`bs__tallyScopebtn ${shownSide === CLUB_ALL ? 'is-active' : ''}`}
            onClick={() => setShownSide(CLUB_ALL)}
          >
            Both
          </button>
          {sides.map(({ side, team }) => (
            <button
              key={side}
              type="button"
              aria-pressed={shownSide === side}
              className={`bs__tallyScopebtn ${shownSide === side ? 'is-active' : ''}`}
              onClick={() => setShownSide(side)}
            >
              {team.abbreviation || (side === 'away' ? 'Away' : 'Home')}
            </button>
          ))}
        </div>
      </div>
      <div className="bs__scroll bs__tallyBody">
        <table className="bs__grid bs__grid--tally">
          <thead>
            <tr>
              <th className="bs__tallyMeasure" scope="col">
                <span className="bs__tallySr">Measure</span>
              </th>
              <th className="bs__tallyClub" scope="col">
                <span className="bs__tallySr">Club</span>
              </th>
              {innings.map((num) => (
                <th key={num} className="bs__tallyCell" scope="col">
                  {num}
                </th>
              ))}
              <th className="bs__tallyTotal" scope="col">
                Total
              </th>
            </tr>
          </thead>
          {TALLY_MEASURES.map(({ key, label }) => (
            <tbody className="bs__tallyGroup" key={key}>
              {shown.map(({ side, team }, i) => (
                <tr key={side}>
                  {i === 0 && (
                    <th className="bs__tallyMeasure" scope="rowgroup" rowSpan={shown.length}>
                      {label}
                    </th>
                  )}
                  <th className="bs__tallyClub" scope="row">
                    <TeamLink id={team.id} className="bs__tallyLogo" ariaLabel={team.teamName}>
                      <TeamTreatmentMark
                        teamId={team.id}
                        name={team.teamName}
                        treatment={treatments?.[side]}
                        side={side}
                        size={20}
                        block="bs__tallyLogobox"
                      />
                    </TeamLink>
                  </th>
                  {innings.map((num) => (
                    <TallyCell
                      key={num}
                      row={byInningAndSide.get(num)?.[side]}
                      measure={key}
                      peak={peaks[key]}
                    />
                  ))}
                  <td className="bs__tallyTotal">{totalFor(side, key)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  )
}

// One half-inning's figure. `X` — a box score's own mark for a half that was
// never batted — where the club didn't come up: the home half of a walk-off,
// and every extra inning the visitors ended.
//
// The wash rides its own absolutely-positioned span rather than the cell's own
// background, so its weight is a plain `opacity` on that layer and the digit
// above it keeps the same ink at every weight. `--fill` is the value's share of
// its measure's peak; 0 washes nothing, which is what a quiet inning should
// look like.
function TallyCell({ row, measure, peak }) {
  if (!row) {
    return (
      <td className="bs__tallyCell bs__tallyCell--none">
        <span className="bs__tallyNum">X</span>
      </td>
    )
  }
  const value = row[measure] ?? 0
  return (
    <td className="bs__tallyCell">
      <span className="bs__tallyWash" style={{ '--fill': value / peak }} aria-hidden="true" />
      <span className="bs__tallyNum">{value}</span>
    </td>
  )
}
