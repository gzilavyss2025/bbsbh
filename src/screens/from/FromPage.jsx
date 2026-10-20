import { useMemo, useState } from 'react'
import '../../styles/from/page.css'
import '../../styles/from/map.css'
import '../../styles/from/list.css'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useRouteLink } from '../../lib/nav.js'
import { fetchFromIndex, fetchFromLookup, fetchFromMap, fetchFromPlaces, fetchFromStateMap } from '../../api/from/whereFrom.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import {
  FROM_TITLE, LIST_LABEL, countTag, creditsFor, emptyList, footnote, legendHas, listTabName, pickerIntro, searchField,
  stateName, unplacedNote,
} from '../../lib/from/copy.js'
import { lookupRows, placeLine, placesIn, rowPlace, searchRows, sortPlaces } from '../../lib/from/list.js'
import { fromCountryPath, fromPath } from '../../lib/from/path.js'
import { FROM_LISTS } from '../../lib/from/route.js'
import { STATE_NAMES } from '../../lib/from/states.js'
import { PlaceList } from './PlaceList.jsx'
import { UsMap } from './UsMap.jsx'

const PAGE = 40
const STATE_OPTIONS = Object.entries(STATE_NAMES).sort(([, a], [, b]) => (a < b ? -1 : 1))

// "Where they're from" (#1526): pick a college, a high school or a hometown, and see every big
// leaguer from there. A standalone page outside the scoring flow, so it opens live (ADR-0034):
// no SealBox, no reveal-only module. `list`, `state` and `zone` are only the OPENING state, from
// the address; the page keeps its own picks and writes them back with replaceState so a shared
// link opens the same view. It does not go through the router for that, because a route change
// would remount the page and cut the map's zoom short.
export function FromPage({ list: openList = 'college', state: openState = null, zone: openZone = null }) {
  useDocumentTitle(FROM_TITLE)
  const linkProps = useRouteLink()
  const [list, setList] = useState(FROM_LISTS.includes(openList) ? openList : 'college')
  const [st, setSt] = useState(openState)
  const [zone, setZone] = useState(openZone)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  const remember = (next) => {
    const merged = { list, state: st, zone, ...next }
    window.history.replaceState(window.history.state, '', fromPath(merged))
  }
  const pickList = (value) => {
    setList(value)
    setShown(PAGE)
    remember({ list: value })
  }
  const pickState = (code) => {
    setSt(code)
    setZone(null)
    setQuery('')
    setShown(PAGE)
    remember({ state: code, zone: null })
  }
  const pickZone = (id) => {
    setZone(id)
    setShown(PAGE)
    remember({ zone: id })
  }

  const index = useAsync(() => fetchFromIndex(), [])
  const outline = useAsync(() => fetchFromMap(), [])
  const lookup = useAsync(() => fetchFromLookup(list), [list])
  const stateMap = useAsync(() => (st ? fetchFromStateMap(st) : Promise.resolve(null)), [st])
  const shard = useAsync(() => (st ? fetchFromPlaces(list, st) : Promise.resolve(null)), [list, st])

  const counts = index.data?.counts?.[list] ?? {}
  const zoneCounts = index.data?.zoneCounts?.[list] ?? {}
  const zones = stateMap.data?.zones ?? []
  const activeZone = zones.some((z) => z.id === zone) ? zone : null
  const search = searchField(list)

  // What the list card shows: a search over every place, else a state's (or zone's) places,
  // else every place A to Z.
  const view = useMemo(() => {
    const all = lookupRows(list, lookup.data)
    if (query.trim()) {
      const rows = searchRows(all, query)
      return { rows: rows.map((r) => ({ key: `${r.state}/${r.slug}`, place: rowPlace(list, r), name: r.name, line: r.state ?? '' })), ready: !lookup.loading }
    }
    if (st) {
      const places = shard.data ? sortPlaces(placesIn(shard.data.places, activeZone)) : []
      return {
        rows: places.map((p) => ({ key: p.slug, place: rowPlace(list, p), name: p.name, line: placeLine(p), count: p.players.length })),
        ready: !shard.loading,
      }
    }
    return { rows: all.map((r) => ({ key: `${r.state}/${r.slug}`, place: rowPlace(list, r), name: r.name, line: r.state ?? '' })), ready: !lookup.loading }
  }, [list, lookup.data, lookup.loading, query, st, shard.data, shard.loading, activeZone])

  const zoneName = zones.find((z) => z.id === activeZone)?.name
  const chipOptions = [
    { value: '', label: `All ${stateName(st)}`, count: counts[st] ?? 0 },
    ...zones.map((z) => ({ value: z.id, label: z.name, count: zoneCounts[z.id] ?? 0 })),
  ]
  const searching = Boolean(query.trim())
  const tabName = listTabName(list, searching ? {} : { stateName: st && stateName(st), zoneName })
  const countries = list === 'hometown' ? (index.data?.countries ?? []) : []

  return (
    <div className="screen">
      <SiteHeader />
      <Stack gap="section" className="fromp">
        <header className="fromp__head">
          <h1 className="fromp__title">{FROM_TITLE}</h1>
          <p className="fromp__intro">{pickerIntro(list)}</p>
          <Segmented
            label="List"
            value={list}
            onChange={pickList}
            options={FROM_LISTS.map((value) => ({ value, label: LIST_LABEL[value] }))}
            className="fromp__toggle"
          />
        </header>

        <AsyncStatus
          loading={index.loading || outline.loading}
          error={index.error || outline.error || (!index.loading && !index.data) || (!outline.loading && !outline.data)}
          hasData={Boolean(index.data && outline.data)}
          errorMessage="Couldn’t load the map. Try again."
          onRetry={() => {
            index.reload()
            outline.reload()
          }}
        />

        {index.data && outline.data && (
          <div className="fromp__board">
            <Card frame="stamped" label={st ? stateName(st) : 'By state'} className="fromp__map">
              <UsMap
                outline={outline.data}
                has={counts}
                picked={st}
                zones={zones}
                zoneHas={zoneCounts}
                zone={activeZone}
                onState={pickState}
                onZone={pickZone}
              />
              <Cluster as="ul" gap="base" className="fromap__legend t-label" aria-label="Map key">
                <li><span className="fromap__swatch fromap__swatch--has" aria-hidden="true" />{legendHas(list)}</li>
                <li><span className="fromap__swatch fromap__swatch--picked" aria-hidden="true" />Picked</li>
              </Cluster>
              {st && (
                <Stack gap="snug">
                  <Chips label="Zones" layout="wrap" options={chipOptions} value={activeZone ?? ''} onChange={(v) => pickZone(v || null)} />
                  <Button size="control" onClick={() => pickState(null)}>Back to all states</Button>
                </Stack>
              )}
              {list === 'college' && index.data.unplaced?.college > 0 && (
                <p className="fromp__note t-label">{unplacedNote(index.data.unplaced.college)}</p>
              )}
            </Card>

            <Stack gap="loose" className="fromp__side">
              <Stack gap="snug">
                <Stack as="label" gap="tight" className="fromp__field">
                  <span className="t-label">State</span>
                  <select className="fromp__select" value={st ?? ''} onChange={(e) => pickState(e.target.value || null)}>
                    <option value="">All states</option>
                    {STATE_OPTIONS.map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </Stack>
                <Stack as="label" gap="tight" className="fromp__field">
                  <span className="t-label">{search.label}</span>
                  <input
                    className="fromp__search"
                    type="search"
                    value={query}
                    placeholder={search.placeholder}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setShown(PAGE)
                    }}
                  />
                </Stack>
              </Stack>

              <Card frame="stamped" label={tabName} count={view.ready ? countTag(list, view.rows.length) : undefined} body="flush" className="fromp__listcard">
                <div className="fromp__scroll">
                  {view.ready && view.rows.length === 0 ? (
                    <p className="fromp__empty">{emptyList(list, { query: searching, state: st })}</p>
                  ) : (
                    <PlaceList rows={view.rows.slice(0, shown)} />
                  )}
                  {!view.ready && <AsyncStatus loading error={false} hasData={false} />}
                  {view.ready && view.rows.length > shown && (
                    <div className="fromp__more">
                      <Button size="control" onClick={() => setShown(shown + PAGE)}>Show more</Button>
                    </div>
                  )}
                </div>
              </Card>

              {countries.length > 0 && (
                <Card frame="stamped" label="Outside the US" count={countries.length} body="flush" className="fromp__countries">
                  <ul className="fromlist fromp__scroll fromp__scroll--short">
                    {countries.map(([slug, name, n]) => {
                      const props = linkProps(fromCountryPath(slug))
                      return (
                        <li key={slug}>
                          <a className="fromlist__row" href={props.href} onClick={props.onClick}>
                            <Stack gap="tight" className="fromlist__text"><span className="fromlist__name">{name}</span></Stack>
                            <span className="fromlist__count">{n}</span>
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              )}
            </Stack>
          </div>
        )}

        <footer className="fromp__foot t-label">
          <p>{footnote(list)}</p>
          {creditsFor(list).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </footer>
      </Stack>
      <ReportFooter />
    </div>
  )
}
