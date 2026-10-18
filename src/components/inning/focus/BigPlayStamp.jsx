import { BIG_PLAY_LABELS } from './bigPlay.js'
import { BIG_PLAY_MS } from './beats.js'

const TICKS = Array.from({ length: 16 }, (_, i) => i)

// The stamp that comes down on a big play: an ink-stamped label, a ring that
// spreads from the hit, and (home runs and up) a fan of ticks. Decorative —
// the denotation and the prose already say what happened, so it is hidden from
// assistive tech. Styles and the motion contract: styles/focus/bigplay.css.
export function BigPlayStamp({ kind }) {
  const { label, sub } = BIG_PLAY_LABELS[kind]
  const burst = kind === 'slam' || kind === 'homer'
  return (
    <div className={`bigplay bigplay--${kind}`} style={{ '--bigplay-ms': `${BIG_PLAY_MS[kind]}ms` }} aria-hidden="true">
      {kind !== 'double' && <span className="bigplay__ring" />}
      {kind === 'slam' && <span className="bigplay__ring bigplay__ring--late" />}
      {burst &&
        TICKS.map((i) => <span key={i} className="bigplay__tick" style={{ '--i': i }} />)}
      <span className="bigplay__stamp">
        <span className="bigplay__label">{label}</span>
        {sub && <span className="bigplay__sub">{sub}</span>}
      </span>
    </div>
  )
}
