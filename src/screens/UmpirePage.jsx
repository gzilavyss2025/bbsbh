import { useState } from 'react'
import { loadUmpire } from '../api/umpires.js'
import { UmpireZoneMap } from '../components/UmpireAccuracyModal.jsx'
import { UmpireTierPill } from '../components/UmpireTierPill.jsx'
import { gamePath } from '../lib/route.js'
import { ALL_MLB_TEAM_IDS, teamClubName } from '../lib/teams.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useNav } from '../lib/nav.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TOP_VENUES_LIMIT = 5
const HP_RECORDS_LIMIT = 10

// Non-regular-season game contexts get a small chip in the game log. Short label
// for the chip, full name for its tooltip; a regular-season row (gameType R or
// untagged) gets no chip.
const CTX_SHORT = { F: 'WC', D: 'DS', L: 'LCS', W: 'WS', A: 'ASG' }
const CTX_FULL = {
  F: 'Wild Card',
  D: 'Division Series',
  L: 'League Championship Series',
  W: 'World Series',
  A: 'All-Star Game',
}

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// Every one of the 30 MLB clubs, ranked by games involving that club this
// umpire has worked (away or home both count — this counts games *involving*
// a team, not just ones at its own park; see topVenues below for "at their
// own park"), most first. A club he hasn't worked stays in the list at
// count 0 (sort is stable, so the zero-count clubs trail in team-id order)
// so the grid always shows the whole league — UmpirePage grays those out.
function allTeams(games) {
  const byTeam = new Map()
  for (const g of games) {
    for (const [id, abbr] of [[g.awayId, g.awayAbbr], [g.homeId, g.homeAbbr]]) {
      if (!id) continue
      if (!byTeam.has(id)) byTeam.set(id, { id, abbr, count: 0 })
      byTeam.get(id).count++
    }
  }
  return ALL_MLB_TEAM_IDS.map((id) => byTeam.get(id) ?? { id, abbr: teamClubName(id) || '', count: 0 }).sort(
    (a, b) => b.count - a.count,
  )
}

// Every ballpark the umpire has worked a game at, ranked most games first. A
// park belongs to one level, so each venue carries the level it was worked at
// (for the AAA chip in the list).
function topVenues(games) {
  const byVenue = new Map()
  for (const g of games) {
    if (!g.venueId) continue
    if (!byVenue.has(g.venueId))
      byVenue.set(g.venueId, { id: g.venueId, name: g.venueName, level: g.level ?? 'MLB', count: 0 })
    byVenue.get(g.venueId).count++
  }
  return [...byVenue.values()].sort((a, b) => b.count - a.count)
}

// Each team's W-L record in games this umpire called from behind the plate —
// the final score is already in the schedule payload gen-umpires.mjs pulls
// (no per-game feed fetch needed), so this is a plain tally over the HP
// games. Ranked by decisions (games), most first; a suspended-and-not-
// resumed tie (isWinner false for both sides) counts toward neither W nor L.
function hpTeamRecords(games) {
  const byTeam = new Map()
  for (const g of games) {
    if (g.role !== 'HP') continue
    for (const [id, abbr, won] of [
      [g.awayId, g.awayAbbr, g.awayIsWinner],
      [g.homeId, g.homeAbbr, g.homeIsWinner],
    ]) {
      if (!id) continue
      if (!byTeam.has(id)) byTeam.set(id, { id, abbr, wins: 0, losses: 0 })
      const rec = byTeam.get(id)
      if (won === true) rec.wins++
      else if (won === false) rec.losses++
    }
  }
  return [...byTeam.values()].sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
}

// The plate-accuracy summary: season called-pitch accuracy, its league rank,
// and the miss-tendency zone map, from the append-only umpire-accuracy.json
// (merged into the umpire record by loadUmpire). Absent — like the other
// cards here — when the umpire has no accuracy data (MiLB, or no scored games
// yet), so it never shows an empty shell. Called-pitch counts carry no score;
// see the plan's spoiler audit.
function PlateAccuracyCard({ accuracy, rank, zoneCells, title = 'Plate accuracy', subtitle = null }) {
  const s = accuracy?.season
  if (!s || !s.called) return null
  const pct = (s.accuracy * 100).toFixed(1)
  return (
    <section className="umpage__card umpage__acccard">
      <h2 className="umpage__cardtitle">{title}</h2>
      {subtitle && <p className="umpage__cardsub">{subtitle}</p>}
      <div className="umpage__accrow">
        <div className="umpage__acctile">
          <span className="umpage__accpct">{pct}%</span>
          <span className="umpage__acctilelabel">Accuracy</span>
        </div>
        {rank && (
          <div className="umpage__acctile">
            <span className="umpage__accpct">#{rank.rank}</span>
            <span className="umpage__acctilelabel">of {rank.total} plate umpires</span>
          </div>
        )}
      </div>
      <p className="umpage__acclabel">
        {s.correct.toLocaleString()} of {s.called.toLocaleString()} called pitches
        {s.games > 0 && ` · ${s.games} ${s.games === 1 ? 'game' : 'games'} behind the plate`}
      </p>
      {zoneCells && (
        <div className="umpage__acczone">
          <UmpireZoneMap cells={zoneCells} />
          <p className="umpage__acczonecap">
            The red boxes show the parts of the strike zone where he misses the most calls,
            compared to a typical umpire.
          </p>
        </div>
      )}
    </section>
  )
}

// An umpire's page: every MLB game he's worked this season, most recent
// first, with a toggle to show only the games he had behind the plate. Game
// dates and who-worked-what carry no score, so — unlike the player/team pages
// this mirrors — there's no spoiler cutoff to thread through: the page just
// shows the umpire's whole season.
export function UmpirePage({ id }) {
  const { loading, error, data } = useAsync(() => loadUmpire(id), [id])
  const navigate = useNav()
  const [hpOnly, setHpOnly] = useState(false)
  const [showAllVenues, setShowAllVenues] = useState(false)
  const [showAllRecords, setShowAllRecords] = useState(false)
  useDocumentTitle(data?.name || null)

  const back = () => window.history.back()
  const gate = AsyncGate({ loading, error, data, screenClass: 'umpire', noun: 'umpire', onBack: back })
  if (gate) return gate

  const games = data.games ?? []
  // Per-game accuracy figures span both levels — the two byGamePk maps cover
  // disjoint gamePks, so a plain union keys every scored HP row.
  const accByGamePk = { ...(data.accuracyAAA?.byGamePk ?? {}), ...(data.accuracy?.byGamePk ?? {}) }
  const hpCount = games.filter((g) => g.role === 'HP').length
  const aaaCount = games.filter((g) => g.level === 'AAA').length
  const mlbCount = games.length - aaaCount
  const shown = hpOnly ? games.filter((g) => g.role === 'HP') : games
  // The teams grid is the 30-club MLB league, so it counts MLB games only; AAA
  // games still show in the venue list and the game log below.
  const teams = allTeams(games.filter((g) => (g.level ?? 'MLB') === 'MLB'))
  const venues = topVenues(games)
  const shownVenues = showAllVenues ? venues : venues.slice(0, TOP_VENUES_LIMIT)
  const hpRecords = hpTeamRecords(games)
  const shownRecords = showAllRecords ? hpRecords : hpRecords.slice(0, HP_RECORDS_LIMIT)

  return (
    <div className="screen umpire">
      <SiteHeader />
      <BackBtn onClick={back} />

      <header className="umpage__head">
        <div className="umpage__namerow">
          <h1 className="umpage__name">{data.name}</h1>
          {data.rank?.tier && <UmpireTierPill tier={data.rank.tier} />}
        </div>
        <p className="umpage__sub">
          {data.season ? `${data.season} season` : 'This season'} ·{' '}
          {aaaCount > 0
            ? `${mlbCount} MLB · ${aaaCount} AAA`
            : `${games.length} ${games.length === 1 ? 'game' : 'games'}`}
          {hpCount > 0 && ` · ${hpCount} behind the plate`}
        </p>
      </header>

      <div className="umpage__cards">
        <PlateAccuracyCard
          accuracy={data.accuracy}
          rank={data.rank}
          zoneCells={data.zoneCells}
          title={data.accuracyAAA ? 'MLB plate accuracy' : 'Plate accuracy'}
        />
        {data.accuracyAAA && (
          <PlateAccuracyCard
            accuracy={data.accuracyAAA}
            rank={data.rankAAA}
            zoneCells={data.zoneCellsAAA}
            title="AAA plate accuracy"
          />
        )}
        {data.accuracyPost && (
          <PlateAccuracyCard
            accuracy={data.accuracyPost}
            rank={null}
            zoneCells={data.zoneCellsPost}
            title="Postseason plate accuracy"
            subtitle="Playoff games — not counted in the season ranking."
          />
        )}

        {teams.length > 0 && (
          <section className="umpage__card">
            <h2 className="umpage__cardtitle">Most worked teams</h2>
            <ul className="umpage__teamgrid">
              {teams.map((t) => (
                <li
                  key={t.id}
                  className={`umpage__teamitem ${t.count === 0 ? 'umpage__teamitem--unworked' : ''}`}
                >
                  <TeamLink id={t.id} className="umpage__teamlink">
                    <TeamLogo teamId={t.id} name={t.abbr} size={34} bw={t.count === 0} />
                    {t.count > 0 && <span className="umpage__teamcount">{t.count}</span>}
                  </TeamLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {venues.length > 0 && (
          <section className="umpage__card">
            <h2 className="umpage__cardtitle">Most worked ballparks</h2>
            <ul className="umpage__venuelist">
              {shownVenues.map((v, i) => (
                <li key={v.id} className="umpage__venuerow">
                  <span className="umpage__venuerank">{i + 1}</span>
                  <span className="umpage__venuename">
                    {v.name || 'Unknown'}
                    {v.level === 'AAA' && <span className="umpage__levelchip">AAA</span>}
                  </span>
                  <span className="umpage__venuecount">{v.count}</span>
                </li>
              ))}
            </ul>
            {!showAllVenues && venues.length > TOP_VENUES_LIMIT && (
              <button
                type="button"
                className="plink umpage__showall"
                onClick={() => setShowAllVenues(true)}
              >
                Show all {venues.length}
              </button>
            )}
          </section>
        )}

        {hpRecords.length > 0 && (
          <section className="umpage__card">
            <h2 className="umpage__cardtitle">Team records, this ump behind the plate</h2>
            <ul className="umpage__venuelist">
              {shownRecords.map((r, i) => (
                <li key={r.id} className="umpage__venuerow">
                  <span className="umpage__venuerank">{i + 1}</span>
                  <TeamLogo teamId={r.id} name={r.abbr} size={18} className="umpage__reclogo" />
                  <span className="umpage__venuename">{r.abbr}</span>
                  <span className="umpage__venuecount">
                    {r.wins}-{r.losses}
                  </span>
                </li>
              ))}
            </ul>
            {!showAllRecords && hpRecords.length > HP_RECORDS_LIMIT && (
              <button
                type="button"
                className="plink umpage__showall"
                onClick={() => setShowAllRecords(true)}
              >
                Show all {hpRecords.length}
              </button>
            )}
          </section>
        )}
      </div>

      <div className="umpage__filter" role="group" aria-label="Filter games by base">
        <button
          type="button"
          className={`umpage__filterbtn ${!hpOnly ? 'is-active' : ''}`}
          onClick={() => setHpOnly(false)}
        >
          All games
        </button>
        <button
          type="button"
          className={`umpage__filterbtn ${hpOnly ? 'is-active' : ''}`}
          onClick={() => setHpOnly(true)}
          disabled={hpCount === 0}
        >
          Home plate only
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="hint">
          {hpOnly ? 'No games behind the plate this season.' : 'No games recorded this season.'}
        </p>
      ) : (
        <ul className="umpage__list">
          {shown.map((g) => {
            const acc = g.role === 'HP' ? accByGamePk[g.gamePk] : null
            // Zebra-stripe the plate-umpire games only in the mixed "All games"
            // view, where they'd otherwise blend in with his base/field
            // assignments — pointless once "Home plate only" already filters to
            // nothing else.
            const isHpRow = g.role === 'HP' && !hpOnly
            return (
              <li
                key={`${g.gamePk}-${g.gameNumber}-${g.role}`}
                className={`umpage__row ${isHpRow ? 'umpage__row--hp' : ''}`}
              >
                <span className="umpage__role">{g.role}</span>
                <span className="umpage__date">{monthDay(g.date)}</span>
                <button
                  type="button"
                  className="plink umpage__matchup"
                  onClick={() =>
                    navigate(gamePath(g.date, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber))
                  }
                >
                  {g.awayAbbr} @ {g.homeAbbr}
                </button>
                {g.level === 'AAA' && <span className="umpage__levelchip">AAA</span>}
                {CTX_SHORT[g.gameType] && (
                  <span className="umpage__ctxchip" title={CTX_FULL[g.gameType]}>
                    {CTX_SHORT[g.gameType]}
                  </span>
                )}
                {acc?.called ? (
                  <span className="umpage__rowacc">
                    {((acc.correct / acc.called) * 100).toFixed(1)}%
                    <span className="umpage__rowacclabel"> Accurate strike zone</span>
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
