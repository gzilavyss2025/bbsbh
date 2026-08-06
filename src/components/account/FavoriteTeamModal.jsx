import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { fetchTeams } from '../../api/schedule.js'
import { useAsync } from '../../hooks/useAsync.js'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { PINNED_TEAM_ID, SPORT_IDS } from '../../lib/teams.js'
import { ClubPicker } from './ClubPicker.jsx'

// Same lazy gate as GameSelect/SiteHeader: AccountPitch imports
// @clerk/clerk-react at its top, so it's never fetched — let alone rendered —
// on a deploy without Clerk configured (see clerkConfig.js). Rendered in both
// the intro welcome modal and the footer's Settings modal.
const AccountPitch = isClerkEnabled
  ? lazy(() => import('./AccountPitch.jsx').then((m) => ({ default: m.AccountPitch })))
  : null

// The first-visit welcome modal (GameSelect, `intro`): the favorite-team
// picker plus the spoiler promise. Its strip is `ClubPicker`, shared verbatim
// with My Tally's Baseball section, which reuses the Splits vs Team card's
// tray/strip styling (vsteam__* — see src/styles/) rather than a new one.
//
// The footer's "Settings" button USED to open this in a second, non-intro mode.
// It now navigates to `/profile` (My Tally), where the club sits alongside the
// level, keep-awake, motion, the progress ledger and the account — a modal was
// never the right shape for a settings page. The `intro={false}` branch is
// still here because phase 4 of that program rebuilds this dialog into the
// two-step intro; it has no caller in the meantime.
//
// Tapping a club applies it immediately (no separate Save step), and closing
// by any route — backdrop tap, the X, Escape, or (in `intro` mode) the "Get
// started" button — commits whatever's currently picked. That means a
// first-time visitor who just dismisses the welcome modal without tapping
// anything still ends up with the Brewers default persisted, rather than
// leaving the "first visit" state to pop the modal again next time.
export function FavoriteTeamModal({
  favoriteTeamId,
  intro = false,
  onSave,
  onClose,
}) {
  const [selId, setSelId] = useState(favoriteTeamId ?? PINNED_TEAM_ID)
  const mlbTeams = useAsync(() => fetchTeams(SPORT_IDS.MLB), [])
  const teams = mlbTeams.data ?? []

  const commitClose = () => {
    onSave(selId)
    onClose()
  }

  const pick = (id) => {
    setSelId(id)
    onSave(id)
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && commitClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])

  // Dialog focus contract, same as GameFinderModal/LogoModal: focus moves to
  // the close button on open and back to the trigger on close.
  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && commitClose()}
    >
      <div
        className="favteamsheet"
        role="dialog"
        aria-modal="true"
        aria-label={intro ? 'Welcome to Tally Baseball' : 'Settings'}
      >
        <div className="favteamsheet__head">
          <h2 className={`sheet__title${intro ? ' favteamsheet__title--intro' : ''}`}>
            {intro ? 'Welcome to Tally Baseball' : 'Settings'}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="favteamsheet__close"
            onClick={commitClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {intro && (
          <p className="sheet__body favteamsheet__pitch">
            Tally Baseball pulls live lineups, umpires, and rosters straight
            from MLB&rsquo;s own data — everything you need to fill in your
            scorebook before first pitch. Every run, hit, and out stays sealed
            until you tap to reveal it, inning by inning, so you&rsquo;re
            never a step ahead of the game in your hand.
          </p>
        )}

        <section className="favteamsheet__section">
          <h3 className="favteamsheet__sectionTitle">Favorite team</h3>
          <p className="favteamsheet__subtitle">
            {intro
              ? "Pick your favorite team — we'll pin them to the top of the schedule."
              : 'Choose a different favorite team.'}
          </p>

          {/* The one club strip in the app — shared verbatim with My Tally's
              Baseball section (components/account/ClubPicker.jsx), so the
              two pickers cannot drift. */}
          <ClubPicker teams={teams} value={selId} onPick={pick} ariaLabel="Favorite team" />
        </section>

        {AccountPitch && (
          <Suspense fallback={null}>
            <AccountPitch />
          </Suspense>
        )}

        {intro && (
          <div className="sheet__actions favteamsheet__actions">
            <button type="button" className="btn btn--next" onClick={commitClose}>
              Get started
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
