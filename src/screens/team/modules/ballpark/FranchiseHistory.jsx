import '../../../../styles/57a-franchise-history.css'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { leagueLogoUrl } from '../../../../lib/teams.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { teamSeasonPath, teamTabPath } from '../../../../lib/route.js'
import { eraSeason } from '../../../../api/history/franchiseSeasons.js'

// The club's history under the Ballpark card, one module: a strip of names,
// leagues and parks by season, then a line for each park. Open
// (names and parks, no game). The data starts in 1901, so a park line says
// "seasons in this data", never "opened" (src/api/history/franchiseSeasons.js).
// MLB only: a MiLB id has no file, `spans` is empty, and nothing renders.

// The league's own mark in place of its name (Gary, 2026-10-30); any other league stays a word.
const LEAGUE_ID = { 'American League': 103, 'National League': 104 }

const years = (from, to) => (from === to ? `${from}` : `${from}–${to}`)
// A span or park still running in the last season of the file reads "from on".
const run = (from, to, through) => (to === through ? `${from} on` : years(from, to))

// Each era is a door to its LAST season (`?y=`); the era still running opens the live page (#2779;
// Gary, 2026-11-05; eraSeason). The card's foot is the door to the franchise page (#2786). Both
// keep the page's `asOf`. `team` names the club; without it the card draws no links.
// `cardProps`: the one-scroll page's stamped frame and name tab (props for Card); without it, the band head.
export function FranchiseHistory({ spans, parks, through, team, asOf, cardProps }) {
  const link = useRouteLink()
  if (!spans?.length) return null
  const eraHref = (s) => {
    const season = eraSeason(s, through)
    return season == null ? teamTabPath(team.id, 'overview', { name: team.name }) : teamSeasonPath(team.id, season, { name: team.name, asOf })
  }
  return (
    <Card {...(cardProps ?? { head: <SectionHead look="band" club>Franchise history</SectionHead> })} className="fhist">
      <ol className="fhist__strip">
        {spans.map((s) => {
          const body = (
            <>
              <span className="fhist__years">{run(s.from, s.to, through)}</span>
              <span className="fhist__name">{s.name}</span>
              {LEAGUE_ID[s.league]
                ? <img className="fhist__leaguelogo" src={leagueLogoUrl(LEAGUE_ID[s.league])} alt={s.league} width="32" height="32" />
                : <span className="fhist__league">{s.league}</span>}
              {s.venueName && <span className="fhist__park">{s.venueName}</span>}
            </>
          )
          return (
            <Stack gap="tight" as="li" key={s.from} className="fhist__span">
              {team ? (
                <a className="fhist__era" {...link(eraHref(s))}>
                  {body}
                </a>
              ) : (
                body
              )}
            </Stack>
          )
        })}
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
      {team && (
        <Door className="fhist__door" {...link(teamTabPath(team.id, 'franchise', { name: team.name, d: asOf }))}>
          Franchise page
        </Door>
      )}
    </Card>
  )
}
