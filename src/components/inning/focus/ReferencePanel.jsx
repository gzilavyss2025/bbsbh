import { useEffect, useRef, useState } from 'react'
import { safeToShowEntering } from '../../../api/enteringHalf.js'
import { buildPreHalfCallouts } from '../../../api/prehalf-callouts.js'
import { useMediaQuery, WIDE_QUERY } from '../../../hooks/useMediaQuery.js'
import { ModalPortal } from '../../ui/ModalPortal.jsx'
import { DefenseSection, LineupSection } from '../EnteringReference.jsx'
import { MarginNotes } from '../MarginNotes.jsx'
import { PitchersSection } from '../PitchersSection.jsx'
import { RosterPanel } from '../RosterPanel.jsx'

// Focus mode's reference shelf — lineups, the fielding diamond, the pitcher
// tables, the benches (ADR-0043). This replaces ReferenceRail.jsx, which
// stacked all five sections into one 268px column and let it scroll: the reader
// got a scrollbar, a truncated lineup, and four sections they weren't looking
// at, all to reach the one they were.
//
// A hand-scorer needs exactly ONE of these at a time, and which one is
// predictable from what they are doing — penciling the next name (LINEUPS),
// decoding a 6-3 (FIELD), logging a pitching change (ARMS), checking who's left
// to hit (BENCH). So it is tabbed, and only the selected section renders.
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
// Purely a placement/visibility component. Every section below is the same
// component the unfocused page renders inline, given the same already-gated
// props; `safeToShowEntering` is the same caller-side gate ReferenceBand.jsx
// applies (ADR-0010), not a second one.
const TABS = [
  { key: 'lineups', label: 'Lineups' },
  { key: 'field', label: 'Field' },
  { key: 'arms', label: 'Arms' },
  { key: 'bench', label: 'Bench' },
]

export function ReferencePanel(props) {
  const { effInning, effHalf, revealedThrough } = props
  const wide = useMediaQuery(WIDE_QUERY)
  // A half the reader hasn't reached yet has no lineup or defense to show (the
  // gate lives in defenseEntering/lineupEntering, ADR-0010 — this only decides
  // whether to offer the tab at all, so a further-out half doesn't get two tabs
  // that open onto nothing).
  const showEntering = safeToShowEntering(revealedThrough, effInning, effHalf)
  const tabs = showEntering ? TABS : TABS.filter((t) => t.key === 'arms' || t.key === 'bench')
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
  const strip = (idFor) => (
    <div className="refpanel__tabs" role="tablist" aria-label="Reference">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          id={idFor(`tab-${t.key}`)}
          className="refpanel__tab"
          aria-selected={t.key === active}
          aria-controls={idFor('panel')}
          onClick={() => setTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
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
}) {
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
      />
    )
  }
  if (tab === 'bench') {
    // ONE LIST PER CLUB, OPEN. This tab used to render both clubs' whole
    // roster cards at RosterPanel's own page default — collapsed — so tapping
    // BENCH answered with two shut drawers and nothing else, and the bench a
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
      </>
    )
  }
  // ARMS. Both halves of it are reveal-progress-driven: no pitcher has a line
  // until a half has been scored, and Margin Notes are built from those same
  // lines. Jump straight to a half ahead of the reveal mark and this section
  // legitimately has nothing — which as bare emptiness read as a broken panel
  // holding a reserved column open for no reason. Say so instead.
  //
  // The pre-half strip's own notes land here too — HalfInning declines to
  // render the strip in focus mode (its own `focusOne` gate, which used to be
  // a `display: none` in styles/focus/stage.css) and this is where they go.
  // That makes THIS the only `buildPreHalfCallouts` call on the screen while
  // focus mode is on, rather than the second of two.
  // SPOILER FOOTING IS THE STRIP'S OWN, UNCHANGED. `buildPreHalfCallouts` gates
  // every score-reading family on `revealedThrough` INSIDE itself (see that
  // file's header — the gate lives there precisely so no caller can skip it),
  // and `showEntering` is the same reached-half caller gate HalfInning applies
  // before rendering the strip inline (ADR-0010). Both are in force below.
  const preHalf = showEntering
    ? buildPreHalfCallouts({ feed, bundle: callouts, inning: effInning, half: effHalf, revealedThrough, workload, gameDate: workloadGameDate })
    : []
  const notes = mergeNotes(preHalf, marginNotes)
  const armsEmpty = !notes.length && !pitcherTeams.some((t) => t.rows?.length)
  // Deliberately a short label, not a sentence: the app uppercases every string
  // by default (01-base.css's `#root *` invariant, guarded by check-caps.mjs),
  // and a full sentence shouted in caps reads far worse than four words do.
  if (armsEmpty) {
    return <p className="refpanel__empty">No pitching lines yet</p>
  }
  return (
    <>
      <MarginNotes notes={notes} feed={feed} bundle={callouts} />
      <PitchersSection teams={pitcherTeams} />
    </>
  )
}

// One ranked list out of two already-ranked ones. Both builders emit the same
// `{ text, personId, side, kind, score, dedupeKey }` note shape and score on the
// same 0–100 worthiness rubric (docs/callouts.md), so re-sorting on `score` is a
// merge, not a re-ranking — a strip note and a digest note compete on the terms
// they were already scored under. Deduped on `dedupeKey` for the case both
// builders reach the same fact about the same pitcher; the pre-half copy wins
// ties by arriving first, which is the entering-tense wording (ADR-0014) and
// the right one for a half still being scored.
function mergeNotes(preHalf, marginNotes) {
  const seen = new Set()
  const out = []
  for (const n of [...preHalf, ...(marginNotes ?? [])]) {
    const key = n.dedupeKey ?? n.text
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n)
  }
  return out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
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
