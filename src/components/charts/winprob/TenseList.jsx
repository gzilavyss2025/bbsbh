import { useId, useMemo } from 'react'
import { ordinal } from '../../../lib/format.js'
import { pressureLabel, tenseBars } from '../../../api/tensest/tenseBars.js'
import { LedgerRow } from './LedgerRow.jsx'

// The Tensest moments list under the swing ledger (#2979, Gary's option A):
// the revealed plays with the most pressure, highest first (api/winprob.js
// selectTensePlays, fed the chart's already-clamped points). Rows are the swing
// ledger's (LedgerRow) minus the swing chip, since this list is not about who
// gained. A row selects its play on the chart; Watch opens its clip.
export function TenseList({ plays, activeIdx, cutoffs, clip, onPick, onWatch }) {
  const headId = useId()
  const { hasClip } = clip
  const watchable = useMemo(() => plays.map((p) => hasClip(p.playId)), [plays, hasClip])
  if (plays.length === 0) return null
  return (
    <div className="winprob__ledger winprob__tense">
      <h3 className="winprob__tense-head t-label t-label--bold" id={headId}>Tensest moments</h3>
      <ol className="winprob__ledger-list" aria-labelledby={headId}>
        {plays.map((p, index) => {
          const tag = `${p.half === 'top' ? '▲' : '▼'}${p.inning}`
          const halfWords = `${p.half === 'top' ? 'top' : 'bottom'} of the ${ordinal(p.inning)}`
          const bars = tenseBars(p.li, cutoffs)
          const pressure = pressureLabel(bars, cutoffs)
          return (
            <LedgerRow
              key={`tp-${p.idx}`}
              play={p}
              active={activeIdx === p.idx}
              tag={tag}
              bars={bars}
              desc={p.desc}
              label={`Tense moment ${index + 1}: ${halfWords}.${pressure ? ` ${pressure}.` : ''} Show on the chart`}
              watchLabel={`Watch tense moment ${index + 1}, ${halfWords}`}
              watchable={watchable[index]}
              onPick={onPick}
              onWatch={() => {
                onWatch(p.idx)
                clip.openClip(p.playId, `${pressure || 'Tense moment'} · ${tag}`)
              }}
            />
          )
        })}
      </ol>
    </div>
  )
}
