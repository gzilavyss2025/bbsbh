import { useMemo } from 'react'
import {
  ranOutNights,
  ranOutSeries,
  RAN_OUT_EARLY_THROUGH,
} from '../../../api/around-the-game/absChallenges.js'
import { clubShort } from '../../../api/around-the-game/clubs.js'
import { fetchGamesByPk } from '../../../api/schedule.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { useFavoriteTeam } from '../../../hooks/preferences/useFavoriteTeam.js'
import { monthDayShort } from '../../../lib/dates.js'
import { ordinal } from '../../../lib/format.js'
import { useRouteLink } from '../../../lib/nav.js'
import { gamePath } from '../../../lib/route.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../../components/around-the-game/BoardScroller.jsx'
import { ColumnChart, roundTicks } from '../../../components/around-the-game/BroadcastBar.jsx'
import { ClubCell } from '../../../components/around-the-game/ClubCell.jsx'
import { Slab, SlabRow } from '../../../components/around-the-game/StatSlab.jsx'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { commas, inches, pct1 } from './format.js'

// OUT OF CHALLENGES — the nights a club spent both of them before the game had
// properly started, and the shape of the season those nights sit inside.
//
// THE BAND IS THE BOARD, NOT A TOP TEN, and the reason is in
// scripts/lib/abs/ranout.mjs: eighteen MLB club-games tie for tenth earliest,
// so a ten-row board would print nine real rows and one picked by nothing. The
// board is every club-game that emptied in the earliest inning any club emptied
// in — nine in MLB, thirteen in Triple-A — and the distribution above it is
// what stops those nine reading as a scandal. Most clubs that run out do it in
// the eighth or the ninth, having spent their challenges on a game that was
// still in front of them.
//
// "OUT OF CHALLENGES" CLAIMS LESS THAN IT SOUNDS LIKE. A club that has run out
// is issued one again in every extra inning (ADR-0075, scripts/lib/abs/bank.mjs
// — 54 club-games on file carry a third failed challenge and every one of them
// is in extras). So a club that emptied in the fifth really did play the sixth
// through the ninth unable to argue a pitch, which is the cost this board is
// about, and was not necessarily silent for the whole night. The caption says
// so, because the stronger reading is the one a reader will take by default.
//
// SPOILER-FREE, and this is the section on the page that sits closest to the
// line: it names a club, an opponent, a date, an inning, the call and how far
// off the edge the pitch was. None of those is a score, no row carries one, and
// test/abs-challenges.test.js asserts the exact key set on the night row rather
// than scanning it for a bad word.
//
// IT READS THE `summary` IT IS HANDED and never the file, so the page's MLB /
// Triple-A chip switches this board for free. The one fetch it does make is the
// batched schedule lookup the game links need, and that is keyed off the band
// the chip just chose — same precedent as FoulTrackerPage's game links, and it
// degrades to a plain, un-linked date rather than to a crash.

export function RanOut({ summary, clubs }) {
  const { favoriteTeamId } = useFavoriteTeam()
  const linkProps = useRouteLink()

  const nights = useMemo(() => ranOutNights(summary), [summary])
  const series = useMemo(() => ranOutSeries(nights), [nights])

  // The band's own games, resolved to the date and the two abbreviations a box
  // score route takes. Nine or thirteen ids in ONE request, re-run when the
  // level chip hands this section a different band.
  const pks = useMemo(() => (nights?.band ?? []).map((n) => n.gamePk), [nights])
  const { data: games } = useAsync(() => fetchGamesByPk(pks), [pks])

  if (!nights) return null

  const tallest = series.reduce((m, r) => (r.n > m ? r.n : m), 0)
  const pooled = series.find((r) => r.extras) ?? null

  // Two figures are printed over the columns they belong to: the band the rows
  // below name, and the inning that takes the most clubs. Nothing on this page
  // can be hovered, so the two a reader came for are printed where they sit.
  const columns = series.map((r) => ({
    key: r.inning,
    label: r.extras ? `${r.inning}+` : String(r.inning),
    value: r.n,
    hollow: r.extras,
    tone: r.mark ? 'mark' : undefined,
    note: r.mark || r.n === tallest ? commas(r.n) : null,
  }))

  return (
    <BroadcastSection title="Out of challenges">
      <SlabRow>
        <Slab
          tone="lead"
          value={commas(nights.band.length)}
          label={`Out in the ${ordinal(nights.earliest)}`}
          note="No club ran out sooner"
        />
        <Slab
          value={pct1(nights.share)}
          label="Of all club-games"
          note={`${commas(nights.emptied)} of ${commas(nights.clubGames)} emptied`}
        />
        <Slab
          value={commas(nights.early)}
          label={`Out through the ${ordinal(RAN_OUT_EARLY_THROUGH)}`}
          note="Three innings left, at least"
        />
        <Slab
          value={commas(nights.late)}
          label="Out after that"
          note={`${pct1(nights.emptied ? nights.late / nights.emptied : null)} of them`}
        />
      </SlabRow>

      <div className="colchart__panel colchart__panel--wide">
        <span className="colchart__paneltitle">
          Inning a club’s bank first reached zero
        </span>
        <ColumnChart
          columns={columns}
          max={tallest}
          ticks={roundTicks(tallest, 100)}
          label="Club-games left with no challenges, by the inning the bank emptied"
        />
      </div>

      {/* THE CAPTION HAS TO SAY WHICH EMPTYING THE BAR COUNTS. Every column is
          a club-game's FIRST emptying, so the pooled column is a club that had
          not run out until extras — and the other available reading, a club
          running out for a second time, is wrong. A hollow bar at the right-hand
          end invites exactly that reading, and nothing else on the page settles
          it. One of the few real sentences here, so it takes .rptprose. */}
      <p className="hint rptprose">
        A club is issued two challenges and keeps the ones it wins, so the bar is
        the inning a second lost challenge took its bank to zero. That is not the
        end of the argument in a game that goes long — a club that emptied in the
        fifth is issued one again in the tenth.
        {pooled ? (
          <>
            {' '}
            The last column pools the {commas(pooled.n)} club-games that had not
            emptied until extra innings, and is drawn hollow because it is a
            sliver of the season each of the other columns carries whole.
          </>
        ) : null}
      </p>

      <BoardScroller
        label={`Club-games that ran out in the ${ordinal(nights.earliest)} inning`}
      >
        <table className="standings rpt">
          <thead>
            <tr>
              <th className="team">
                Club
                {/* The band is a tie pile, so the head says the board is the
                    WHOLE of it rather than a ranked cut of it. */}
                <span className="rpt__sub">Every one that emptied this early</span>
              </th>
              <th>Out in</th>
              {/* THE DATE COMES BEFORE THE WIDE COLUMN. The board scrolls
                  sideways on a phone under a pinned club cell, so the order of
                  the columns decides what a reader meets first: club, inning
                  and the link to the game, with the six facts about the two
                  lost challenges after them. */}
              <th>Date</th>
              <th>Who lost them</th>
            </tr>
          </thead>
          <tbody>
            {nights.band.map((n) => {
              // A club emptied by ONE MAN ASKING TWICE is the shape inside the
              // band worth marking. It is read off the row rather than counted
              // in the caption: the count goes stale between the writing and
              // the merge, and the row is where a reader wants it anyway.
              const oneMan =
                n.fails.length > 1 &&
                n.fails.every((f) => f.playerId != null && f.playerId === n.fails[0].playerId)
              const link = games?.[n.gamePk]
              const date = monthDayShort(n.date)
              return (
                <tr
                  key={`${n.gamePk}-${n.teamId}`}
                  className={n.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}
                >
                  <ClubCell
                    teamId={n.teamId}
                    name={clubShort(clubs, n.teamId)}
                    sub={
                      <>
                        {n.side === 'home' ? 'vs ' : 'at '}
                        <TeamLink id={n.oppId} name={clubShort(clubs, n.oppId)}>
                          {clubShort(clubs, n.oppId)}
                        </TeamLink>
                      </>
                    }
                  />
                  <td>
                    {n.half === 'top' ? 'Top' : 'Bot'} {n.inning}
                  </td>
                  <td>
                    {/* The game link degrades to a plain date rather than to a
                        crash or a dead button: the schedule lookup is a second
                        request and can fail on its own. */}
                    {link ? (
                      <a
                        className="plink"
                        {...linkProps(
                          gamePath(
                            link.apiDate,
                            link.awayAbbr,
                            link.homeAbbr,
                            'boxscore',
                            link.gameNumber,
                          ),
                        )}
                      >
                        {date}
                      </a>
                    ) : (
                      date
                    )}
                  </td>
                  <td>
                    {n.fails.map((f, i) => (
                      <span key={`${f.playerId ?? 'x'}-${i}`} className="rptfail">
                        <PlayerLink id={f.playerId} name={f.playerName}>
                          {f.playerName}
                        </PlayerLink>
                        {' · '}
                        {f.callType ?? '—'}
                        {' · '}
                        <span className="rptfail__miss">{inches(f.missInches)}</span>
                      </span>
                    ))}
                    {oneMan ? (
                      <span className="rptfail rptmark">Both on one man</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </BoardScroller>
    </BroadcastSection>
  )
}
