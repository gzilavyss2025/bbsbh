import { useCallback, useEffect, useRef, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fetchTeamPhotoBatch } from '../../api/gamePhotos.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { BackBtn } from '../../components/chrome/BackBtn.jsx'
import { AsyncGate, AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { loadTeamPhotos } from './data/loadTeamPhotos.js'

const PHOTO_BATCH_GAMES = 8
const PHOTO_INITIAL_TARGET = 20
const PHOTO_GROW_STEP = 20

// ===========================================================================
// A club's professional photos, one season, one continuous grid
// ===========================================================================
// The destination behind the Photos rail's own "Full season" door
// (TeamPhotosRail.jsx, TeamHighlightsRail's neighbor on both the Overview
// and Games tab) — every photographer still MLB's content package carries
// for this club's games this season (including one still in progress — see
// loadTeamPhotos.js/allStartedGames), newest first, growing as you scroll
// toward Opening Day. Same photographer-only filter as that rail
// (`onlyPhotographer` inside `fetchTeamPhotoBatch`), same walk-back shape,
// just a vertical page instead of a horizontal rail and with no `limit` —
// there is no lighter version of "the whole season."
//
// Deliberately NOT part of the spoiler-safe scored-game flow (root
// CLAUDE.md), for the same reason `/photos` (GamePhotosPage.jsx) and
// gamePhotos.js itself aren't: a recap or celebration photo narrates the
// outcome just by being visible, so this page carries the same "Unsealed"
// notice rather than a SealBox. It goes one step further than every other
// gamePhotos.js consumer by including a LIVE game, not just decided ones —
// a deliberate product call (there's no expectation of spoiler coverage on
// a photo-browsing page reached by its own explicit door), not an oversight
// of the usual `won != null` invariant the rest of the app holds to.
export function TeamPhotosPage({ id, asOf, sportId: _sportId }) {
  const teamId = Number(id)
  const data = useAsync(() => loadTeamPhotos(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: data.loading,
    error: data.error,
    data: data.data,
    screenClass: 'gamephotos',
    noun: 'team',
    onBack: back,
  })
  if (gate) return gate

  const { team, season, seasonGames } = data.data

  return (
    <TeamPhotosSeason
      key={`${team.id}-${season}`}
      team={team}
      season={season}
      games={seasonGames}
      onBack={back}
    />
  )
}

// ---------------------------------------------------------------------------
// The season grid — its own component so `games`/`team` are stable props a
// walk-back's refs can close over, the same split GamesTab uses between
// itself and TeamPhotosRail.
// ---------------------------------------------------------------------------
function TeamPhotosSeason({ team, season, games, onBack }) {
  useDocumentTitle(`${team.name} Photos`)

  const consumedRef = useRef(0)
  const photosRef = useRef([])
  const cacheRef = useRef(new Map())
  const inFlightRef = useRef(false)
  const activeRef = useRef(true)
  const sentinelRef = useRef(null)

  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [exhausted, setExhausted] = useState(false)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  // Same shape as TeamPhotosRail's own growPhotos, minus the horizontal-
  // scroll bookkeeping this page has no use for — see fetchTeamPhotoBatch's
  // header for what one batch step does (fetch + filter + cache, by gamePk).
  const growPhotos = useCallback(
    async (targetCount) => {
      if (inFlightRef.current || !activeRef.current) return
      inFlightRef.current = true
      setLoading(true)
      while (
        activeRef.current &&
        consumedRef.current < games.length &&
        photosRef.current.length < targetCount
      ) {
        const { photos: batchPhotos, consumed } = await fetchTeamPhotoBatch(
          games,
          team.id,
          consumedRef.current,
          PHOTO_BATCH_GAMES,
          cacheRef.current,
        )
        consumedRef.current += consumed
        if (!activeRef.current) break
        // fetchTeamPhotoBatch returns a batch oldest-of-that-batch-first (the
        // order TeamPhotosRail wants, since it PREPENDS each older batch onto
        // a rail already anchored newest-right). This grid instead APPENDS
        // each successive (older) batch to build a newest-first feed, so it
        // has to reverse each batch first — otherwise the newest game in the
        // very first batch lands at the END of that batch's run instead of
        // the top of the page, which read as "last week is missing" even
        // though it was fetched, just buried mid-list.
        photosRef.current = [...photosRef.current, ...[...batchPhotos].reverse()]
        setPhotos(photosRef.current)
      }
      if (activeRef.current) {
        if (consumedRef.current >= games.length) setExhausted(true)
        setLoading(false)
      }
      inFlightRef.current = false
    },
    [games, team.id],
  )

  useEffect(() => {
    growPhotos(PHOTO_INITIAL_TARGET)
  }, [growPhotos])

  // Scrolling the sentinel near the bottom of the viewport grows the window
  // toward Opening Day — the vertical-page counterpart to the rail's
  // left-edge sentinel. A generous rootMargin means the next batch is
  // usually in by the time the reader actually reaches the bottom.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || exhausted || loading) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        growPhotos(photosRef.current.length + PHOTO_GROW_STEP)
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [exhausted, loading, growPhotos])

  return (
    <div className="screen gamephotos">
      <SiteHeader />
      <BackBtn onClick={onBack} />
      <header className="topbar">
        <h1 className="topbar__title">
          <TeamLogo teamId={team.id} name={team.name} size={32} />
          {team.name} Photos
        </h1>
      </header>

      <div className="gamephotos__notice" role="note">
        <span className="gamephotos__noticetag">Unsealed</span>
        <p>
          Every professional photo MLB’s content package carries for the {season} season, newest
          first — including tonight’s game, if one’s in progress. Personal use only — photos are
          copyrighted (AP/Getty/USA Today Sports via MLB).
        </p>
      </div>

      <section className="gamephotos__section gamephotos__gallery">
        <AsyncStatus
          loading={loading && photos.length === 0}
          error={null}
          hasData={photos.length > 0}
          emptyMessage={`No photos posted for the ${season} season yet.`}
        />
        {photos.length > 0 && (
          <ul className="gamephotos__grid gamephotos__grid--large">
            {photos.map((photo) => {
              const { playerName, teamId: subjectTeamId, teamName } = photo.focus
              return (
                <li key={photo.id} data-apidate={photo.apiDate}>
                  <a
                    className="gamephotos__tile"
                    href={photo.original}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={
                      playerName
                        ? `Open full-resolution photo of ${playerName} in a new tab`
                        : 'Open full-resolution photo in a new tab'
                    }
                  >
                    <img src={photo.thumb} alt={photo.headline} loading="lazy" />
                    <span className="gamephotos__expand" aria-hidden="true">
                      ⤢
                    </span>
                  </a>
                  {(playerName || subjectTeamId) && (
                    <p className="gamephotos__subject">
                      {subjectTeamId && <TeamLogo teamId={subjectTeamId} name={teamName} size={16} />}
                      <span className="gamephotos__subjectname">{playerName || teamName}</span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!exhausted && <div ref={sentinelRef} className="gamephotos__loadmore" aria-hidden="true" />}
        {loading && photos.length > 0 && (
          <p className="hint" aria-hidden="true">
            Loading&hellip;
          </p>
        )}
      </section>

      <ReportFooter />
    </div>
  )
}
