import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { fetchTeams } from '../../api/schedule.js'
import { useAsync } from '../../hooks/useAsync.js'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { PINNED_TEAM_ID, SPORT_IDS } from '../../lib/teams.js'
import { ClubPicker } from './ClubPicker.jsx'
import { ClubSeal } from '../profile/ClubSeal.jsx'

// Same lazy gate as GameSelect/SiteHeader: AccountPitch imports
// @clerk/clerk-react at its top, so it's never fetched — let alone rendered —
// on a deploy without Clerk configured (see clerkConfig.js). Its content is
// step 2 of this modal; see AccountPitch.jsx's own header for the two
// branches it renders.
const AccountPitch = isClerkEnabled
  ? lazy(() => import('./AccountPitch.jsx').then((m) => ({ default: m.AccountPitch })))
  : null

// The first-visit welcome modal (GameSelect's welcome flow — its only
// caller). A two-step dialog, one dialog with two panels and a step
// indicator, never two separate modals (PRD §6.1):
//
//   Step 1 — Your club. The existing club strip (ClubPicker, unchanged);
//            tapping applies immediately, no separate Save.
//   Step 2 — Your scorebook. The account benefit (AccountPitch.jsx), shown
//            only when isClerkEnabled.
//
// Closing by ANY route — backdrop tap, the ✕, Escape, "Choose later" at step
// 1, or either action at step 2 — commits whatever club is currently picked
// and ends the WHOLE intro. A dismissal is an answer: a first-time visitor
// who never taps anything still ends up with the pinned default persisted,
// rather than leaving "first visit" true so the modal pops again next time.
// `onClose(step)` reports which step the visitor exited from, purely so the
// caller's bbsbh:intro flag can record it (src/lib/account/intro.js) — it
// gates nothing here.
//
// The settings-mode ("intro=false") branch this component used to have is
// GONE, deliberately (see HANDOFF.md): the footer's Settings button has
// navigated to /profile since phase 3 — a modal was never the right shape for
// a settings page — so this component now has exactly one caller and exactly
// one purpose.
//
// The club strip is `ClubPicker` — the same component My Tally's Baseball
// section renders — so there is exactly one club picker in the app.
export function FavoriteTeamModal({ favoriteTeamId, onSave, onClose }) {
  const [selId, setSelId] = useState(favoriteTeamId ?? PINNED_TEAM_ID)
  const titleId = useId()
  const [step, setStep] = useState(1)
  const mlbTeams = useAsync(() => fetchTeams(SPORT_IDS.MLB), [])
  const teams = mlbTeams.data ?? []
  const selectedTeam = teams.find((team) => team.id === selId) ?? null
  // `teams` is async, so `selectedTeam` is null on first paint. The primary
  // action must NOT read "Continue with the your club" while it resolves —
  // which is the literal first thing a new visitor saw on a cold cache. Until
  // a real club name exists, the neutral label stands.
  const clubLabel = selectedTeam?.teamName || selectedTeam?.name || ''

  const pick = (id) => {
    setSelId(id)
    onSave(id)
  }

  // The only terminal action. Commits the current pick and closes the WHOLE
  // dialog — there is no route back to step 1 once step 2 is reached.
  const finish = () => {
    onSave(selId)
    onClose(step)
  }

  const goToStep2 = () => {
    onSave(selId)
    if (AccountPitch) setStep(2)
    else onClose(1)
  }

  // Dialog focus contract, same as GameFinderModal/LogoModal: focus moves to
  // the close button on open and back to the trigger on close. Re-run on a
  // step change too, so a screen-reader user lands somewhere sane on the new
  // panel instead of wherever the previous one left focus.
  const closeRef = useRef(null)
  const sheetRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])
  useEffect(() => {
    closeRef.current?.focus()
  }, [step])

  // Escape + Tab are handled ON the dialog, not on `window`, and `aria-modal`
  // is enforced rather than merely declared — the rule ConsentModal.jsx states.
  //
  // A window listener was actively harmful here: step 2 renders Clerk's
  // <SignUpButton mode="modal">, which opens a Clerk portal ON TOP of this
  // dialog. Escape inside Clerk's own sign-up sheet bubbled to window, closed
  // the whole intro out from under it, and unmounted the sign-up mid-flow.
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      finish()
      return
    }
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusable = [
      ...sheetRef.current.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && finish()}
    >
      <div
        ref={sheetRef}
        className="favteamsheet introsheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <div className="favteamsheet__head">
          <div>
            {/* No step indicator when there is no step 2 to go to. PRD §6.1:
                on an unconfigured deploy there is "no step 2, no indicator,
                and no dead '1 of 2'". */}
            {AccountPitch && (
              <p className="introsheet__eyebrow caps-exempt">
                {step === 1 ? 'Step 1 · Your club' : 'Step 2 · Your scorebook'}
              </p>
            )}
            <h2 id={titleId} className="sheet__title favteamsheet__title--intro">
              {step === 1 ? 'Make Tally yours.' : 'Take your Tally with you.'}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="favteamsheet__close"
            onClick={finish}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === 1 ? (
          <>
            <p className="sheet__body favteamsheet__pitch">
              Choose your club. We&rsquo;ll pin its games&mdash;and its
              affiliates&mdash;to the top of every slate.
            </p>

            <section className="favteamsheet__section">
              <ClubPicker teams={teams} value={selId} onPick={pick} ariaLabel="Your club" />

              {selectedTeam && (
                <div className="introsheet__reaction">
                  <ClubSeal teamId={selId} name={selectedTeam.name} size={56} />
                  <p className="introsheet__reactiontext caps-exempt">
                    Pinned to the top of every {clubLabel} slate — and every{' '}
                    {clubLabel} affiliate, from AAA to Single-A.
                  </p>
                </div>
              )}
            </section>

            <p className="introsheet__fineprint caps-exempt">
              Every run, hit, and out stays sealed until you tap to reveal it
              — the whole reason Tally exists.
            </p>

            <div className="sheet__actions favteamsheet__actions introsheet__actions">
              <button type="button" className="btn btn--next" onClick={goToStep2}>
                {AccountPitch && clubLabel ? `Continue with the ${clubLabel}` : 'Get started'}
              </button>
              {AccountPitch && (
                <button type="button" className="btn btn--ghost" onClick={finish}>
                  Choose later
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="sheet__body favteamsheet__pitch">
              Create a free account to keep your place in every game, your
              spoiler choices, and your Game Log together on every device.
            </p>
            {AccountPitch && (
              <Suspense fallback={null}>
                <AccountPitch
                  clubTeamId={selId}
                  // `clubLabel`, not `.name`: step 1 calls the club "Brewers"
                  // and step 2 was calling it "Milwaukee Brewers" two taps
                  // later, in the same dialog.
                  clubName={clubLabel}
                  onContinue={finish}
                />
              </Suspense>
            )}
          </>
        )}
      </div>
    </div>
  )
}
