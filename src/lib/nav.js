import { createContext, useContext } from 'react'

// Contexts + hooks for the deep name/team links (providers live in nav.jsx —
// split out so each file exports one kind of thing and Fast Refresh stays happy).
//
// NavContext carries the App's History-API `go`, so a PlayerLink/TeamLink
// anywhere in the tree can navigate without a threaded prop. ScopeContext
// carries what a link should stamp onto its target: `sportId` (a level hint for
// the fetch layer) and `asOf` (the `?d=` as-of cutoff).
//
// `asOf` here is now only ever PROPAGATION — a page that was itself opened at a
// dated URL keeps its links dated, so one visit gives one answer. It is no
// longer INJECTION: `GameView` used to supply the current game's officialDate,
// stamping a cutoff on every link out of a game, and stopped on 2026-08-06
// (ADR-0034, "The cutoff is opt-in now"). Stats surfaces open live. Empty off a
// game, and empty on a game too.
export const NavContext = createContext(() => {})
export const ScopeContext = createContext({})

export function useNav() {
  return useContext(NavContext)
}

export function useLinkScope() {
  return useContext(ScopeContext)
}

// A real anchor beats a button for navigation. `<button onClick={navigate}>`
// silently swallows middle-click, cmd/ctrl-click, "open link in new tab", and
// the browser's own status-bar destination preview — every one of which a
// reader expects from something that looks like a link. This returns the props
// to spread onto an `<a>`, so those gestures reach the browser while a plain
// left-click still becomes a client-side push with no page load.
//
// A `/learn` path is deliberately NOT intercepted: the guides are
// server-rendered documents outside the React app (ADR-0053), and pushing one
// through the client router would paint the SPA over a document the server
// already sent. Those links are ordinary navigations, on purpose.
export function useRouteLink() {
  const navigate = useNav()
  return function linkProps(path) {
    return {
      href: path,
      onClick(event) {
        if (event.defaultPrevented) return
        if (path.startsWith('/learn')) return
        // Anything but an unmodified primary click is the reader asking the
        // browser for something we are not being asked to do.
        if (event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(path)
      },
    }
  }
}

// The name a link should put in its own address, read off the children it is
// already rendering. Deep links here wrap a name — `<PlayerLink>Mike
// Trout</PlayerLink>` — so the slug the URL wants is usually sitting right
// there, and borrowing it means the address gets a name without ~40 call sites
// each learning to pass one (route.js `entitySegment`, ADR-0057).
//
// Deliberately SHALLOW, and deliberately conservative. It reads a string child,
// or the string parts of an array of children, and nothing else: it does not
// walk into elements, because a link whose children are markup is a link whose
// caller knows the name and can pass `name=` for a fraction of the cost of a
// recursive walk that runs on every render. Anything with no letters in it (a
// uniform number, a lone bullet) returns '', and the link falls back to the bare
// id — a wrong name in an address is worse than no name.
export function nameFromChildren(children) {
  const text =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.filter((c) => typeof c === 'string').join(' ')
        : ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return /[a-z]/i.test(clean) ? spokenOrder(clean) : ''
}

// A scorebook sorts names, so half this app PRINTS 'Skenes, Paul' — the lineup
// card, the roster panel, the bullpen board, the pitcher handoff. An address is
// read aloud, and 'skenes-paul' is not how anybody says or searches that name,
// so the borrow above flips the sorted spelling back.
//
// This lives here rather than at each call site because the distortion is
// SYSTEMATIC: every surface that prints a sorted name is a surface whose link
// would carry a backwards one, including the next one somebody writes. A name
// with no comma is returned untouched, which is every club and most people.
// 'Griffey Jr., Ken' comes back 'Ken Griffey Jr.', because the suffix belongs to
// the surname half and stays with it.
const SORTED_NAME = /^([^,]+?)\s*,\s*(.+)$/
function spokenOrder(name) {
  const m = SORTED_NAME.exec(name)
  return m ? `${m[2]} ${m[1]}` : name
}
