import { useCallback, useEffect, useState } from 'react'
import { StatcastPercentiles } from '../../../../../components/charts/StatcastPercentiles.jsx'
import { AdvancedStatsCard } from '../../../../../components/player/AdvancedStatsCard.jsx'
import { AwardsLedger } from '../../../../../components/player/AwardsLedger.jsx'
import { CareerTimeline } from '../../../../../components/player/CareerTimeline.jsx'
import { PlayerHighlightsRail } from '../../../../../components/player/PlayerHighlightsRail.jsx'
import { PlayerPhotosRail } from '../../../../../components/player/PlayerPhotosRail.jsx'
import { TargetCommand } from '../../../../../components/charts/TargetCommand.jsx'
import { CommandReceivedCard } from '../../../../../components/playerstats/CommandReceivedCard.jsx'
import { FoulCard } from '../../../../../components/playerstats/FoulCard.jsx'
import { MilestoneWatchCard } from '../../../../../components/playerstats/MilestoneWatchCard.jsx'
import { RunValueCard } from '../../../../../components/playerstats/RunValueCard.jsx'
import { TransactionTimeline } from '../../../../../components/transactions/TransactionTimeline.jsx'
import { fetchRunValue, playerRunValue } from '../../../../../api/around-the-game/runValue.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { Part } from './Part.jsx'
import {
  advancedFor,
  awardsFor,
  commandReceivedCardFor,
  foulsFor,
  milestonesFor,
  inMajors,
  percentilesFor,
  targetCommandCardFor,
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

// His this-season MLB games for the Photos walk-back. With none (or a failed read) the rail is
// never drawn, so it reports empty itself; otherwise the rail does.
function Photos({ bio, season, onEmpty }) {
  const { data, loading } = useAsync(() => photoGamesFor(bio, season), [bio.id, season])
  const none = !loading && !data?.length
  useEffect(() => {
    if (none) onEmpty()
  }, [none, onEmpty])
  return data?.length ? <PlayerPhotosRail personId={bio.id} games={data} limit={6} onEmpty={onEmpty} /> : null
}

// Photos and highlights: only for a player in the majors, on the live view. Each rail reports
// when it has nothing; the card hides once both have.
function Media({ p }) {
  const { bio, asOf, season, hide } = p
  const shown = !asOf && bio.debut && inMajors(bio)
  const [none, setNone] = useState({})
  const noPhotos = useCallback(() => setNone((n) => (n.photos ? n : { ...n, photos: true })), [])
  const noClips = useCallback(() => setNone((n) => (n.clips ? n : { ...n, clips: true })), [])
  useEffect(() => {
    if (none.photos && none.clips) hide('media')
  }, [none, hide])
  return (
    <Part id="media" hide={hide} load={async () => shown} deps={[shown]}>
      {() => (
        <>
          <Photos bio={bio} season={season} onEmpty={noPhotos} />
          <PlayerHighlightsRail playerId={bio.id} teamId={bio.team?.id} limit={6} onEmpty={noClips} />
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
  targetcommand: ({ p }) => (
    <Part id="targetcommand" hide={p.hide} load={() => targetCommandCardFor(p.bio.id, p.season)} deps={[p.bio.id, p.season]}>
      {(d) => <TargetCommand entry={d.entry} data={d.data} />}
    </Part>
  ),
  cmdreceived: ({ p }) => (
    <Part id="cmdreceived" hide={p.hide} load={() => commandReceivedCardFor(p.bio.id, p.season)} deps={[p.bio.id, p.season]}>
      {(data) => <CommandReceivedCard data={data} personId={p.bio.id} season={p.season} />}
    </Part>
  ),
  fouls: ({ p }) => (
    <Part
      id="fouls"
      hide={p.hide}
      load={() => foulsFor(p.bio, p.role, p.season, p.asOf)}
      deps={[p.bio.id, p.role, p.season, p.asOf]}
    >
      {() => <FoulCard playerId={p.bio.id} group={p.role} asOf={p.asOf} seasonYear={p.season} label={String(p.season)} />}
    </Part>
  ),
  milestones: ({ p }) => (
    <Part
      id="milestones"
      hide={p.hide}
      load={() => milestonesFor(p.bio, p.role, p.season, p.asOf)}
      deps={[p.bio.id, p.role, p.season, p.asOf]}
      has={(m) => m?.length}
    >
      {(m) => (
        <MilestoneWatchCard
          playerId={p.bio.id}
          asOf={p.asOf}
          milestones={m}
          groupLabel={p.bio.twoWay ? (p.role === 'pitching' ? 'Pitching' : 'Batting') : null}
        />
      )}
    </Part>
  ),
}
