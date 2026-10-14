import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/season/advanced.css'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { loadAdvanced } from './advancedData.js'
import { advancedView } from './advancedView.js'

const SCOPES = [['regular', 'Regular season'], ['post', 'Postseason']]

// Advanced (#2012): the rates behind the headline tiles, a Regular season / Postseason switch over a tile grid.
// Open surface (ADR-0034): full-season aggregates, no seal. The league rate under a tile is the MLB season rate.
export default function AdvancedModule({ bio, role, asOf, season, onEmpty, onCount }) {
  const { data, loading } = useAsync(() => loadAdvanced(bio, role, season, asOf), [bio, role, season, asOf])
  const [scope, setScope] = useState('regular')
  const [open, setOpen] = useState(null)
  const views = useMemo(() => {
    if (!data) return null
    const make = (s, post) => s && advancedView({ role, facts: s.facts, bundle: s.bundle, rates: data.rates, post })
    return { regular: make(data.regular, false), post: make(data.post, true) }
  }, [data, role])
  const empty = !loading && !views?.regular
  const shown = views?.[scope] ?? views?.regular
  const active = shown === views?.post ? 'post' : 'regular'
  useEffect(() => {
    if (empty) onEmpty()
    else if (views) onCount(`${season} ${active === 'post' ? 'postseason' : 'season'}`)
  }, [empty, views, active, season, onEmpty, onCount])
  if (loading) return <div className="pnext-adv pnext-adv--loading" aria-busy="true" />
  if (empty) return null
  const tile = shown.tiles.find((t) => t.key === open)
  return (
    <div className="pnext-adv">
      <div className="pnext-adv__top">
        {views.post && (
          <Cluster role="group" aria-label="Scope">
            {SCOPES.map(([k, text]) => (
              <Button key={k} size="control" pressed={active === k} onClick={() => (setScope(k), setOpen(null))}>{text}</Button>
            ))}
          </Cluster>
        )}
        {shown.sample && <span className="pnext-adv__sample mono">{shown.sample}</span>}
      </div>
      <div className="pnext-adv__grid">
        {shown.tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={open === t.key}
            className={`pnext-adv__tile${t.lead ? ' pnext-adv__tile--lead' : ''}${t.missing ? ' pnext-adv__tile--missing' : ''}${open === t.key ? ' pnext-adv__tile--open' : ''}`}
            onClick={() => setOpen(open === t.key ? null : t.key)}
          >
            <span className="pnext-adv__label">{t.label}</span>
            <span className="pnext-adv__value mono">{t.missing ? 'Not on file' : t.value}</span>
            {t.caption && <span className="pnext-adv__cap">{t.caption}</span>}
          </button>
        ))}
      </div>
      {tile?.note && <p className="pnext-adv__note">{tile.note}</p>}
    </div>
  )
}
