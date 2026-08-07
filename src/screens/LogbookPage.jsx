import '../styles/48-logbook.css'
import '../styles/49-passport-book.css'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { fetchStampGames } from '../api/logbook.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useStamps } from '../hooks/useStamps.js'
import { useNav } from '../lib/nav.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { gamePath, logbookPath, logbookStatsPath } from '../lib/route.js'
import {
  PAGE_CAPACITY,
  autoLayout,
  firstOpenPage,
  otherPlacementsOn,
  pageCountFor,
  pageIsFullFor,
  placementFor,
} from '../lib/passportLayout.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { GameStamp } from '../components/logbook/GameStamp.jsx'
import { PassportBook } from '../components/passport/PassportBook.jsx'
import { PassportCover } from '../components/passport/PassportCover.jsx'
import { Loader } from '../components/ui/Loader.jsx'
import { LogbookLanding } from '../components/account/LogbookLanding.jsx'

const LogbookAccountGate = isClerkEnabled
  ? lazy(() =>
      import('../components/account/LogbookAccountGate.jsx').then((module) => ({
        default: module.LogbookAccountGate,
      })),
    )
  : null

// The Logbook — your passport book of game stamps (ADR-0035, ADR-0036).
//
// ===========================================================================
// THIS PAGE RENDERS FINAL SCORES PLAINLY. Here is why that is not a spoiler.
// ===========================================================================
// A stamp only exists for a game its owner already finished revealing — the
// server refuses to mint one otherwise, against its own record of this user's
// reveal ratchet and spoiled-day consent, never against a claim from the
// client. So every number on this page is a number this user already chose to
// see. That is a structural guarantee, not a convention, and it is the entire
// argument: read ADR-0035 before adding anything here that shows a game the
// user has NOT stamped ("recent games you might stamp", "this club's other
// results") — such a list would break it instantly.
//
// LOCAL-FIRST. The collection comes from localStorage (useStamps), which holds
// no scores at all; the facts each stamp draws with are resolved at render time
// from the schedule (api/logbook.js). On a Clerk-configured deploy this book is
// the signed-in branch behind LogbookAccountGate; the signed-out branch explains
// the feature and offers account entry. A deploy with no Clerk keeps the local
// collection directly accessible, preserving the optional-dependency fallback.
//
// ===========================================================================
// The book, and the two-step placement flow (ADR-0036)
// ===========================================================================
// Minting happens in the box score, inside its SealBox. PLACING happens here:
// you tap a page where you want the stamp, then confirm or try again. A stamp
// that has been minted but not placed waits in the tray above the book — never
// lost, so abandoning the placement step costs nothing.
//
// A PLACEMENT IS NOT PERMANENT. Tapping a stamp that is already on a page opens
// its options — open the game, move it, or send it back to the tray — and
// "move it" re-enters the very same placing mode, on a stamp that happens to
// have a placement already. That is deliberately not a second flow: `place`
// (src/lib/stamps.js's `placeStamp`) has always been a move as much as a first
// placement, so the only things a move adds are the three the user can see —
// the old spot fades while you choose, the page you are moving off does not
// count the stamp against its own capacity, and the collision nudge ignores
// the spot you are leaving (otherwise every small correction would be shoved a
// stamp-width away by the stamp you are correcting). All three live in
// passportLayout's `otherPlacementsOn`/`pageIsFullFor`, not here.
//
// Every number the book is drawn with comes from src/lib/passportLayout.js.
// Nothing in this file computes a position; if you find yourself typing a
// coordinate here, it belongs there, where a test can reach it.

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function monthDay(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  return year ? MONTH_DAY.format(new Date(year, month - 1, day)) : ''
}

export function LogbookPage(props) {
  useDocumentTitle('Game Log')

  // Local visual handoff for a surface that otherwise needs a configured,
  // signed-out Clerk session. DEV-only, so production auth remains the only
  // way into the pitch; route parsing already ignores query strings.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('signedout')) {
    return <LogbookLanding />
  }

  if (LogbookAccountGate) {
    return (
      <Suspense fallback={<LogbookGateLoader />}>
        <LogbookAccountGate Book={LogbookCollection} pageProps={props} />
      </Suspense>
    )
  }

  return <LogbookCollection {...props} />
}

function LogbookGateLoader() {
  return (
    <div className="screen logbook">
      <SiteHeader />
      <Loader />
      <ReportFooter />
    </div>
  )
}

function LogbookCollection({ season: requestedSeason = null, placing = null }) {
  const navigate = useNav()
  const { counts, seasons, forSeason, all, unplaced, place, unplace, placeAll } = useStamps()

  // Which stamp, if any, we are placing. Seeded from `?place=` (the hand-off
  // from the box score's mint card) but owned locally afterwards, so picking a
  // different one from the tray doesn't have to rewrite the URL.
  const [placingPk, setPlacingPk] = useState(placing)
  // The tapped-but-not-yet-confirmed spot. Deliberately NOT committed on tap:
  // "confirm or try again" is the whole interaction, and a stamp that landed
  // the moment you touched the page would have no try-again.
  const [pending, setPending] = useState(null)
  // Which PLACED stamp has its options open. Tapping a stamp in the book used
  // to navigate straight to its game; it now opens this instead, because a
  // keepsake you can only ever leave has no way back off a spot you regret.
  // The extra tap to reach the game is the price, and the grid below the book
  // still opens one in a single tap.
  const [selectedPk, setSelectedPk] = useState(null)
  // The stamp that has JUST been put down, which plays the press once and then
  // clears itself when the animation reports back. Only ever set by a confirm —
  // "place them all for me" deliberately does not set it, because a pageful
  // pressing at once is a flurry, not a stamping.
  const [landedPk, setLandedPk] = useState(null)
  // Which spread of the book is open, and how many blank pages this device has
  // added past the last placement. Page count is a local view preference — how
  // many empty pages you keep is not part of the collection (ADR-0036).
  const [addedPages, setAddedPages] = useState(1)
  // NULL, not 1 — the book opens on its cover, and you turn past it. Seeding
  // this with a page number makes the sync inside PassportBook turn straight
  // to that page on mount, so the cover would exist and never once be seen.
  // It is set only when something actively wants a page: picking a stamp out
  // of the tray, or adding a page.
  const [openPage, setOpenPage] = useState(null)

  // Re-seed from the prop when `?place=` CHANGES — React's documented
  // adjust-state-during-render pattern rather than an effect, which would
  // render once with the stale stamp selected and then again with the right
  // one (and trips the cascading-render lint rule besides).
  const [seenPlacing, setSeenPlacing] = useState(placing)
  if (placing !== seenPlacing) {
    setSeenPlacing(placing)
    setPlacingPk(placing)
    setPending(null)
    setSelectedPk(null)
  }

  // Facts for the WHOLE collection: the book spans every season, unlike the
  // season-paged grid below it. Keyed on the pk list rather than the array
  // identity so a note edit doesn't refetch every game.
  const gamePks = useMemo(() => all.map((s) => s.gamePk), [all])
  const pkKey = gamePks.join(',')
  const facts = useAsync((signal) => fetchStampGames(gamePks, { signal }), [pkKey])
  const byPk = facts.data ?? {}

  const pageCount = pageCountFor(all, addedPages)
  const total = all.length

  // A bare /logbook lands the GRID on the newest season the collection has —
  // only the local store knows which that is, so the route leaves it null and
  // the resolution happens here. (The book itself is never season-paged.)
  const season = requestedSeason ?? seasons[0] ?? null
  const seasonStamps = useMemo(() => (season ? forSeason(season) : []), [season, forSeason])

  const placingStamp = placingPk ? all.find((s) => s.gamePk === placingPk) : null
  const selectedStamp = selectedPk ? all.find((s) => s.gamePk === selectedPk) : null
  // A move rather than a first placement — the stamp already sits somewhere.
  // Every difference between the two is a wording change here plus the two
  // `except` arguments below; the store makes no distinction at all.
  const movingFrom = placingStamp?.placement ?? null

  // Tapping the page proposes a spot; passportLayout decides where it actually
  // lands, nudging off anything it would badly cover.
  const onPageTap = useCallback(
    ({ page, x, y }) => {
      if (!placingPk) return
      // Everything already on that page counts as taken — except the stamp
      // being moved, which must not be nudged off its own current spot.
      setPending(placementFor(placingPk, page, { x, y }, otherPlacementsOn(all, page, placingPk)))
    },
    [placingPk, all],
  )

  const confirmPlacement = useCallback(() => {
    if (!placingPk || !pending) return
    place(placingPk, pending)
    setPending(null)
    setPlacingPk(null)
    setLandedPk(placingPk)
    // Drop `?place=` so a refresh (or the back button) doesn't reopen the mode
    // for a stamp that is already on the page.
    if (placing) navigate(logbookPath(requestedSeason), { replace: true })
  }, [placingPk, pending, place, placing, navigate, requestedSeason])

  const cancelPlacement = useCallback(() => {
    setPending(null)
    setPlacingPk(null)
    if (placing) navigate(logbookPath(requestedSeason), { replace: true })
  }, [placing, navigate, requestedSeason])

  // The press is over; this is an ordinary stamp again. Driven by the
  // animation ending rather than by a timer, so the duration lives in the CSS
  // and nowhere else. Under reduced motion nothing fires and the mark simply
  // stays set — the class is inert there, so there is nothing to clean up.
  const forgetLanded = useCallback(() => setLandedPk(null), [])

  // Pick a stamp up off the page it is on. The book turns to that page first,
  // so the move starts with the old spot in view — you are correcting a
  // position, not choosing one from nothing.
  const startMove = useCallback((entry) => {
    if (!entry?.placement) return
    setSelectedPk(null)
    setPending(null)
    setPlacingPk(entry.gamePk)
    setOpenPage(entry.placement.page)
  }, [])

  const openGame = useCallback(
    (gamePk) => {
      const game = byPk[gamePk]
      if (!game) return
      // Straight to lineup 1 — a stamped game is one you have already been
      // through, so the book returns you to the top of it rather than to the
      // box score you left from.
      navigate(
        gamePath(game.date, game.away.abbreviation, game.home.abbreviation, 'lineup1', game.gameNumber),
      )
    },
    [byPk, navigate],
  )

  const addPage = useCallback(() => {
    setAddedPages((n) => Math.max(n, pageCount) + 1)
    setOpenPage(pageCount + 1)
  }, [pageCount])

  return (
    <div className="screen logbook">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Game Log</h1>
        {total > 0 && (
          <button
            type="button"
            className="topbar__back"
            onClick={() => navigate(logbookStatsPath())}
          >
            Stats ›
          </button>
        )}
      </header>

      {total === 0 ? (
        <p className="hint hint--prose">
          No stamps yet. Reveal a game’s box score and stamp it — it lands here, and
          you choose where on the page it goes.
        </p>
      ) : (
        <>
          {/* The tray: minted, not yet placed. Shown only when it has something
              in it, so a fully-arranged book carries no chrome for it. */}
          {unplaced.length > 0 && !placingPk && (
            <section className="logbook__tray" aria-label="Stamps waiting to be placed">
              <p className="logbook__traylede">
                {unplaced.length} {unplaced.length === 1 ? 'stamp is' : 'stamps are'} waiting
                for a page.
              </p>
              <ul className="logbook__traylist">
                {unplaced.slice(0, 8).map((entry) => (
                  <li key={entry.gamePk}>
                    <button
                      type="button"
                      className="logbook__traystamp"
                      onClick={() => {
                        setPlacingPk(entry.gamePk)
                        setPending(null)
                        setOpenPage(firstOpenPage(all, pageCount) ?? pageCount)
                      }}
                    >
                      {byPk[entry.gamePk] ? (
                        <GameStamp
                          game={byPk[entry.gamePk]}
                          instanceId={`tray-${entry.gamePk}`}
                        />
                      ) : (
                        <span>{monthDay(entry.date)}</span>
                      )}
                      <small>Place {monthDay(entry.date)}</small>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => placeAll(autoLayout(unplaced, { startPage: pageCount }))}
              >
                Place them all for me
              </button>
            </section>
          )}

          {/* A placed stamp's options. Tapping a stamp in the book opens this
              rather than jumping straight to the game, which is what makes a
              placement editable at all: the three things you can do with a
              keepsake already on a page live in one place, and "Move it" is
              just placing mode again. Never shown while placing — the two are
              the same slot above the book, and one bar at a time. */}
          {selectedStamp && !placingPk && (
            <section className="logbook__selected" aria-live="polite">
              <p className="logbook__placinglede">
                {monthDay(selectedStamp.date)} · page {selectedStamp.placement?.page}
              </p>
              <div className="logbook__placingactions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => openGame(selectedStamp.gamePk)}
                >
                  Open game ›
                </button>
                <button
                  type="button"
                  className="btn btn--seal"
                  onClick={() => startMove(selectedStamp)}
                >
                  Move it
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    unplace(selectedStamp.gamePk)
                    setSelectedPk(null)
                  }}
                >
                  Back to the tray
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setSelectedPk(null)}
                >
                  Done
                </button>
              </div>
            </section>
          )}

          {/* Placement mode: the page becomes a tap target, and the tapped spot
              is a proposal until it is confirmed. The same mode runs a MOVE —
              `movingFrom` only changes the wording, so there is one flow to
              keep honest rather than two that can drift apart. */}
          {placingPk && (
            <section className="logbook__placing" aria-live="polite">
              <p className="logbook__placinglede">
                {pending
                  ? movingFrom
                    ? 'There instead? Confirm it, or tap somewhere else.'
                    : 'There? Confirm it, or tap somewhere else.'
                  : movingFrom
                    ? `Tap where ${monthDay(placingStamp?.date)} should go instead — any page.`
                    : `Tap the page where you want ${monthDay(placingStamp?.date)} to go.`}
              </p>
              <div className="logbook__placingactions">
                {pending && (
                  <button type="button" className="btn btn--seal" onClick={confirmPlacement}>
                    {movingFrom ? 'Move it here' : 'Stamp it here'}
                  </button>
                )}
                <button type="button" className="btn btn--ghost" onClick={cancelPlacement}>
                  Cancel
                </button>
              </div>
              {/* The stamp being moved does not count against the page it is
                  moving off — a full page, one of those keepsakes being this
                  one, still has room for it to land somewhere else on it. */}
              {pageIsFullFor(all, openPage, placingPk) && !pending && (
                <p className="hint hint--prose">
                  This page holds {PAGE_CAPACITY}. Turn to a new one, or add one from the
                  corner.
                </p>
              )}
            </section>
          )}

          <PassportBook
            pageCount={pageCount}
            openPage={openPage}
            onOpenPage={setOpenPage}
            stamps={all}
            factsByPk={byPk}
            pending={pending}
            pendingGamePk={placingPk}
            placing={Boolean(placingPk)}
            selectedPk={selectedPk}
            movingPk={placingPk}
            landedPk={landedPk}
            onLanded={forgetLanded}
            onStampClick={setSelectedPk}
            onPageTap={onPageTap}
            onAddPage={addPage}
            coverSlot={<PassportCover onOpen={() => setOpenPage(1)} />}
          />

          {/* Everything the Logbook already showed, shifted below the book. */}
          {seasons.length > 1 && (
            <nav className="logbook__seasons" aria-label="Game Log seasons">
              {seasons.map((year) => (
                <button
                  type="button"
                  key={year}
                  className={year === season ? 'is-active' : ''}
                  aria-current={year === season ? 'page' : undefined}
                  onClick={() => navigate(logbookPath(year))}
                >
                  {year}
                  <small>{counts[year]}</small>
                </button>
              ))}
            </nav>
          )}

          <p className="logbook__count">
            {seasonStamps.length} {seasonStamps.length === 1 ? 'stamp' : 'stamps'}
            {season ? ` · ${season}` : ''}
            <button
              type="button"
              className="logbook__statslink"
              onClick={() => navigate(logbookStatsPath())}
            >
              What it adds up to ›
            </button>
          </p>

          <ul className="logbook__grid">
            {seasonStamps.map((entry) => {
              const game = byPk[entry.gamePk]
              return (
                <li className="logbook__cell" key={entry.gamePk}>
                  {game ? (
                    <button
                      type="button"
                      className="logbook__stampbtn"
                      onClick={() => openGame(entry.gamePk)}
                    >
                      <GameStamp game={game} />
                    </button>
                  ) : (
                    // Facts unresolved (offline, or a batch that failed). The
                    // keepsake still belongs to the user, so it holds its place
                    // with what the local record itself carries rather than
                    // vanishing from the grid.
                    <div className="logbook__pending">
                      <span>{monthDay(entry.date)}</span>
                      <small>{facts.loading ? 'Loading' : 'Not available offline'}</small>
                    </div>
                  )}
                  <p className="logbook__caption">
                    <span>{monthDay(entry.date)}</span>
                    <span className="logbook__mode">{entry.mode}</span>
                    {entry.placement ? (
                      // Which page this keepsake sits on, and the way back to
                      // it. Deliberately no longer an un-place: a control
                      // labelled "p.3" that silently took the stamp off page 3
                      // was the only thing here that could undo a placement,
                      // and it read as a page number. It now turns the book to
                      // that page and opens the stamp's options, where moving
                      // it and returning it to the tray are both named.
                      <button
                        type="button"
                        className="logbook__unplace"
                        aria-label={`Options for the ${monthDay(entry.date)} stamp on page ${entry.placement.page}`}
                        onClick={() => {
                          setPlacingPk(null)
                          setPending(null)
                          setSelectedPk(entry.gamePk)
                          setOpenPage(entry.placement.page)
                        }}
                      >
                        p.{entry.placement.page}
                      </button>
                    ) : (
                      <span className="logbook__unplaced">unplaced</span>
                    )}
                  </p>
                  {entry.note && <p className="logbook__note">{entry.note}</p>}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
