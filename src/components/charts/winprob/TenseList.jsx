import { useMemo } from 'react'
import { ordinal } from '../../../lib/format.js'
import { pressureLabel, tenseBars } from '../../../api/tensest/tenseBars.js'
import { PressureMeter } from '../PressureMeter.jsx'

// The Tensest moments list under the swing ledger (#2979, Gary's option A):
// the revealed plays with the most pressure, highest first (api/winprob.js
// selectTensePlays, fed the chart's already-clamped points). Rows match the
// swing ledger's, minus the swing chip, since this list is not about who
// gained. A row selects its play on the chart; Watch opens its clip.
export function TenseList({ plays, activeIdx, cutoffs, clip, onPick, onWatch }) {
  const { hasClip } = clip
  const watchable = useMemo(() => plays.map((p) => hasClip(p.playId)), [plays, hasClip])
  if (plays.length === 0) return null
  return (
    <div className="winprob__ledger winprob__tense">
      <h3 className="winprob__tense-head t-label t-label--bold" id="winprob-tense-head">Tensest moments</h3>
      <ol className="winprob__ledger-list" aria-labelledby="winprob-tense-head">
        {plays.map((p, index) => {
          const tag = `${p.half === 'top' ? '▲' : '▼'}${p.inning}`
          const halfWords = `${p.half === 'top' ? 'top' : 'bottom'} of the ${ordinal(p.inning)}`
          const bars = tenseBars(p.li, cutoffs)
          const pressure = pressureLabel(bars, cutoffs)
          const isActive = activeIdx === p.idx
          return (
            <li className={`winprob__ledger-row${isActive ? ' is-active' : ''}`} key={`tp-${p.idx}`}>
              <button
                type="button"
                className="winprob__ledger-pick"
                aria-pressed={isActive}
                aria-label={`Tense moment ${index + 1}: ${halfWords}.${pressure ? ` ${pressure}.` : ''} Show on the chart`}
                onClick={() => onPick(p.idx)}
              >
                <span className="winprob__ledger-meta">
                  <span className="t-label">{tag}</span>
                  <PressureMeter bars={bars} decorative />
                </span>
                <span className="winprob__ledger-desc">{p.desc}</span>
              </button>
              {watchable[index] && (
                <button
                  type="button"
                  className="winprob__ledger-watch"
                  aria-label={`Watch tense moment ${index + 1}, ${halfWords}`}
                  onClick={() => {
                    onWatch(p.idx)
                    clip.openClip(p.playId, `Tense moment · ${tag}`)
                  }}
                >
                  <span aria-hidden="true">▶</span> Watch
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
