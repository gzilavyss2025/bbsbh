import { useMemo } from 'react'
import { fetchStampGames } from '../api/logbook.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useStamps } from '../hooks/useStamps.js'
import { useNav } from '../lib/nav.js'
import { gamePath, logbookPath, logbookStatsPath } from '../lib/route.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { ReportFooter } from '../components/ReportFooter.jsx'
import { GameStamp } from '../components/GameStamp.jsx'

// The Logbook — every game you stamped, as the stamps themselves (ADR-0035).
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

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function monthDay(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  return year ? MONTH_DAY.format(new Date(year, month - 1, day)) : ''
}

export function LogbookPage({ season: requestedSeason = null }) {
  useDocumentTitle('Logbook')
  const navigate = useNav()
  const { counts, seasons, forSeason } = useStamps()

  // A bare /logbook lands on the newest season the collection actually has —
  // only the local store knows which that is, so the route deliberately leaves
  // it null and the resolution happens here.
  const season = requestedSeason ?? seasons[0] ?? null
  const stamps = useMemo(() => (season ? forSeason(season) : []), [season, forSeason])
  const gamePks = useMemo(() => stamps.map((s) => s.gamePk), [stamps])
  // Keyed on the pk list rather than the array identity so a note edit (which
  // rewrites the stamp objects) doesn't refetch every game's facts.
  const pkKey = gamePks.join(',')

  const facts = useAsync((signal) => fetchStampGames(gamePks, { signal }), [pkKey])
  const byPk = facts.data ?? {}

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Logbook</h1>
      </header>

      {total === 0 ? (
        <p className="hint hint--prose">
          No stamps yet. Reveal a game’s box score and stamp it — it lands here.
        </p>
      ) : (
        <>
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
            {stamps.length} {stamps.length === 1 ? 'stamp' : 'stamps'}
            {season ? ` · ${season}` : ''}
            {/* The retrospective spans every season, not the one on screen —
                see LogbookStatsPage.jsx. */}
            <button
              type="button"
              className="logbook__statslink"
              onClick={() => navigate(logbookStatsPath())}
            >
              What it adds up to ›
            </button>
          </p>

          <ul className="logbook__grid">
            {stamps.map((entry) => {
              const game = byPk[entry.gamePk]
              return (
                <li className="logbook__cell" key={entry.gamePk}>
                  {game ? (
                    <button
                      type="button"
                      className="logbook__stampbtn"
                      onClick={() =>
                        navigate(
                          gamePath(
                            game.date,
                            game.away.abbreviation,
                            game.home.abbreviation,
                            'boxscore',
                            game.gameNumber,
                          ),
                        )
                      }
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
