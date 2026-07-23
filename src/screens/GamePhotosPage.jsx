import { useState } from 'react'
import { fetchGamePhotos } from '../api/gamePhotos.js'
import { fetchTeamSchedule } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PINNED_TEAM_ID, SPORT_IDS, teamFullName } from '../lib/teams.js'
import { toApiDate } from '../lib/dates.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamFilterStrip } from '../components/TeamFilterStrip.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { ReportFooter } from '../components/ReportFooter.jsx'

const CURRENT_YEAR = new Date().getFullYear()
const SEASONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)

function monthDay(iso) {
  if (!iso) return ''
  const dt = new Date(`${iso}T00:00:00Z`)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// A personal tool for pulling MLB's full-resolution, watermark-free editorial
// photos for a specific game — pick a club and a game, then open or save any
// photo MLB's content package carries for it (recap art, hero images,
// galleries). See api/gamePhotos.js for how the CDN's resize transforms get
// stripped back to the photographer's original upload.
//
// Deliberately NOT part of the spoiler-safe scored-game flow (root
// CLAUDE.md) — a recap/celebration photo narrates the outcome just by
// looking at it, so this page carries its own notice instead of a SealBox.
// Linked from the footer/menu like any other reference page (reportPages.js),
// or deep-linked to one game's gallery (`/photos/{gamePk}`, `initialGamePk`
// below) from that game's own box score — see GamePhotosStrip.jsx.
export function GamePhotosPage({ initialGamePk = null } = {}) {
  useDocumentTitle('Game Photos')
  const [teamId, setTeamId] = useState(PINNED_TEAM_ID)
  const [season, setSeason] = useState(CURRENT_YEAR)
  const [gamePk, setGamePk] = useState(initialGamePk)
  // Arriving via a deep link skips straight to that game's gallery — the
  // club/season picker only reappears once the user asks to browse.
  const [browsing, setBrowsing] = useState(initialGamePk == null)

  const pickTeam = (id) => {
    setTeamId(id)
    setGamePk(null)
  }
  const pickSeason = (y) => {
    setSeason(y)
    setGamePk(null)
  }
  const browseAllGames = () => {
    setBrowsing(true)
    setGamePk(null)
  }

  const scheduleState = useAsync(
    () => (teamId ? fetchTeamSchedule(teamId, season, SPORT_IDS.MLB) : Promise.resolve([])),
    [teamId, season],
  )
  const today = toApiDate()
  const games = (scheduleState.data ?? [])
    .filter((g) => g.apiDate <= today)
    .sort((a, b) => (a.apiDate < b.apiDate ? 1 : a.apiDate > b.apiDate ? -1 : 0))

  const photosState = useAsync(
    () => (gamePk ? fetchGamePhotos(gamePk) : Promise.resolve([])),
    [gamePk],
  )
  const photos = photosState.data ?? []

  return (
    <div className="screen gamephotos">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Game Photos</h1>
      </header>

      <div className="gamephotos__notice" role="note">
        <span className="gamephotos__noticetag">Unsealed</span>
        <p>
          A photo here can show the result at a glance, so unlike the rest of
          Tally Baseball, nothing on this page is spoiler-safe. Personal use
          only — photos are copyrighted (AP/Getty/USA Today Sports via MLB).
        </p>
      </div>

      {browsing && (
        <>
          <section className="gamephotos__section">
            <div className="gamephotos__sectionhead">
              <h2 className="gamephotos__sectiontitle">Club</h2>
            </div>
            <TeamFilterStrip selectedTeamId={teamId} onSelect={pickTeam} ariaLabel="Choose a club" />
          </section>

          <section className="gamephotos__section">
            <div className="gamephotos__sectionhead">
              <h2 className="gamephotos__sectiontitle">
                {teamId ? teamFullName(teamId) : 'Games'}
              </h2>
              {teamId && (
                <select
                  className="gamephotos__seasonselect"
                  aria-label="Season"
                  value={season}
                  onChange={(e) => pickSeason(Number(e.target.value))}
                >
                  {SEASONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!teamId && <p className="hint hint--prose">Pick a club above to browse its games.</p>}

            {teamId && (
              <>
                <AsyncStatus
                  loading={scheduleState.loading}
                  error={scheduleState.error}
                  hasData={games.length > 0}
                  errorMessage="Couldn’t load the schedule. Try again."
                  onRetry={scheduleState.reload}
                  emptyMessage={`No ${season} games played yet.`}
                />
                {games.length > 0 && (
                  <ul className="gamephotos__games">
                    {games.map((g) => {
                      const active = g.gamePk === gamePk
                      return (
                        <li key={g.gamePk}>
                          <button
                            type="button"
                            className={`gamephotos__gamerow${active ? ' is-active' : ''}`}
                            aria-pressed={active}
                            onClick={() => setGamePk(g.gamePk)}
                          >
                            <TeamLogo teamId={g.opponent.id} name={g.opponent.name} size={26} />
                            <span className="gamephotos__gamematchup">
                              {g.isHome ? `vs ${g.opponent.abbreviation}` : `at ${g.opponent.abbreviation}`}
                              {g.gameNumber > 1 && <em> · Gm {g.gameNumber}</em>}
                            </span>
                            <span className="gamephotos__gamedate">{monthDay(g.apiDate)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        </>
      )}

      {gamePk && (
        <section className="gamephotos__section gamephotos__gallery">
          <div className="gamephotos__sectionhead">
            <h2 className="gamephotos__sectiontitle">Photos</h2>
            <span className="gamephotos__galleryactions">
              {photos.length > 0 && (
                <span className="gamephotos__resultsmeta">{photos.length} found</span>
              )}
              {!browsing && (
                <button type="button" className="gamephotos__browsebtn" onClick={browseAllGames}>
                  Browse other games
                </button>
              )}
            </span>
          </div>
          <AsyncStatus
            loading={photosState.loading}
            error={photosState.error}
            hasData={photos.length > 0}
            errorMessage="Couldn’t load photos for this game. Try again."
            onRetry={photosState.reload}
            emptyMessage="No photos posted for this game yet."
          />
          {photos.length > 0 && (
            <ul className="gamephotos__grid">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <a
                    href={photo.original}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open full-resolution photo in a new tab"
                  >
                    <img src={photo.thumb} alt="" loading="lazy" />
                    <span className="gamephotos__expand" aria-hidden="true">⤢</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ReportFooter />
    </div>
  )
}
