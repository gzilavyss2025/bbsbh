import { keysVerdict } from '../../lib/postseason/keysVerdict.js'
import { ordinal } from '../../lib/format.js'
import { teamAbbr } from '../../lib/teams.js'
import { Door } from '../ui/control/Door.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'
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
  const current = data?.current
  const [a, b] = clubs.map((c) => current?.teams?.find((t) => t.teamId === c.id))
  if (!a || !b || current.season !== season || !data.keys?.length) return null
  const bar = data.bar
  const failed = (t, key) => t.ranks?.[key] == null || t.ranks[key] > bar
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
      <SectionHead look="label" action={<Door {...routeLink('/nine-keys')}>Full report</Door>}>
        Nine Keys
      </SectionHead>
      <Card as="div" body="flush" className="psseries__keys">
        <table className="psseries__keystable">
          <caption className="sr-only">
            Nine Keys ranks out of 30, {abbr(a.teamId)} and {abbr(b.teamId)}
          </caption>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">{abbr(a.teamId)}</th>
              <td aria-hidden="true" className="psseries__keyscale">
                <span>1st</span>
                <span>30th</span>
              </td>
              <th scope="col">{abbr(b.teamId)}</th>
            </tr>
          </thead>
          <tbody>
            {data.keys.map((k) => (
              <tr key={k.id} className="psseries__keyrow">
                <th scope="row" className="psseries__keylabel" title={k.note}>
                  {k.label}
                </th>
                <Rank rank={a.ranks?.[k.id]} fail={failed(a, k.id)} />
                <td className="psseries__keytrack" aria-hidden="true">
                  <span className="psseries__keyline">
                    <span className="psseries__keybar" style={{ left: at(bar) }} />
                    <KeyDot rank={a.ranks?.[k.id]} side="away" at={at} />
                    <KeyDot rank={b.ranks?.[k.id]} side="home" at={at} />
                  </span>
                </td>
                <Rank rank={b.ranks?.[k.id]} fail={failed(b, k.id)} />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="psseries__keytally">
          Failed · {abbr(a.teamId)} {a.failed?.length ?? 0} · {abbr(b.teamId)} {b.failed?.length ?? 0}
        </p>
        <p className="psseries__keyverdict">{verdict}</p>
      </Card>
    </section>
  )
}

// No rank on file: no mark on the track (the rank cell says "—").
function KeyDot({ rank, side, at }) {
  if (rank == null) return null
  return <span className={`psseries__keydot psseries__keydot--${side}`} style={{ left: at(rank) }} />
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
