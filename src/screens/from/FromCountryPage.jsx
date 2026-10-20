import '../../styles/from/page.css'
import '../../styles/from/list.css'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useRouteLink } from '../../lib/nav.js'
import { fetchFromCountry } from '../../api/from/whereFrom.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { EmptyState } from '../../components/ui/state/EmptyState.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { FROM_TITLE, countTag, creditsFor, footnote, placeMissing } from '../../lib/from/copy.js'
import { fromPath } from '../../lib/from/path.js'
import { PlaceList } from './PlaceList.jsx'

// One country's towns (#1526, `/from/country/{country}`): every town outside the US where a big
// leaguer was born, the biggest first. Each opens that town's place page.
export function FromCountryPage({ country }) {
  const linkProps = useRouteLink()
  const found = useAsync(() => fetchFromCountry(country), [country])
  const data = found.data
  useDocumentTitle(data ? `${data.name} · ${FROM_TITLE}` : FROM_TITLE)
  const picker = linkProps(fromPath({ list: 'hometown' }))
  const rows = (data?.places ?? [])
    .map((p) => ({ key: p.slug, place: { kind: 'abroad', country, slug: p.slug }, name: p.name, count: p.players.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return (
    <div className="screen">
      <SiteHeader />
      <Stack gap="section" className="fromp">
        <header className="fromp__head">
          <h1 className="fromp__title">{FROM_TITLE}</h1>
          <p className="fromp__intro">{data ? `Every town in ${data.name} where a big leaguer was born.` : 'Every big leaguer born outside the US.'}</p>
        </header>
        <AsyncStatus loading={found.loading} error={found.error} hasData={Boolean(data)} errorMessage="Couldn’t load this country. Check your connection, then reload the page." />
        {!found.loading && !found.error && !data && (
          <EmptyState action={<Door href={picker.href} onClick={picker.onClick}>Back to the picker</Door>}>{placeMissing}</EmptyState>
        )}
        {data && (
          <Card frame="stamped" label={data.name} count={countTag('hometown', rows.length)} body="flush" className="fromp__listcard">
            <PlaceList rows={rows} />
          </Card>
        )}
        <footer className="fromp__foot t-label">
          <p>{footnote('hometown')}</p>
          {creditsFor('hometown').map((line) => (
            <p key={line}>{line}</p>
          ))}
        </footer>
      </Stack>
      <ReportFooter />
    </div>
  )
}
