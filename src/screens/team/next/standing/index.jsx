import { loadNumbers } from '../../data/loadNumbers.js'
import { NumbersBody } from '../../NumbersTab.jsx'
import { once } from '../once.js'
import { useBandData } from '../useBandData.js'

// Standing: today's Numbers tab, standings table first. Foundation: the module as it is
// today, in the Standing share of the tab (NumbersBody part="standing"). Ranks reads the
// same load through `once`, so the page buys it once.
const NOOP = () => {}
export default function Standing({ team, asOf, sportId, onReady }) {
  const numbers = useBandData(() => once(`numbers:${team.id}:${asOf ?? ''}`, () => loadNumbers(team.id, asOf)), [team.id, asOf], {
    onReady,
    onCount: NOOP,
  })
  return <NumbersBody numbers={numbers} team={team} asOf={asOf} sportId={sportId} part="standing" />
}
