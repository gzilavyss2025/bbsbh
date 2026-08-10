import { useEffect, useRef, useState } from 'react'
import { safeToShowEntering } from '../../../api/enteringHalf.js'
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

  const strip = (
    <div className="refpanel__tabs" role="tablist" aria-label="Reference">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          className="refpanel__tab"
          aria-selected={t.key === active}
          onClick={() => setTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  if (wide) {
    return (
      <aside className="focusrail" aria-label="Reference">
        {strip}
        <div className="refpanel__body">
          <Section tab={active} showEntering={showEntering} {...props} />
        </div>
      </aside>
    )
  }

  return (
    <>
      <div className="refbar">
        {tabs.map((t) => (
          <button key={t.key} type="button" className="refbar__chip" onClick={() => openSheet(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {sheetOpen && (
        <RefSheet onClose={() => setSheetOpen(false)}>
          {strip}
          <div className="refpanel__body refpanel__body--sheet">
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
  prospectsData,
  rookiesData,
  isMlb,
  revealedThrough,
  rosters,
}) {
  if (tab === 'lineups' && showEntering) {
    return (
      <LineupSection
        feed={feed}
        inning={effInning}
        half={effHalf}
        awayName={meta.away.clubName}
        homeName={meta.home.clubName}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        isMlb={isMlb}
        revealedThrough={revealedThrough}
      />
    )
  }
  if (tab === 'field' && showEntering) {
    return (
      <DefenseSection
        feed={feed}
        inning={effInning}
        half={effHalf}
        fieldingSide={effHalf === 'top' ? 'home' : 'away'}
        fieldingName={effHalf === 'top' ? meta.home.clubName : meta.away.clubName}
        fieldingTeamId={effHalf === 'top' ? meta.home.id : meta.away.id}
        revealedThrough={revealedThrough}
      />
    )
  }
  if (tab === 'bench') {
    return (
      <>
        {['away', 'home'].map((side) => (
          <RosterPanel
            key={side}
            title={rosters[side].name}
            roster={rosters[side]}
            revealedThrough={revealedThrough}
            prospectsData={prospectsData}
            rookiesData={rookiesData}
            isMlb={isMlb}
          />
        ))}
      </>
    )
  }
  // ARMS. Both halves of it are reveal-progress-driven: no pitcher has a line
  // until a half has been scored, and Margin Notes are built from those same
  // lines. Jump straight to a half ahead of the reveal mark and this section
  // legitimately has nothing — which as bare emptiness read as a broken panel
  // holding a reserved 300px column open for no reason. Say so instead.
  const armsEmpty =
    !marginNotes?.length && !pitcherTeams.some((t) => t.rows?.length)
  // Deliberately a short label, not a sentence: the app uppercases every string
  // by default (01-base.css's `#root *` invariant, guarded by check-caps.mjs),
  // and a full sentence shouted in caps reads far worse than four words do.
  if (armsEmpty) {
    return <p className="refpanel__empty">No pitching lines yet</p>
  }
  return (
    <>
      <MarginNotes notes={marginNotes} feed={feed} bundle={callouts} />
      <PitchersSection teams={pitcherTeams} />
    </>
  )
}

function RefSheet({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
