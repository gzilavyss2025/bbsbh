import { useCallback } from 'react'
import { PlayerHighlightsRail } from '../../../../../components/player/PlayerHighlightsRail.jsx'
import { CommandReceivedCard } from '../../../../../components/playerstats/CommandReceivedCard.jsx'
import { Part } from './Part.jsx'
import {
  commandReceivedCardFor,
  inMajors,
} from './tbdData.js'

// Today's cards, each as the live tab draws them (PlayerAnalyticsTab, PlayerHistoryTab and
// PlayerPage). A card's `Part` loads its data and hides the card when there is none.
// `p` is the module's props plus `hide`.

// Highlights only, for a player in the majors, on the live view (Photos has its own module, #2021).
// The rail reports when it has nothing; the card hides then.
function Media({ p }) {
  const { bio, asOf, hide } = p
  const shown = !asOf && bio.debut && inMajors(bio)
  const none = useCallback(() => hide('media'), [hide])
  return (
    <Part id="media" hide={hide} load={async () => shown} deps={[shown]}>
      {() => <PlayerHighlightsRail playerId={bio.id} teamId={bio.team?.id} limit={6} onEmpty={none} />}
    </Part>
  )
}

export const CARDS = {
  media: Media,
  cmdreceived: ({ p }) => (
    <Part id="cmdreceived" hide={p.hide} load={() => commandReceivedCardFor(p.bio.id, p.season)} deps={[p.bio.id, p.season]}>
      {(data) => <CommandReceivedCard data={data} personId={p.bio.id} season={p.season} />}
    </Part>
  ),
}
