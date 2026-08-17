import '../../styles/68-broadcast-reports.css'
import { useMemo } from 'react'
import { fetchGate, gateBoard, paceBoard, latestSeason, asClock } from '../../api/reports/gate.js'
import { fetchFarmSystem, farmBoard } from '../../api/reports/farmSystem.js'
import { fetchWorkload, bullpenBoard, leagueBullpen } from '../../api/reports/bullpen.js'
import { loadClubs, clubName } from '../../api/reports/clubs.js'
import { toApiDate, humanDate } from '../../lib/dates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useNav } from '../../lib/nav.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { ReportMasthead, ReportSection } from '../../components/reports/ReportMasthead.jsx'

// THE RUNDOWN — the top of the show.
//
// A broadcast does not open with a table. It opens with four or five single
// facts, each one a door into the segment behind it, and it takes about twenty
// seconds. This page is that: one headline figure from each report, each card
// opening the full board it came from.
//
// WHY A HUB PAGE AND NOT JUST MENU ROWS. /more already lists every standalone
// page by name, and a name is an address, not a reason. The reports are worth
// visiting because of what is IN them tonight — the fullest park in baseball,
// the pen that is out of arms — and a directory row cannot say that. This page
// is the one surface where the reports argue for themselves.
//
// It computes nothing of its own. Every figure is the top row of a board
// already built by api/reports/*, so a number here and the number on the page
// it links to are the same number by construction rather than by care.
//
// SPOILER-FREE, inherited from all three readers.

const commas = (n) => (n == null ? '—' : n.toLocaleString('en-US'))

// One card in the rundown. Deliberately a <button> rather than an anchor: the
// app routes through lib/nav's history navigation, and every other in-app
// destination in this codebase is reached the same way.
function RundownCard({ eyebrow, figure, line, logoId, note, onOpen }) {
  return (
    <button type="button" className="rundown__card" onClick={onOpen}>
      <p className="rundown__eyebrow">{eyebrow}</p>
      <p className="rundown__figure">{figure}</p>
      <p className="rundown__line">
        {logoId ? <TeamLogo teamId={logoId} name={line} size={22} /> : null}
        {line}
      </p>
      {note ? <p className="rundown__note">{note}</p> : null}
    </button>
  )
}

export function RundownPage() {
  useDocumentTitle('The Rundown')
  const navigate = useNav()
  const asOf = toApiDate()

  const { data: gate } = useAsync(() => fetchGate(), [])
  const { data: farm } = useAsync(() => fetchFarmSystem(), [])
  const { data: workload } = useAsync(() => fetchWorkload(), [])
  const { data: clubs } = useAsync(() => loadClubs(), [])

  const season = latestSeason(gate)
  const gateRows = useMemo(
    () => (gate && season ? (gateBoard(gate, season, 'fill')?.rows ?? []) : []),
    [gate, season],
  )
  const paceRows = useMemo(
    () => (gate && season ? (paceBoard(gate, season, 'avg')?.rows ?? []) : []),
    [gate, season],
  )
  const farmRows = useMemo(() => (farm ? (farmBoard(farm) ?? []) : []), [farm])
  const penRows = useMemo(() => {
    if (!workload || !clubs) return []
    return bullpenBoard(workload, [...clubs.keys()], asOf, 'downPct') ?? []
  }, [workload, clubs, asOf])

  const league = gate?.seasons?.[season]?.league
  const pen = leagueBullpen(penRows)

  const fullest = gateRows[0]
  const slowest = paceRows[0]
  const quickest = paceRows[paceRows.length - 1]
  const topFarm = farmRows[0]
  const emptiestPen = penRows[0]

  // A card only appears once its own report has landed. A rundown with a
  // half-loaded card reading "—" says less than a rundown with three cards.
  const cards = [
    fullest && {
      key: 'gate',
      eyebrow: 'The Gate',
      figure: `${fullest.fill?.toFixed(1)}%`,
      line: clubName(clubs, fullest.teamId),
      logoId: fullest.teamId,
      note: `The fullest park in baseball — ${commas(fullest.avg)} a night at ${fullest.venue}.
             League average is ${commas(league?.attAvg)}.`,
      path: '/attendance',
    },
    slowest &&
      quickest && {
        key: 'pace',
        eyebrow: 'The Clock',
        figure: asClock(slowest.avg),
        line: clubName(clubs, slowest.teamId),
        logoId: slowest.teamId,
        note: `The longest games in the league, and ${Math.round(slowest.avg - quickest.avg)} minutes
               more than ${clubName(clubs, quickest.teamId)} every single night.`,
        path: '/pace',
      },
    topFarm && {
      key: 'farm',
      eyebrow: 'The Farm Report',
      figure: topFarm.index.toFixed(1),
      line: clubName(clubs, topFarm.orgId),
      logoId: topFarm.orgId,
      note: `The best farm system in baseball on the balanced weighting —
             ${topFarm.prospects.length} ranked prospects and a ${topFarm.record.w}-${topFarm.record.l}
             season across four affiliates.`,
      path: '/farm',
    },
    emptiestPen && {
      key: 'pen',
      eyebrow: 'The Pen',
      figure: `${emptiestPen.counts.down}/${emptiestPen.total}`,
      line: clubName(clubs, emptiestPen.teamId),
      logoId: emptiestPen.teamId,
      note: `The most taxed bullpen in the league tonight. League-wide, ${pen.down} arms of
             ${pen.arms} are likely down.`,
      path: '/bullpens',
    },
  ].filter(Boolean)

  return (
    <div className="screen">
      <SiteHeader />

      <ReportMasthead
        eyebrow="The Rundown"
        title="Tonight’s Top of the Show"
        dek="One number from each report, and the door into it. Every figure here is the top
             row of the board it links to — nothing on this page is computed twice."
        meta={[
          { label: 'Date', value: humanDate(asOf) },
          { label: 'Season', value: season ?? '—' },
          { label: 'Reports', value: cards.length || '—' },
        ]}
      />

      <ReportSection title="The rundown">
        {cards.length === 0 ? (
          <p className="hint">Loading tonight’s reports…</p>
        ) : (
          <div className="rundown">
            {cards.map((c) => (
              <RundownCard
                key={c.key}
                eyebrow={c.eyebrow}
                figure={c.figure}
                line={c.line}
                logoId={c.logoId}
                note={c.note}
                onOpen={() => navigate(c.path)}
              />
            ))}
          </div>
        )}
      </ReportSection>

      <section className="method">
        <h2>What these are</h2>
        <p>
          Four reports, none of which is a score. The Gate counts crowds, The Clock counts
          minutes, The Farm Report scores organisations on talent they hold rather than games
          they have won, and The Pen counts how much work each bullpen has already done. A
          reader keeping score by hand can open any of them mid-game without seeing a single
          thing they have not yet reached on paper.
        </p>
        <p>
          Everything on this page is read from the same nightly files the four boards read, so
          a figure here can never disagree with the page it opens. If a card is missing, its
          report has not finished loading yet.
        </p>
      </section>

      <ReportFooter />
    </div>
  )
}
