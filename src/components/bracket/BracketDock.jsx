// THE BRACKET DOCK — the phone's copy of BracketRail.jsx. In the postseason
// window the MLB slate's bottom dock holds the bracket instead of the wire
// (Gary, 2026-10-01). Same sheet as the wire's (ui/dock/SheetDock.jsx), so it
// drags, flicks and pads the slate's floor exactly the same way.
//
// The resting rail says what is on today and how many clubs are left; pulled
// up, the sheet holds FullBracket.jsx, which fits a phone as it is (its tree is
// 358px wide). GameSelect mounts this only on a day with a postseason game:
// on a day without one, the full bracket is already the page above the board
// (PostseasonBracket.jsx), and a dock would draw it twice.
//
// Spoilers: the same bracket the fold draws, heading into its cutoff
// (ADR-0087). No seal, no kraft.
import '../../styles/80-postseason-bracket.css'
import '../../styles/postseason/home.css'
import { useEffect } from 'react'
import { recordLine } from '../../api/postseason/text.js'
import { aliveClubs, seriesPlayingToday } from '../../lib/postseason/bracketDisplay.js'
import { Pill } from '../ui/control/Pill.jsx'
import { SheetDock } from '../ui/dock/SheetDock.jsx'
import { FullBracket } from './FullBracket.jsx'
import { useBracketHistoryIds } from './PostseasonBracket.jsx'
import { Trophy } from './bracketParts.jsx'

// The rail's one line: today's series, or the champion.
function todayLine(bracket, slateDate) {
  if (bracket.champion) return `${bracket.champion.abbreviation} won the World Series`
  const today = seriesPlayingToday(bracket, slateDate)
  if (today.length === 1) {
    const [s] = today
    return `${s.slots.map((slot) => slot.club.abbreviation).join('–')} · ${recordLine(s)}`
  }
  if (today.length > 1) return `${today.length} series today`
  return 'No games today'
}

export function BracketDock({ bracket, cutoff, slateDate, onPresence }) {
  const historyIds = useBracketHistoryIds()
  const present = Boolean(bracket)

  useEffect(() => {
    onPresence?.(present)
  }, [onPresence, present])

  if (!present) return null

  const alive = aliveClubs(bracket).length
  const line = todayLine(bracket, slateDate)

  return (
    <SheetDock
      label="Postseason bracket"
      bodyId="bracket-dock-body"
      bodyAs="div"
      className="wiredock--bracket"
      style={{ '--wire-club': 'var(--navy)' }}
      measureKey={line}
      title="Postseason"
      note={bracket.champion ? 'Final' : `${alive} clubs left`}
      closeLabel="Collapse the bracket"
      collapsedLabel={`Open the bracket. ${line}.`}
      collapsed={
        <>
          <span className="wiredock__spine" aria-hidden="true" />
          <span className="bracketdock__trophy" aria-hidden="true"><Trophy size={20} /></span>
          <span className="wiredock__line">
            <span className="wiredock__club">Bracket</span>
            <span className="wiredock__cut">{line}</span>
          </span>
          {!bracket.champion && <Pill fill="paper" figure className="wiredock__count">{alive} left</Pill>}
          <span className="wiredock__chevron" aria-hidden="true">⌃</span>
        </>
      }
    >
      <div className="pbkt bracketdock__body">
        <FullBracket bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
      </div>
    </SheetDock>
  )
}
