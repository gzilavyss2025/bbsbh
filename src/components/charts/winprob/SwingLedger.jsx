import { useMemo } from 'react'
import { ordinal } from '../../../lib/format.js'
import { winProbChangeLabel } from './explore.js'
import { winProbKeyPill } from './keyColors.js'

// The biggest revealed swings under the win-probability plot, numbered 1 =
// biggest to match the plot's markers (api/winprob.js orders them). A row
// selects its play (`onPick`); its Watch button selects it too (`onWatch`)
// and opens the play's film (`clip`, useSwingClip.js). `keys` are the two
// clubs' key colours (keyColors.js). `stepAt(idx)` is a play's whole-percent
// change in the header's own numbers (explore.js wholeSwing); the ranking
// stays on the raw delta.
export function SwingLedger({ bigPlays, activeIdx, home, away, keys, stepAt, clip, onPick, onWatch }) {
  const { hasClip } = clip
  // One film lookup per row when the plays or the film list change, not on every render.
  const watchable = useMemo(() => bigPlays.map((p) => hasClip(p.playId)), [bigPlays, hasClip])
  if (bigPlays.length === 0) return null
  return (
    <div className="winprob__ledger">
      {/* No visible heading: the numbered markers on the plot already tie
          these rows to the chart. The list keeps its name for a screen
          reader. A row selects its play; its Watch button opens the clip. */}
      <ol className="winprob__ledger-list" aria-label="Biggest swings">
        {bigPlays.map((p, index) => {
          const toHome = p.delta > 0
          const abbr = toHome ? home : away
          const chipText = winProbChangeLabel(stepAt(p.idx), home, away)
          const tag = `${p.half === 'top' ? '▲' : '▼'}${p.inning}`
          const isActive = activeIdx === p.idx
          const halfWords = `${p.half === 'top' ? 'top' : 'bottom'} of the ${ordinal(p.inning)}`
          return (
            <li className={`winprob__ledger-row${isActive ? ' is-active' : ''}`} key={`bp-${p.idx}`}>
              <button
                type="button"
                className="winprob__ledger-pick"
                aria-pressed={isActive}
                aria-label={`Swing ${index + 1}: ${chipText}, ${halfWords}. Show on the chart`}
                onClick={() => onPick(p.idx)}
              >
                <span className="winprob__ledger-meta">
                  <span className="winprob__moment-number">{index + 1}</span>
                  <span
                    className="pill pill--ink pill--figure winprob__ledger-chip"
                    style={winProbKeyPill(toHome ? keys.home : keys.away)}
                  >
                    {chipText}
                  </span>
                  <span className="winprob__ledger-half">{tag}</span>
                </span>
                <span className="winprob__ledger-desc">{p.desc || `${abbr} rally`}</span>
              </button>
              {watchable[index] && (
                <button
                  type="button"
                  className="winprob__ledger-watch"
                  aria-label={`Watch swing ${index + 1}, ${halfWords}`}
                  onClick={() => {
                    onWatch(p.idx)
                    clip.openClip(p.playId, `${chipText} · ${tag}`)
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
