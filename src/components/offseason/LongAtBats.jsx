import { useMemo, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { atBatGamePath, clubAbbr, count, fetchLongAtBats } from '../../api/notebook.js'
import { useRouteLink } from '../../lib/nav.js'
import { monthDayShort } from '../../lib/dates.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { StrikeZone } from '../scoring/StrikeZone.jsx'
import { pitchCardInfo } from '../../api/playbyplay/pitchInfo.js'
import { fallbackFigureUrls } from '../../api/uniforms.js'
import { BatterFallbackContext } from '../logo/uniformContexts.js'
import { HeaderBug } from '../gamehud/HeaderBug.jsx'
import { teamAbbr, teamPrimaryColor } from '../../lib/teams.js'
import { PitchScene } from '../playbyplay/pitcherCard/PitchScene.jsx'
import { atBatScenePitches, atBatZone } from '../../lib/pitcherCard/atBat.js'
import { Button } from '../ui/control/Button.jsx'
import { InfoPopover } from '../ui/InfoPopover.jsx'

// "1 in every 1,700": the rate as a reader says it, rounded to the hundred.
const oneIn = (total, n) => Math.round(total / n / 100) * 100 || Math.round(total / n)
const lastName = (name) => name.split(' ').slice(1).join(' ') || name

// THE NOTEBOOK, AT MLB — one note about the season that just finished (issue
// #1078, step 4 of #1038).
//
// The wire above this says what is happening to the rosters. This says what
// happened in the season a reader has just put their scorebook away on, and it
// is the note the design study picked for MLB because it is the one thing a
// SCORER notices that a highlight reel never shows: the at-bat that would not
// end. Twelve pitches is four lines of a scorebook cell.
//
// A CENSUS, NOT A LEADERBOARD. The number is how many there were in the whole
// regular season, out of every plate appearance played — which is only sayable because
// pitch coverage at MLB is complete and every game was read
// (scripts/gen-long-at-bats.mjs). When it is not complete the note says so
// instead of quietly presenting a sample as a count; `coverage.complete` is
// exactly that check, and it is the difference between "170 of 173,710" and a
// sentence that would be false.
//
// AND IT NAMES NO RESULT, which took deciding rather than assuming. A row names
// a batter, a pitcher, a date and a pitch count. It does NOT name the at-bat's
// result, its inning, or anything about the game around it — because a
// twelve-pitch at-bat is a LENGTH, and a length is true of the at-bat whoever
// won. The generator does not store the outcome, so there is nothing here to
// leak it. Opening a row opens that game at its first lineup page, sealed under
// the same `revealedThrough` mark the slate's own cards hand over
// (api/notebook.js). That is the same line the picked-game card walks at the
// minor levels (ADR-0080), and the reason #1078's own spoiler note only asks a
// report to declare itself when it is about a RESULT.
//
// THE ROW IS THE /fouls PAGE'S, and that is a deliberate borrowing. "Most
// fouls in one plate appearance" draws the batter's face pinned left and the
// pitcher's pinned right, their names and clubs facing each other across the
// count — because a long at-bat is two men refusing to give in, and a table row
// cannot show that. This note is about the same event measured a different way,
// so it reads the same way.
//
// WHAT DID NOT COME WITH IT IS THE SCOREBUG. On /fouls the middle of the second
// line carries the score, the inning, the outs, the bases and what the at-bat
// finally did — a report page's ordinary right, and none of it this note's. The
// slot holds the DATE here instead, which is the one thing about the at-bat
// that opens its game without saying a word about it.
//
// FIVE UP FRONT, THEN TEN AT A TIME. The whole census is the answer — trimming
// it to a round number is the one thing research.md §7 forbids outright — but
// the whole census is 170 rows, and each one carries two faces now, so opening
// all of it in one press dropped a reader into eight thousand pixels of scroll
// with the rest of the page somewhere below it. The door pages instead. Every
// row is still reachable; none of them arrives uninvited.

// The longest at-bat's pitches on the Gameday zone. The census file keeps no
// at-bat index, so the game's play-by-play is read and the plate appearance
// found by its batter, pitcher and length. Nothing until it arrives.
async function fetchAtBat(row) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${row.pk}/playByPlay`)
  if (!res.ok) return null
  const feed = await res.json()
  // The census counts a little differently from the feed's isPitch flags, so
  // match the meeting and take its longest plate appearance.
  const pitched = (p) => (p.playEvents ?? []).filter((e) => e.isPitch).length
  const play = (feed.allPlays ?? [])
    .filter((p) => p.matchup?.batter?.id === row.batter.id && p.matchup?.pitcher?.id === row.pitcher.id)
    .sort((a, b) => pitched(b) - pitched(a))[0]
  if (!play) return null
  // The game as the at-bat began: the play before it carries the score, and,
  // in the same half, the outs and the runners.
  const at = feed.allPlays.indexOf(play)
  const prev = feed.allPlays[at - 1]
  const same = prev && prev.about?.inning === play.about?.inning && prev.about?.halfInning === play.about?.halfInning
  const bug = {
    away: prev?.result?.awayScore ?? 0,
    home: prev?.result?.homeScore ?? 0,
    inning: play.about?.inning,
    top: play.about?.halfInning === 'top',
    outs: same ? prev.count?.outs ?? 0 : 0,
    bases: same ? ['postOnFirst', 'postOnSecond', 'postOnThird'].map((k) => !!prev.matchup?.[k]) : [false, false, false],
  }
  return { bug, result: play.result?.description ?? null, event: play.result?.event ?? null, pitchDetails: pitchCardInfo(feed, play).pitchDetails, batSide: play.matchup?.batSide?.code ?? 'R', pitchHand: play.matchup?.pitchHand?.code ?? 'R' }
}

// Gameday's own scorebug, set to the game as the at-bat began.
function Scorebug({ row }) {
  const { data } = useAsync(() => fetchAtBat(row), [row.pk, row.batter.id])
  const b = data?.bug
  if (!b) return null
  const [first, second, third] = b.bases
  return (
    <div className="seasonnote__bug">
      <HeaderBug
        season={row.date?.slice(0, 4)}
        awayName={row.away.abbr}
        homeName={row.home.abbr}
        awayTeamId={row.away.id}
        homeTeamId={row.home.id}
        awayRuns={b.away}
        homeRuns={b.home}
        inning={b.inning}
        half={b.top ? 'top' : 'bottom'}
        batter={null}
        pitcher={null}
        bases={{ first, second, third }}
        outs={b.outs}
      />
    </div>
  )
}

// The zone, a card for whichever pitch dot the pointer is on, and how the
// at-bat ended under it.
function AtBatZone({ row }) {
  const { data } = useAsync(() => fetchAtBat(row), [row.pk, row.batter.id])
  const [tip, setTip] = useState(null)
  // The pitch-tracking replay: null shows the zone, an object plays the at-bat
  // through PitchScene's at-bat look (a new object replays it).
  const [play, setPlay] = useState(null)
  const scene = useMemo(() => (data ? atBatScenePitches(data.pitchDetails, 'hitter', data.batSide) : []), [data])
  if (!data) return null
  const side = row.batter.teamId === row.away?.id ? 'away' : 'home'
  const figures = fallbackFigureUrls(row.batter.teamId, side, data.batSide === 'L' ? 'left' : 'right')
  const last = data.pitchDetails[data.pitchDetails.length - 1]
  const onMove = (e) => {
    const no = Number(e.target.closest('g')?.querySelector('.strikezone__num')?.textContent)
    const p = no ? data.pitchDetails.find((d) => d.no === no) : null
    if (!p) return setTip(null)
    const box = e.currentTarget.getBoundingClientRect()
    setTip({ p, x: e.clientX - box.left, y: e.clientY - box.top })
  }
  return (
    <div className="seasonnote__zonecol">
      <div className="seasonnote__zonewrap" onMouseMove={onMove} onMouseLeave={() => setTip(null)}>
        {play ? (
          <div className="seasonnote__scene">
            <PitchScene
              pitches={scene}
              lefty={data.pitchHand === 'L'}
              name={row.pitcher.name}
              zone={atBatZone(data.pitchDetails)}
              atBat={scene.length}
              play={play}
            />
          </div>
        ) : (
          <BatterFallbackContext.Provider value={figures}>
            <StrikeZone pitchDetails={data.pitchDetails} batSide={data.batSide} className="seasonnote__zone" margin={0.6} />
          </BatterFallbackContext.Provider>
        )}
        {scene.length > 0 && (
          <Button
            size="control"
            skin="ink"
            className="seasonnote__play"
            onClick={() => setPlay(play ? null : { all: true })}
          >
            {play ? 'Zone' : '▶ Play'}
          </Button>
        )}
        {tip && (
          <div className="seasonnote__tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
            <span className={`pitchlist__num pitchlist__num--${tip.p.cat}`}>{tip.p.no}</span>
            <div>
              <p className="seasonnote__tiptype">{tip.p.type || 'Pitch'}</p>
              <p className="seasonnote__tipmeta">
                {tip.p.mph != null ? `${tip.p.mph} MPH · ` : ''}
                {tip.p.callDesc}
              </p>
              {tip.p.balls != null && (
                <p className="seasonnote__tipmeta">
                  Count {tip.p.balls}-{tip.p.strikes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {data.result && (
        <div className="seasonnote__result">
          <p className="t-label t-label--bold seasonnote__what">
            {last
              ? `Pitch ${last.no}: ${/walk/i.test(data.event ?? '') ? 'Ball 4' : /strikeout/i.test(data.event ?? '') ? 'Strike 3' : last.callDesc}`
              : data.event ?? 'Result'}
          </p>
          <p className="seasonnote__resulttext">{data.result}</p>
        </div>
      )}
    </div>
  )
}

export function LongAtBats({ season }) {
  const { data } = useAsync(() => fetchLongAtBats(season), [season])
  // How many rows are on screen, not a boolean — the door adds to it rather
  // than flipping it.
  // Which at-bat the scorebug, tiles and zone show: an index into the census.
  const [pick, setPick] = useState(0)
  // A club filter: an at-bat stays when the club is on either side of it.
  const [club, setClub] = useState(null)
  const linkProps = useRouteLink()

  const rows = data?.rows ?? []
  // A file for a season the page is not naming, a season still being played, or
  // one the sweep has not finished is not a census. The note is a count or it
  // is nothing.
  if (rows.length === 0 || data?.season !== season || !data?.coverage?.complete) return null

  // Its own census, shown only once the file has one and every postseason game on
  // it is read. A complete zero is still a count.
  const post = data.post?.coverage.complete ? data.post : null

  // The postseason's long at-bats join the list, each marked; the census
  // line below still counts the two seasons apart (ADR-0104).
  // `key`: a row's own id. pk + batter + pitches is not unique at ten pitches
  // (one batter can see a pitcher twice for ten in a game), and a repeated React
  // key left a stale row standing at the head of a filtered list.
  const every = [...rows, ...(post?.rows ?? []).map((r) => ({ ...r, post: true }))]
    .sort((a, b) => b.pitches - a.pitches || (a.date < b.date ? -1 : 1))
    .map((r, i) => ({ ...r, key: i }))
  const clubs = [...new Set(every.flatMap((r) => [r.batter.teamId, r.pitcher.teamId]))]
    .filter(Boolean)
    .sort((a, b) => (teamAbbr({ id: a }) < teamAbbr({ id: b }) ? -1 : 1))
  const all = club ? every.filter((r) => r.batter.teamId === club || r.pitcher.teamId === club) : every
  const top = all[pick] ?? all[0]
  const pickClub = (id) => {
    setClub(id)
    setPick(0)
  }
  // Gary asked for one number for the year (2026-11-03): the two seasons summed here.
  const plateAppearances = data.coverage.plateAppearances + (post?.coverage.plateAppearances ?? 0)
  // Every row, in a list that scrolls in its own box (five rows tall).
  const shown = all
  const path = atBatGamePath(top)

  // ONE CARD, ONE UNIT: the longest at-bat drawn one square per pitch, the
  // next longest in the same squares beside it, and the census as one line under
  // both. A phone stacks the two halves.
  return (
    <section className="seasonnote seasonnote--stories" aria-label={`The longest at-bats of ${season}`}>
      {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
          invariant is never a per-component .toUpperCase() (ADR-0017). */}
      <SectionHead as="h3" className="oseason__head">
        Longest at-bats of {season}
      </SectionHead>

      <Card frame="stamped" as="div" className="seasonnote__sheet">
        <div className="seasonnote__clubs" role="group" aria-label="Filter by club">
          <button type="button" className="seasonnote__clubpick seasonnote__clubpick--all" aria-pressed={club === null} onClick={() => pickClub(null)}>
            All
          </button>
          {clubs.map((id) => (
            <button
              key={id}
              type="button"
              className="seasonnote__clubpick"
              aria-pressed={club === id}
              aria-label={teamAbbr({ id })}
              onClick={() => pickClub(club === id ? null : id)}
            >
              <TeamLogo teamId={id} size={26} />
            </button>
          ))}
        </div>
        <div className="seasonnote__row">
          <div className="seasonnote__longest">
            <p className="seasonnote__big">
              <span className="seasonnote__n">{top.pitches}</span>
              <span className="t-label t-label--bold">pitches</span>
              {path && (
                <a className="seasonnote__when" {...linkProps(path)}>
                  {monthDayShort(top.date)}, {top.date.slice(0, 4)}
                  <span className="sr-only"> — open this game</span>
                  <span aria-hidden="true">›</span>
                </a>
              )}
            </p>
            <Scorebug row={top} />
            {/* Two stacked lines, as a broadcast matchup reads: who is up, who is throwing. */}
            <ul className="seasonnote__matchup">
              {[
                ['At bat', top.batter],
                ['Pitching', top.pitcher],
              ].map(([role, p]) => (
                <li
                  key={role}
                  className="seasonnote__side"
                  // A club may colour a card that identifies the club (ADR-0030's addendum).
                  style={{ '--side-club': teamPrimaryColor(p.teamId) || 'var(--surface-stamped-ink)' }}
                >
                  <TeamLogo teamId={p.teamId} size={120} variant="mono" className="seasonnote__sidemark" />
                  <div className="seasonnote__who">
                    <span className="seasonnote__role">{role}</span>
                    <PlayerLink id={p.id} name={p.name} className="seasonnote__name">
                      {p.name}
                    </PlayerLink>
                    <span className="seasonnote__club">{clubAbbr(top, p.teamId)}</span>
                  </div>
                  <Headshot personId={p.id} name={p.name} teamId={p.teamId} className="seasonnote__shot" />
                </li>
              ))}
            </ul>
            <div className="seasonnote__rest">
                <ol
              className="seasonnote__bars"
              // The foot fades only while there is more below; at the end, or a list
              // that fits, it sits flat.
              ref={(el) => el && (el.dataset.end = el.scrollTop + el.clientHeight >= el.scrollHeight - 2 ? 'true' : 'false')}
              onScroll={(e) => {
                const el = e.currentTarget
                el.dataset.end = el.scrollTop + el.clientHeight >= el.scrollHeight - 2 ? 'true' : 'false'
              }}
            >
                  {shown.map((row, i) => (
                    <li key={row.key}>
                      <button
                        type="button"
                        className="seasonnote__barrow"
                        aria-pressed={i === pick}
                        aria-label={`${row.batter.name} vs ${row.pitcher.name}, ${row.pitches} pitches, ${monthDayShort(row.date)}`}
                        onClick={() => setPick(i)}
                      >
                        <span className="seasonnote__barn">{row.pitches}</span>
                    <span className="seasonnote__barwho">
                      <span className="seasonnote__barside">
                        <TeamLogo teamId={row.batter.teamId} size={18} />
                        <span className="seasonnote__barname">{row.batter.name}</span>
                      </span>
                      <span className="seasonnote__barside">
                        <TeamLogo teamId={row.pitcher.teamId} size={18} />
                        <span className="seasonnote__barname seasonnote__barname--p">{row.pitcher.name}</span>
                      </span>
                    </span>
                    <span className="seasonnote__barmeta">
                      <span>
                        {row.post && <span className="seasonnote__barpost">Postseason</span>}{row.post && ' · '}
                        {monthDayShort(row.date)}
                      </span>
                      {row.event && <span className="seasonnote__barevent">{row.event}</span>}
                    </span>
                  </button>
                    </li>
                  ))}
                </ol>
                    <p className="sr-only" role="status">
                  Showing {shown.length} of {all.length} at-bats.
                </p>
              </div>
          </div>

          <AtBatZone key={`${top.pk}-${top.batter.id}`} row={top} />
        </div>


        <p className="seasonnote__census infopop-row">
          <span className="seasonnote__against">{every.length}</span> at-bats went {data.threshold}+ pitches in {season}, about 1 in every{' '}
          <span className="seasonnote__against">{count(oneIn(plateAppearances, every.length))}</span> plate appearances
          <InfoPopover label="How the at-bats are counted" className="infopop--paper">
            Regular season and postseason together: {count(plateAppearances)} plate appearances
            {post ? ` (${rows.length} of the long ones in the regular season, ${post.rows.length} in the postseason)` : ''}
            . A batter left mid-count by an inning-ending caught stealing starts a new
            at-bat next inning, and is counted as one. Each one opens its game, sealed.
          </InfoPopover>
        </p>
      </Card>
    </section>
  )
}
