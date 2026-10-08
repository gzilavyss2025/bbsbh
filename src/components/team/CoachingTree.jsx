import { Card } from '../ui/frame/Card.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { ManagerLink } from './ManagerLink.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'

// A long career lists dozens of people; the rest wait behind a native <details>.
const SHOWN = 12

// The manager page's coaching-tree band, two rows deep: the manager on top, the
// people who held a staff job under them below. `staff` is coachedUnder()'s
// output, most seasons together first. A person who later managed links to their
// own manager page and wears the mark; the rest link to the player page.
// Renders nothing for a manager with no staff on file. Open surface: no score,
// no SealBox.
export function CoachingTree({ name, staff }) {
  if (!staff?.length) return null
  return (
    <Card body="flush" className="mgrpage__card coachtree">
      <h2 className="mgrpage__cardtitle">Coaching tree</h2>
      <div className="coachtree__top">{name}</div>
      <div className="coachtree__stem" aria-hidden="true" />
      <Row staff={staff.slice(0, SHOWN)} />
      {staff.length > SHOWN && (
        <details className="coachtree__more">
          <summary>{staff.length - SHOWN} more</summary>
          <Row staff={staff.slice(SHOWN)} />
        </details>
      )}
    </Card>
  )
}

function Row({ staff }) {
  return (
    <ul className="coachtree__row">
      {staff.map((p) => {
        const Link = p.laterManaged ? ManagerLink : PlayerLink
        return (
          <Stack as="li" gap="tight" key={p.personId} className="coachtree__node">
            <Link id={p.personId} name={p.name || undefined} className="coachtree__name">
              {p.name || 'Coach'}
            </Link>
            <span className="coachtree__meta">
              {p.seasons} {p.seasons === 1 ? 'season' : 'seasons'}
              {p.laterManaged && <b> → manager</b>}
            </span>
          </Stack>
        )
      })}
    </ul>
  )
}
