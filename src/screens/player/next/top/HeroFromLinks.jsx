import { Fragment } from 'react'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { fetchFromHsSplit } from '../../../../api/from/whereFrom.js'
import { playerFromLinks } from '../../../../lib/from/playerLinks.js'

// The hero's Born and School cells as links to "who else is from there" (#1526): the town's
// or the school's page on the Where they're from pages. An open surface (ADR-0034): a school
// or a birthplace says nothing about a game.

// The addresses for one player. A high school with a state needs the small "shared names" file to
// name its address, so that school stays plain text until it loads (and when it cannot load).
export function useFromLinks(bio) {
  const needsSplit = bio.schools.some((s) => s.kind === 'high-school' && s.state)
  const split = useAsync(() => (needsSplit ? fetchFromHsSplit() : Promise.resolve(null)), [bio.id, needsSplit])
  return playerFromLinks(bio, split.data ? new Set(split.data) : null)
}

// A place's name, linked when it has an address.
function FromLink({ path, children }) {
  const linkProps = useRouteLink()
  if (!path) return children
  const props = linkProps(path)
  return (
    <a className="plink" href={props.href} onClick={props.onClick}>
      {children}
    </a>
  )
}

export function BornValue({ links, text }) {
  return <FromLink path={links.born}>{text}</FromLink>
}

// "Smyrna, Vanderbilt": each school its own link (a school with no address stays plain text).
export function SchoolsValue({ links }) {
  return links.schools.map((s, i) => (
    <Fragment key={`${s.kind}/${s.name}`}>
      {i > 0 && ', '}
      <FromLink path={s.path}>{s.name}</FromLink>
    </Fragment>
  ))
}
