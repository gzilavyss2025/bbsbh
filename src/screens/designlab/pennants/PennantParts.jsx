import { LeaguePennant } from '../../../components/honors/LeaguePennant.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { Cluster } from '../../../components/ui/layout/Cluster.jsx'
import { Grid } from '../../../components/ui/layout/Grid.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'
import { Entry } from '../Entry.jsx'

// Real shared art, with fixed historical champions and no live game data.
// The explicit Milwaukee logo URL exercises caller-supplied art. It is the
// current mono mark, not a claim that this was the club's 1982 banner art.
const CLUBS = [
  {
    teamId: 158, season: 1982, league: 'AL', teamName: 'Milwaukee Brewers',
    clubLabel: 'Milwaukee', abbreviation: 'MIL', logoUrl: '/data/logos/mono/158.svg',
    palette: { field: '#142c49', border: '#c89737', ink: '#f1e7cc', year: '#c89737' },
  },
  {
    teamId: 121, season: 1986, league: 'NL', teamName: 'New York Mets',
    clubLabel: 'New York', abbreviation: 'NYM',
    palette: { field: '#164b8b', border: '#bd5929', ink: '#f1e7cc', year: '#f1e7cc' },
  },
  {
    teamId: 147, season: 2009, league: 'AL', teamName: 'New York Yankees',
    clubLabel: 'New York', abbreviation: 'NYY',
    palette: { field: '#1b2c42', border: '#d6caa6', ink: '#f1e7cc', year: '#f1e7cc' },
  },
]
const YANKEES = CLUBS[2]
const TEAM_SEASONS = [1996, 1998, 2000, 2009]

export function PennantParts() {
  return (
    <Stack gap="section" style={{ width: '100%', minWidth: 0 }}>
      <Entry
        title="Season variants · full"
        path="src/components/honors/LeaguePennant.jsx"
        note="Current one-color club marks illustrate the component. These are not reproductions of historical banner artwork. Milwaukee supplies an explicit logo URL; its 1982 league is AL."
        wide
      >
        <Grid min="12rem" gap="loose" style={{ width: '100%' }}>
          {CLUBS.map((club) => (
            <Stack gap="snug" key={club.teamId}>
              <LeaguePennant {...club} width={160} />
              <p className="dlabentry__note">
                {club.teamName} · {club.season} · {club.league} champions
              </p>
            </Stack>
          ))}
        </Grid>
      </Entry>

      <Entry
        title="Team page · compact collection"
        note="The same club repeats across seasons. Each pennant keeps its own year and accessible championship label."
        wide
      >
        <Card frame="ledger">
          <Stack gap="base">
            <h4 className="dlab__entrytitle">New York Yankees · league champions</h4>
            <Cluster gap="base" align="start">
              {TEAM_SEASONS.map((season) => (
                <LeaguePennant {...YANKEES} key={season} season={season} variant="compact" width={84} />
              ))}
            </Cluster>
          </Stack>
        </Card>
      </Entry>

      <Entry
        title="Player page · one season"
        note="The adjacent caption names the honor, so this pennant uses decorative mode. This is a placement example, not a player-data integration."
        wide
      >
        <Card frame="ledger">
          <Cluster gap="base" align="center">
            <LeaguePennant {...YANKEES} variant="compact" width={96} decorative />
            <Stack gap="tight">
              <h4 className="dlab__entrytitle">Derek Jeter · 2009</h4>
              <p className="dlabentry__note">New York Yankees · American League champions</p>
            </Stack>
          </Cluster>
        </Card>
      </Entry>

      <Entry
        title="Lettering and logo fallback"
        note="The script option uses Yellowtail for the club label. A null logo URL draws the supplied abbreviation without a logo request."
        wide
      >
        <Grid min="12rem" gap="loose" style={{ width: '100%' }}>
          <Stack gap="snug">
            <LeaguePennant {...CLUBS[0]} clubLabel="Brewers" lettering="script" width={160} />
            <p className="dlabentry__note">Yellowtail club label</p>
          </Stack>
          <Stack gap="snug">
            <LeaguePennant {...CLUBS[1]} logoUrl={null} width={160} />
            <p className="dlabentry__note">No logo · abbreviation fallback</p>
          </Stack>
        </Grid>
      </Entry>
    </Stack>
  )
}
