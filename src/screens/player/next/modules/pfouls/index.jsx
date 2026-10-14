// The pitcher's Foul balls slot (#2016, the contract is in ../../CLAUDE.md): the batter card's count
// explorer from his side, a Regular season / Postseason switch, and three season baselines with his
// rank. The whole file is the only home of the league's cells and the ranking pool, so a whole file
// that fails to load leaves his own numbers, not an empty card (as the batter card, #1891).
import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/batter/fouls.css'
import '../../../../../styles/player-next/pitcher/pfouls.css'
import { fetchFouls, fetchFoulsFor, foulLeaders, foulsInScope, leagueFoulRates, pitcherFoulLine } from '../../../../../api/fouls.js'
import { CountExplorer, Rail, Stat } from '../../parts/CountExplorer.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { Door } from '../../../../../components/ui/control/Door.jsx'
import { Pill } from '../../../../../components/ui/control/Pill.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { useRouteLink } from '../../../../../lib/nav.js'
import { foulsPath } from '../../../../../lib/route.js'
import { pfoulsView } from './pfoulsView.js'

const COPY = {
  pick: 'Pick a count',
  cellAria: (c) => `Count ${c.name}, reached by ${c.reachPct} of his batters, ${c.fouls} fouls`,
  vs: 'Fouls per swing against the league',
  who: 'Him',
  ends: 'How those at-bats ended',
}
const SCOPES = [['R', 'Regular season'], ['P', 'Postseason']]

export default function PfoulsModule({ bio, asOf, season, onEmpty, onCount }) {
  // The nightly file cannot be cut to a past date.
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
  const [picked, setPicked] = useState(null)
  const [metric, setMetric] = useState(0)
  const { lines, scope, view } = useMemo(() => {
    const lines = { R: pitcherFoulLine(data?.[0], bio.id), P: pitcherFoulLine(data?.[0]?.post, bio.id) }
    // A pick from another season or player falls back when this one has no line there.
    const scope = lines[picked] ? picked : lines.R ? 'R' : 'P'
    const whole = data?.[1] ? foulsInScope(data[1], scope) : null
    const view = lines[scope]
      ? pfoulsView({
          id: bio.id,
          line: lines[scope],
          league: leagueFoulRates(whole),
          pool: scope === 'R' && whole ? foulLeaders(whole).pitchers.byFoulPct : null,
          post: scope === 'P',
        })
      : null
    return { lines, scope, view }
  }, [data, bio.id, picked])
  const link = useRouteLink()
  useEffect(() => {
    if (!loading && !view) onEmpty()
    onCount(view ? `${season}${scope === 'P' ? ' · post' : ''}` : undefined)
  }, [loading, view, season, scope, onEmpty, onCount])

  if (!view) return loading ? <div className="fouls"><div className="fouls__wait" aria-busy="true" /></div> : null
  const m = view.baseline[metric]
  return (
    <div className={`fouls pfouls${view.thin ? ' pfouls--thin' : ''}`}>
      {lines.R && lines.P && (
        <div role="group" aria-label="Part of season" className="pfouls__scope">
          {SCOPES.map(([k, label]) => (
            <Button key={k} size="control" pressed={k === scope} onClick={() => setPicked(k)}>
              <span className="pfouls__opt">
                {label}
                <span className="pfouls__g">{lines[k].g} G</span>
              </span>
            </Button>
          ))}
        </div>
      )}
      <div className="fouls__body">
        {view.thin ? (
          <p className="pfouls__thin">{view.thin}</p>
        ) : (
          <CountExplorer key={scope} view={view} copy={COPY} />
        )}

        <Stack gap="snug" className="fouls__base">
          <span className="fouls__cap">Season baseline</span>
          <Cluster gap="tight" role="group" aria-label="Season stat">
            {view.baseline.map((b, i) => (
              <Pill key={b.key} role="control" fill="paper" pressed={i === metric} onClick={() => setMetric(i)}>
                {b.label}
              </Pill>
            ))}
          </Cluster>
          <Stack gap="base" className="fouls__metric" aria-live="polite">
            <div className="fouls__between">
              <Stat k={m.title} v={m.his} sub={m.sub} />
              <Stat k={m.lgName} v={m.lg} sub={m.gapNote || m.lgSub} end />
            </div>
            <Rail fill={m.fill} tick={m.tick} label={`${m.title}: him ${m.his}, ${m.lgName} ${m.lg}`} />
            {m.rank && <span className="fouls__sub pfouls__rank">{m.rank}</span>}
            <p className="pfouls__why">{m.why}</p>
          </Stack>
          <Door {...link(foulsPath({ seasonYear: season }))}>League foul tracker</Door>
        </Stack>
      </div>
    </div>
  )
}
