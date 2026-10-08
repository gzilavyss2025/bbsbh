// THE SMALL BRACKET — the primer's right column (ADR-0087, 2026-10-08
// addendum; design tab "H · Harmonized"). The round being played feeds the next
// one. On an LCS or World Series day the two LCS feed the World Series: three
// boxes and two elbow connectors. On a Wild Card or Division Series day the
// round's series (AL first, then NL) feed the boxes of the next round, one
// connector each. Connectors are pencil and dashed until a series is decided,
// then ink. The earlier rounds live behind "Full bracket ›", which
// opens FullBracket in the app's centered .scrim/.sheet (no SheetDock: that is
// the phone's bottom dock, and this column only shows from BRACKET_RAIL_QUERY).
//
// Draw-only: every value comes from lib/postseason/primer/bracketNow.js, which
// reads the bracket heading into its cutoff. No seal, no kraft (ADR-0087).
//
//   bracket   the derived bracket (docs/api/postseason.md), NOT the live one
//   cutoff    the bracket's cutoff date, handed on to FullBracket for its links
//   round     the primer's round: 'wildcard', 'division', 'lcs' or 'worldseries'
import '../../styles/80-postseason-bracket.css'
import '../../styles/postseason/primer-rail.css'
import { useRef, useState } from 'react'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { bracketNow, roundFeed } from '../../lib/postseason/primer/bracketNow.js'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Door } from '../ui/control/Door.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { BlankSlot, ClubMark, Pips } from './bracketParts.jsx'
import { FullBracket } from './FullBracket.jsx'
import { useBracketHistoryIds } from './PostseasonBracket.jsx'

// The rail is 358px; the card's body padding (16px a side) and border leave 324.
const W = 324
const BOX_W = 128
const BOX_H = 86
const GAP = 12
const TO_X = W - BOX_W

const wins = (n) => `${n} ${n === 1 ? 'win' : 'wins'}`

function Box({ box, x, y, feeders }) {
  const sides = box.rows
    .map((r, i) => (r.club ? `${r.club.name} ${wins(r.wins)}` : feeders?.[i] ? `winner of ${feeders[i]} to come` : 'to come'))
    .join(', ')
  return (
    <div
      role="group"
      aria-label={`${box.name}. ${sides}.${box.foot ? ` ${box.foot}.` : ''}`}
      className={`pbnow__box${box.today ? ' pbnow__box--today' : ''}`}
      style={{ left: x, top: y, width: BOX_W, height: BOX_H }}
    >
      <span className="pbnow__name">{box.name}</span>
      {box.rows.map((row, i) =>
        row.club ? (
          <div key={row.club.id} className={`pbnow__row${row.eliminated ? ' pbnow__row--out' : ''}`}>
            <ClubMark club={row.club} eliminated={row.eliminated} size={16} />
            <span className="pbnow__abbr">{row.club.abbreviation}</span>
            <Pips winsNeeded={box.winsNeeded} wins={row.wins} />
          </div>
        ) : (
          <div key={i} className="pbnow__row">
            <BlankSlot label={feeders?.[i] ? `Winner of ${feeders[i]}, to come` : 'To come'} />
          </div>
        ),
      )}
      {box.foot && <span className="pbnow__foot">{box.foot}</span>}
    </div>
  )
}

// Mounted only while open, so the history read behind FullBracket's links
// starts on the tap and not on page load.
function FullBracketSheet({ bracket, cutoff, onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const historyIds = useBracketHistoryIds()
  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="sheet pbnow-sheet" role="dialog" aria-modal="true" aria-label="Full postseason bracket">
        <div className="pbnow-sheet__head">
          <h2 className="sheet__title">Postseason</h2>
          <IconButton ref={closeRef} label="Close" mark="md" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="pbkt">
          <FullBracket bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
        </div>
      </div>
    </div>
  )
}

// The boxes and connectors for one round: { nodes, links, height, note }. A node
// is { box, x, y, feeders }; a link is { y1, y2, inked } from the left column
// (x = BOX_W) to the right (x = TO_X).
function layoutNow(bracket, round) {
  if (round === 'wildcard' || round === 'division') {
    const feed = roundFeed(bracket, round)
    if (!feed) return null
    // The NL boxes sit one gap lower, so the two leagues read as two groups.
    const fromY = feed.from.map((box, i) => i * (BOX_H + GAP) + (box.league === 'NL' ? GAP : 0))
    // A box of the next round sits level with the middle of the series that feed it.
    const toY = feed.to.map((_, j) => {
      const ys = feed.links.filter((l) => l.to === j).map((l) => fromY[l.from])
      return ys.reduce((a, b) => a + b, 0) / ys.length
    })
    return {
      nodes: [
        ...feed.from.map((box, i) => ({ box, x: 0, y: fromY[i] })),
        ...feed.to.map((box, j) => ({ box, x: TO_X, y: toY[j], feeders: box.rows.map((r) => r.feeder) })),
      ],
      links: feed.links.map((l) => ({ y1: fromY[l.from] + BOX_H / 2, y2: toY[l.to] + BOX_H / 2, inked: l.inked })),
      height: fromY.at(-1) + BOX_H,
      note: round === 'wildcard'
        ? 'The Wild Card series feed the Division Series. Other rounds are in the full bracket.'
        : 'The Division Series feed the LCS. Other rounds are in the full bracket.',
    }
  }
  const now = bracketNow(bracket)
  if (!now) return null
  const [al, nl, ws] = now.boxes
  const height = 2 * BOX_H + GAP
  const wsY = (height - BOX_H) / 2
  return {
    nodes: [
      { box: al, x: 0, y: 0 },
      { box: nl, x: 0, y: BOX_H + GAP },
      { box: ws, x: TO_X, y: wsY, feeders: [al.name, nl.name] },
    ],
    links: now.links.map((l, i) => ({ y1: i * (BOX_H + GAP) + BOX_H / 2, y2: wsY + BOX_H / 2, inked: l.inked })),
    height,
    note: 'The two LCS feed the World Series. Earlier rounds are in the full bracket.',
  }
}

export function BracketNow({ bracket, cutoff, round }) {
  const [open, setOpen] = useState(false)
  const now = layoutNow(bracket, round)
  if (!now) return null
  return (
    <>
      <Card
        aria-label="Postseason bracket, current round"
        head={
          <SectionHead
            look="label"
            as="h2"
            action={
              <Door onClick={() => setOpen(true)} aria-haspopup="dialog">
                Full bracket
              </Door>
            }
          >
            Postseason
          </SectionHead>
        }
      >
        <div className="pbnow__tree" style={{ width: W, height: now.height }}>
          <svg className="pbkt-lines" width={W} height={now.height} aria-hidden="true">
            {now.links.map((link, i) => (
              <path
                key={i}
                d={`M${BOX_W} ${link.y1} H${(BOX_W + TO_X) / 2} V${link.y2} H${TO_X}`}
                className={link.inked ? 'pbkt-ink' : 'pbkt-pencil pbkt-dash'}
              />
            ))}
          </svg>
          {now.nodes.map((node, i) => (
            <Box key={i} {...node} />
          ))}
        </div>
        <p className="pbnow__note">{now.note}</p>
      </Card>
      {open && <FullBracketSheet bracket={bracket} cutoff={cutoff} onClose={() => setOpen(false)} />}
    </>
  )
}
