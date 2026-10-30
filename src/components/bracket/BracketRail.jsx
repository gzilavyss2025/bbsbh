// THE BRACKET RAIL — what runs down the right of the MLB slate in the
// postseason window on a wide screen, in the column the transactions rail
// (WireRail.jsx) holds the rest of the year (Gary, 2026-10-01). In October a
// free-agent election is not news beside a Game 3; the bracket is.
//
// It is FullBracket.jsx, unchanged, inside a `.pbkt` container: that file's
// container query stacks the two leagues whenever the column is under 820px,
// so in this 358px rail the AL tree sits over the NL tree, with the World
// Series at the foot. 358 is the tree's own fixed width (FullBracket's
// TREE_W), which is why this rail is wider than the wire's 288 and why it
// appears only from BRACKET_RAIL_QUERY up (see 25-wide-layout.css's partner
// rules in styles/postseason/home.css).
//
// Like the wire rail it is not sticky and not its own scroller: it is about
// 900px tall, taller than many windows, and a sticky column taller than the
// window puts its own foot out of reach (ADR-0062).
//
// Spoilers: the same bracket the fold draws, heading into its cutoff
// (ADR-0087). No seal, no kraft.
import '../../styles/80-postseason-bracket.css'
import '../../styles/postseason/home.css'
import { FullBracket } from './FullBracket.jsx'
import { useBracketHistoryIds } from './PostseasonBracket.jsx'

export function BracketRail({ bracket, cutoff }) {
  const historyIds = useBracketHistoryIds()
  return (
    <aside className="bracketrail" aria-label="Postseason bracket">
      {bracket && (
        <div className="pbkt bracketrail__body">
          <FullBracket bracket={bracket} cutoff={cutoff} historyIds={historyIds} rail />
        </div>
      )}
    </aside>
  )
}
