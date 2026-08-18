import '../../styles/68-around-the-game.css'
import { Fragment, useMemo, useState } from 'react'
import {
  fetchDoubleheaders,
  buildBoard,
  boardHighlights,
  seasonBounds,
} from '../../api/around-the-game/doubleheaders.js'
import { loadClubs, clubName, clubShort } from '../../api/around-the-game/clubs.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { BroadcastMasthead, BroadcastSection } from '../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'
import { ClubCell } from '../../components/around-the-game/ClubCell.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { BoardScroller } from '../../components/around-the-game/BoardScroller.jsx'
import { YearRange } from '../../components/around-the-game/YearRange.jsx'

// DOUBLEHEADER RECORDS — how clubs fare on the days they have to play twice.
//
// THE ARGUMENT THE PAGE MAKES. A doubleheader is a scheduling accident, not a
// matchup: rain in April sends two clubs out for eighteen innings in August,
// with a spot starter, a short pen and whoever is left on the bench. Nobody
// keeps a record for those days, and the counting stat everyone reaches for —
// "swept the doubleheader" — is unrecorded too. So the page keeps it: each
// club's record in doubleheader GAMES, and how often the day ended 2-0 either
// way.
//
// THE SLIDER IS THE PAGE. One season holds thirty-odd doubleheaders across the
// whole league, which is two or three per club — a sample too thin to rank. The
// twenty-three-season span is thick enough to mean something but blurs three
// eras of scheduling into one line. Neither is the right window, so the reader
// picks: the same board, over whatever years they want to ask about, recomputed
// as the handles move (api/around-the-game/doubleheaders.js).
//
// SPOILER-FREE. Nothing here is a score. Every figure is a season-level
// aggregate over Final games — the same footing as the comeback-rate card and
// the team-record boards — and no individual game's runs reach this page.

// Each sort carries the phrase the caption says, not just the chip's label.
// The board is eight columns wide and a phone shows four of them, so the column
// a rank was worked out from is regularly scrolled off the screen — a reader
// looking at rank 1 beside a middling number needs the page to say what it
// ranked on rather than leaving the board looking mis-sorted.
const SORTS = [
  { key: 'pct', label: 'Win pct', caption: 'win percentage in doubleheader games' },
  { key: 'dh', label: 'Most played', caption: 'doubleheaders played' },
  { key: 'sweeps', label: 'Most sweeps', caption: 'doubleheaders swept' },
  { key: 'sweptBy', label: 'Most swept', caption: 'doubleheaders swept by the opponent' },
]

// Named eras, because dragging two handles from 2004 to 2020 is a chore and
// because these are the spans a reader compares. They are FIXED years, not
// trailing windows: "2011-2020" means the same decade next season, so a link
// to it keeps saying what it said. Only the open-ended pair reads the file —
// `null` at either end means "whatever the file starts or stops at", so the
// first chip and the last one follow the data forward without an edit here.
const PRESETS = [
  { key: 'all', label: 'All Years', from: null, to: null },
  { key: '2004', label: '2004–2010', from: 2004, to: 2010 },
  { key: '2011', label: '2011–2019', from: 2011, to: 2019 },
  // 2020 and 2021 on their own, because they are not the same game: every
  // doubleheader in those two seasons was seven innings a side. Folded into a
  // longer span they quietly move a club's record; on their own they are the
  // one span here that is internally consistent.
  { key: '2020', label: '2020–2021', from: 2020, to: 2021 },
  { key: '2022', label: '2022–Present', from: 2022, to: null },
]

// A preset's years, clamped to what the file actually holds — a span that ran
// past either end would put the slider handles somewhere the data does not go.
function presetRange(preset, bounds) {
  return {
    from: Math.max(bounds.first, preset.from ?? bounds.first),
    to: Math.min(bounds.last, preset.to ?? bounds.last),
  }
}

// The most-met opponent, with the club's mark beside its name — the same
// pairing the club column of every board in this app uses, so the eye can run
// down this column on the marks alone.
//
// A TIE IS SHOWN AS MARKS, NOT AS A COUNT. Ties at the top are common once the
// slider is short — five clubs a club met three times each — and the cell used
// to give up and print "5 clubs (3 DHs each)", which names nobody and is the
// one answer a reader cannot use. Five marks in a row fit where five names
// never would, and they say WHICH five.
//
// The marks are decorative to a screen reader (TeamLogo renders alt=""), so
// each one carries its club's name in an `.sr-only` span. Without that a
// logos-only cell is a silent cell.
function OpponentCell({ top, clubs }) {
  if (!top || !top.dh) return <td className="dh__opp">—</td>
  const tied = top.ids.length > 1
  const suffix = `${top.dh} DH${top.dh === 1 ? '' : 's'}${tied ? ' each' : ''}`
  return (
    <td className="dh__opp">
      {top.ids.map((id) => (
        <span key={id} className={`dh__oppclub${tied ? ' dh__oppclub--mark' : ''}`}>
          <TeamLogo teamId={id} name={clubShort(clubs, id)} size={16} />
          {tied ? (
            <span className="sr-only">{clubShort(clubs, id)}</span>
          ) : (
            clubShort(clubs, id)
          )}
        </span>
      ))}
      <span className="dh__oppcount">({suffix})</span>
    </td>
  )
}

// A row of club marks — one per doubleheader, repeated when the same club did
// it twice. This is what the drawer's Swept and Swept by columns print instead
// of a number: "2" says a club swept two doubleheaders, and three marks say
// WHICH clubs, in the room a two-character figure took.
//
// The marks are decorative to a screen reader (TeamLogo renders alt=""), so
// each carries its club's name in an `.sr-only` span. A repeat is a repeat in
// both channels: two Cubs marks read as "Cubs Cubs", which is the fact.
function MarkRow({ ids, clubs, label }) {
  if (!ids?.length) return <td className="dh__marks">—</td>
  return (
    <td className="dh__marks">
      <span className="sr-only">{`${ids.length} ${label}: `}</span>
      {ids.map((id, i) => (
        // The same club can appear twice, so the index is part of the key —
        // there is no id here that is unique on its own.
        <span key={`${id}-${i}`} className="dh__mark">
          <TeamLogo teamId={id} name={clubShort(clubs, id)} size={16} />
          <span className="sr-only">{clubShort(clubs, id)} </span>
        </span>
      ))}
    </td>
  )
}

// Every doubleheader of one season, placed: the preposition and the opponent's
// mark, "vs" at home and "@" on the road.
//
// THE MARK CARRIES IT, not a name. A club that played eleven doubleheaders in a
// season (2020 happened) prints eleven names as a paragraph and eleven marks as
// a row you can read at a glance — and the mark is the thing the eye is already
// matching against the board above. The name is still there for a screen
// reader, in an `.sr-only` span, because TeamLogo renders alt="".
//
// HOME AND AWAY COMES FROM THE PARK, not from the feed's home/away flag. A
// makeup doubleheader flips that flag between its two games while both are
// played at one address, so the flag would print a club as both host and
// visitor on the same day. The generator resolves the venue's usual occupant
// instead (scripts/gen-doubleheaders.mjs); a neutral site names the opponent
// with no preposition rather than guessing one.
function OpponentList({ days, clubs }) {
  if (!days?.length) return <td className="dh__against">—</td>
  return (
    <td className="dh__against">
      {days.map((d, i) => (
        <span key={`${d.oppId}-${i}`} className="dh__against-item">
          {d.home === true ? <span className="dh__at">vs</span> : null}
          {d.home === false ? <span className="dh__at">@</span> : null}
          <TeamLogo teamId={d.oppId} name={clubShort(clubs, d.oppId)} size={16} />
          <span className="sr-only">{clubShort(clubs, d.oppId)} </span>
        </span>
      ))}
    </td>
  )
}

// One club's years, opened from its row. This is the "per year" half of the
// page: the board answers "over this span", and the drawer answers "which of
// those years was it, and against whom". Seasons with no doubleheader for that
// club simply do not appear — a club that played none in 2016 has no 2016 line,
// rather than a row of zeroes.
function SeasonDrawer({ row, clubs, columns }) {
  return (
    <tr className="dh__drawerrow">
      <td colSpan={columns}>
        <table className="dh__drawer">
          <thead>
            <tr>
              <th>Year</th>
              <th>DHs</th>
              <th>W-L</th>
              <th>Swept</th>
              <th>Swept by</th>
              <th className="dh__against">Doubleheaders against</th>
            </tr>
          </thead>
          <tbody>
            {row.seasons.map((s) => (
              <tr key={s.season}>
                <th scope="row">{s.season}</th>
                <td>{s.dh}</td>
                <td>
                  {s.w}-{s.l}
                </td>
                <MarkRow ids={s.swept} clubs={clubs} label="swept" />
                <MarkRow ids={s.sweptBy} clubs={clubs} label="swept by" />
                <OpponentList days={s.days} clubs={clubs} />
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

export function DoubleheadersPage() {
  useDocumentTitle('MLB Doubleheader Records by Team, 2004–Present')
  const [sortBy, setSortBy] = useState('pct')
  const [range, setRange] = useState(null) // null until the file says what it holds
  const [openTeam, setOpenTeam] = useState(null)
  const { favoriteTeamId } = useFavoriteTeam()

  const { loading, error, data } = useAsync(() => fetchDoubleheaders(), [])
  const { data: clubs } = useAsync(() => loadClubs(), [])

  const bounds = useMemo(() => seasonBounds(data), [data])
  // The whole span, until the reader narrows it. Held in state rather than
  // derived so the two handles stay where they were put when anything else on
  // the page re-renders.
  const from = range?.from ?? bounds?.first ?? null
  const to = range?.to ?? bounds?.last ?? null

  const board = useMemo(
    () => (data && from != null ? buildBoard(data, { from, to, sortBy }) : null),
    [data, from, to, sortBy],
  )
  const highs = useMemo(() => boardHighlights(board), [board])

  const rows = board?.rows ?? []
  const setPreset = (preset) => {
    if (!bounds) return
    setRange(presetRange(preset, bounds))
  }
  // Which preset chip reads as pressed — worked out from the handles rather
  // than remembered, so dragging a handle onto a decade lights that chip and
  // dragging off it puts the light out.
  const activePreset = (p) => {
    if (!bounds || from == null) return false
    const span = presetRange(p, bounds)
    return from === span.from && to === span.to
  }

  const COLUMN_COUNT = 8

  return (
    <div className="screen">
      <SiteHeader />

      <BroadcastMasthead
        eyebrow="Doubleheaders"
        title="Doubleheader Records"
        dekFull
        dek="Every MLB club’s record in doubleheader games since 2004 — who sweeps the day, who
             drops both, and who they keep meeting."
      />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={Boolean(bounds)}
        errorMessage="Couldn’t load doubleheaders. Try again."
        emptyMessage="No doubleheaders on file yet."
        emptyProse
      />

      {bounds && (
        <>
          <BroadcastSection
            title="Choose the seasons">
            <YearRange
              min={bounds.first}
              max={bounds.last}
              from={from}
              to={to}
              onChange={(nextFrom, nextTo) => setRange({ from: nextFrom, to: nextTo })}
            />
            <div className="rpt-controls" role="group" aria-label="Quick spans">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`rpt-chip${activePreset(p) ? ' is-on' : ''}`}
                  aria-pressed={activePreset(p)}
                  onClick={() => setPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </BroadcastSection>

          <SlabRow>
            <Slab
              tone="lead"
              value={board?.pairs ?? 0}
              label="Doubleheaders played"
            />
            <Slab
              value={highs?.busiest?.dh ?? '—'}
              label="Most doubleheaders"
              note={highs?.busiest ? clubName(clubs, highs.busiest.teamId) : ''}
            />
            <Slab
              value={highs?.mostSweeps?.sweeps ?? '—'}
              label="Most sweeps"
              note={highs?.mostSweeps ? clubName(clubs, highs.mostSweeps.teamId) : ''}
            />
            <Slab
              value={highs?.mostSweptBy?.sweptBy ?? '—'}
              label="Most swept"
              note={highs?.mostSweptBy ? clubName(clubs, highs.mostSweptBy.teamId) : ''}
            />
          </SlabRow>

          <BroadcastSection
            title="Doubleheader records by club">
            <div className="rpt-controls" role="group" aria-label="Sort the board">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`rpt-chip${s.key === sortBy ? ' is-on' : ''}`}
                  aria-pressed={s.key === sortBy}
                  onClick={() => setSortBy(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {rows.length > 0 && (
              <p className="dh__caption">
                <strong>{board.clubs}</strong> club{board.clubs === 1 ? '' : 's'} ·{' '}
                {from === to ? from : `${from}–${to}`} · ranked by{' '}
                {SORTS.find((s) => s.key === sortBy)?.caption}
              </p>
            )}

            {rows.length === 0 ? (
              <p className="hint">No doubleheader was played in these years.</p>
            ) : (
              <BoardScroller label="Doubleheader board, every club ranked">
                <table className="standings rpt dh">
                  <thead>
                    <tr>
                      <th className="team">Club</th>
                      <th>DHs</th>
                      <th>W-L</th>
                      <th>Win pct</th>
                      <th>Swept</th>
                      <th>Swept by</th>
                      <th>Split</th>
                      <th>Most-met opponent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <Fragment key={r.teamId}>
                        {/* THE WHOLE ROW OPENS THE YEARS. The button below is
                            still the real control — it is what a keyboard
                            reaches and what carries aria-expanded — but a
                            reader who has just read across a row should not
                            have to travel back to one small figure to open it.
                            A click landing on a CONTROL is left alone. The club
                            name is one: TeamLink renders a <button>, not an
                            anchor (it navigates through the app's own router),
                            so an `a`-only guard misses it and the row would
                            toggle on its way out to the club page. The DHs
                            button is the other. */}
                        <tr
                          className={`dh__row${r.teamId === favoriteTeamId ? ' rpt__row--mine' : ''}${
                            openTeam === r.teamId ? ' dh__row--open' : ''
                          }`}
                          onClick={(e) => {
                            if (e.target.closest('a, button')) return
                            setOpenTeam(openTeam === r.teamId ? null : r.teamId)
                          }}
                        >
                          <ClubCell
                            teamId={r.teamId}
                            name={clubShort(clubs, r.teamId)}
                            rank={r.rank}
                            tied={r.tied}
                            tab="games"
                          />
                          <td>
                            <button
                              type="button"
                              className="dh__open"
                              aria-expanded={openTeam === r.teamId}
                              onClick={() => setOpenTeam(openTeam === r.teamId ? null : r.teamId)}
                            >
                              {r.dh}
                              <span className="dh__chev" aria-hidden="true">
                                {openTeam === r.teamId ? '▾' : '▸'}
                              </span>
                              <span className="sr-only">
                                {` doubleheaders — show ${clubShort(clubs, r.teamId)} by year`}
                              </span>
                            </button>
                          </td>
                          <td>
                            {r.w}-{r.l}
                          </td>
                          <td>{r.pct ?? '—'}</td>
                          <td>{r.sweeps || '—'}</td>
                          <td>{r.sweptBy || '—'}</td>
                          <td>{r.splits || '—'}</td>
                          <OpponentCell top={r.top} clubs={clubs} />
                        </tr>
                        {openTeam === r.teamId && (
                          <SeasonDrawer row={r} clubs={clubs} columns={COLUMN_COUNT} />
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </BoardScroller>
            )}
          </BroadcastSection>

          <section className="method">
            <h2>How doubleheader records are counted</h2>
            <p>
              <strong>A doubleheader is a day, not a game.</strong> Two regular-season games
              between the same two clubs on the same date, both finished. Traditional
              doubleheaders (one admission) and split ones (two) both count: that difference is
              how tickets were sold, not whether a club played twice.
            </p>
            <p>
              <strong>A rained-out second game is not a doubleheader.</strong> When only one game
              of a pair is played, the day is dropped — counting it would put single games inside
              a doubleheader record.
            </p>
            <p>
              <strong>Home and away is the park, not the box score.</strong> A makeup
              doubleheader flips which club bats last between its two games while both are played
              at one address, so “@” and “vs” name the club whose park it was.
            </p>
            <p>
              <strong>2020 and 2021 were seven innings.</strong> Every other season here played
              nine. The years are counted the same way regardless, so a span crossing those two
              is comparing games of different lengths.
            </p>
            <p>
              <strong>Source.</strong> The MLB Stats API schedule feed, regular season only,
              rebuilt nightly. Postseason, spring and the minor leagues are out.
            </p>
          </section>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
