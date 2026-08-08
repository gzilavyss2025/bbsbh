// This page's own partial, kept out of the core sheet (src/index.css) so only
// /team/{id}/stamp-in pays for it. It loads after the core, which is the order
// it would have had there.
import '../../styles/59-stamp-in.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { usePastGameSignals } from '../../hooks/usePastGameSignals.js'
import { useStamps } from '../../hooks/useStamps.js'
import { useNav } from '../../lib/nav.js'
import { humanDate } from '../../lib/dates.js'
import { gamePath, teamTabPath } from '../../lib/route.js'
import { DEFAULT_STAMP_MODE, seasonFromDate } from '../../lib/stamps.js'
import {
  STAMP_IN_CONSENT_KEY,
  hasStampInConsent,
  parseStampInConsent,
  serializeStampInConsent,
  stampInGames,
} from '../../lib/stampIn.js'
import { teamClubName } from '../../lib/teams.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { BackBtn } from '../../components/chrome/BackBtn.jsx'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { ConsentModal } from '../../components/seal/ConsentModal.jsx'
import { GameResultFace } from '../../components/game/GameResultFace.jsx'
import { BoxScoreSkeleton } from '../../components/game/BoxScoreSkeleton.jsx'
import { StampInButton } from '../../components/logbook/StampInButton.jsx'
import { loadStampIn } from './data/loadStampIn.js'

// ===========================================================================
// Stamp In — a club's played season, every result showing (ADR-0042)
// ===========================================================================
// The one place in this app that lays a whole season of final scores out in
// front of you before you have opened any of those games. That is a departure
// from the spoiler rule, and it is legitimate for one reason and one only:
// **you asked for it, at this address, by name.** The consent below is the
// whole argument, so read ADR-0042 before touching it.
//
// TWO RULES THIS FILE MUST KEEP.
//
// 1. NOTHING RENDERS, AND NOTHING IS FETCHED, BEFORE CONSENT. The season is a
//    separate component mounted only once the answer is yes — so an
//    unconsented visit has no result in the DOM and has not even asked
//    statsapi for one. Not fetched-then-hidden; not fetched at all.
//
// 2. IT IS RENDER-ONLY, exactly in ADR-0026's sense. This page never writes
//    `bbsbh:reveal:{gamePk}` and never advances `revealedThrough` for any
//    game. It touches `useRevealProgress` nowhere, mounts no `SealBox`, and
//    passes no `onReveal` to anything. An accidental write here would silently
//    unseal these games on every OTHER screen — the slate, the innings viewer,
//    the box score — and on every one of the reader's other devices. That is
//    the failure this whole page has to be trusted not to cause.
//
// The consent is stored on this device (`bbsbh:stampIn`), never synced. It is
// a fact about one browser, the same footing as `bbsbh:intro`.
export function StampInPage({ id, asOf, sportId }) {
  const teamId = Number(id)
  const navigate = useNav()
  const [consent, setConsent] = useState(readConsent)
  useDocumentTitle('Stamp In')

  // The one way out, and back to the only door in: the Games tab's Schedule
  // card, which holds this page's single entry point. Carries `?d=`/`?s=`
  // through, like every other team link (see teamTabPath).
  const backToGames = useCallback(() => {
    navigate(teamTabPath(id, 'games', { d: asOf, s: sportId }))
  }, [navigate, id, asOf, sportId])

  const accept = useCallback(() => {
    writeConsent()
    setConsent(true)
  }, [])

  if (!consent) {
    return (
      <div className="screen stampin">
        <SiteHeader />
        <BackBtn onClick={backToGames} />
        <ConsentModal group="stampIn" onConfirm={accept} onDismiss={backToGames} />
      </div>
    )
  }

  return <StampInSeason teamId={teamId} asOf={asOf} onBack={backToGames} />
}

// ---------------------------------------------------------------------------
// The consented season
// ---------------------------------------------------------------------------
function StampInSeason({ teamId, asOf, onBack }) {
  const data = useAsync(() => loadStampIn(teamId, asOf), [teamId, asOf])
  const getSignals = usePastGameSignals()
  const { isStamped, seasonIsFull, stamp } = useStamps()

  const gate = AsyncGate({
    loading: data.loading,
    error: data.error,
    data: data.data,
    screenClass: 'stampin',
    noun: 'team',
    onBack,
  })
  if (gate) return gate

  const { team, schedule } = data.data
  const games = stampInGames(schedule)
  // MiLB has no entry in the MLB club-name table, so the affiliate's own feed
  // name is the fallback — the house degrade, never a crash.
  const club = teamClubName(team.id) || team.name || 'this club'

  return (
    <div className="screen stampin">
      <SiteHeader />
      <BackBtn onClick={onBack} />
      <h1 className="stampin__title">Stamp In</h1>
      {/* Second person, and about what you SAW — never about how much of the
          season is "done". docs/game-log.md §1: the Game Log has no completion
          state, so this page carries no count, no bar, and no total. */}
      <p className="stampin__lede">
        Every {club} game already played, newest first. Press a stamp on the ones you watched — it
        lands in your Game Log, waiting for a page.
      </p>

      {games.length === 0 ? (
        <p className="hint">No games posted yet for this season.</p>
      ) : (
        <ol className="stampin__list">
          {games.map((game) => (
            <StampInRow
              key={game.gamePk}
              game={game}
              getSignals={getSignals}
              stamped={isStamped(game.gamePk)}
              seasonFull={seasonIsFull(seasonFromDate(game.apiDate))}
              onStamp={() =>
                stamp(game.gamePk, { mode: DEFAULT_STAMP_MODE, note: '', date: game.apiDate })
              }
            />
          ))}
        </ol>
      )}
      <button type="button" className="btn stampin__back" onClick={onBack}>
        Back to the schedule
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One game
// ---------------------------------------------------------------------------
function StampInRow({ game, getSignals, stamped, seasonFull, onStamp }) {
  const [signals, setSignals] = useState(null)
  const [failed, setFailed] = useState(false)
  const ref = useRef(null)
  const gamePk = game.gamePk

  // Each card needs its OWN feed + win probability, and a season is up to 162
  // of them. Fetching on mount would be ~324 requests in one burst, so a row
  // asks for its game only when the reader is nearly looking at it, and even
  // then it waits its turn in the queue below. Already-fetched games cost
  // nothing on a second visit — usePastGameSignals caches a Final game's
  // signals for the tab's lifetime.
  useEffect(() => {
    if (signals || failed) return
    const node = ref.current
    let done = false
    const job = {
      cancelled: false,
      run: () =>
        getSignals(gamePk).then(
          (s) => {
            if (!job.cancelled) setSignals(s)
          },
          () => {
            if (!job.cancelled) setFailed(true)
          },
        ),
    }
    if (!node || typeof IntersectionObserver === 'undefined') {
      enqueue(job)
      return () => {
        job.cancelled = true
      }
    }
    // A generous margin so a card is normally loaded by the time it arrives,
    // rather than flashing its skeleton under the reader's thumb.
    const io = new IntersectionObserver(
      (entries) => {
        if (done || !entries.some((e) => e.isIntersecting)) return
        done = true
        io.disconnect()
        enqueue(job)
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(node)
    return () => {
      job.cancelled = true
      io.disconnect()
    }
  }, [gamePk, getSignals, signals, failed])

  const boxScorePath = gamePath(
    game.apiDate,
    game.away?.abbreviation,
    game.home?.abbreviation,
    'boxscore',
    game.gameNumber,
  )
  // The stamp's accessible name says which game it is — every row's visible
  // word is the same one, so the date and opponent have to come from here.
  // Degrades to the bare word on a thin MiLB row with no opponent posted.
  const opponent = game.opponent?.abbreviation || game.opponent?.name || ''
  const dateLabel = game.apiDate ? humanDate(game.apiDate) : '—'
  const label = [dateLabel, opponent && `${game.isHome ? 'vs' : 'at'} ${opponent}`]
    .filter(Boolean)
    .join(', ')

  return (
    <li className="stampin__row" ref={ref}>
      <div className="stampin__rowhead">
        <span className="stampin__date">{dateLabel}</span>
        {opponent && (
          <span className="stampin__opp">
            {game.isHome ? 'vs' : 'at'} {opponent}
          </span>
        )}
      </div>
      {signals ? (
        <div className="stampin__facewrap">
          <GameResultFace
            feed={signals.feed}
            winProb={signals.winProb}
            boxScorePath={boxScorePath}
            // The line and the decisions, nothing else. A season is up to 162
            // rows and this page is read by scrolling it, so the play of the
            // game — a photo and two lines each — costs more height than it
            // earns here. It is still on the slate, where you see one game.
            hidePlayOfGame
            trailing={
              <StampInButton
                stamped={stamped}
                seasonFull={seasonFull}
                onStamp={onStamp}
                label={label}
              />
            }
          />
          {/* The cap REFUSES rather than prunes (ADR-0035), so a row that
              cannot be stamped says why instead of offering a dead button.
              Same sentence the box score's mint strip uses. */}
          {!stamped && seasonFull && (
            <p className="stampin__refusal">
              Your {seasonFromDate(game.apiDate)} Game Log is full. Remove a stamp to make room.
            </p>
          )}
        </div>
      ) : failed ? (
        <p className="hint hint--error">Couldn’t load this game’s result.</p>
      ) : (
        <BoxScoreSkeleton />
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// The fetch queue
// ---------------------------------------------------------------------------
// Module-level, like usePastGameSignals' own cache and for the same reason:
// gamePks are globally unique, so one queue for the tab is the correct scope.
//
// LIFO, not FIFO, and that is the part that matters on a fast scroll. A flick
// through half a season crosses fifty rows in a second; serving them
// oldest-request-first would spend the whole budget on cards the reader has
// already scrolled past. Taking the newest request first keeps the four slots
// pointed at wherever the reader actually stopped.
const MAX_IN_FLIGHT = 4
const waiting = []
let inFlight = 0

function enqueue(job) {
  waiting.push(job)
  pump()
}

function pump() {
  while (inFlight < MAX_IN_FLIGHT && waiting.length > 0) {
    const job = waiting.pop()
    if (job.cancelled) continue
    inFlight += 1
    job.run().finally(() => {
      inFlight -= 1
      pump()
    })
  }
}

// ---------------------------------------------------------------------------
// The consent record's storage I/O
// ---------------------------------------------------------------------------
// Kept here rather than in a hook of its own: the rules are pure and tested in
// src/lib/stampIn.js, and this is the only screen that ever reads or writes
// them. Both directions degrade quietly — a browser with storage disabled
// simply asks again next visit, which errs toward asking, never toward
// showing.
function readConsent() {
  try {
    return hasStampInConsent(parseStampInConsent(window.localStorage.getItem(STAMP_IN_CONSENT_KEY)))
  } catch {
    return false
  }
}

function writeConsent() {
  try {
    window.localStorage.setItem(STAMP_IN_CONSENT_KEY, serializeStampInConsent(Date.now()))
  } catch {
    // Private mode / storage disabled — the page still opens for this visit.
  }
}
