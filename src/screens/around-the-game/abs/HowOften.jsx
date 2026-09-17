import { useMemo } from 'react'
import {
  binPosition,
  exposureBoard,
  leagueBaseline,
  EXPOSURE_KINDS,
} from '../../../api/around-the-game/absExposure.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { ColumnChart, roundTicks } from '../../../components/around-the-game/BroadcastBar.jsx'
import { Slab, SlabRow } from '../../../components/around-the-game/StatSlab.jsx'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { commas, num1, num2 } from './format.js'

// HOW OFTEN IS NORMAL — the denominator question, and the only section on this
// page that needs a second file to answer it.
//
// THE MEAN DESCRIBES NOBODY, which is why the histograms are the section and
// the slabs are only its headline. A batter challenges about once every forty
// plate appearances; among the hitters who clear the floor the rate runs from
// roughly two per thousand pitches to twelve, six of them never called for one
// all season, and one man called for 32 in 1,085 pitches. Printing 6.4 and
// stopping would describe a hitter who does not exist.
//
// SO EVERY RULE ON A CHART COMES OFF ITS VALUE. The median and the mean are
// placed through binPosition, which maps a value onto the drawn columns by the
// same arithmetic the labels under them are written from. Placed by a
// hand-counted bin index instead, the median mark in the first draft of this
// section pointed at 5.11 under a label reading 5.90.
//
// THE TWO DENOMINATORS ARE NOT THE SAME MEASUREMENT. A batter's exposure is
// pitches seen; a catcher's is innings CAUGHT, because nothing in the feed
// counts the pitches a catcher received. Two charts drawn alike invite a
// reading straight across them, so the page says once that there is none.
//
// IT READS THE `exposure` IT IS HANDED — the page owns the fetch and slices it
// by the level the chip chose, the same way it hands every board its `summary`.

// How many count gridlines a histogram gets, and how round they are. The two
// charts differ by an order of magnitude (three hundred and fifty hitters
// against seventy catchers), so a fixed step would rule one of them like graph
// paper and leave the other with no lines at all.
function countStep(peak) {
  if (peak >= 60) return 20
  if (peak >= 30) return 10
  if (peak >= 12) return 5
  return 2
}

// A bin's label is its lower edge, and the last one carries a `+` because it
// absorbs everything above it. The decimals follow the step: a catcher's 0.2
// bins need one and a batter's 2s need none.
function binLabel(bin, step) {
  const at = step < 1 ? num1(bin.from) : commas(Math.round(bin.from))
  return bin.last ? `${at}+` : at
}

function Histogram({ board }) {
  const { kind, bins } = board
  const step = countStep(board.peak)
  return (
    <div className="colchart__panel colchart__panel--wide">
      <span className="colchart__paneltitle">
        {kind.label}, {kind.scale}
      </span>
      {/* THE SAMPLE FLOOR RIDES IN THE HEAD IT QUALIFIES rather than in a note
          under the chart, which is where the shipped boards on this page put
          theirs. A reader looking at the shape has the floor in the same
          glance. */}
      <span className="colchart__panelsub">
        {commas(board.qualified)} with {commas(kind.floor)} or more {kind.unit}
      </span>
      <ColumnChart
        columns={bins.map((b) => ({
          key: b.from,
          label: binLabel(b, kind.step),
          value: b.n,
        }))}
        max={board.peak}
        ticks={roundTicks(board.peak, step)}
        rules={[
          {
            key: 'median',
            pos: binPosition(board.median, bins),
            label: `Median ${num2(board.median)}`,
          },
          {
            key: 'mean',
            pos: binPosition(board.mean, bins),
            label: `Mean ${num2(board.mean)}`,
            tone: 'mean',
          },
        ]}
        label={`How many ${kind.many} sit at each challenge rate, ${kind.scale}`}
      />
    </div>
  )
}

export function HowOften({ exposure }) {
  const boards = useMemo(
    () => EXPOSURE_KINDS.map((k) => exposureBoard(exposure, k.key)).filter(Boolean),
    [exposure],
  )
  const league = useMemo(
    () => Object.fromEntries(EXPOSURE_KINDS.map((k) => [k.key, leagueBaseline(exposure, k.key)])),
    [exposure],
  )

  if (boards.length === 0) return null

  const batter = boards.find((b) => b.key === 'batter') ?? null
  const catcher = boards.find((b) => b.key === 'catcher') ?? null
  const spread = (b) => (b ? `${num1(b.low)} to ${num1(b.high)}` : '—')

  return (
    <BroadcastSection title="How often is normal">
      {/* THE LEAGUE FIGURE IS OVER EVERY MAN, and the spread beside it is over
          the ones who cleared the floor. Those are different populations on
          purpose: "one every forty times up" is a fact about the league, and a
          floor applied to it would report the habits of regulars as everyone's. */}
      <SlabRow>
        {EXPOSURE_KINDS.map((k, i) => {
          const base = league[k.key]
          return (
            <Slab
              key={k.key}
              tone={i === 0 ? 'lead' : undefined}
              value={base ? `1 in ${commas(Math.round(base.per))}` : '—'}
              label={`A ${k.key}, per ${k.each}`}
              note={base ? `${num2(base.rate)} ${k.scale}` : '—'}
            />
          )
        })}
        {boards.map((b) => (
          <Slab
            key={`${b.key}-spread`}
            value={spread(b)}
            label={`The middle eight in ten ${b.kind.many}`}
            note={`${commas(b.qualified)} cleared the floor`}
          />
        ))}
      </SlabRow>

      {boards.map((b) => (
        <Histogram key={b.key} board={b} />
      ))}

      {/* THE TWO SENTENCES THE CHARTS CANNOT CARRY: what the spread means, and
          that the two denominators are not one measurement. Real sentences, so
          .rptprose — `#root *` shouts every word in this app, and the name in
          the first one takes `.rptprose .plink` for the same reason. */}
      {batter ? (
        <p className="hint rptprose">
          The mean describes almost nobody.{' '}
          {batter.never > 0 ? (
            <>
              {commas(batter.never)} of the {commas(batter.qualified)} hitters here never
              called for a review all season, and{' '}
            </>
          ) : (
            <>Across the {commas(batter.qualified)} hitters here, </>
          )}
          {batter.leader ? (
            <>
              <PlayerLink id={batter.leader.playerId} name={batter.leader.name}>
                {batter.leader.name}
              </PlayerLink>{' '}
              called for {commas(batter.leader.asBatter)} in{' '}
              {commas(batter.leader.pitches)} pitches — {num1(batter.leader.per1000Pitches)} per
              thousand, against a league figure of {num2(league.batter?.rate)}.
            </>
          ) : null}
          {catcher ? (
            <>
              {' '}
              Catchers cluster far tighter: eight in ten of them sit between{' '}
              {num2(catcher.low)} and {num2(catcher.high)} per nine innings.
            </>
          ) : null}
        </p>
      ) : null}

      <p className="hint rptprose">
        Innings caught, not pitches received — no feed counts a catcher’s pitches, so
        the two figures are measured on different denominators and cannot be read
        straight across.
      </p>
    </BroadcastSection>
  )
}
