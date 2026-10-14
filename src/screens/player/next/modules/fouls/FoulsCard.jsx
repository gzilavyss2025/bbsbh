import { useEffect, useState } from 'react'
import { fetchFouls, fetchFoulsFor, batterFoulLine, leagueFoulRates } from '../../../../../api/fouls.js'
import { CountExplorer, Rail, Stat } from '../../parts/CountExplorer.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { foulsView } from './foulsView.js'

const COPY = {
  pick: 'Pick a count',
  cellAria: (c) => `Count ${c.name}, reached in ${c.reachPct} of plate appearances, ${c.fouls} fouls`,
  vs: 'Fouls per swing against the league',
  who: 'Him',
  ends: 'How those at-bats ended',
}

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
  const [metric, setMetric] = useState(0)
  useEffect(() => {
    if (!loading && !view) onEmpty()
    onCount(view ? String(season) : undefined)
  }, [loading, view, season, onEmpty, onCount])

  if (!view) return loading ? <div className="fouls"><div className="fouls__wait" aria-busy="true" /></div> : null
  const m = view.baseline[Math.min(metric, view.baseline.length - 1)]
  return (
    <div className="fouls">
      <div className="fouls__body">
        <CountExplorer view={view} copy={COPY} />

        <Stack gap="snug" className="fouls__base">
          <span className="fouls__cap">Season baseline</span>
          <Segmented
            label="Season stat"
            fill
            value={Math.min(metric, view.baseline.length - 1)}
            onChange={setMetric}
            options={view.baseline.map((b, i) => ({ value: i, label: b.label }))}
          />
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
