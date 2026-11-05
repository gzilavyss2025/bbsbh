import { Card } from '../../../../components/ui/frame/Card.jsx'
import { useRouteLink } from '../../../../lib/nav.js'
import { playerPath } from '../../../../lib/route.js'
import { clubPeople, retiredTiles } from './peopleView.js'

// The club's retired numbers as tiles (#2784, store #2598): the number, the name, the year. A
// manager, executive or other gets a small role tag. A player tile links to the player page when
// the club's own files know his id (retiredTiles). Jackie Robinson's 42 is one league-wide line.
const ROLE = { manager: 'Manager', executive: 'Executive', other: 'Honoree' }

export function RetiredNumbers({ retired, hof, leaders }) {
  const link = useRouteLink()
  const tiles = retiredTiles(retired?.numbers, clubPeople(hof, leaders))
  const league = retired?.league ?? []
  if (!tiles.length && !league.length) return null
  return (
    <Card frame="stamped" label="Retired numbers" labelAs="h3" count={String(tiles.length + league.length)} className="frnums">
      {tiles.length > 0 && (
        <ul className="frnums__grid">
          {tiles.map((t) => {
            const body = (
              <>
                <span className="frnums__number">{t.number}</span>
                <span className="frnums__name">{t.name}</span>
                {t.year && <span className="frnums__year">{t.year}</span>}
                {t.role && <span className="frnums__role t-label">{ROLE[t.role] ?? t.role}</span>}
              </>
            )
            return (
              <li key={`${t.number}-${t.name}`} className="frnums__tile">
                {t.playerId ? (
                  <a className="frnums__link" {...link(playerPath(t.playerId, { name: t.name }))}>
                    {body}
                  </a>
                ) : (
                  <span className="frnums__link">{body}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {league.map((n) => (
        <p key={n.number} className="frnums__league">
          <b>{n.number}</b> {n.name} · retired across MLB in {n.year}.
        </p>
      ))}
    </Card>
  )
}
