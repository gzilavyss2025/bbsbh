import '../../styles/from/page.css'
import '../../styles/from/place.css'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useViewOnce } from '../../hooks/motion/useViewOnce.js'
import { useRouteLink } from '../../lib/nav.js'
import { fetchFromMap, fetchFromPlace } from '../../api/from/whereFrom.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { EmptyState } from '../../components/ui/state/EmptyState.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { FROM_TITLE, creditsFor, footnote, placeIntro, placeMissing } from '../../lib/from/copy.js'
import { decadeGroups, placeFacts, placeSubtitle } from '../../lib/from/facts.js'
import { fromPath } from '../../lib/from/path.js'
import { placeKey } from '../../lib/from/route.js'
import { DecadeList } from './DecadeList.jsx'
import { PlaceHero } from './PlaceHero.jsx'

// One place of "Where they're from" (#1526): every big leaguer who played at one school or was born
// in one town, by the decade of his MLB debut. `route` is the parsed address (src/lib/from/route.js).
// An open page (ADR-0034): schools and birthplaces, no score, no SealBox.
export function FromPlacePage({ route }) {
  const linkProps = useRouteLink()
  const key = placeKey(route)
  const found = useAsync(() => fetchFromPlace(route), [key])
  // The 57 KB outline is for the locator, so a place with no state on the map never fetches it.
  const mapState = found.data?.state ?? null
  const outline = useAsync(() => (mapState ? fetchFromMap() : Promise.resolve(null)), [mapState])
  // A place with no players has nothing to show: it reads as no place, never as a blank page.
  const place = found.data?.place?.players?.length ? found.data.place : null
  const list = route.kind === 'abroad' ? 'hometown' : route.kind
  useDocumentTitle(place ? `${place.name} · ${FROM_TITLE}` : FROM_TITLE)
  const still = useViewOnce(key, 'from-place', Boolean(place))
  const picker = linkProps(fromPath({ list }))
  const facts = place ? placeFacts(place.players) : null

  return (
    <div className="screen">
      <SiteHeader />
      <Stack gap="section" className="fromp">
        <header className="fromp__head">
          <h1 className="fromp__title">{FROM_TITLE}</h1>
          <p className="fromp__intro">{placeIntro(list)}</p>
        </header>

        <AsyncStatus loading={found.loading} error={found.error} hasData={Boolean(place)} errorMessage="Couldn’t load this place. Check your connection, then reload the page." />
        {!found.loading && !found.error && !place && (
          <EmptyState action={<Door href={picker.href} onClick={picker.onClick}>Back to the picker</Door>}>{placeMissing}</EmptyState>
        )}

        {place && facts && (
          <>
            <PlaceHero
              place={place}
              facts={facts}
              list={list}
              state={found.data.state}
              outline={outline.data}
              still={still}
              subtitle={placeSubtitle(route.kind, { name: place.name, city: place.city, state: found.data.state ?? place.state, countryName: found.data.countryName })}
            />
            <DecadeList groups={decadeGroups(place.players)} />
          </>
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
