import { useCallback, useMemo, useState } from 'react'
import { fetchStampGames } from '../api/logbook.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useStamps } from '../hooks/useStamps.js'
import { useNav } from '../lib/nav.js'
import { gamePath, logbookPath, logbookStatsPath } from '../lib/route.js'
import {
  PAGE_CAPACITY,
  autoLayout,
  firstOpenPage,
  pageCountFor,
  pageIsFull,
  placementFor,
  stampsOnPage,
} from '../lib/passportLayout.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { ReportFooter } from '../components/ReportFooter.jsx'
import { GameStamp } from '../components/GameStamp.jsx'
import { PassportBook } from '../components/passport/PassportBook.jsx'
import { PassportCover } from '../components/passport/PassportCover.jsx'

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
// from the schedule (api/logbook.js). A signed-out user therefore gets a real,
// working Logbook on this device, and a signed-in one gets the same page with
// the collection merged across devices by StampsCloudSync. One code path.
//
// ===========================================================================
// The book, and the two-step placement flow (ADR-0036)
// ===========================================================================
// Minting happens in the box score, inside its SealBox. PLACING happens here:
// you tap a page where you want the stamp, then confirm or try again. A stamp
// that has been minted but not placed waits in the tray above the book — never
// lost, so abandoning the placement step costs nothing.
//
// Every number the book is drawn with comes from src/lib/passportLayout.js.
// Nothing in this file computes a position; if you find yourself typing a
// coordinate here, it belongs there, where a test can reach it.

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function monthDay(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  return year ? MONTH_DAY.format(new Date(year, month - 1, day)) : ''
}

export function LogbookPage({ season: requestedSeason = null, placing = null }) {
  useDocumentTitle('Logbook')
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

  // Tapping the page proposes a spot; passportLayout decides where it actually
  // lands, nudging off anything it would badly cover.
  const onPageTap = useCallback(
    ({ page, x, y }) => {
      if (!placingPk) return
      // Everything already on that page counts as taken — except the stamp
      // being moved, which must not be nudged off its own current spot.
      const taken = stampsOnPage(all, page)
        .filter((s) => s.gamePk !== placingPk)
        .map((s) => s.placement)
      setPending(placementFor(placingPk, page, { x, y }, taken))
    },
    [placingPk, all],
  )

  const confirmPlacement = useCallback(() => {
    if (!placingPk || !pending) return
    place(placingPk, pending)
    setPending(null)
    setPlacingPk(null)
    // Drop `?place=` so a refresh (or the back button) doesn't reopen the mode
    // for a stamp that is already on the page.
    if (placing) navigate(logbookPath(requestedSeason), { replace: true })
  }, [placingPk, pending, place, placing, navigate, requestedSeason])

  const cancelPlacement = useCallback(() => {
    setPending(null)
    setPlacingPk(null)
    if (placing) navigate(logbookPath(requestedSeason), { replace: true })
  }, [placing, navigate, requestedSeason])

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
        <h1 className="topbar__title">Logbook</h1>
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

          {/* Placement mode: the page becomes a tap target, and the tapped spot
              is a proposal until it is confirmed. */}
          {placingPk && (
            <section className="logbook__placing" aria-live="polite">
              <p className="logbook__placinglede">
                {pending
                  ? 'There? Confirm it, or tap somewhere else.'
                  : `Tap the page where you want ${monthDay(placingStamp?.date)} to go.`}
              </p>
              <div className="logbook__placingactions">
                {pending && (
                  <button type="button" className="btn stampcard__mint" onClick={confirmPlacement}>
                    Stamp it here
                  </button>
                )}
                <button type="button" className="btn btn--ghost" onClick={cancelPlacement}>
                  Cancel
                </button>
              </div>
              {pageIsFull(all, openPage) && !pending && (
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
            onStampClick={openGame}
            onPageTap={onPageTap}
            onAddPage={addPage}
            coverSlot={<PassportCover onOpen={() => setOpenPage(1)} />}
          />

          {/* Everything the Logbook already showed, shifted below the book. */}
          {seasons.length > 1 && (
            <nav className="logbook__seasons" aria-label="Logbook seasons">
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
                      <button
                        type="button"
                        className="logbook__unplace"
                        onClick={() => unplace(entry.gamePk)}
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
