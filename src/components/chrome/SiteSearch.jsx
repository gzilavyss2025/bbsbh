import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { searchPeople, fetchTeamDirectory, searchTeams } from '../../api/search.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { useRecentSearches } from '../../hooks/useRecentSearches.js'
import { useVisualViewport } from '../../hooks/useVisualViewport.js'
import { useNav } from '../../lib/nav.js'
import { playerPath, teamPath } from '../../lib/route.js'
import { SPORT_LABEL } from '../../lib/teams.js'
import { Headshot } from '../player/Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// The site-wide search trigger — a persistent icon button (not an always-open
// input; on a phone-width header there's no room to dock one, and this is the
// mobile-standard pattern anyway) that opens SiteSearchModal. Lives in
// SiteHeader (every screen except the slate) and the slate's own topbar (see
// GameSelect), so it's reachable from anywhere in the app.
export function SiteSearchButton({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`sitesearch-btn ${className}`}
        onClick={() => setOpen(true)}
        aria-label="Search players and teams"
      >
        <SearchGlyph />
      </button>
      {/* Rendered in place, NOT through ModalPortal: both hosts (SiteHeader and
          the slate topbar) are already in the root stacking context, and the
          ALL-CAPS invariant is a `#root *` rule — a portal to <body> would land
          the whole search surface outside it and quietly break the app's casing
          (see the Clerk note in index.css). */}
      {open && <SiteSearchModal onClose={() => setOpen(false)} />}
    </>
  )
}

function SearchGlyph({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
      <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Two letters before anything is fetched — the people endpoint returns
// thousands of rows for one, and `searchPeople` refuses it anyway.
const MIN_QUERY = 2
// Short enough that the list feels attached to the thumb, long enough that a
// normal typing burst is one request rather than six.
const SEARCH_DEBOUNCE_MS = 180
const PLAYER_LIMIT = 10
const TEAM_LIMIT = 6
// A stable empty list, so "no query, nothing to show" is the same reference
// every render — see the sticky-results note in SiteSearchModal.
const NO_PLAYERS = []

// One box, two kinds of result — merges what used to be the footer's separate
// PlayerSearchBox and TeamSearchBox into a single site-wide lookup.
//
// ---------------------------------------------------------------------------
// Why this is a full-screen surface and NOT the app's shared `.scrim`/`.sheet`
// bottom-sheet dialog (GameFinderModal, SiteMenuModal, HighlightSheet, …).
// Read this before "restoring consistency":
//
// A docked bottom sheet is laid out against the LAYOUT viewport, which an
// on-screen keyboard does not shrink. So the moment the field took focus — the
// entire point of the surface — the sheet sat underneath the keyboard: input,
// hint and every result rendered, focused, and invisible. That is not a styling
// nit a taller `max-height` fixes; the sheet's anchor is in the wrong place.
// Every mobile search that works (Safari, the App Store, Maps) puts the field
// at the TOP of the screen and grows results downward, so the keyboard covers
// only the tail of a scrollable list and never the field.
//
// The three mechanisms that make that hold:
//   • `useVisualViewport` sizes this overlay to the visible rectangle and
//     translates it past any scroll the browser did to reveal the field, so the
//     surface ends exactly where the keyboard begins — on iOS, where nothing in
//     CSS can express that (see the hook's header).
//   • the document is scroll-locked while it's open, so a flick that runs off
//     the end of the results can't drag the page behind it.
//   • a result row cancels its own `pointerdown`. Without that the press blurs
//     the input, the keyboard retracts, the layout grows by ~300px, and the
//     release lands on whatever row slid under the finger — the worst class of
//     mobile bug, because it opens the WRONG player and reads as a mis-tap.
//
// It keeps the rest of the dialog contract: Escape closes, focus moves to the
// field on open and back to the trigger on close.
// ---------------------------------------------------------------------------
export function SiteSearchModal({ onClose }) {
  const navigate = useNav()
  const { recent, remember, clear } = useRecentSearches()
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const hasQuery = trimmed.length >= MIN_QUERY
  const debounced = useDebouncedValue(hasQuery ? trimmed : '', SEARCH_DEBOUNCE_MS)

  const people = useAsync(() => searchPeople(debounced, PLAYER_LIMIT), [debounced])
  const directory = useAsync(fetchTeamDirectory, [])

  // Hold the previous query's rows while the next request is in flight instead
  // of blanking to a spinner. Typing a name is a series of near-identical
  // queries, so a list that empties and refills on every keystroke reads as the
  // app losing its place; one that updates underneath the cursor reads as fast.
  // The progress hairline under the field is what says "still working".
  //
  // Adjusted during render (React's documented "adjust state while rendering"
  // escape hatch, the same shape Headshot.jsx uses to reset its fallback rung)
  // rather than in an effect, so a settled request never paints one frame of
  // stale rows first. NO_PLAYERS is a module constant precisely so the
  // cleared-out case is reference-stable and this can't loop.
  const [players, setPlayers] = useState(NO_PLAYERS)
  const nextPlayers = hasQuery ? people.data : NO_PLAYERS
  if (nextPlayers && nextPlayers !== players) setPlayers(nextPlayers)

  // Clubs are filtered in memory from a directory fetched once per session, so
  // they answer the LIVE query rather than the debounced one — there is no
  // request to spare, and waiting on the debounce just to filter an array
  // already in hand would make the screen feel slower than the thumb driving it.
  const teams = useMemo(
    () => (hasQuery ? searchTeams(directory.data ?? [], trimmed, TEAM_LIMIT) : []),
    [directory.data, hasQuery, trimmed],
  )

  const searching = hasQuery && (people.loading || debounced !== trimmed)

  // Clubs go first when the query starts a WORD of a club's name — "brew",
  // "iron", "yank". That's an unambiguous hit on a closed list of ~150 clubs,
  // while the people endpoint answers a fuzzier question and will happily
  // return a dozen namesakes for the same letters. Any other query keeps people
  // first, which is what a search box on a baseball app is usually for.
  //
  // Per WORD, not per name: a club is stored city-first ("Milwaukee Brewers",
  // "Lehigh Valley IronPigs") and nobody types the city — matching the head of
  // the whole string would miss every nickname, which is to say every query
  // this rule exists for.
  // Case folding for a COMPARISON — neither value is rendered, so the global
  // uppercase invariant isn't in play here.
  const lowered = trimmed.toLowerCase() // caps-js-exempt
  const teamsFirst = teams.some((t) =>
    (t.name ?? '')
      .toLowerCase() // caps-js-exempt
      .split(/\s+/)
      .some((word) => word.startsWith(lowered)),
  )

  const groups = useMemo(() => {
    if (!hasQuery) {
      return recent.length ? [{ id: 'recent', label: 'Recent', rows: recent.map(toRow) }] : []
    }
    const playerGroup = { id: 'players', label: 'Players', rows: players.map(playerRow) }
    const teamGroup = { id: 'teams', label: 'Teams', rows: teams.map(teamRow) }
    const ordered = teamsFirst ? [teamGroup, playerGroup] : [playerGroup, teamGroup]
    return ordered.filter((g) => g.rows.length > 0)
  }, [hasQuery, players, teams, teamsFirst, recent])

  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups])
  const noResults = hasQuery && !searching && rows.length === 0

  // Which row the return key and arrow keys act on. Reset to the top whenever
  // the list itself changes — keyed on the row identities rather than the array
  // reference, so a re-render that produced the same rows doesn't yank the
  // highlight back while someone is arrowing down it. Same adjust-during-render
  // pattern as the player list above.
  const signature = rows.map((r) => r.key).join('|')
  const [activeIndex, setActiveIndex] = useState(0)
  const [prevSignature, setPrevSignature] = useState(signature)
  if (signature !== prevSignature) {
    setPrevSignature(signature)
    setActiveIndex(0)
  }
  const active = rows[Math.min(activeIndex, rows.length - 1)] ?? null

  // The top row is always the return key's target, but it is only DRAWN as
  // highlighted once there's a pointer or an arrow key moving the cursor. On a
  // phone there is neither, and a permanently tinted first row reads as
  // something already tapped rather than as a keyboard cursor.
  const [cursorVisible, setCursorVisible] = useState(false)

  const uid = useId()
  const optionId = (row) => `${uid}-${row.key}`

  const open = useCallback(
    (row) => {
      if (!row) return
      remember({ kind: row.kind, id: row.id, name: row.name, sub: row.sub })
      onClose()
      navigate(row.kind === 'team' ? teamPath(row.id) : playerPath(row.id))
    },
    [navigate, onClose, remember],
  )

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inputRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    // Focusing here, in the effect that follows the trigger's own click, is
    // still inside the user gesture as far as mobile Safari is concerned —
    // which is what makes the keyboard actually come up.
    inputRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  // Scroll-lock the document behind the overlay. Plain `overflow: hidden` (not
  // the position-fixed body trick) because it leaves the page's scroll offset
  // alone, so closing the search puts the user back exactly where they were —
  // and the results list carries `overscroll-behavior: contain` so a flick past
  // its end stops there rather than chaining into the page.
  useEffect(() => {
    const root = document.documentElement
    const { body } = document
    const prevRoot = root.style.overflow
    const prevBody = body.style.overflow
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = prevRoot
      body.style.overflow = prevBody
    }
  }, [])

  const viewport = useVisualViewport()
  // Falls back to the CSS default (100dvh, in index.css) where visualViewport
  // is unsupported — a desktop browser, mostly, where there's no keyboard to
  // work around in the first place.
  const frame = viewport
    ? { height: `${viewport.height}px`, transform: `translateY(${viewport.offsetTop}px)` }
    : undefined

  const onFieldKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (!rows.length) return
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    setCursorVisible(true)
    setActiveIndex((i) => (i + step + rows.length) % rows.length)
  }

  return (
    <div
      className="searchoverlay"
      style={frame}
      onClick={(e) => e.target.classList.contains('searchoverlay') && onClose()}
    >
      <div
        className="searchoverlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search players and teams"
      >
        <form
          className="searchoverlay__bar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            open(active)
          }}
        >
          <div className="searchfield">
            <span className="searchfield__glyph" aria-hidden="true">
              <SearchGlyph size={16} />
            </span>
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="go"
              className="searchfield__input"
              placeholder="Players or teams"
              aria-label="Search players and teams"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onFieldKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls={`${uid}-results`}
              aria-autocomplete="list"
              aria-activedescendant={active ? optionId(active) : undefined}
            />
            {query !== '' && (
              <button
                type="button"
                className="searchfield__clear"
                aria-label="Clear search"
                // Cancel the press so the field never loses focus — clearing
                // the box should leave you typing, not dismiss the keyboard.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
              >
                ✕
              </button>
            )}
          </div>
          <button type="button" className="searchoverlay__cancel" onClick={onClose}>
            Cancel
          </button>
        </form>

        <div className="searchoverlay__progress" aria-hidden="true">
          {searching && <span className="searchoverlay__progressbar" />}
        </div>

        <div
          className="searchoverlay__results"
          id={`${uid}-results`}
          aria-busy={searching || undefined}
        >
          {!hasQuery && recent.length === 0 && (
            <p className="searchoverlay__hint">
              Search any player or club — every level, past and present.
            </p>
          )}
          {noResults && <p className="searchoverlay__hint">No matches for “{trimmed}”.</p>}

          {groups.map((group) => (
            <section key={group.id} className="searchoverlay__group">
              <div className="searchoverlay__grouphead">
                <h3 className="searchoverlay__grouptitle">{group.label}</h3>
                {group.id === 'recent' && (
                  <button type="button" className="searchoverlay__clearrecent" onClick={clear}>
                    Clear
                  </button>
                )}
              </div>
              <ul className="searchoverlay__list" role="listbox" aria-label={group.label}>
                {group.rows.map((row) => (
                  <ResultRow
                    key={row.key}
                    row={row}
                    id={optionId(row)}
                    active={active?.key === row.key}
                    showCursor={cursorVisible}
                    onOpen={open}
                    onHover={() => {
                      setCursorVisible(true)
                      setActiveIndex(rows.indexOf(row))
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {hasQuery && !searching ? `${rows.length} results` : ''}
        </p>
      </div>
    </div>
  )
}

// A row is an option in a combobox listbox, so the <li> IS the control — no
// nested <button>, which would put a second, differently-labelled thing in the
// accessibility tree for every result. Keyboard users drive it from the field
// (arrows + return, wired above); pointer users tap it directly.
function ResultRow({ row, id, active, showCursor, onOpen, onHover }) {
  return (
    <li
      id={id}
      role="option"
      // `aria-selected` tracks the return key's target whether or not the
      // cursor is drawn — a screen-reader user has no pointer to reveal it with.
      aria-selected={active}
      className={`searchoverlay__opt ${active && showCursor ? 'searchoverlay__opt--active' : ''}`}
      // See the modal's header: cancelling the press keeps the keyboard up
      // through the tap, so the list can't shift out from under the finger
      // between press and release.
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => onOpen(row)}
      onMouseMove={onHover}
    >
      {/* A fixed-width slot around the mark: TeamLogo sizes itself with an
          inline style, so the two kinds of row can only share a text column if
          something outside the mark owns the width. */}
      <span className="searchoverlay__mark">
        {row.kind === 'team' ? (
          <TeamLogo teamId={row.id} name={row.name} size={30} />
        ) : (
          <Headshot personId={row.id} name={row.name} className="searchoverlay__shot" />
        )}
      </span>
      <span className="searchoverlay__text">
        <span className="searchoverlay__name">{row.name}</span>
        {row.sub && <span className="searchoverlay__sub">{row.sub}</span>}
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Row shaping. One shape — { key, kind, id, name, sub } — for all three
// sources, which is what lets the recents shelf, the player list and the club
// list share a renderer, a keyboard cursor, and the stored recent entry.
// ---------------------------------------------------------------------------

function playerRow(p) {
  return {
    key: `player-${p.id}`,
    kind: 'player',
    id: p.id,
    name: p.name,
    sub: [p.pos, p.team, p.active ? '' : 'Retired'].filter(Boolean).join(' · '),
  }
}

function teamRow(t) {
  return {
    key: `team-${t.id}`,
    kind: 'team',
    id: t.id,
    name: t.name,
    sub: SPORT_LABEL[t.sportId] ?? '',
  }
}

function toRow(entry) {
  return { key: `${entry.kind}-${entry.id}`, ...entry }
}
