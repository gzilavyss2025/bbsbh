import { useEffect, useState } from 'react'
import { fetchFouls, fetchFoulsFor, batterFoulLine, leagueFoulRates } from '../../../../../api/fouls.js'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Pill } from '../../../../../components/ui/control/Pill.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { foulsView } from './foulsView.js'

const STRIKES = [0, 1, 2]

// His foul balls by count (#1891): a 4 x 3 grid of counts, the picked count's story, and his season
// baseline against the league. The whole file is the only place the league's cells live, so a
// league that fails to load leaves his own numbers, not an empty card.
export default function FoulsCard({ bio, asOf, season, onEmpty, onCount }) {
  // The nightly file cannot be cut to a past date, as FoulCard does.
  const skip = !!asOf || season == null
  const { data, loading } = useAsync(
    () =>
      skip
        ? Promise.resolve(null)
        : Promise.all([
            fetchFoulsFor(bio.id, { seasonYear: season, strict: true }),
            fetchFouls({ seasonYear: season }).catch(() => null),
          ]),
    [skip, bio.id, season],
  )
  const view = data ? foulsView({ line: batterFoulLine(data[0], bio.id), league: leagueFoulRates(data[1]) }) : null
  const [pick, setPick] = useState(null)
  const [metric, setMetric] = useState(0)
  useEffect(() => {
    if (!loading && !view) onEmpty()
    onCount(view ? String(season) : undefined)
  }, [loading, view, season, onEmpty, onCount])

  if (!view) return loading ? <div className="fouls"><div className="fouls__wait" aria-busy="true" /></div> : null
  const c = view.cells[pick ?? view.top]
  const m = view.baseline[Math.min(metric, view.baseline.length - 1)]
  return (
    <div className="fouls">
      <div className="fouls__body">
        <Stack gap="snug" className="fouls__pick">
          <span className="fouls__cap">Pick a count</span>
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
                    aria-label={`Count ${cell.name}, reached in ${cell.reachPct} of plate appearances, ${cell.fouls} fouls`}
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
            <Stat k="Reached in" v={c.reachPct} sub={`${c.reach} of ${view.pa} PA`} />
            <Stat k="Fouls here" v={c.fouls} sub={c.per100} />
            <Stat k="Fouls per swing" v={c.rate} sub={`of ${c.swings} swings`} />
          </div>
          <Stack gap="snug" className="fouls__block">
            <Cluster gap="snug" align="baseline" className="fouls__between">
              <span className="fouls__cap">Fouls per swing against the league</span>
              <span className="fouls__lg">League <b>{c.lgRate}</b> · <b className="fouls__ink">{c.diff}</b></span>
            </Cluster>
            <Rail fill={c.railFill} tick={c.railTick} label={`Him ${c.rate}, league ${c.lgRate}`} />
          </Stack>
          <Stack gap="snug" className="fouls__block">
            <span className="fouls__cap">How those at-bats ended</span>
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
          </Stack>
        </Stack>

        <Stack gap="snug" className="fouls__base">
          <span className="fouls__cap">Season baseline</span>
          <Cluster gap="tight" role="group" aria-label="Season stat">
            {view.baseline.map((b, i) => (
              <Pill key={b.key} role="control" fill="paper" pressed={b === m} onClick={() => setMetric(i)}>
                {b.label}
              </Pill>
            ))}
          </Cluster>
          <Stack gap="base" className="fouls__metric" aria-live="polite">
            <div className="fouls__between">
              <Stat k={m.title} v={m.his} sub={m.sub} />
              <Stat k="League" v={m.lg} sub={m.gapNote || m.lgSub} end />
            </div>
            <Rail fill={m.fill} tick={m.tick} label={`${m.title}: him ${m.his}, league ${m.lg}`} />
          </Stack>
        </Stack>
      </div>
    </div>
  )
}

function Stat({ k, v, sub, end }) {
  return (
    <Stack gap="tight" className={`fouls__stat${end ? ' fouls__stat--end' : ''}`}>
      <span className="fouls__cap">{k}</span>
      <span className="fouls__num">{v}</span>
      <span className="fouls__sub">{sub}</span>
    </Stack>
  )
}

function Rail({ fill, tick, label }) {
  return (
    <div className="fouls__rail" role="img" aria-label={label}>
      <div className="fouls__fill" style={{ width: `${fill}%` }} />
      {tick != null && <div className="fouls__tick" style={{ left: `${tick}%` }} />}
    </div>
  )
}
