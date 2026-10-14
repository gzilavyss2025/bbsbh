import { CommandReceivedCard } from '../../../../../components/playerstats/CommandReceivedCard.jsx'
import { Part } from './Part.jsx'
import { commandReceivedCardFor } from './tbdData.js'

// Today's cards, each as the live tab draws them (PlayerAnalyticsTab). A card's `Part` loads its data and hides the card when there is none.
// `p` is the module's props plus `hide`.

export const CARDS = {
  cmdreceived: ({ p }) => (
    <Part id="cmdreceived" hide={p.hide} load={() => commandReceivedCardFor(p.bio.id, p.season)} deps={[p.bio.id, p.season]}>
      {(data) => <CommandReceivedCard data={data} personId={p.bio.id} season={p.season} />}
    </Part>
  ),
}
