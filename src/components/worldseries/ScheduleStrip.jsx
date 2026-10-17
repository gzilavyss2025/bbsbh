import { Key } from '../ui/frame/Key.jsx'

// The Series schedule as a strip: one cell per game and one hatched cell per
// off day. Today is marked, the next game is inked, an if-necessary game has a
// dashed edge. `columns` is ledgerModel's column list; nothing here reads a
// result.
const swatch = (kind) => <span className={`ww-swatch ww-swatch--${kind}`} aria-hidden="true" />

const KEY = [
  { label: 'Today', mark: swatch('today') },
  { label: 'Next', mark: swatch('next') },
  { label: 'Travel', mark: swatch('off') },
  { label: 'If needed', mark: swatch('maybe') },
]

export function nextGameNumber(columns) {
  return columns.find((c) => c.kind === 'game' && c.state === 'future' && !c.ifNecessary)?.gameNumber ?? null
}

export function ScheduleStrip({ columns }) {
  const next = nextGameNumber(columns)
  return (
    <div className="ww-strip">
      <ol className="ww-strip__list" aria-label="Series schedule">
        {columns.map((c) => {
          if (c.kind === 'off') {
            return (
              <li key={`off-${c.afterGame}`} className={`ww-strip__cell ww-strip__cell--off${c.today ? ' ww-strip__cell--today' : ''}`}>
                Off
              </li>
            )
          }
          const cls = [
            'ww-strip__cell',
            c.state === 'today' && 'ww-strip__cell--today',
            c.gameNumber === next && 'ww-strip__cell--next',
            c.ifNecessary && 'ww-strip__cell--maybe',
          ]
          return (
            <li key={c.gameNumber} className={cls.filter(Boolean).join(' ')}>
              G{c.gameNumber}
            </li>
          )
        })}
      </ol>
      <Key items={KEY} className="ww-strip__key" />
    </div>
  )
}
