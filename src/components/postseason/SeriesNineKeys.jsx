import '../../styles/postseason/series-parts.css'
import { isFailedKey, keysVerdict, nineKeysTeams } from '../../lib/postseason/keysVerdict.js'
import { ordinal } from '../../lib/format.js'
import { teamAbbr } from '../../lib/teams.js'
import { Door } from '../ui/control/Door.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Table } from '../ui/table/Table.jsx'
import { InfoPopover } from '../ui/InfoPopover.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { useRouteLink } from '../../lib/nav.js'

// NINE KEYS (series page): where each club ranked among the 30 on nine
// season-long measures, which keys it failed, and whether it sits inside the
// rule no champion since the file's first season has broken. The data is the
// Nine Keys report's own static file (api/nineKeys.js); this is a two-club cut
// of it.
//
// No spoiler surface: a regular-season rank carries no postseason game and no
// score (the same footing as Standings, ADR-0034). A failed key is a rank worse
// than the file's `bar` (15 of 30), the test NineKeysPage uses.
//
//   data    loadNineKeys()'s shape: { keys, bar, limit, firstSeason, current }
//   clubs   [{ id }, { id }], the left club then the right club
//   season  the series' season; the section shows only for that season's file
export function SeriesNineKeys({ data, clubs, season }) {
  const routeLink = useRouteLink()
  const teams = nineKeysTeams(data, clubs, season)
  if (!teams) return null
  const [a, b] = teams
  const bar = data.bar
  const failed = (t, key) => isFailedKey(t.ranks?.[key], bar)
  const abbr = (id) => teamAbbr({ id })
  const verdict = keysVerdict(
    { abbr: abbr(a.teamId), failed: a.failed?.length ?? 0 },
    { abbr: abbr(b.teamId), failed: b.failed?.length ?? 0 },
    { limit: data.limit, firstSeason: data.firstSeason },
  )
  // A rank's place on the 1-to-30 track, in percent.
  const at = (rank) => `${((Math.min(Math.max(rank, 1), 30) - 1) / 29) * 100}%`
  return (
    <section className="psseries__keyssection">
      <Card frame="stamped" label="Nine keys" labelAs="h2" as="div" className="psseries__keys">
        <Table frame="bare" density="keep" className="psseries__keystable">
          <caption className="sr-only">
            Nine Keys ranks out of 30, {abbr(a.teamId)} and {abbr(b.teamId)}
          </caption>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">
                <TeamLogo teamId={a.teamId} size={14} className="psseries__keyhead" />
                {abbr(a.teamId)}
              </th>
              <th scope="col">
                <TeamLogo teamId={b.teamId} size={14} className="psseries__keyhead" />
                {abbr(b.teamId)}
              </th>
              <td aria-hidden="true" className="psseries__keyscale">
                <span>1st</span>
                <span>30th</span>
              </td>
            </tr>
          </thead>
          <tbody>
            {data.keys.map((k) => (
              <tr key={k.id} className="psseries__keyrow">
                <th scope="row" className="psseries__keylabel" title={k.note}>
                  {k.label}
                </th>
                <Rank rank={a.ranks?.[k.id]} fail={failed(a, k.id)} />
                <Rank rank={b.ranks?.[k.id]} fail={failed(b, k.id)} />
                <td className="psseries__keytrack" aria-hidden="true">
                  <span className="psseries__keyline">
                    <span className="psseries__keybar" style={{ left: at(bar) }} />
                    <KeyDot rank={a.ranks?.[k.id]} teamId={a.teamId} side="away" at={at} />
                    <KeyDot rank={b.ranks?.[k.id]} teamId={b.teamId} side="home" at={at} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Cluster align="center" className="psseries__keyfoot">
          <p className="psseries__keytally">
            Failed · {abbr(a.teamId)} {a.failed?.length ?? 0} · {abbr(b.teamId)} {b.failed?.length ?? 0}
            <InfoPopover label="What the failed-key count means" className="psseries__keyverdict infopop--paper">
              {verdict}
            </InfoPopover>
          </p>
          <Door {...routeLink('/nine-keys')}>Full report</Door>
        </Cluster>
      </Card>
    </section>
  )
}

// No rank on file: no mark on the track (the rank cell says "—").
function KeyDot({ rank, teamId, side, at }) {
  if (rank == null) return null
  return (
    <span className={`psseries__keydot psseries__keydot--${side}`} style={{ left: at(rank) }}>
      <TeamLogo teamId={teamId} size={18} />
    </span>
  )
}

function Rank({ rank, fail }) {
  if (rank == null) return <td className="psseries__keyrank psseries__keyrank--fail">—</td>
  return (
    <td className={`psseries__keyrank${fail ? ' psseries__keyrank--fail' : ''}`}>
      {ordinal(rank)}
      {fail && <span className="sr-only"> (failed)</span>}
    </td>
  )
}
