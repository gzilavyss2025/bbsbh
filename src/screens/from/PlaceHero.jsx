import { useRouteLink } from '../../lib/nav.js'
import { changeLink } from '../../lib/from/copy.js'
import { fromPath } from '../../lib/from/path.js'
import { Door } from '../../components/ui/control/Door.jsx'
import { FactGrid } from '../../components/ui/frame/FactGrid.jsx'
import { StatTile } from '../../components/ui/frame/StatTile.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Locator } from './Locator.jsx'

// A place's hero (#1526, SPEC §9.5): its name, the line under it, two tiles, the fact strip and
// the locator. The tiles stamp in once a page visit (`still` says it already did).
function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value}</dd>
    </div>
  )
}

export function PlaceHero({ place, facts, subtitle, list, state, outline, still }) {
  const linkProps = useRouteLink()
  const change = linkProps(fromPath({ list, state }))
  const stamp = (i) => ({ stampIn: !still, style: { '--stamp-delay': `calc(var(--stagger-step) * ${i})` } })
  const locate = outline && state && Boolean(outline.states[state])
  return (
    <Card frame="stamped" className="fromhero" body="flush">
      <div className="fromhero__grid">
        <div className="fromhero__tiles">
          <StatTile tone="ink" label="Big leaguers" value={facts.count} caption={`Debuts ${facts.first}–${facts.latest}`} {...stamp(0)} />
          <StatTile tone="tint" label={facts.tile.label} value={facts.tile.value} caption={facts.tile.caption} {...stamp(1)} />
        </div>
        <div className="fromhero__text">
          <h2 className="fromhero__name">{place.name}</h2>
          <p className="fromhero__sub t-label">{subtitle}</p>
          <Door href={change.href} onClick={change.onClick}>{changeLink(list)}</Door>
        </div>
        {locate && (
          <div className="fromhero__map">
            <Locator
              outline={outline}
              state={state}
              point={place.pt ?? null}
              label={`Map: ${place.city ?? place.name}, in ${state}`}
            />
          </div>
        )}
      </div>
      <FactGrid look="strip" className="fromhero__facts">
        <Fact label="First debut" value={facts.first} />
        <Fact label="Latest" value={facts.latest} />
        <Fact label="Decades" value={facts.decades} />
        <Fact label="Pitchers" value={facts.pitchers} />
        <Fact label="Hitters" value={facts.hitters} />
        <Fact label="Newest class" value={`${facts.newest.year} · ${facts.newest.n}`} />
      </FactGrid>
    </Card>
  )
}
