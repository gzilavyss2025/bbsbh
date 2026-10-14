import { useCallback, useEffect, useState } from 'react'
import { CareerTimeline } from '../../../../../components/player/CareerTimeline.jsx'
import { PlayerHighlightsRail } from '../../../../../components/player/PlayerHighlightsRail.jsx'
import { PlayerPhotosRail } from '../../../../../components/player/PlayerPhotosRail.jsx'
import { CommandReceivedCard } from '../../../../../components/playerstats/CommandReceivedCard.jsx'
import { FoulCard } from '../../../../../components/playerstats/FoulCard.jsx'
import { TransactionTimeline } from '../../../../../components/transactions/TransactionTimeline.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { Part } from './Part.jsx'
import {
  commandReceivedCardFor,
  foulsFor,
  inMajors,
  photoGamesFor,
  timelineFor,
  transactionsFor,
} from './tbdData.js'

// Today's cards, each as the live tab draws them (PlayerAnalyticsTab, PlayerHistoryTab and
// PlayerPage). A card's `Part` loads its data and hides the card when there is none.
// `p` is the module's props plus `hide`.

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
}
