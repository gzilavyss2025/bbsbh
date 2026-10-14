import { useState } from 'react'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { Cluster } from '../../../../components/ui/layout/Cluster.jsx'

// The count explorer the Foul balls cards share (#1891, #2016): the 4 x 3 grid of counts and the
// picked count's story. `view` is a foulsView; `copy` holds the words that differ by side
// ({ pick, cellAria(cell), vs, who, ends }, and optional reached, of and note(cell), which the batter card leaves out). The fouls__* classes stay; a card restyles them in its own CSS.
const STRIKES = [0, 1, 2]

export function CountExplorer({ view, copy }) {
  const [pick, setPick] = useState(null)
  const c = view.cells[pick ?? view.top]
  return (
    <>
      <Stack gap="snug" className="fouls__pick">
        <span className="fouls__cap">{copy.pick}</span>
        <div className="fouls__grid">
          <span />
          {STRIKES.map((s) => (
            <span key={s} className="fouls__colhead">{s} {s === 1 ? 'strike' : 'strikes'}</span>
          ))}
          {[0, 1, 2, 3].map((b) => [
            <span key={`h${b}`} className="fouls__colhead fouls__rowhead">{b} {b === 1 ? 'ball' : 'balls'}</span>,
            ...STRIKES.map((s) => {
              const cell = view.cells[b * 3 + s]
              return (
                <button
                  key={cell.name}
                  type="button"
                  className="fouls__cell"
                  aria-pressed={cell === c}
                  aria-label={copy.cellAria(cell)}
                  style={{ '--heat': cell.heat.toFixed(2) }}
                  onClick={() => setPick(cell.i)}
                >
                  <span className="fouls__name">{cell.name}</span>
                  <span className="fouls__reach">{cell.reachPct}</span>
                </button>
              )
            }),
          ])}
        </div>
      </Stack>

      <Stack gap="loose" className="fouls__panel" aria-live="polite">
        <Cluster gap="snug" align="center">
          <span className="fouls__big">{c.name}</span>
          <span className="fouls__cap">{c.words}</span>
          {c.two && <span className="fouls__flag">Two strikes</span>}
        </Cluster>
        <div className="fouls__stats">
          <Stat k={copy.reached ?? 'Reached in'} v={c.reachPct} sub={`${c.reach} of ${view.pa} ${copy.of ?? 'PA'}`} />
          <Stat k="Fouls here" v={c.fouls} sub={c.per100} />
          <Stat k="Fouls per swing" v={c.rate} sub={`of ${c.swings} swings`} />
        </div>
        <Stack gap="snug" className="fouls__block">
          <Cluster gap="snug" align="baseline" className="fouls__between">
            <span className="fouls__cap">{copy.vs}</span>
            <span className="fouls__lg">League <b>{c.lgRate}</b> · <b className="fouls__ink">{c.diff}</b></span>
          </Cluster>
          <Rail fill={c.railFill} tick={c.railTick} label={`${copy.who} ${c.rate}, league ${c.lgRate}`} />
        </Stack>
        <Stack gap="snug" className="fouls__block">
          <span className="fouls__cap">{copy.ends}</span>
          {c.reach > 0 && (
            <div className="fouls__bar" role="img" aria-label={c.ends.map((e) => `${e.name} ${e.n}`).join(', ')}>
              {c.ends.filter((e) => e.n > 0).map((e) => (
                <span key={e.key} className={`fouls__seg fouls__seg--${e.key}`} style={{ width: `${(e.n / c.reach) * 100}%` }}>
                  {e.n / c.reach >= 0.11 ? e.pct : ''}
                </span>
              ))}
            </div>
          )}
          <ul className="fouls__legend">
            {c.ends.map((e) => (
              <li key={e.key}>
                <span className={`fouls__key fouls__seg--${e.key}`} aria-hidden="true" />
                {e.name}
                <b>{e.n} <span>{e.pct}</span></b>
              </li>
            ))}
          </ul>
          {copy.note && <p className="fouls__note">{copy.note(c)}</p>}
        </Stack>
      </Stack>
    </>
  )
}

export function Stat({ k, v, sub, end }) {
  return (
    <Stack gap="tight" className={`fouls__stat${end ? ' fouls__stat--end' : ''}`}>
      <span className="fouls__cap">{k}</span>
      <span className="fouls__num">{v}</span>
      <span className="fouls__sub">{sub}</span>
    </Stack>
  )
}

export function Rail({ fill, tick, label }) {
  return (
    <div className="fouls__rail" role="img" aria-label={label}>
      <div className="fouls__fill" style={{ width: `${fill}%` }} />
      {tick != null && <div className="fouls__tick" style={{ left: `${tick}%` }} />}
    </div>
  )
}
