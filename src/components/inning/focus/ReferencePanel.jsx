import { memo, useEffect, useRef, useState } from 'react'
import { halfIndex } from '../../../api/select.js'
import { safeToShowEntering } from '../../../api/enteringHalf.js'
import { buildPreHalfCallouts } from '../../../api/prehalf-callouts.js'
import { rankNotes } from '../../../api/callout-notes.js'
import { useCalloutLedger } from '../../../hooks/useCalloutLedger.js'
import { useMediaQuery, WIDE_QUERY } from '../../../hooks/useMediaQuery.js'
import { ModalPortal } from '../../ui/ModalPortal.jsx'
import { ChevronLink } from '../../ui/ChevronLink.jsx'
import { DefenseSection, LineupSection } from '../EnteringReference.jsx'
import { MarginNotes } from '../MarginNotes.jsx'
import { PitchersSection } from '../PitchersSection.jsx'
import { RosterPanel } from '../RosterPanel.jsx'
import { ExtrasFacts } from './ExtrasFacts.jsx'
import { UmpireTendenciesFold } from '../../umpire/UmpireTendenciesFold.jsx'
import { StatBox, AbsCard } from '../../gamehud/StatBox.jsx'
import { WinProbChart } from '../../charts/WinProbChart.jsx'

// Focus mode's reference shelf — lineups, the fielding diamond, the pitcher
// tables, the benches (ADR-0043). This replaces ReferenceRail.jsx, which
// stacked all five sections into one 268px column and let it scroll: the reader
// got a scrollbar, a truncated lineup, and four sections they weren't looking
// at, all to reach the one they were.
//
// A hand-scorer needs exactly ONE of these at a time, and which one is
// predictable from what they are doing — penciling the next name (LINEUPS),
// decoding a 6-3 (FIELD), logging a pitching change (ARMS), checking who's left
// to hit or filling in a card header (EXTRAS). So it is tabbed, and only the
// selected section renders.
//
//  • WIDE (>= 740px, WIDE_QUERY): a real reserved column the focus grid always
//    keeps at --refrail-w (styles/focus/stage.css), open permanently. There is no
//    hide/show flap any more: a 300px column showing one section has nothing
//    worth hiding, and the old flap's `railOpen` was a second piece of state
//    whose only job was undoing a layout problem this fixes structurally. The
//    reserved track means opening a tab still cannot reflow the at-bat card —
//    the property the rail was introduced for (ADR-0010).
//  • NARROW (< 740px): the column doesn't fit, so the tabs themselves become
//    the surface — a chip row under the trail, each chip opening the SAME
//    panel in a `.scrim`/`.sheet` bottom sheet already scrolled to its section.
//    Same ModalPortal contract HighlightSheet/StrikeZone use, portalled to
//    <body> for the same reason: `.turnscene`'s `isolation: isolate` would
//    otherwise trap the dialog under the floating bar (ModalPortal.jsx).
//    The sheet always starts closed — a modal that opens itself over the whole
//    screen on load is a bug, not a reference surface.
//
// Purely a placement/visibility component — the ONLY reference shelf now
// (the old unfocused-page `ReferenceBand`/`RosterPanels` split is retired).
// `safeToShowEntering` is the caller-side reached-half gate (ADR-0010), not a
// second one — the selectors underneath (`defenseEntering`/`lineupEntering`)
// keep their own reveal gate regardless of who calls them.
const TABS = [
  { key: 'lineups', label: 'Lineups' },
  { key: 'field', label: 'Field' },
  { key: 'arms', label: 'Arms' },
  { key: 'extras', label: 'Extras' },
]

// Memoized for the same reason InningPage is (see its header): InningViewer
// re-renders on every scorebug live-state report — several times per "Next
// at-bat" tap — and this column's sections are not cheap to rebuild
// (lineupEntering/defenseEntering each walk the whole game's plays;
// buildPreHalfCallouts runs in the Arms branch). Every prop is a memoized
// derivation, a primitive, or a stable handler, so the comparison only misses
// when something the panel actually shows changed — `stepAtBatIndex` moving
// each tap still re-renders it, as the Lineups tab's on-deck marker needs.
export const ReferencePanel = memo(function ReferencePanel(props) {
  const { effInning, effHalf, revealedThrough } = props
  const wide = useMediaQuery(WIDE_QUERY)
  // A half the reader hasn't reached yet has no lineup or defense to show (the
  // gate lives in defenseEntering/lineupEntering, ADR-0010 — this only decides
  // whether to offer the tab at all, so a further-out half doesn't get two tabs
  // that open onto nothing).
  const showEntering = safeToShowEntering(revealedThrough, effInning, effHalf)
  const tabs = showEntering ? TABS : TABS.filter((t) => t.key === 'arms' || t.key === 'extras')
  const [tab, setTab] = useState(tabs[0].key)
  // The chosen tab can stop existing when the reader pages to a half they
  // haven't reached. Resolved on read rather than reset in an effect: there is
  // nothing to synchronise, only a value to clamp.
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key

  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = (key) => {
    setTab(key)
    setSheetOpen(true)
  }

  // Unlike the at-bat trail (see AtBatTrail.jsx's note on why that one is NOT a
  // tablist), these really are tabs: each selects which section renders, and
  // there is exactly one panel for them to own. So the contract is spelled out
  // properly rather than half-declared — `aria-controls` pointing at the panel,
  // `aria-selected` on the chosen tab, and `role="tabpanel"` + `aria-labelledby`
  // on the body pointing back. The ids are suffixed per placement because the
  // rail and the sheet can both exist in the DOM on a resize, and duplicate ids
  // would cross the wires between them.
  //
  // AND THE REST OF THE CONTRACT, which this used to declare and not keep.
  // AtBatTrail.jsx's header argues at length that announcing a widget contract
  // while honouring none of it is worse for a screen-reader user than an honest
  // shape — and this file, next door, was doing exactly that: `role="tablist"`
  // with every tab in the tab order and no arrow-key handling at all. A user
  // who reaches a tablist is told to expect one stop and arrow keys; they got
  // four stops and dead arrows. TabStrip below owns both halves now.
  const strip = (idFor) => (
    <TabStrip tabs={tabs} active={active} onSelect={setTab} idFor={idFor} />
  )

  if (wide) {
    const idFor = (s) => `refrail-${s}`
    return (
      <aside className="focusrail" aria-label="Reference">
        {strip(idFor)}
        <div
          className="refpanel__body"
          id={idFor('panel')}
          role="tabpanel"
          aria-labelledby={idFor(`tab-${active}`)}
        >
          <Section tab={active} showEntering={showEntering} {...props} />
        </div>
      </aside>
    )
  }

  const idFor = (s) => `refsheet-${s}`
  return (
    <>
      <div className="refbar">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className="refbar__chip"
            // A chip opens a dialog rather than switching a panel in place, so
            // it says so — and reports whether that dialog is currently open,
            // which for a screen-reader user is the difference between "this
            // did nothing" and "this opened something elsewhere".
            aria-haspopup="dialog"
            aria-expanded={sheetOpen && t.key === active}
            onClick={() => openSheet(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sheetOpen && (
        <RefSheet onClose={() => setSheetOpen(false)}>
          {strip(idFor)}
          <div
            className="refpanel__body refpanel__body--sheet"
            id={idFor('panel')}
            role="tabpanel"
            aria-labelledby={idFor(`tab-${active}`)}
          >
            <Section tab={active} showEntering={showEntering} {...props} />
          </div>
        </RefSheet>
      )}
    </>
  )
})

// The tab strip, with the two things `role="tablist"` actually promises:
//
//  • A ROVING TABINDEX. One stop in the page's tab order, not four. The
//    selected tab is the stop; the rest are reachable only by arrow key. That
//    is the whole point of the role — a keyboard user tabs PAST a tablist in
//    one press and steps INTO it deliberately, rather than paying four presses
//    to cross a reference shelf on the way to the reveal button they are
//    pressing forty times a half-hour.
//
//  • ARROW KEYS, wrapping, plus Home/End. Selection follows focus, which is
//    the right pattern here: showing a section is instant and side-effect-free
//    (one memoized render, no fetch), so there is nothing to defer and no
//    reason to make the reader press Enter as well.
//
// Focus moves imperatively in the handler, with no effect and no state of its
// own. A key press lands on the tab that HAS focus, so moving selection is only
// half the job — the new tab has to be focused too, or the next arrow press
// arrives at the old one. Focusing it directly is legal even though it is still
// `tabIndex={-1}` at that instant: -1 blocks the TAB key, never `.focus()`, and
// the re-render that follows makes it the strip's 0 anyway. Doing it here also
// keeps a plain click from ever stealing focus, which an effect keyed on
// `active` would have done.
function TabStrip({ tabs, active, onSelect, idFor }) {
  const ref = useRef(null)

  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.key === active)
    let next = null
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next == null) return
    e.preventDefault()
    onSelect(tabs[next].key)
    // Indexed off the container rather than by id: the same strip renders twice
    // (rail and sheet) with different id prefixes, and the node order here is
    // `tabs` order by construction.
    ref.current?.querySelectorAll('[role="tab"]')[next]?.focus()
  }

  return (
    <div
      ref={ref}
      className="refpanel__tabs"
      role="tablist"
      aria-label="Reference"
      onKeyDown={onKeyDown}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          id={idFor(`tab-${t.key}`)}
          className="refpanel__tab"
          aria-selected={t.key === active}
          aria-controls={idFor('panel')}
          tabIndex={t.key === active ? 0 : -1}
          onClick={() => onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// One tab's content. Only the selected section is rendered at all — not hidden
// with CSS — so the panel's height is the section's height and nothing the
// reader isn't looking at is in the DOM competing for the scroll.
function Section({
  tab,
  showEntering,
  feed,
  callouts,
  marginNotes,
  pitcherTeams,
  effInning,
  effHalf,
  meta,
  treatment,
  prospectsData,
  rookiesData,
  isMlb,
  revealedThrough,
  rosters,
  workload,
  workloadGameDate,
  stepAtBatIndex,
  managers,
  uniforms,
  scorebookWeather,
  getDerived,
  runExpectancy,
  winProbPoints,
  winProbBigPlays,
  onScorecard,
}) {
  // The per-game shown ledger (src/hooks/useCalloutLedger.js). Read here, at
  // the top of the component, because the ARMS branch below is an early
  // return — and inert outside a provider, so this panel still renders
  // standalone. It only ever SUBTRACTS from a list; no gate below moves.
  const ledger = useCalloutLedger()
  if (tab === 'lineups' && showEntering) {
    return (
      <LineupSection
        feed={feed}
        inning={effInning}
        half={effHalf}
        awayName={meta.away.clubName}
        homeName={meta.home.clubName}
        awayId={meta.away.id}
        homeId={meta.home.id}
        treatment={treatment}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        isMlb={isMlb}
        revealedThrough={revealedThrough}
        bare
        leadSide={effHalf === 'top' ? 'away' : 'home'}
        stepAtBatIndex={stepAtBatIndex}
      />
    )
  }
  if (tab === 'field' && showEntering) {
    const fieldingSide = effHalf === 'top' ? 'home' : 'away'
    return (
      <DefenseSection
        feed={feed}
        inning={effInning}
        half={effHalf}
        fieldingSide={fieldingSide}
        fieldingName={effHalf === 'top' ? meta.home.clubName : meta.away.clubName}
        fieldingTeamId={effHalf === 'top' ? meta.home.id : meta.away.id}
        fieldingTreatment={treatment?.[fieldingSide]}
        revealedThrough={revealedThrough}
        bare
      />
    )
  }
  if (tab === 'extras') {
    // EVERYTHING THAT ISN'T ON THE FIELD. Two things a scorer reaches for from
    // the same standing start — who is left on each club, and the card-header
    // facts (managers, uniforms, crew, date, park, first pitch, weather) —
    // which between them were the only reason to leave the half being scored.
    // The facts used to live on the lineup pages alone, two taps away and a
    // lost place on the way back; the tab that already held "the rest of the
    // club" is where they belong.
    //
    // ONE LIST PER CLUB, OPEN. This tab used to render both clubs' whole
    // roster cards at RosterPanel's own page default — collapsed — so tapping
    // it answered with two shut drawers and nothing else, and the bench a
    // scorer came for was three taps deep. Each club now opens on the single
    // list that half is actually about: the batting side's BENCH (who is left
    // to hit for) and the fielding side's BULLPEN (which arm is next). The
    // rotation starters are dropped at both ends — they cannot enter once the
    // game is under way, which is the reason RosterPanel splits them out in
    // the first place (see splitBullpen in InningViewer.jsx).
    //
    // Batting club first, deliberately: it is the half being scored. The
    // ordinary stacked page still shows away-then-home, both collapsed, both
    // whole — nothing here changes it (see RosterPanel's two new props).
    //
    // The benches lead and the facts follow, not the other way round: the
    // lists answer a question the current half is asking, the facts answer one
    // asked once at the top of the game and then only occasionally.
    const battingSide = effHalf === 'top' ? 'away' : 'home'
    const sides = [
      { side: battingSide, groups: ['bench'] },
      { side: battingSide === 'away' ? 'home' : 'away', groups: ['bullpen'] },
    ]
    return (
      <>
        {sides.map(({ side, groups }) => (
          <RosterPanel
            key={side}
            title={rosters[side].name}
            roster={rosters[side]}
            teamId={meta[side].id}
            side={side}
            treatment={treatment?.[side]}
            revealedThrough={revealedThrough}
            prospectsData={prospectsData}
            rookiesData={rookiesData}
            isMlb={isMlb}
            defaultOpen
            groups={groups}
          />
        ))}
        {/* The win-probability chart, moved here from the Arms tab: a
            once-a-half-ish reference rather than something a scorer checks
            between every pitch, so it belongs with the drawers, not pinned
            under the pitching lines. Sits above the Tendencies card so the
            two once-a-game references still read as a pair below it. */}
        <WinProbChart
          points={winProbPoints}
          bigPlays={winProbBigPlays}
          awayAbbr={meta.away.abbreviation}
          homeAbbr={meta.home.abbreviation}
          awayId={meta.away.id}
          homeId={meta.home.id}
          awayTreatment={treatment?.away}
          homeTreatment={treatment?.home}
          partial
        />
        {/* The plate ump's Tendencies card as a drawer (open by default,
            foldable), between the benches and the fill-in facts: it reads
            like the crew line below (a once-a-game reference), so it sits
            with the drawers rather than among the facts. Renders nothing
            for MiLB / unswept crews. */}
        <UmpireTendenciesFold feed={feed} />
        <ExtrasFacts
          feed={feed}
          meta={meta}
          managers={managers}
          uniforms={uniforms}
          scorebookWeather={scorebookWeather}
        />
        {/* The door to the live scorecard — the #22 sheet inked as far as
            this same reveal mark. It sits at the tab's foot with the other
            once-a-game reaches: mid-half you're scoring, not reading the
            whole sheet. Structural (a route), never a score. */}
        {onScorecard && (
          <div className="thub-door">
            <ChevronLink onClick={onScorecard}>Open the live scorecard</ChevronLink>
          </div>
        )}
      </>
    )
  }
  // ARMS. Notes + pitching lines are reveal-progress-driven: no pitcher has a
  // line until a half has been scored, and Margin Notes are built from those
  // same lines. Jump straight to a half ahead of the reveal mark and that
  // half of the tab legitimately has nothing — which as bare emptiness read
  // as a broken panel holding a reserved column open for no reason. Say so
  // instead, scoped to just that pair (see `armsEmpty` below) — the stat
  // content that follows has its own "nothing revealed yet" answer (a null
  // render from StatBox's own `revealed` gate), so it isn't folded into this
  // same empty state.
  //
  // The pre-half strip's own notes land here too — HalfInning declines to
  // render the strip inline (its own `windowed` gate no longer applies here —
  // this tab exists for every half now, live or historical) and this is
  // where they go. That makes THIS the only `buildPreHalfCallouts` call on
  // the screen, rather than the second of two.
  // SPOILER FOOTING IS THE STRIP'S OWN, UNCHANGED. `buildPreHalfCallouts` gates
  // every score-reading family on `revealedThrough` INSIDE itself (see that
  // file's header — the gate lives there precisely so no caller can skip it),
  // and `showEntering` is the same reached-half caller gate HalfInning applies
  // before rendering the strip inline (ADR-0010). Both are in force below.
  //
  // REPETITION IS RANKED HERE TOO, and it is one surface's worth: the strip's
  // notes and the Margin Notes digest render as ONE list under this tab, so
  // they share one ledger read (`shownCounts`) and one diversity pass. The
  // ledger counts distinct HALVES, and never the half being staged, so nothing
  // below can decay itself out from under the reader mid-half.
  const armsHalfIdx = halfIndex(effInning, effHalf)
  const shownCounts = ledger.countsFor(armsHalfIdx)
  const preHalf = showEntering
    ? buildPreHalfCallouts({ feed, bundle: callouts, inning: effInning, half: effHalf, revealedThrough, workload, gameDate: workloadGameDate, shownCounts })
    : []
  const notes = mergeNotes(preHalf, marginNotes, shownCounts)
  const armsEmpty = !notes.length && !pitcherTeams.some((t) => t.rows?.length)

  // The stat-line content that used to be part of InningPage.jsx's
  // `.innings__row2`, built only while NOT windowed (decision 5) — now it
  // always builds, for every half, live or historical, moved permanently
  // into this tab. Same already-gated values, same components, only the
  // destination changed. The WPA chart that used to sit alongside it here
  // moved on to the Extras tab — a once-a-half reference, not something a
  // scorer checks between pitches.
  const idx = armsHalfIdx
  const revealed = idx <= revealedThrough
  const battingSide = effHalf === 'top' ? 'away' : 'home'
  return (
    <>
      {/* Deliberately a short label, not a sentence: the app uppercases every
          string by default (01-base.css's `#root *` invariant, guarded by
          check-caps.mjs), and a full sentence shouted in caps reads far worse
          than four words do. */}
      {armsEmpty ? (
        <p className="refpanel__empty">No pitching lines yet</p>
      ) : (
        <>
          <MarginNotes notes={notes} feed={feed} bundle={callouts} halfIdx={armsHalfIdx} />
          <PitchersSection teams={pitcherTeams} />
        </>
      )}
      <StatBox
        className="innings__statbox"
        placeholder
        feed={feed}
        inning={effInning}
        half={effHalf}
        battingSide={battingSide}
        awayAbbr={meta.away.abbreviation}
        homeAbbr={meta.home.abbreviation}
        awayFranchise={meta.away.franchiseName || meta.away.abbreviation}
        homeFranchise={meta.home.franchiseName || meta.home.abbreviation}
        getDerived={getDerived}
        revealed={revealed}
        runExpectancy={runExpectancy}
      />
      <AbsCard
        feed={feed}
        inning={effInning}
        half={effHalf}
        revealed={revealed}
        awayAbbr={meta.away.abbreviation}
        homeAbbr={meta.home.abbreviation}
      />
    </>
  )
}

// One ranked list out of two already-ranked ones. Both builders emit the same
// `{ text, personId, side, kind, score, dedupeKey }` note shape and score on the
// same 0–100 worthiness rubric (docs/callouts.md), so re-ranking on `score` is a
// merge, not a re-ranking — a strip note and a digest note compete on the terms
// they were already scored under. Deduped on `dedupeKey` for the case both
// builders reach the same fact about the same pitcher; the pre-half copy wins
// by arriving first, which is the entering-tense wording (ADR-0014) and the
// right one for a half still being scored.
//
// The re-rank is `rankNotes` (api/callout-notes/shared.js), so the merged list
// carries the same decay and once-per-game rules the two builders already
// applied to themselves, plus one note per kind ACROSS both of them. This one
// is deliberately UNCAPPED: MarginNotes.jsx shows the first few and hides the
// rest behind "Show N more", and a note a diversity rule turned down is
// deferred to the tail rather than thrown away, so it is still there to find.
function mergeNotes(preHalf, marginNotes, shownCounts) {
  const seen = new Set()
  const out = []
  for (const n of [...preHalf, ...(marginNotes ?? [])]) {
    const key = n.dedupeKey ?? n.text
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n)
  }
  return rankNotes(out, { shownCounts, maxPerKind: 1 })
}

function RefSheet({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Scroll-lock the innings page behind the sheet — the same plain
  // `overflow: hidden` (never the position-fixed body trick, which loses the
  // reader's scroll offset) that SiteSearch.jsx uses, for the same reason
  // ADR-0037 records it as load-bearing there. A drag inside a docked sheet
  // that has nothing left to scroll otherwise chains into the document, and a
  // page sliding under a dialog that stays put reads as a broken sheet rather
  // than as a page. `.refpanel__body`'s `overscroll-behavior: contain` covers
  // the same flick once the panel itself HAS scrolled; this covers the rest.
  useEffect(() => {
    const root = document.documentElement
    const { body } = document
    const prevRoot = root.style.overflow
    const prevBody = body.style.overflow
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = prevRoot
      body.style.overflow = prevBody
    }
  }, [])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  return (
    <ModalPortal>
      <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="sheet focusrail__sheet" role="dialog" aria-modal="true" aria-label="Reference">
          <div className="focusrail__sheethead">
            <h2 className="sheet__title">Reference</h2>
            <button ref={closeRef} className="sheet__close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </ModalPortal>
  )
}
