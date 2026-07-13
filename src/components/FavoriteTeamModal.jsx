import { useEffect, useRef, useState } from 'react'
import { fetchTeams } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { PINNED_TEAM_ID, SPORT_IDS } from '../lib/teams.js'
import { TeamLogo } from './TeamLogo.jsx'

// Favorite-team picker, shared by the first-visit welcome modal (GameSelect)
// and the footer's "Favorite team" button. The picker itself reuses the
// Splits vs Team card's tray/strip styling (vsteam__* — see index.css) rather
// than a new one: the same finger-scrollable row of every MLB club's logo,
// grayscaled except the pick.
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
  gameScoreVisible = false,
  onSetGameScoreVisible,
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

  // Keep the selected club centered in the strip, same behavior as the
  // player page's Splits vs Team picker (SplitsVsTeam.jsx): scroll the
  // strip's own scrollLeft (not scrollIntoView, which would also scroll the
  // page/modal) so the pick is centered both on open — the Brewers default
  // sits mid-alphabet — and after every subsequent tap.
  const stripRef = useRef(null)
  const activeRef = useRef(null)
  useEffect(() => {
    const strip = stripRef.current
    const btn = activeRef.current
    if (!strip || !btn) return
    strip.scrollTo({
      left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2,
      behavior: 'smooth',
    })
  }, [selId, teams.length])

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
        aria-label="Favorite team"
      >
        <div className="favteamsheet__head">
          <h2 className={`sheet__title${intro ? ' favteamsheet__title--intro' : ''}`}>
            {intro ? 'Welcome to Scorebook Helper' : 'Favorite team'}
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
            Scorebook Helper pulls live lineups, umpires, and rosters straight
            from MLB&rsquo;s own data — everything you need to fill in your
            scorebook before first pitch. Every run, hit, and out stays sealed
            until you tap to reveal it, inning by inning, so you&rsquo;re
            never a step ahead of the game in your hand.
          </p>
        )}

        <p className="favteamsheet__subtitle">
          {intro
            ? "Pick your favorite team — we'll pin them to the top of the schedule."
            : 'Choose a different favorite team.'}
        </p>

        <div className="vsteam__tray">
          <div
            className="vsteam__strip"
            role="tablist"
            aria-label="Favorite team"
            ref={stripRef}
          >
            {teams.map((t) => {
              const active = t.id === selId
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={t.name}
                  ref={active ? activeRef : null}
                  className={`vsteam__team${active ? ' is-active' : ''}`}
                  onClick={() => pick(t.id)}
                >
                  <TeamLogo teamId={t.id} name={t.name} size={36} />
                </button>
              )
            })}
          </div>
        </div>

        {onSetGameScoreVisible && (
          <div className="favteamsheet__pref">
            <div className="favteamsheet__prefText">
              <span className="favteamsheet__prefLabel">
                Show Game Score on FINAL cards
              </span>
              <span className="hint hint--prose favteamsheet__prefHint">
                A 0–10 rating of how exciting a finished game was — never the
                score itself.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={gameScoreVisible}
              className={`favteamsheet__prefToggle${gameScoreVisible ? ' is-on' : ''}`}
              onClick={() => onSetGameScoreVisible(!gameScoreVisible)}
            >
              {gameScoreVisible ? 'On' : 'Off'}
            </button>
          </div>
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
