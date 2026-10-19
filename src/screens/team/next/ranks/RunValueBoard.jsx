import '../../../../styles/team-next/run-value/card.css'
import '../../../../styles/motion/run-value-card.css'
import { useLayoutEffect, useRef, useState } from 'react'
import { COMPONENTS, clubLeaders, signed } from '../../../../api/around-the-game/runValue.js'
import { RunValueSplit, splitScale } from '../../../../components/around-the-game/RunValueParts.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { useInViewOnce } from '../../../../hooks/scroll/useInViewOnce.js'
import { monthDayShort } from '../../../../lib/dates.js'
import { viewKey } from '../../../../lib/motion/inViewOnce.js'
import { runValuePath } from '../../../../lib/route.js'
import { useNav } from '../../../../lib/nav.js'
import { measureFlip, playFlip } from './runvalue/flip.js'
import { LeagueStrip } from './runvalue/LeagueStrip.jsx'
import { LeaderList } from './runvalue/LeaderList.jsx'
import { useCountUp } from './runvalue/useCountUp.js'

// Run value, on a stamped card (the data is n.runValue). A lead tile carries the total, its rank
// and the league strip; the split bar's four parts are buttons that re-rank the club's top six by
// that part; then the six, with a face and a mini split bar each (#2295, spec
// .scratch/run-value-motion/handoff.md). MLB only: `data` is null for an affiliate and the card
// does not render. Season aggregates, so an open surface (ADR-0034): nothing here is sealed.
//
// The entrance plays once per page visit, when the card first shows (it sits below the fold; the
// gate's own tenth, since the card is taller than a phone held sideways): the stamp-in, a count-up on the total and the six values, the league bars, the split bar's
// wipe, then the buttons and rows. `still` (the band already played) or reduced motion draws the end
// state at once. The picked part is a view of this card only: not in the URL, not stored.
export function RunValueBoard({ data, clubName, asOf, sportId, still }) {
  const navigate = useNav()
  const club = data?.club
  const [cardRef, seen] = useInViewOnce(viewKey(club?.teamId ?? 0, 'team-run-value'))
  const phase = still ? 'rest' : seen
  const [view, setView] = useState({ part: 'total', prev: null, gen: 0 })
  const listRef = useRef(null)
  const flipFrom = useRef(null)

  // The count-up plays with the entrance and stops for good at the first tap: a re-rank changes its
  // values at once.
  useCountUp(cardRef, phase === 'play' && view.gen === 0, signed)

  useLayoutEffect(() => {
    if (!flipFrom.current) return
    playFlip(listRef.current, flipFrom.current)
    flipFrom.current = null
  }, [view.gen])

  if (!data) return null
  const { rank, of } = data
  const part = COMPONENTS.find((c) => c.key === view.part)
  const pick = (key) => {
    const prev = clubLeaders(club, view.part).map((p) => p.id)
    if (!motionIsReduced()) flipFrom.current = measureFlip(listRef.current)
    setView((v) => ({ part: key ?? 'total', prev, gen: v.gen + 1 }))
  }
  const cls = ['rnk__card', 'rvclub', phase !== 'rest' && view.gen === 0 && 'rvclub--intro', phase === 'wait' && 'rvclub--wait']
  return (
    <Card
      ref={cardRef}
      frame="stamped"
      label="Run value"
      labelAs="h3"
      count="runs above average"
      stampIn={phase !== 'rest'}
      className={cls.filter(Boolean).join(' ')}
    >
      <StatTile
        tone="ink"
        className="rnk__lead rvclub__lead"
        label="Club total"
        value={
          <span data-count={club.total} data-count-at="260,1500">
            {signed(club.total)}
          </span>
        }
      >
        {rank ? (
          <p className="rvclub__rank">
            <span
              className="rvclub__rankno"
              data-count={rank}
              data-count-at="260,1500"
              data-count-mask="—"
              data-count-mask-at="0.15"
              data-count-final={rank}
            >
              {rank}
            </span>
            <span className="rvclub__rankof">of {of} clubs</span>
          </p>
        ) : null}
        <LeagueStrip rows={data.league} teamId={club.teamId} />
      </StatTile>
      <div className="rvclub__split">
        <RunValueSplit
          entry={club}
          scale={splitScale([club])}
          selected={part?.key ?? null}
          onSelect={pick}
          hint={part ? 'Tap it again for all four parts' : 'Tap a part to re-rank the top six'}
        />
      </div>
      <h4 className="rvclub__title" aria-live="polite">
        Top six · {part ? part.inProse : 'all four parts'}
      </h4>
      <LeaderList ref={listRef} club={club} part={view.part} prev={view.prev} gen={view.gen} />
      <p className="rvcard__note">
        Every {clubName} player Baseball Savant has a season figure for, {club.players.length} of them, counted for the club
        that holds him now. A man traded in July brings his whole season with him.
      </p>
      <div className="rvclub__foot">
        {data.generatedAt ? <span className="rvclub__source">Savant · {monthDayShort(data.generatedAt.slice(0, 10))}</span> : <span />}
        <Door onClick={() => navigate(runValuePath({ d: asOf, s: sportId }))}>League run value board</Door>
      </div>
    </Card>
  )
}
