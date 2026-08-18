import '../../styles/68-around-the-game.css'
import { Fragment, useMemo, useState } from 'react'
import {
  fetchDoubleheaders,
  buildBoard,
  boardHighlights,
  seasonBounds,
  throughDate,
} from '../../api/around-the-game/doubleheaders.js'
import { loadClubs, clubName, clubShort } from '../../api/around-the-game/clubs.js'
import { humanDate } from '../../lib/dates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { BroadcastMasthead, BroadcastSection } from '../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'
import { ClubCell } from '../../components/around-the-game/ClubCell.jsx'
import { BoardScroller } from '../../components/around-the-game/BoardScroller.jsx'
import { YearRange } from '../../components/around-the-game/YearRange.jsx'

// THE DOUBLE DIP — how clubs fare on the days they have to play twice.
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

// Quick spans, because dragging two handles from 2004 to 2022 is a chore and
// "the last ten years" is the question most readers actually have. Each is
// resolved against the file's own last season, never against today's date.
const PRESETS = [
  { key: 'all', label: 'All years', span: null },
  { key: '10', label: 'Last 10', span: 10 },
  { key: '5', label: 'Last 5', span: 5 },
  { key: '1', label: 'This season', span: 1 },
]

// The most-met opponent, worded. A tie at the top is common once the slider is
// short — two clubs each met twice — and the reader is told so rather than
// shown one of them picked arbitrarily.
function opponentCell(top, clubs) {
  if (!top || !top.dh) return '—'
  const suffix = `${top.dh} DH${top.dh === 1 ? '' : 's'}`
  if (top.ids.length === 1) return `${clubShort(clubs, top.ids[0])} (${suffix})`
  if (top.ids.length === 2) {
    return `${clubShort(clubs, top.ids[0])}, ${clubShort(clubs, top.ids[1])} (${suffix})`
  }
  return `${top.ids.length} clubs (${suffix} each)`
}

// One club's years, opened from its row. This is the "per year" half of the
// page: the board answers "over this span", and the drawer answers "which of
// those years was it". Seasons with no doubleheader for that club simply do not
// appear — a club that played none in 2016 has no 2016 line, rather than a row
// of zeroes.
function SeasonDrawer({ row, columns }) {
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
                <td>{s.sweeps || '—'}</td>
                <td>{s.sweptBy || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

export function DoubleheadersPage() {
  useDocumentTitle('The Double Dip — Doubleheaders')
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
  const through = useMemo(() => throughDate(data), [data])

  const rows = board?.rows ?? []
  const setPreset = (span) => {
    if (!bounds) return
    setRange(span ? { from: Math.max(bounds.first, bounds.last - span + 1), to: bounds.last } : null)
  }
  // Which preset chip reads as pressed — worked out from the handles rather
  // than remembered, so dragging a handle onto "the last five seasons" lights
  // that chip and dragging off it puts the light out.
  const activePreset = (p) => {
    if (!bounds || from == null) return false
    if (!p.span) return from === bounds.first && to === bounds.last
    return to === bounds.last && from === Math.max(bounds.first, bounds.last - p.span + 1)
  }

  const COLUMN_COUNT = 8

  return (
    <div className="screen">
      <SiteHeader />

      <BroadcastMasthead
        eyebrow="The Double Dip"
        title="Doubleheaders"
        dek="Every club’s record on the days it had to play twice — and how often those days
             ended 2-0 one way or the other. Nobody keeps this record, so this page does."
        meta={[
          { label: 'Seasons', value: bounds ? `${bounds.first}–${bounds.last}` : '—' },
          { label: 'Through', value: through ? humanDate(through) : '—' },
          { label: 'Doubleheaders', value: board?.pairs ?? '—' },
        ]}
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
            title="The years"
            note="Drag either end to narrow the span. Every number below — records, sweeps,
                  ranks and the most-met opponent — is recounted over the years between the
                  handles."
          >
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
                  onClick={() => setPreset(p.span)}
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
              note={`${board?.clubs ?? 0} club${board?.clubs === 1 ? '' : 's'} played at least one.`}
            />
            <Slab
              value={highs?.busiest?.dh ?? '—'}
              label="Most doubleheaders"
              note={highs?.busiest ? clubName(clubs, highs.busiest.teamId) : ''}
            />
            <Slab
              value={highs?.mostSweeps?.sweeps ?? '—'}
              label="Most sweeps"
              note={highs?.mostSweeps ? `${clubName(clubs, highs.mostSweeps.teamId)} took both.` : ''}
            />
            <Slab
              value={highs?.mostSweptBy?.sweptBy ?? '—'}
              label="Most swept"
              note={
                highs?.mostSweptBy ? `${clubName(clubs, highs.mostSweptBy.teamId)} dropped both.` : ''
              }
            />
          </SlabRow>

          <BroadcastSection
            title="The board"
            note="One row per club with a doubleheader in the span. W-L counts GAMES; sweeps
                  and splits count DAYS. Open a row for that club’s year-by-year lines."
          >
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
                        <tr className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
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
                          <td className="dh__opp">{opponentCell(r.top, clubs)}</td>
                        </tr>
                        {openTeam === r.teamId && (
                          <SeasonDrawer row={r} columns={COLUMN_COUNT} />
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </BoardScroller>
            )}
          </BroadcastSection>

          <section className="method">
            <h2>How this is counted</h2>
            <p>
              <strong>A doubleheader is a day, not a game.</strong> Two regular-season games
              between the same two clubs on the same date, both finished. Traditional
              doubleheaders (one admission) and split ones (two) both count — the difference is
              how tickets were sold, not whether a club played twice.
            </p>
            <p>
              <strong>A rained-out second game is not a doubleheader.</strong> When only one game
              of a scheduled pair is played, the day is dropped rather than folded in, because
              counting it would put single games inside a doubleheader record.
            </p>
            <p>
              <strong>Sweeps and splits count days; W-L counts games.</strong> A club that took
              both games has one sweep and a 2-0 line. The three columns therefore add up to the
              DHs column, and the W-L column adds up to twice it.
            </p>
            <p>
              <strong>Two eras are folded into one line, and the slider is how you separate
              them.</strong> The 2020 and 2021 doubleheaders were seven innings each; every other
              season here played nine. The years are counted the same way regardless, so a span
              that crosses those two seasons is comparing games of different lengths.
            </p>
            <p>
              <strong>Source.</strong> The MLB Stats API schedule feed, regular season only,
              rebuilt nightly (scripts/gen-doubleheaders.mjs). Postseason and spring games are
              out; so is the minor leagues, whose feeds do not carry the flag reliably.
            </p>
          </section>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
