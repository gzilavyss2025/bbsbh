import '../../styles/35-postseason-series.css'
import { usePostseasonBracket } from '../../hooks/postseason/usePostseasonBracket.js'
import { recordLine } from '../../api/postseason/text.js'
import { loadSeriesStats, BATTING_CATEGORIES, SERIES_PITCHING_CATEGORIES } from '../../api/postseasonSeries.js'
import { fetchGameCardsByPk } from '../../api/schedule.js'
import { computePlayOfTheGame } from '../../api/boxscore.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { usePastGameSignals } from '../../hooks/usePastGameSignals.js'
import { gamePath } from '../../lib/route.js'
import { toApiDate } from '../../lib/dates.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { TeamLink } from '../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { BackBtn } from '../../components/chrome/BackBtn.jsx'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { GameResultFace } from '../../components/game/GameResultFace.jsx'
import { SectionHead } from '../../components/ui/frame/SectionHead.jsx'
import { seriesGameBuckets, upcomingGameLabel } from './selectors.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// No year, same reasoning as PostseasonSeriesPage.jsx's own monthDay: a
// series' games all land inside one October.
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// The record AS OF one logged game, in the same three wordings recordLine
// (text.js) uses for the series' current state — mirrored here rather than
// reused because a Series' `games` carry a winnerId, not two scores, so the
// tally itself is simpler than PostseasonSeriesPage.jsx's seriesStatusAfterGame.
function recordAfterGame(series, index) {
  const [a, b] = series.slots
  let aWins = 0
  let bWins = 0
  for (let i = 0; i <= index; i++) {
    const winnerId = series.games[i].winnerId
    if (winnerId === a.club?.id) aWins += 1
    else if (winnerId === b.club?.id) bWins += 1
  }
  const hi = Math.max(aWins, bWins)
  const lo = Math.min(aWins, bWins)
  const isClincher = series.decided && index === series.games.length - 1
  if (isClincher) return `${series.winner.abbreviation} won ${hi}–${lo}`
  if (aWins === bWins) return `Series tied ${hi}–${lo}`
  const leader = aWins > bWins ? a.club : b.club
  return `${leader?.abbreviation ?? ''} leads ${hi}–${lo}`
}

// Sweeps only the ALREADY-COUNTED games (before the cutoff) for their box
// scores, cards and win-probability signals — the same footing as
// PostseasonSeriesPage.jsx's loadSeries, minus the postseason-history.json
// read this page skips: `games` comes straight off the bracket Series. Never
// called with the cutoff game or an upcoming one — loadSeriesStats fetches a
// `/boxscore` per game, which for a still-live game would resolve its score.
async function loadGameLog(games, getSignals) {
  const [stats, cardsByPk, signalsEntries] = await Promise.all([
    loadSeriesStats(games),
    fetchGameCardsByPk(games.map((g) => g.gamePk)),
    Promise.all(
      games.map((g) =>
        getSignals(g.gamePk)
          .then((signals) => [g.gamePk, signals])
          .catch(() => [g.gamePk, null]),
      ),
    ),
  ])
  return { stats, cardsByPk, gameSignals: Object.fromEntries(signalsEntries) }
}

const EMPTY_LOG = { stats: null, cardsByPk: {}, gameSignals: {} }

// Live Postseason Series: a series still in progress, or a 2026 series that
// finished but has nowhere else to go yet — postseason-history.json only
// gets a season once its whole World Series is Final, via a hand-run script
// (trap 7, docs/api/postseason.md), so any 2026 series opens here regardless
// of `decided`. Same sections as the finished page (record, game-by-game log,
// series leaders, rosters), plus two this page alone needs: today's game
// (named, never scored) and the games still to play. The cutoff is this
// page's own `?d=` (asOf), capped at today by usePostseasonBracket — never
// Scores Unlocked, which does not apply to the postseason bracket (ADR-0087).
export function LiveSeriesPage({ seriesId, asOf }) {
  const back = () => window.history.back()
  const cutoffInput = asOf ?? toApiDate(new Date())
  // The season rides along in the id itself ({year}-{round}-{awayId}-{homeId}),
  // so there is no need to infer it from the cutoff's own year.
  const season = Number(String(seriesId).split('-')[0]) || undefined
  const { bracket, loading: bracketLoading, error: bracketError } = usePostseasonBracket(cutoffInput, { season })
  const series = bracket?.series.find((s) => s.id === seriesId) ?? null

  const getSignals = usePastGameSignals()
  const games = series?.games ?? []
  const gamePks = games.map((g) => g.gamePk).join(',')
  const { loading: logLoading, error: logError, data: log } = useAsync(
    () => (games.length ? loadGameLog(games, getSignals) : Promise.resolve(EMPTY_LOG)),
    [gamePks],
  )

  useDocumentTitle(series ? `${bracket.season} ${series.name}` : null)

  const bracketGate = AsyncGate({
    loading: bracketLoading,
    error: bracketError,
    data: bracket,
    screenClass: 'psseries pslive',
    noun: 'series',
    onBack: back,
  })
  if (bracketGate) return bracketGate
  const seriesGate = AsyncGate({
    loading: false,
    error: null,
    data: series,
    screenClass: 'psseries pslive',
    noun: 'series',
    onBack: back,
  })
  if (seriesGate) return seriesGate

  const { results, today, upcoming } = seriesGameBuckets(series)
  const { stats, cardsByPk, gameSignals } = log ?? EMPTY_LOG
  const hasBatting = stats && Object.values(stats.batting).some((v) => v.length > 0)
  const hasPitching = stats && Object.values(stats.pitching).some((v) => v.length > 0)
  const clubs = series.slots.map((slot) => slot.club).filter(Boolean)

  return (
    <div className="screen psseries pslive">
      <SiteHeader />
      <BackBtn onClick={back} />

      <header className="topbar">
        <h1 className="topbar__title">{series.name}</h1>
      </header>

      {/* The result hero, reusing the finished page's exact banner/ledger
          classes (.psseries__result etc.) — but the headline is recordLine's
          state ("Series tied 1–1", "CHC leads 2–1", or a decided
          series' own "TOR won 3–1": trap 7 means a decided 2026 series
          still opens here) rather than a clinch declaration, since this page
          may render before there IS one. Each club's win trace is the same
          inked-cell ledger idiom (.psseries__cell--won); winner/loser tinting
          applies only once the series actually is decided. */}
      <section className="psseries__result">
        <div className="psseries__banner">
          <h2 className="psseries__headline">{recordLine(series)}</h2>
        </div>
        <div className="psseries__ledger">
          {clubs.map((club) => {
            const wins = series.slots.find((slot) => slot.club?.id === club.id)?.wins ?? 0
            const isWinner = series.decided && series.winner?.id === club.id
            const isLoser = series.decided && series.eliminated?.id === club.id
            return (
              <div
                key={club.id}
                className={`psseries__team${isWinner ? ' psseries__team--winner' : ''}${isLoser ? ' psseries__team--loser' : ''}`}
              >
                <TeamLink id={club.id} className="psseries__teamlink">
                  <TeamLogo teamId={club.id} name={teamClubNameShort(club.id)} size={32} />
                  <span className="psseries__teamname">{teamClubNameShort(club.id)}</span>
                </TeamLink>
                <div className="psseries__cells" aria-hidden="true">
                  {results.map((g) => (
                    <span
                      key={g.gameNumber}
                      className={`psseries__cell${g.winnerId === club.id ? ' psseries__cell--won' : ''}`}
                    >
                      {g.winnerId === club.id ? g.gameNumber : ''}
                    </span>
                  ))}
                </div>
                <span className="psseries__wins">{wins}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Today's game — named, never scored. No feed or box-score fetch ever
          runs for this gamePk on this page (root CLAUDE.md's spoiler rule). */}
      {today && (
        <section className="psseries__today">
          <SectionHead look="label">Today</SectionHead>
          <div className="psseries__todaycard">
            <span className="psseries__todaygame">Game {today.gameNumber}</span>
            <div className="psseries__todayteams">
              {clubs.map((club) => (
                <span key={club.id} className="psseries__todayteam">
                  <TeamLogo teamId={club.id} name={teamClubNameShort(club.id)} size={24} />
                  {club.abbreviation}
                </span>
              ))}
            </div>
            <p className="hint">No score here until this game is scored on its own page.</p>
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="psseries__games">
          <SectionHead look="label">Game by game</SectionHead>
          <div className="psseries__log">
            <div className="psseries__logbody">
              {results.map((g, i) => {
                const card = cardsByPk?.[g.gamePk]
                const signals = gameSignals?.[g.gamePk]
                const boxScorePath = card
                  ? gamePath(card.officialDate, card.away.abbreviation, card.home.abbreviation, 'boxscore', card.gameNumber)
                  : null
                const potg = signals ? computePlayOfTheGame(signals.winProb, signals.feed) : null
                const isClincher = series.decided && i === results.length - 1
                return (
                  <article key={g.gameNumber} className="psseries__entry" aria-label={`Game ${g.gameNumber}`}>
                    <span className="psseries__gamenum" aria-hidden="true">
                      {g.gameNumber}
                    </span>
                    <div className="psseries__entryhead">
                      <span className="psseries__gamedate">{monthDay(g.date)}</span>
                      <span className={`psseries__gamestatus${isClincher ? ' psseries__gamestatus--final' : ''}`}>
                        {recordAfterGame(series, i)}
                      </span>
                    </div>
                    {signals && boxScorePath ? (
                      <>
                        <div className="psseries__facewrap">
                          <GameResultFace
                            feed={signals.feed}
                            winProb={signals.winProb}
                            boxScorePath={boxScorePath}
                            hidePlayOfGame
                          />
                        </div>
                        <SeriesPlayOfTheGame
                          potg={potg}
                          awayAbbr={card.away.abbreviation}
                          homeAbbr={card.home.abbreviation}
                        />
                      </>
                    ) : (
                      <p className="hint hint--error">Couldn’t load this game’s result.</p>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="psseries__upcoming">
          <SectionHead look="label">Still to play</SectionHead>
          <ul className="psseries__upcominglist">
            {upcoming.map((g) => (
              <li key={g.gameNumber} className="psseries__upcomingrow">
                <span className="psseries__upcominggame">Game {g.gameNumber}</span>
                <span className="psseries__upcomingdate">{g.date ? monthDay(g.date) : upcomingGameLabel(g)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {logLoading && !stats && results.length > 0 && <p className="hint">Loading the series so far…</p>}
      {logError && !stats && results.length > 0 && (
        <p className="hint hint--error">Couldn’t load this series’ leaders and rosters.</p>
      )}

      {(hasBatting || hasPitching) && (
        <div className="psseries__leaders">
          {hasBatting && (
            <SeriesLeaderBoard title="Series batting leaders" categories={BATTING_CATEGORIES} byCategory={stats.batting} />
          )}
          {hasPitching && (
            <SeriesLeaderBoard
              title="Series pitching leaders"
              categories={SERIES_PITCHING_CATEGORIES}
              byCategory={stats.pitching}
            />
          )}
        </div>
      )}

      {stats && clubs.length > 0 && (
        <div className="psseries__rosters">
          {clubs.map((club) => (
            <RosterCard key={club.id} teamId={club.id} roster={stats.rosters[club.id]} />
          ))}
        </div>
      )}
    </div>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Same idea as PostseasonSeriesPage.jsx's own SeriesPlayOfTheGame — a
// headshot-led panel for the wide layout's second column, suppressed
// entirely with no WPA or a failed box-score resolution.
function SeriesPlayOfTheGame({ potg, awayAbbr, homeAbbr }) {
  if (!potg?.desc) return null
  const halfLabel = potg.half === 'top' ? 'Top' : 'Bottom'
  const hasScore = potg.awayScore != null && potg.homeScore != null
  return (
    <div className="psseries__potg">
      <h4 className="psseries__potgTitle">Play of the game</h4>
      <div className="psseries__potgBody">
        <Headshot personId={potg.batterId} name={potg.batterName} teamId={potg.batterTeamId} className="psseries__potgShot" />
        <div className="psseries__potgMain">
          {potg.batterName && (
            <div className="psseries__potgWho">
              <PlayerLink id={potg.batterId} className="psseries__potgName">
                {potg.batterName}
              </PlayerLink>
              {(potg.batterTeamAbbr || potg.batterPos) && (
                <span className="psseries__potgMeta">{[potg.batterTeamAbbr, potg.batterPos].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          )}
          <p className="psseries__potgDesc">
            {potg.inning != null && (
              <span className="psseries__potgWhen">
                {halfLabel} {ordinal(potg.inning)}{' '}
              </span>
            )}
            {potg.desc}
            {hasScore && (
              <span className="psseries__potgScore">
                {' '}
                {awayAbbr} {potg.awayScore}, {homeAbbr} {potg.homeScore}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

// Same agate board as PostseasonSeriesPage.jsx's SeriesLeaderBoard/
// SeriesLeaderLine, over a 1-3 game sample instead of a full series — renders
// nothing when no category clears postseasonSeries.js's own qualifying floor,
// which is expected for a Wild Card series' first game or two.
function SeriesLeaderBoard({ title, categories, byCategory }) {
  const ranked = categories
    .map((category) => ({ category, entries: byCategory[category.key] ?? [] }))
    .filter((r) => r.entries.length > 0)
  if (ranked.length === 0) return null
  return (
    <section className="psseries__lboard">
      <SectionHead look="label">{title}</SectionHead>
      <div className="psseries__lrows">
        {ranked.map(({ category, entries }) => (
          <SeriesLeaderLine key={category.key} category={category} entries={entries} />
        ))}
      </div>
    </section>
  )
}

function SeriesLeaderLine({ category, entries }) {
  const [leader, ...chasers] = entries
  const leaderTied = chasers.length > 0 && chasers[0].value === leader.value
  return (
    <div className="psseries__lcat">
      <span className="psseries__lkey" aria-label={category.label} title={category.label}>
        {category.short}
        {leaderTied && (
          <span className="psseries__ltied" aria-hidden="true">
            tied
          </span>
        )}
      </span>
      <div className="psseries__lmain">
        <div className="psseries__ltop">
          <TeamLogo teamId={leader.teamId} name={teamClubNameShort(leader.teamId)} size={18} />
          <PlayerLink id={leader.id} className="psseries__lname">
            {leader.name}
          </PlayerLink>
          <span className="psseries__lval">{leader.display}</span>
        </div>
        {chasers.length > 0 && (
          <p className="psseries__lchase">
            {chasers.map((e, i) => (
              <span key={e.id} className="psseries__lchaser">
                <TeamLogo teamId={e.teamId} name={teamClubNameShort(e.teamId)} size={13} />
                <PlayerLink id={e.id} className="psseries__lchasername">
                  {e.name}
                </PlayerLink>
                <span className="psseries__lchaserval">{e.display}</span>
                {i < chasers.length - 1 && (
                  <span className="psseries__ldot" aria-hidden="true">
                    ·
                  </span>
                )}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}

// Same reference-roster card as PostseasonSeriesPage.jsx's RosterCard/
// RosterGroup — every player who dressed for at least one counted game.
function RosterCard({ teamId, roster }) {
  const positionPlayers = roster?.positionPlayers ?? []
  const pitchers = roster?.pitchers ?? []
  if (positionPlayers.length === 0 && pitchers.length === 0) return null
  return (
    <section className="psseries__rostercard">
      <div className="psseries__rosterhead">
        <TeamLogo teamId={teamId} name={teamClubNameShort(teamId)} size={24} />
        <span className="psseries__rosterteam">{teamClubNameShort(teamId)} roster</span>
      </div>
      {positionPlayers.length > 0 && <RosterGroup title="Position players" rows={positionPlayers} />}
      {pitchers.length > 0 && <RosterGroup title="Pitchers" rows={pitchers} />}
    </section>
  )
}

function RosterGroup({ title, rows }) {
  return (
    <div className="psseries__rostergroup">
      <h4 className="psseries__rostergrouptitle">{title}</h4>
      <ul className="psseries__rosterlist">
        {rows.map((p) => (
          <li key={p.id} className="psseries__rosterrow">
            <span className="psseries__rosternum">{p.jersey}</span>
            <PlayerLink id={p.id} className="psseries__rostername">
              {p.name}
            </PlayerLink>
            <span className="psseries__rosterpos">{p.position}</span>
            <span className="psseries__rosterchev">›</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
