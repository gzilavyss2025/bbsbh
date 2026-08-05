import { useMemo } from 'react'
import { fetchStampGames } from '../api/logbook.js'
import { computeLogbookStats } from '../api/logbookStats.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useStamps } from '../hooks/useStamps.js'
import { useNav } from '../lib/nav.js'
import { logbookPath } from '../lib/route.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'

// The Logbook retrospective — what your collection adds up to (ADR-0035, the
// game-stamps PRD §6, Tier 1).
//
// ===========================================================================
// THIS PAGE RENDERS FINAL SCORES PLAINLY. The containment argument, again.
// ===========================================================================
// Identical to LogbookPage.jsx's, and it holds for exactly one reason: every
// game this page reads is one of THIS user's own stamps, and a stamp only
// exists for a game its owner already finished revealing — the server refuses
// to mint one otherwise, against its own record of the reveal ratchet and the
// spoiled-day consent map, never against a claim from the client.
//
// That makes one rule absolute here: **nothing on this page may involve a game
// the user has not stamped.** No "recent games you might stamp", no "this
// club's other results", no league context, no season totals for a club you
// have seen twice. Every one of those would put an unrevealed score on screen
// and collapse the argument in a single line of JSX. Read ADR-0035 before
// adding a number whose source is anything but `stamps` + the facts resolved
// for those exact gamePks.
//
// The math is NOT here. It lives in src/api/logbookStats.js, pure and unit
// tested (test/logbook-stats.test.js) — deliberately unlike
// FirstScorebookPage.jsx, which derives its equivalent numbers inline in
// `useMemo`s where nothing can reach them. This file is a rendering of a
// computed object and should stay that way.

const FULL_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function dateLabel(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  return year ? FULL_DATE.format(new Date(year, month - 1, day)) : ''
}

function record(row) {
  return row.ties ? `${row.wins}–${row.losses}–${row.ties}` : `${row.wins}–${row.losses}`
}

// A one-game "run" is not one — the same rule the module applies to the two
// headline streaks, so the table under them can't contradict them. The column
// heading carries the word; the cell is a bare number so it sets in mono
// tabular figures beside the record, like every other count on the page.
function streakLabel(streak) {
  return streak && streak.length >= 2 ? String(streak.length) : '—'
}

function SectionHead({ eyebrow, title, note }) {
  return (
    <header className="logbookstats__sectionhead">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {note && <p className="logbookstats__prose">{note}</p>}
    </header>
  )
}

function Tally({ items }) {
  return (
    <div className="logbookstats__tally">
      {items.map(({ key, value, label }) => (
        <div key={key}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

export function LogbookStatsPage() {
  useDocumentTitle('Game Log Stats')
  const navigate = useNav()
  const { seasons, forSeason } = useStamps()

  // Every live stamp, all seasons — the retrospective is about the whole book,
  // which is why this route is deliberately not season-paged (see route.js).
  const stamps = useMemo(
    () => seasons.flatMap((season) => forSeason(season)),
    [seasons, forSeason],
  )
  const gamePks = useMemo(() => stamps.map((s) => s.gamePk), [stamps])
  // Keyed on the pk list rather than the array identity, so editing a note
  // (which rewrites the stamp objects) doesn't refetch every game's facts.
  const pkKey = gamePks.join(',')

  const facts = useAsync((signal) => fetchStampGames(gamePks, { signal }), [pkKey])

  // Reveal-only by classification, called with the user's own stamps and
  // nothing else — see the header, and ADR-0001.
  const stats = useMemo(
    () => computeLogbookStats(stamps, facts.data ?? {}),
    [stamps, facts.data],
  )

  if (!stats.stamps) {
    return (
      <div className="screen">
        <SiteHeader />
        {/* Same header as the populated page below — an empty collection is a
            state of this screen, not a different screen. */}
        <header className="topbar">
          <button type="button" className="topbar__back" onClick={() => navigate(logbookPath())}>
            ‹ Game Log
          </button>
          <h1 className="topbar__title">Stats</h1>
        </header>
        <p className="hint hint--prose">
          No stamps yet. Reveal a game’s box score and stamp it — once a few are in
          the book, this is where it adds up.
        </p>
        <ReportFooter />
      </div>
    )
  }

  const { homeRoad } = stats

  return (
    <div className="screen logbookstats">
      <SiteHeader />
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={() => navigate(logbookPath())}>
          ‹ Game Log
        </button>
        <h1 className="topbar__title">Stats</h1>
      </header>

      {stats.dateRange && (
        <p className="logbookstats__dateline">
          <span>{dateLabel(stats.dateRange[0])}</span>
          <i aria-hidden="true" />
          <span>{dateLabel(stats.dateRange[1])}</span>
        </p>
      )}

      <Tally
        items={[
          { key: 'games', value: stats.games, label: stats.games === 1 ? 'Game' : 'Games' },
          { key: 'innings', value: stats.innings, label: 'Innings' },
          { key: 'runs', value: stats.runs, label: 'Runs' },
          { key: 'clubs', value: stats.clubs.length, label: 'Clubs seen' },
        ]}
      />

      {/* Said plainly rather than folded into the totals: a book that reports a
          smaller number as if it were whole is the failure mode the MiLB
          degradation convention exists to avoid. */}
      {stats.pending > 0 && (
        <p className="hint hint--prose">
          {stats.pending} {stats.pending === 1 ? 'stamp is' : 'stamps are'}{' '}
          {facts.loading ? 'still resolving' : 'not available offline'} — the totals
          below leave {stats.pending === 1 ? 'it' : 'them'} out.
        </p>
      )}

      <section className="logbookstats__section">
        <SectionHead
          eyebrow="The shape of the book"
          title="How your games finished"
          note={`${stats.runsPerGame.toFixed(1)} runs a game across everything you logged.`}
        />
        <Tally
          items={[
            { key: 'onerun', value: stats.oneRunGames, label: 'One-run games' },
            { key: 'shutouts', value: stats.shutouts, label: 'Shutouts' },
            { key: 'extras', value: stats.extraInningGames, label: 'Extra innings' },
            { key: 'blowouts', value: stats.blowouts, label: 'Blowouts' },
          ]}
        />
        <div className="logbookstats__splits">
          <div>
            <span>Home vs. road</span>
            <strong>
              {homeRoad.homeWins}–{homeRoad.awayWins}
              {homeRoad.ties ? `–${homeRoad.ties}` : ''}
            </strong>
            {/* A stamp carries no attendance record, so this can only ever mean
                which dugout won — never "games you saw in person". */}
            <small>Home clubs’ record in the games you logged</small>
          </div>
          <div>
            <span>How you took them in</span>
            <strong>
              {stats.modes.watched}–{stats.modes.followed}
            </strong>
            <small>Watched vs. followed</small>
          </div>
        </div>
      </section>

      {(stats.longestWinStreak || stats.longestLossStreak) && (
        <section className="logbookstats__section">
          <SectionHead
            eyebrow="Runs of luck"
            title="Your longest streaks"
            note="Counted across the games in this book only — the games in between are ones you didn’t see."
          />
          <div className="logbookstats__streaks">
            {stats.longestWinStreak && (
              <article>
                <TeamLogo
                  teamId={stats.longestWinStreak.teamId}
                  name={stats.longestWinStreak.name}
                  size={34}
                />
                <strong>{stats.longestWinStreak.length}</strong>
                <span>
                  straight {stats.longestWinStreak.abbreviation} wins
                </span>
                <small>
                  {dateLabel(stats.longestWinStreak.from)} — {dateLabel(stats.longestWinStreak.to)}
                </small>
              </article>
            )}
            {stats.longestLossStreak && (
              <article>
                <TeamLogo
                  teamId={stats.longestLossStreak.teamId}
                  name={stats.longestLossStreak.name}
                  size={34}
                />
                <strong>{stats.longestLossStreak.length}</strong>
                <span>
                  straight {stats.longestLossStreak.abbreviation} losses
                </span>
                <small>
                  {dateLabel(stats.longestLossStreak.from)} — {dateLabel(stats.longestLossStreak.to)}
                </small>
              </article>
            )}
          </div>
        </section>
      )}

      <section className="logbookstats__section">
        <SectionHead
          eyebrow="The standings, as stamped"
          title="Your record watching each club"
          note={
            stats.mostSeenClub && stats.mostSeenOpponent
              ? `You’ve logged the ${stats.mostSeenClub.name} ${stats.mostSeenClub.games} times, most often against the ${stats.mostSeenOpponent.name}.`
              : undefined
          }
        />
        <div className="logbookstats__table logbookstats__table--clubs">
          <div className="logbookstats__tablehead">
            <span>Club</span>
            <span>G</span>
            <span>Record</span>
            <span>Best run</span>
          </div>
          {stats.clubs.map((club) => (
            <div className="logbookstats__row" key={club.id}>
              <span>
                <TeamLogo teamId={club.id} name={club.name} size={22} />
                <b>{club.abbreviation || club.name}</b>
              </span>
              <span>{club.games}</span>
              <span>{record(club)}</span>
              <span>{streakLabel(club.longestWin)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="logbookstats__section">
        <SectionHead eyebrow="Seen the most" title="Matchups and ballparks" />
        <div className="logbookstats__pair">
          <div className="logbookstats__table">
            <div className="logbookstats__tablehead">
              <span>Matchup</span>
              <span>G</span>
            </div>
            {stats.matchups.slice(0, 8).map((matchup) => (
              <div className="logbookstats__row logbookstats__row--pair" key={matchup.key}>
                <span>
                  <TeamLogo teamId={matchup.teams[0].id} name={matchup.teams[0].name} size={20} />
                  <b>{matchup.teams[0].abbreviation}</b>
                  <i>vs</i>
                  <TeamLogo teamId={matchup.teams[1].id} name={matchup.teams[1].name} size={20} />
                  <b>{matchup.teams[1].abbreviation}</b>
                </span>
                <span>{matchup.games}</span>
              </div>
            ))}
          </div>
          <div className="logbookstats__table">
            <div className="logbookstats__tablehead">
              <span>Ballpark</span>
              <span>G</span>
            </div>
            {stats.venues.slice(0, 8).map((venue) => (
              <div className="logbookstats__row" key={venue.name}>
                <span>
                  <b>{venue.name}</b>
                </span>
                <span>{venue.games}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {stats.pitchers.length > 0 && (
        <section className="logbookstats__section">
          <SectionHead
            eyebrow="On the mound"
            title="Pitchers of record you saw most"
            note="Wins and losses charged in your games alone, plus the saves that closed them."
          />
          <div className="logbookstats__table">
            <div className="logbookstats__tablehead">
              <span>Pitcher</span>
              <span>W</span>
              <span>L</span>
              <span>SV</span>
            </div>
            {stats.pitchers.slice(0, 10).map((pitcher) => (
              <div className="logbookstats__row" key={pitcher.name}>
                <span>
                  <b>{pitcher.name}</b>
                </span>
                <span>{pitcher.wins}</span>
                <span>{pitcher.losses}</span>
                <span>{pitcher.saves}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.seasons.length > 1 && (
        <section className="logbookstats__section">
          <SectionHead eyebrow="Season by season" title="How the book fills" />
          <div className="logbookstats__table logbookstats__table--duo">
            <div className="logbookstats__tablehead">
              <span>Season</span>
              <span>G</span>
            </div>
            {stats.seasons.map((season) => (
              <div className="logbookstats__row" key={season.season}>
                <span>
                  <b>{season.season}</b>
                </span>
                <span>{season.games}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <ReportFooter />
    </div>
  )
}
