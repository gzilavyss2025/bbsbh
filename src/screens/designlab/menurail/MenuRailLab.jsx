import { useState } from 'react'
import { Entry, Group } from '../Entry.jsx'
import { MenuRail } from '../../../components/ui/control/MenuRail.jsx'

// THE MENU RAIL (#2073, slice 05): the real MenuRail on invented cards. Tap a card: the
// row folds into a rail and the panel opens; tap it again, or the Back button, to return.
// Every name, figure and line is invented. None is a real player's, and none is a score.
const PATH = 'src/components/ui/control/MenuRail.jsx'
const ITEMS = [
  { key: 'one', title: 'First kind', meta: '41%', mark: '●', figures: 'Invented line one · 12 · 34' },
  { key: 'two', title: 'Second kind', meta: '27%', mark: '◆', figures: 'Invented line two · 56 · 78' },
  { key: 'three', title: 'Third kind', meta: '19%', mark: '■', figures: 'Invented line three · 9 · 10' },
  { key: 'four', title: 'Fourth kind', meta: '13%', mark: '▲', figures: 'Invented line four · 11 · 12', disabled: true },
]
const GROUPED = [
  { ...ITEMS[0], heading: 'Group A' },
  ITEMS[1],
  { ...ITEMS[2], heading: 'Group B' },
]
const panel = (key) => <p className="dlab__note">Invented panel for the card &ldquo;{key}&rdquo;.</p>

export function MenuRailHalf() {
  const [a, setA] = useState(null)
  const [b, setB] = useState('two')
  return (
    <Group
      title="Menu rail"
      lede="One menu of cards that folds into a rail, with a focus panel for the picked card (#2073). Arsenal, Splits, Plate approach and Contact use it."
    >
      <Entry title="MenuRail — menu" path={PATH} wide note="Live: tap a card, then tap it again or use Back. The fourth card is disabled.">
        <MenuRail label="Invented kinds" items={ITEMS} picked={a} onPick={setA} panel={panel} backLabel="All kinds" />
      </Entry>
      <Entry title="MenuRail — rail, railMeta, group heads" path={PATH} wide note="Starts on a pick. railMeta keeps the figure beside the name; the group heads fold away.">
        <MenuRail label="Invented kinds, grouped" items={GROUPED} picked={b} onPick={setB} panel={panel} backLabel="All kinds" railMeta />
      </Entry>
    </Group>
  )
}
