import '../../../../styles/report/challenge-faces.css'
import { useMemo, useState } from 'react'
import { challengeCard } from '../../../../api/around-the-game/absClubCard.js'
import { Segmented } from '../../../../components/ui/control/Segmented.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { ChallengeList } from './challenges/ChallengeList.jsx'
import { FacePlot } from './challenges/FacePlot.jsx'

// ABS Challenges, on a stamped card: which men on this club argue with the plate
// umpire, how often against what they see, and how often they were right.
//
// The model is absClubCard.js's (pure, tested); this file holds the card's three
// choices and hands them down.
//   job      At the plate or Behind it: a hitter's exposure is the pitches he
//            saw, a catcher's the pitches he received (innings caught until the
//            club file carries them).
//   measure  Called (reviews against exposure) or Success (the share overturned).
//            The Success pair appears only when the file carries the wins.
//   pick     the man the reader tapped, on the plot or in the list. It opens his
//            name tab on the plot and lights his row. Until one is picked, the
//            card shows the one the chart is about: the most eager hitter, or
//            the one who called the most.
// MLB and Triple-A only: below that the club has no rows and the card does not
// render. The hover card on a face or a photo is the app's own (components/player
// /PlayerHoverCard.jsx), asked for with this card's figures (challenges/).
const JOBS = [
  { value: 'batter', label: 'At the plate' },
  { value: 'catcher', label: 'Behind it' },
]
const MEASURES = [
  { value: 'called', label: 'Called' },
  { value: 'success', label: 'Success' },
]

// The man the card opens on: the highest rate (Called) or the most reviews
// (Success) among the men it draws.
function leaderOf(job, measure) {
  const pool = job.plotted.filter((r) => (measure === 'success' ? r.calls > 0 : true))
  const score = (r) => (measure === 'success' ? r.calls : r.frac)
  return pool.reduce((best, r) => (best && score(best) >= score(r) ? best : r), null)
}

export function ChallengeBoard({ data, teamId, level = 'MLB', still }) {
  const card = useMemo(() => challengeCard(data, teamId, level), [data, teamId, level])
  const [jobKey, setJobKey] = useState('batter')
  const [measureKey, setMeasureKey] = useState('called')
  const [pick, setPick] = useState({ id: null, fromPlot: false })
  if (!card) return null

  const job = card[jobKey]?.rows.length ? card[jobKey] : card.batter
  const measure = measureKey === 'success' && job.hasSuccess ? 'success' : 'called'
  const leader = leaderOf(job, measure)
  const known = pick.id === 'mlb' || job.rows.some((r) => r.playerId === pick.id)
  const shown = { id: known ? pick.id : (leader?.playerId ?? null), fromPlot: known ? pick.fromPlot : false }

  const lead = job.lead[measure]
  const rank = measure === 'success'
    ? { rank: job.club.won.toLocaleString('en-US'), of: job.club.called.toLocaleString('en-US') }
    : lead.rank
  const jobs = JOBS.filter((j) => card[j.value].rows.length)

  return (
    <Card frame="stamped" label="ABS Challenges" labelAs="h3" stampIn={!still} className="rnk__card chalboard">
      <StatTile tone="ink" className="stattile--compact rnk__lead" label={lead.label} value={lead.value} caption={lead.caption} rank={rank ?? undefined} />
      {jobs.length > 1 && (
        <Segmented label="At the plate or behind it" value={job.key} onChange={(v) => setJobKey(v)} fill options={jobs} />
      )}
      <div className="chalboard__body">
        <div className="chalboard__plotcol">
          {job.hasSuccess && (
            <Segmented className="chalboard__measure" label="Reviews called, or how often they were right" value={measure} onChange={(v) => setMeasureKey(v)} options={MEASURES} />
          )}
          <FacePlot job={job} measure={measure} picked={shown.id} onPick={(id) => setPick({ id, fromPlot: true })} />
        </div>
        <div className="chalboard__list">
          <ChallengeList job={job} measure={measure} pick={shown} onPick={(id) => setPick({ id, fromPlot: false })} />
        </div>
      </div>
    </Card>
  )
}
