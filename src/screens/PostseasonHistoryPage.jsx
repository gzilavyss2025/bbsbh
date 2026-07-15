import { useState } from 'react'
import { loadPostseasonHistory } from '../api/postseasonHistory.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { PostseasonSeriesModal } from '../components/PostseasonSeriesModal.jsx'
import { teamClubNameShort, teamFullName } from '../lib/teams.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// One series tile in the bracket — the two clubs, the final series score,
// winner bolded. Purely a summary; tapping it is what opens the animated
// PostseasonSeriesModal with the game-by-game detail + MVP.
function SeriesTile({ series, onOpen }) {
  const { teamA, teamB, winnerTeamId } = series
  return (
    <button
      type="button"
      className="psseries"
      onClick={() => onOpen(series)}
    >
      <span className="psseries__label">{series.label}</span>
      {[teamA, teamB].map((t) => (
        <span
          className={`psseries__team${t.teamId === winnerTeamId ? ' psseries__team--winner' : ''}`}
          key={t.teamId}
        >
          <TeamLogo teamId={t.teamId} name={teamClubNameShort(t.teamId)} size={20} />
          <span className="psseries__teamname">{teamClubNameShort(t.teamId)}</span>
          <span className="psseries__wins">{t.wins}</span>
        </span>
      ))}
    </button>
  )
}

function SeasonBracket({ season, onOpenSeries }) {
  return (
    <section className="pshistory__season">
      <div className="pshistory__seasonhead">
        <span className="pshistory__year">{season.year}</span>
        <TeamLink id={season.championTeamId} className="pshistory__champion">
          <TeamLogo
            teamId={season.championTeamId}
            name={teamFullName(season.championTeamId)}
            size={28}
          />
          <span className="pshistory__championname">{teamFullName(season.championTeamId)}</span>
          <span className="pshistory__championtag">
            <img
              src="/brand/world-series-trophy-icon.png"
              alt=""
              className="pshistory__championtrophy"
              width={14}
              height={14}
              aria-hidden="true"
            />
            World Series Champion
          </span>
        </TeamLink>
      </div>

      <div className="psbracket">
        {season.rounds.map((round) => (
          <div className="psbracket__round" key={round.key}>
            <p className="psbracket__roundlabel">
              {round.key === 'worldseries' && (
                <img
                  src="/brand/world-series-trophy-icon.png"
                  alt=""
                  className="psbracket__roundtrophy"
                  width={12}
                  height={12}
                  aria-hidden="true"
                />
              )}
              {round.label}
            </p>
            <div className="psbracket__list">
              {round.series.map((series) => (
                <SeriesTile
                  key={series.id}
                  series={round.key === 'worldseries' ? { ...series, isWorldSeries: true } : series}
                  onOpen={onOpenSeries}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Postseason History: the completed bracket (who advanced, how many games
// each series went) for the last several MLB postseasons, one section per
// year, newest first, each round laid out as its own column so the whole
// thing reads left-to-right as a bracket. Tapping a series slides an
// animated card over showing the game-by-game scores and the round MVP
// (LCS/World Series only). Data comes from
// scripts/gen-postseason-history.mjs, a hand-run precompute (a finished
// postseason's results are immutable, same footing as war-history.json/
// awards-history.json) — no SealBox needed, same as those pages: a past
// series' score carries no LIVE game's spoiler risk.
export function PostseasonHistoryPage() {
  useDocumentTitle('Postseason History')
  const { loading, error, data } = useAsync(() => loadPostseasonHistory(), [])
  const [activeSeries, setActiveSeries] = useState(null)
  const seasons = data?.seasons ?? []
  const updated = monthDay(data?.generatedAt?.slice(0, 10))

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Postseason History</h1>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={seasons.length > 0}
        errorMessage="Couldn’t load Postseason History. Try again."
        emptyMessage="No postseason history is available right now."
        emptyProse
      />

      {seasons.length > 0 && (
        <>
          <div className="pshistory__list">
            {seasons.map((season) => (
              <SeasonBracket key={season.year} season={season} onOpenSeries={setActiveSeries} />
            ))}
          </div>
          {updated && <p className="hint prospects__caption">Updated {updated}.</p>}
        </>
      )}

      {activeSeries && (
        <PostseasonSeriesModal series={activeSeries} onClose={() => setActiveSeries(null)} />
      )}
    </div>
  )
}
