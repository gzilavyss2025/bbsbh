import '../../../../styles/57a-franchise-history.css'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'

// The club's history under the Ballpark card, one module: a strip of names,
// leagues and parks by season, then a line for each park. Spoiler-free and open
// (names and parks, no game). The data starts in 1901, so a park line says
// "seasons in this data", never "opened" (src/api/franchiseHistory.js).
// MLB only: a MiLB id has no file, `spans` is empty, and nothing renders.

const years = (from, to) => (from === to ? `${from}` : `${from}–${to}`)
// A span or park still running in the last season of the file reads "from on".
const run = (from, to, through) => (to === through ? `${from} on` : years(from, to))

export function FranchiseHistory({ spans, parks, through }) {
  if (!spans?.length) return null
  return (
    <Card head={<SectionHead look="band" club>Franchise history</SectionHead>} className="fhist">
      <ol className="fhist__strip">
        {spans.map((s) => (
          <Stack gap="tight" as="li" key={s.from} className="fhist__span">
            <span className="fhist__years">{run(s.from, s.to, through)}</span>
            <span className="fhist__name">{s.name}</span>
            <span className="fhist__league">{s.league}</span>
            {s.venueName && <span className="fhist__park">{s.venueName}</span>}
          </Stack>
        ))}
      </ol>
      <Stack as="ul" className="fhist__parks">
        {parks.map((p) => (
          <Stack gap="tight" as="li" key={p.venueId} className="fhist__parkline">
            <span className="fhist__parkname">{p.names.join(', ')}</span>
            <span className="fhist__parkyears">
              Seasons in this data: {p.runs.map(([a, b]) => run(a, b, through)).join(', ')}
            </span>
            {p.mates.length > 0 && (
              <span className="fhist__parkmates">
                Also used by{' '}
                {p.mates.map((m) => `${m.name} ${run(m.from, m.to, through)}`).join(', ')}
              </span>
            )}
          </Stack>
        ))}
      </Stack>
    </Card>
  )
}
