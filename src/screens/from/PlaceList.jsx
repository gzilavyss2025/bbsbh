import { useRouteLink } from '../../lib/nav.js'
import { fromPlacePath } from '../../lib/from/path.js'
import { Stack } from '../../components/ui/layout/Stack.jsx'

// One list of places: a name, a line under it, and how many big leaguers (#1526). Each row is
// a real link to the place's page. `rows` are { key, place, name, line, count? } and the caller
// decides what shows, so the same list serves search, a state's shard and the A to Z list.
export function PlaceList({ rows }) {
  const linkProps = useRouteLink()
  return (
    <ul className="fromlist">
      {rows.map((r) => {
        const props = linkProps(fromPlacePath(r.place))
        return (
          <li key={r.key}>
            <a className="fromlist__row" href={props.href} onClick={props.onClick}>
              <Stack gap="tight" className="fromlist__text">
                <span className="fromlist__name">{r.name}</span>
                {r.line && <span className="fromlist__line t-label">{r.line}</span>}
              </Stack>
              {r.count != null && <span className="fromlist__count">{r.count}</span>}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
