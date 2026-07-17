import { useState } from 'react'
import { loadPostseasonHistory } from '../api/postseasonHistory.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useMediaQuery, WIDE_QUERY } from '../hooks/useMediaQuery.js'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { PostseasonSeriesModal } from '../components/PostseasonSeriesModal.jsx'
import { teamClubNameShort, teamFullName } from '../lib/teams.js'

const AL = 103
const NL = 104

// Seasons at/after this year show eagerly; older ones (the data goes back
// to 2000 — see gen-postseason-history.mjs) sit behind "Load more" so the
// wide layout's default view isn't 26 stacked full brackets.
const DEFAULT_CUTOFF_YEAR = 2020

// Wraps every Division/Championship series into the uniform "lane" shape
// the columns render (see wildCardLanes below for the Wild Card round's
// mixed bye/series lanes).
function seriesLanes(list) {
  return list.map((s) => ({ type: 'series', key: s.id, series: s }))
}

// Orders the Wild Card round's lanes (2 byes + 2 matchups, the 2022+
// format) so each one sits in the SAME top/bottom slot as the team it
// becomes in its Division Series card — a bye lines up with wherever its
// seed reads on the DS card (teamA/top or teamB/bottom), and a Wild Card
// matchup lines up with wherever its eventual winner reads there. DS team
// order itself comes straight off the schedule (whichever club was away in
// that series' game 1), so there's no seed-based rule to lean on here —
// this reads the actual DS card and mirrors it, rather than assuming seed
// order. Falls back to seed order (byes first) for any shape other than
// the exact 2-bye/2-series case (the pre-2022 3-bye/1-game format, or
// anything unexpected).
function wildCardLanes(byes, wc, ds) {
  if (byes.length !== 2 || wc.length !== 2 || ds.length !== 2) {
    return [
      ...byes.map((b) => ({ type: 'bye', key: `bye-${b.teamId}`, bye: b })),
      ...wc.map((s) => ({ type: 'series', key: s.id, series: s })),
    ]
  }

  const items = [
    ...byes.map((b) => ({ type: 'bye', key: `bye-${b.teamId}`, bye: b, teamId: b.teamId })),
    ...wc.map((s) => ({ type: 'series', key: s.id, series: s, teamId: s.winnerTeamId })),
  ]

  // Which DS series a team ends up in, and whether it reads top (teamA) or
  // bottom (teamB) on that card.
  const dsSlot = (teamId) => {
    for (let i = 0; i < ds.length; i++) {
      if (ds[i].teamA.teamId === teamId) return { dsIndex: i, pos: 0 }
      if (ds[i].teamB.teamId === teamId) return { dsIndex: i, pos: 1 }
    }
    return { dsIndex: ds.length, pos: 0 }
  }

  return items
    .map((item) => ({ item, slot: dsSlot(item.teamId) }))
    .sort((a, b) => a.slot.dsIndex - b.slot.dsIndex || a.slot.pos - b.slot.pos)
    .map(({ item }) => item)
}

// Shapes one league's rounds within a season into what a bracket column
// needs. A bye (seed 1/2, or 1-3 in the pre-2022 single-game Wild Card
// format) is never itself a series in the data — it's reconstructed here as
// "a seeded team that never appears in this league's Wild Card round" — so
// the column still shows every seed, not just the ones with a game.
function leagueBracket(season, leagueId) {
  const byKey = Object.fromEntries(season.rounds.map((r) => [r.key, r]))
  const wc = (byKey.wildcard?.series ?? []).filter((s) => s.leagueId === leagueId)
  const ds = (byKey.division?.series ?? []).filter((s) => s.leagueId === leagueId)
  const cs = (byKey.lcs?.series ?? []).filter((s) => s.leagueId === leagueId)

  const seedOf = new Map()
  for (const s of [...wc, ...ds, ...cs]) {
    seedOf.set(s.teamA.teamId, s.teamA.seed)
    seedOf.set(s.teamB.teamId, s.teamB.seed)
  }
  const wcTeamIds = new Set(wc.flatMap((s) => [s.teamA.teamId, s.teamB.teamId]))
  const byes = [...seedOf.entries()]
    .filter(([teamId]) => !wcTeamIds.has(teamId))
    .sort((a, b) => a[1] - b[1])
    .map(([teamId, seed]) => ({ teamId, seed }))

  return {
    wcLanes: wildCardLanes(byes, wc, ds),
    dsLanes: seriesLanes(ds),
    csLanes: seriesLanes(cs),
  }
}

// One team's line inside a bracket card — seed chip, logo, club name, win
// count — shared by the bye ghost slot, an ordinary matchup, and the World
// Series card so "seed left of the logo" never has to be reimplemented per
// card type.
function SeedRow({ teamId, seed, wins, winner, faded, iconSize = 16 }) {
  return (
    <span className={`seedrow${winner ? ' seedrow--winner' : ''}${faded ? ' seedrow--faded' : ''}`}>
      <span className="seedrow__seed">{seed ?? ''}</span>
      <TeamLogo teamId={teamId} name={teamClubNameShort(teamId)} size={iconSize} />
      <span className="seedrow__name">{teamClubNameShort(teamId)}</span>
      {wins != null && <span className="seedrow__wins">{wins}</span>}
    </span>
  )
}

// A top-2 seed's Wild Card round slot when it isn't playing one — not a
// button, since there's no series behind it to open.
function ByeCard({ teamId, seed }) {
  return (
    <div className="seedcard seedcard--bye">
      <SeedRow teamId={teamId} seed={seed} />
      <span className="seedcard__byetag">Bye</span>
    </div>
  )
}

function MatchupCard({ series, onOpen }) {
  const { teamA, teamB, winnerTeamId } = series
  return (
    <button type="button" className="seedcard" onClick={() => onOpen(series)}>
      {[teamA, teamB].map((t) => (
        <SeedRow
          key={t.teamId}
          teamId={t.teamId}
          seed={t.seed}
          wins={t.wins}
          winner={t.teamId === winnerTeamId}
          faded={t.teamId !== winnerTeamId}
        />
      ))}
    </button>
  )
}

function Lane({ lane, onOpenSeries }) {
  return lane.type === 'bye' ? (
    <ByeCard teamId={lane.bye.teamId} seed={lane.bye.seed} />
  ) : (
    <MatchupCard series={lane.series} onOpen={onOpenSeries} />
  )
}

function BracketColumn({ side, label, lanes, onOpenSeries }) {
  return (
    <div className={`psbracket__col psbracket__col--${side}`}>
      <p className={`psbracket__collabel psbracket__collabel--${side}`}>{label}</p>
      <div className="psbracket__lanes">
        {lanes.map((lane) => (
          <Lane key={lane.key} lane={lane} onOpenSeries={onOpenSeries} />
        ))}
      </div>
    </div>
  )
}

// The World Series card's Series MVP row. A real headshot keeps the
// position as a small pill anchored to the photo's corner (pswscard__pos);
// when there's no real photo on file, the mug slot shows the MVP's own team
// crest (a clean TeamLogo, not Headshot's boxed/clipped fallback treatment —
// hideFallback keeps Headshot from rendering that itself) and the position
// reads as plain text after the name instead.
function SeriesMvp({ mvp }) {
  const [hasPhoto, setHasPhoto] = useState(true)
  return (
    <div className="pswscard__mvp">
      <span className="pswscard__mug">
        <Headshot
          personId={mvp.playerId}
          name={mvp.name}
          teamId={mvp.teamId}
          className="pswscard__shot"
          hideFallback
          onFallback={(mode) => setHasPhoto(mode == null)}
        />
        {!hasPhoto && (
          <TeamLogo teamId={mvp.teamId} name={teamClubNameShort(mvp.teamId)} size={40} className="pswscard__mvplogo" />
        )}
        {hasPhoto && mvp.position && <span className="pswscard__pos">{mvp.position}</span>}
      </span>
      <span className="pswscard__mvpinfo">
        <span className="pswscard__mvptag">Series MVP</span>
        <span className="pswscard__mvpname">
          {mvp.name}
          {!hasPhoto && mvp.position && <span className="pswscard__mvppos"> {mvp.position}</span>}
        </span>
      </span>
    </div>
  )
}

// Full-width bracket: 7 columns — AL Wild Card → Division → Championship
// converging from the left, the World Series fixed center, NL rounds
// mirroring back out to the right. Seasons before the Wild Card round
// existed (2000-2011 — straight from Division Series) carry no 'wildcard'
// entry in season.rounds at all, so both Wild Card columns are dropped
// (psbracket--no-wc collapses the grid to 5 tracks) rather than rendering
// a column of fake "Bye" cards for every Division Series team.
function BracketGrid({ season, onOpenSeries }) {
  const al = leagueBracket(season, AL)
  const nl = leagueBracket(season, NL)
  const ws = season.rounds.find((r) => r.key === 'worldseries')?.series?.[0] ?? null
  const hasWildCard = season.rounds.some((r) => r.key === 'wildcard')

  return (
    <div className={`psbracket${hasWildCard ? '' : ' psbracket--no-wc'}`}>
      {hasWildCard && (
        <BracketColumn side="al" label="AL Wild Card" lanes={al.wcLanes} onOpenSeries={onOpenSeries} />
      )}
      <BracketColumn side="al" label="AL Division Series" lanes={al.dsLanes} onOpenSeries={onOpenSeries} />
      <BracketColumn side="al" label="AL Championship" lanes={al.csLanes} onOpenSeries={onOpenSeries} />
      <div className="psbracket__col psbracket__col--ws">
        <p className="psbracket__collabel psbracket__collabel--ws">
          <img
            src="/brand/world-series-trophy-icon.png"
            alt=""
            className="psbracket__roundtrophy"
            aria-hidden="true"
          />
          World Series
        </p>
        <div className="psbracket__lanes">
          {ws && (
            <button type="button" className="pswscard" onClick={() => onOpenSeries({ ...ws, isWorldSeries: true })}>
              {[ws.teamA, ws.teamB].map((t) => (
                <SeedRow
                  key={t.teamId}
                  teamId={t.teamId}
                  seed={t.seed}
                  wins={t.wins}
                  winner={t.teamId === ws.winnerTeamId}
                  faded={t.teamId !== ws.winnerTeamId}
                  iconSize={22}
                />
              ))}
              {ws.mvp && <SeriesMvp mvp={ws.mvp} />}
            </button>
          )}
        </div>
      </div>
      <BracketColumn side="nl" label="NL Championship" lanes={nl.csLanes} onOpenSeries={onOpenSeries} />
      <BracketColumn side="nl" label="NL Division Series" lanes={nl.dsLanes} onOpenSeries={onOpenSeries} />
      {hasWildCard && (
        <BracketColumn side="nl" label="NL Wild Card" lanes={nl.wcLanes} onOpenSeries={onOpenSeries} />
      )}
    </div>
  )
}

function StackRound({ side, label, lanes, onOpenSeries }) {
  return (
    <>
      <p className={`psstack__roundlabel psstack__roundlabel--${side}`}>{label}</p>
      {lanes.map((lane) => (
        <Lane key={lane.key} lane={lane} onOpenSeries={onOpenSeries} />
      ))}
    </>
  )
}

// Condensed single-column phone layout: the same reading order as the wide
// grid (AL rounds down, World Series, NL rounds back out) flowed vertically
// instead of across seven columns, since a horizontal bracket doesn't
// survive iPhone width. Round labels become thin dividers rather than a
// column header.
function BracketStack({ season, onOpenSeries }) {
  const al = leagueBracket(season, AL)
  const nl = leagueBracket(season, NL)
  const ws = season.rounds.find((r) => r.key === 'worldseries')?.series?.[0] ?? null
  const hasWildCard = season.rounds.some((r) => r.key === 'wildcard')

  return (
    <div className="psstack">
      {hasWildCard && (
        <StackRound side="al" label="AL Wild Card" lanes={al.wcLanes} onOpenSeries={onOpenSeries} />
      )}
      <StackRound side="al" label="AL Division Series" lanes={al.dsLanes} onOpenSeries={onOpenSeries} />
      <StackRound side="al" label="AL Championship" lanes={al.csLanes} onOpenSeries={onOpenSeries} />
      <p className="psstack__roundlabel psstack__roundlabel--ws">
        <img
          src="/brand/world-series-trophy-icon.png"
          alt=""
          className="psbracket__roundtrophy"
          aria-hidden="true"
        />
        World Series
      </p>
      {ws && (
        <button type="button" className="pswscard pswscard--stack" onClick={() => onOpenSeries({ ...ws, isWorldSeries: true })}>
          {[ws.teamA, ws.teamB].map((t) => (
            <SeedRow
              key={t.teamId}
              teamId={t.teamId}
              seed={t.seed}
              wins={t.wins}
              winner={t.teamId === ws.winnerTeamId}
              faded={t.teamId !== ws.winnerTeamId}
              iconSize={18}
            />
          ))}
        </button>
      )}
      <StackRound side="nl" label="NL Championship" lanes={nl.csLanes} onOpenSeries={onOpenSeries} />
      <StackRound side="nl" label="NL Division Series" lanes={nl.dsLanes} onOpenSeries={onOpenSeries} />
      {hasWildCard && (
        <StackRound side="nl" label="NL Wild Card" lanes={nl.wcLanes} onOpenSeries={onOpenSeries} />
      )}
    </div>
  )
}

function SeasonBracket({ season, onOpenSeries, wide }) {
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
              aria-hidden="true"
            />
            World Series Champion
          </span>
        </TeamLink>
      </div>

      {wide ? (
        <BracketGrid season={season} onOpenSeries={onOpenSeries} />
      ) : (
        <BracketStack season={season} onOpenSeries={onOpenSeries} />
      )}
    </section>
  )
}

// Postseason History: the completed bracket (who advanced, how many games
// each series went, and each team's seed) for every MLB postseason back to
// 2000. Tablet/desktop shows every season from DEFAULT_CUTOFF_YEAR on
// stacked, each one a real 7-column bracket (AL converging from the left,
// NL from the right, World Series centered — see BracketGrid), with a
// "Load more" button to reveal the older seasons rather than stacking 26
// full brackets by default. A phone can't fit that bracket sideways, so
// below the app's one wide-layout breakpoint (useMediaQuery/WIDE_QUERY,
// shared with GameView's lineup-page swap) it shows ONE season at a time,
// condensed to a single vertical column (BracketStack), with a fixed
// bottom stepper — same shape as InningViewer's half-inning navigator and
// StandingsPage's day stepper — to page Older/Newer across the FULL
// history (the stepper only ever renders one season, so there's no "load
// more" wall to hit there). Tapping any matchup (bye slots excepted — they
// carry no series) opens the same animated PostseasonSeriesModal at every
// width. Data comes from scripts/gen-postseason-history.mjs, a hand-run
// precompute (a finished postseason's results are immutable, same footing
// as war-history.json/awards-history.json) — no SealBox needed, same as
// those pages: a past series' score carries no LIVE game's spoiler risk.
export function PostseasonHistoryPage() {
  useDocumentTitle('Postseason History')
  const { loading, error, data } = useAsync(() => loadPostseasonHistory(), [])
  const [activeSeries, setActiveSeries] = useState(null)
  const [yearIndex, setYearIndex] = useState(0)
  const [showAllYears, setShowAllYears] = useState(false)
  const wide = useMediaQuery(WIDE_QUERY)
  const seasons = data?.seasons ?? []
  const currentYearSeason = seasons[Math.min(yearIndex, seasons.length - 1)]
  const visibleSeasons = showAllYears
    ? seasons
    : seasons.filter((s) => s.year >= DEFAULT_CUTOFF_YEAR)
  const hasMoreYears = !showAllYears && visibleSeasons.length < seasons.length

  return (
    <div className={`screen psh-screen${!wide ? ' psyear-screen' : ''}`}>
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

      {seasons.length > 0 && wide && (
        <div className="pshistory__list">
          {visibleSeasons.map((season) => (
            <SeasonBracket key={season.year} season={season} onOpenSeries={setActiveSeries} wide />
          ))}
          {hasMoreYears && (
            <button type="button" className="pshistory__more" onClick={() => setShowAllYears(true)}>
              Load postseasons before {DEFAULT_CUTOFF_YEAR}
            </button>
          )}
        </div>
      )}

      {seasons.length > 0 && !wide && currentYearSeason && (
        <>
          <div className="pshistory__list">
            <SeasonBracket season={currentYearSeason} onOpenSeries={setActiveSeries} wide={false} />
          </div>

          <nav className="psyearnav" aria-label="Postseason year stepper">
            <button
              type="button"
              onClick={() => setYearIndex((i) => Math.min(seasons.length - 1, i + 1))}
              disabled={yearIndex >= seasons.length - 1}
              aria-label="Older postseason"
            >
              ‹ Older
            </button>
            <span className="psyearnav__label">{currentYearSeason.year}</span>
            <button
              type="button"
              onClick={() => setYearIndex((i) => Math.max(0, i - 1))}
              disabled={yearIndex === 0}
              aria-label="Newer postseason"
            >
              Newer ›
            </button>
          </nav>
        </>
      )}

      {activeSeries && (
        <PostseasonSeriesModal series={activeSeries} onClose={() => setActiveSeries(null)} />
      )}
    </div>
  )
}
