// This page's own partial, kept out of the core sheet (src/index.css) so only
// /team/{id}/transactions pays for it. It loads after the core, which is the
// order it would have had there.
import '../../styles/72-club-transactions.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { loadMoreTeamTransactions } from '../../api/teamTransactions.js'
import { dateline } from '../../components/transactions/MoveRow.jsx'
import { TxStory } from '../../components/transactions/TxStory.jsx'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { BackBtn } from '../../components/chrome/BackBtn.jsx'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { loadTransactions } from './data/loadTransactions.js'

// ===========================================================================
// A club's roster moves — the whole season, one day under another
// ===========================================================================
// THE PROBLEM THIS EXISTS FOR. The home slate's wire gives every roster move in
// the league a club chip, and that chip has to land somewhere. It used to land
// on the Games tab, because that is where the club's Transactions deck lives —
// under the series strip, under every game of the season, under the highlights
// rail and under the photos rail. A reader who tapped MIL to read the move they
// had just seen arrived at the top of a very long page and had to scroll past
// four sections to find it. The wire pointed at the right tab and the wrong
// place on it.
//
// So the chip points here instead, at a page holding one thing.
//
// WHY A PAGE AND NOT A LONGER DECK. The deck is right where it is: a club's own
// page shows its recent moves beside everything else about the club, and a
// horizontal deck is the shape that costs a long page the least. But a deck
// cannot be skimmed backwards — you cannot read a season by swiping — and it
// can only mark a day boundary with a divider between cards. A ledger does both
// naturally, which is what the wire itself is on the home page. So the two
// surfaces split the work the way this app already splits it elsewhere: the
// deck is the preview, this is the whole thing.
//
// The CARD is the same card either way (TxStory.jsx), so a move a reader
// recognises from the club page looks the same here.
//
// Spoiler-free: a roster move and its date carry no score, so there is no
// SealBox on this page and none is wanted (api/transactions/clubFeed.js).
// `asOf` scopes which moves load, exactly as it does for the deck, and is never
// displayed — a dated visit stays dated across the hop, and skips the live
// window for the same reason the deck does.

// How many DAYS are drawn before the next batch, and how many each step adds.
// The first page arrives with the route already holding 45 days of the file, so
// this governs how much of an already-loaded page is painted, not how often the
// network is asked.
const INITIAL_DAYS = 10
const REVEAL_DAYS = 10

export function TeamTransactionsPage({ id, asOf, sportId: _sportId }) {
  const teamId = Number(id)
  const data = useAsync(() => loadTransactions(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: data.loading,
    error: data.error,
    data: data.data,
    screenClass: 'txpage',
    noun: 'team',
    onBack: back,
  })
  if (gate) return gate

  const { team, page } = data.data
  return (
    <ClubLedger
      key={`${team.id}-${asOf ?? ''}`}
      team={team}
      asOf={asOf}
      first={page}
      onBack={back}
    />
  )
}

// ---------------------------------------------------------------------------
// The ledger — its own component so `first` is a stable prop the pager starts
// from, the same split TeamPhotosPage uses between itself and its grid.
// ---------------------------------------------------------------------------
function ClubLedger({ team, asOf, first, onBack }) {
  useDocumentTitle(`${team.name} Transactions`)

  const [days, setDays] = useState(first.days)
  const [cursor, setCursor] = useState(first.cursor)
  const [hasMore, setHasMore] = useState(first.hasMore)
  const [shown, setShown] = useState(INITIAL_DAYS)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)
  const sentinelRef = useRef(null)

  const visible = days.slice(0, shown)
  const canGrow = shown < days.length || hasMore

  // Widens the drawn slice first (a loaded page usually holds more than is
  // shown), and asks for another page only once that buffer runs out. The ref
  // closes the gap before React commits `loading`, so a sentinel and a button
  // firing together cannot page twice — the same guard the deck uses.
  const grow = useCallback(async () => {
    if (inFlight.current) return
    if (shown < days.length) {
      setShown((n) => n + REVEAL_DAYS)
      setFailed(false)
      return
    }
    if (!hasMore) return
    inFlight.current = true
    setLoading(true)
    setFailed(false)
    try {
      // Paging back stays on the nightly file: the live window covers three
      // days, and by here the reader is 45 days into the season.
      const next = await loadMoreTeamTransactions(team.id, cursor, asOf)
      setDays((prev) => [...prev, ...next.days])
      setCursor(next.cursor)
      setHasMore(next.hasMore)
      setShown((n) => n + REVEAL_DAYS)
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [asOf, cursor, days.length, hasMore, shown, team.id])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !canGrow || loading) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) grow()
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [canGrow, grow, loading])

  return (
    <div className="screen txpage">
      <SiteHeader />
      <BackBtn onClick={onBack} />
      <header className="topbar">
        <h1 className="topbar__title">
          <TeamLogo teamId={team.id} name={team.name} size={32} />
          {team.name} Transactions
        </h1>
      </header>

      {days.length === 0 ? (
        <p className="hint txpage__empty">No roster moves posted for this club yet.</p>
      ) : (
        <div className="txpage__days">
          {visible.map((day) => (
            <section className="txpage__day" key={day.date}>
              {/* The wire's own dateline row, upright: the day, a rule, and the
                  day's count. Mixed case on purpose — the CSS applies the app's
                  ALL-CAPS invariant (ADR-0017). */}
              <h2 className="txpage__dateline">
                <span>{dateline(day.date)}</span>
                <span className="txpage__rule" aria-hidden="true" />
                <span className="txpage__count">{day.stories.length}</span>
              </h2>
              <div className="txpage__stories">
                {day.stories.map((story) => (
                  <TxStory key={story.id} story={story} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {canGrow && (
        <>
          <div ref={sentinelRef} aria-hidden="true" />
          <button type="button" className="txpage__more" onClick={grow} disabled={loading}>
            {loading ? 'Loading moves…' : failed ? 'Try loading again' : 'Earlier moves'}
          </button>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
