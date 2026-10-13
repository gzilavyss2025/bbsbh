import { useState } from 'react'
import { StatcastPercentiles } from '../../../../../components/charts/StatcastPercentiles.jsx'
import { AdvancedStatsCard } from '../../../../../components/player/AdvancedStatsCard.jsx'
import { AwardsLedger } from '../../../../../components/player/AwardsLedger.jsx'
import { CareerTimeline } from '../../../../../components/player/CareerTimeline.jsx'
import { PlayerHighlightsRail } from '../../../../../components/player/PlayerHighlightsRail.jsx'
import { PlayerPhotosRail } from '../../../../../components/player/PlayerPhotosRail.jsx'
import { RunValueCard } from '../../../../../components/playerstats/RunValueCard.jsx'
import { TransactionTimeline } from '../../../../../components/transactions/TransactionTimeline.jsx'
import { fetchRunValue, playerRunValue } from '../../../../../api/around-the-game/runValue.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { Part } from './Part.jsx'
import {
  advancedFor,
  awardsFor,
  inMajors,
  percentilesFor,
  photoGamesFor,
  timelineFor,
  transactionsFor,
} from './tbdData.js'

// Today's cards, each as the live tab draws them (PlayerAnalyticsTab, PlayerHistoryTab and
// PlayerPage). A card's `Part` loads its data and hides the card when there is none.
// `p` is the module's props plus `hide`.

function Advanced({ p }) {
  const { bio, role, season, asOf, hide } = p
  const [picked, setPicked] = useState('reg')
  return (
    <Part id="advanced" hide={hide} load={() => advancedFor(bio, role, season, asOf)} deps={[bio.id, role, season, asOf]}>
      {({ adv, post }) => <AdvancedStatsCard adv={adv} post={post} picked={picked} onPick={setPicked} />}
    </Part>
  )
}

// His this-season MLB games for the Photos walk-back; the rail hides itself on none.
function Photos({ bio, season }) {
  const { data } = useAsync(() => photoGamesFor(bio, season), [bio.id, season])
  return data?.length ? <PlayerPhotosRail personId={bio.id} games={data} limit={6} /> : null
}

// Photos and highlights: only for a player in the majors, on the live view. The rails decide
// for themselves whether they have anything, so this card never reports empty.
// ponytail: a bench player with neither leaves the card blank; the rails would need an onEmpty.
function Media({ p }) {
  const { bio, asOf, season, hide } = p
  const shown = !asOf && bio.debut && inMajors(bio)
  return (
    <Part id="media" hide={hide} load={async () => shown} deps={[shown]}>
      {() => (
        <>
          <Photos bio={bio} season={season} />
          <PlayerHighlightsRail playerId={bio.id} teamId={bio.team?.id} limit={6} />
        </>
      )}
    </Part>
  )
}

export const CARDS = {
  percentile: ({ p }) => (
    <Part id="percentile" hide={p.hide} load={() => percentilesFor(p.bio.id, p.role)} deps={[p.bio.id, p.role]}>
      {(d) => <StatcastPercentiles savant={d.savant} raw={d.raw} median={d.median} group={p.role} />}
    </Part>
  ),
  advanced: Advanced,
  runvalue: ({ p }) => (
    <Part
      id="runvalue"
      hide={p.hide}
      load={async () => playerRunValue(await fetchRunValue(), p.bio.id)}
      deps={[p.bio.id]}
    >
      {() => <RunValueCard playerId={p.bio.id} />}
    </Part>
  ),
  awards: ({ p }) => (
    <Part id="awards" hide={p.hide} load={() => awardsFor(p.bio, p.asOf)} deps={[p.bio.id, p.asOf]}>
      {(ledger) => <AwardsLedger ledger={ledger} />}
    </Part>
  ),
  timeline: ({ p }) => (
    <Part
      id="timeline"
      hide={p.hide}
      load={() => timelineFor(p.bio)}
      deps={[p.bio.id]}
      has={(t) => t?.entries?.length}
    >
      {(t) => <CareerTimeline entries={t.entries} />}
    </Part>
  ),
  transactions: ({ p }) => (
    <Part
      id="transactions"
      hide={p.hide}
      load={() => transactionsFor(p.bio, p.asOf)}
      deps={[p.bio.id, p.asOf]}
      has={(t) => t?.rows?.length}
    >
      {(t) => <TransactionTimeline rows={t.rows} />}
    </Part>
  ),
  media: Media,
}
