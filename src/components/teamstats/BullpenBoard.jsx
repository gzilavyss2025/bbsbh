import { useMemo, useState } from 'react'
import { staffGridFor } from '../../api/workload.js'
import { InfoPopover } from '../ui/InfoPopover.jsx'
import { SectionMasthead } from '../ui/SectionMasthead.jsx'
import { StaffGrid } from '../workload/StaffGrid.jsx'
import { headerThemeClass, headerThemeStyle } from '../../lib/headerTheme.js'

// The bullpen availability board — who's rested, who's limited, who's likely
// down tonight, from each reliever's recent completed appearances
// (api/workload.js: rule-based flags with published thresholds — 25+ pitches
// yesterday, 35+ over three days, back-to-back days, three straight days).
// Spoiler-free: everything is yesterday-and-earlier; nothing from tonight.
//
// IT DRAWS A STAFF GRID, not a list of names. The list gave a reader eight
// rows of tag-plus-name and hid every reason behind a hover title, which is
// invisible on the phone this app is built for. The grid puts the same eight
// arms over their last seven days, so the shape of a worked pen — the run of
// clay down one column after extra innings, the arm with three days in a row —
// is the thing you see first. Same file, same verdicts, no sentences.
//
// Only rendered for a slate-current game (the workload file describes "now",
// so on an archival box score the flags would be about the wrong day) — the
// caller gates on the game date sitting within the file's freshness window.
//
// Nested under the OPPOSING starting pitcher card (TeamInfo.jsx), behind the
// BullpenToggle below — this side's lineup is about to face THAT team's pen,
// not its own, so `bullpen`/`theme`/`masthead` all belong to the other side
// (same club OpposingStarterCard themes its own masthead to, see ADR-0030).

// Nests the board under the starting pitcher card, collapsible via the pill
// below rather than a plain always-on section: local state, not a persisted
// preference like useMatchupNotes — every visit starts collapsed fresh rather
// than remembering a prior expand.
export function useBullpenReveal() {
  const [showBullpen, setShowBullpen] = useState(false)
  return { showBullpen, setShowBullpen }
}

// The pill that shows/hides the board, in the starting pitcher masthead's
// aside slot — same look as the batting order's MatchupNotesToggle
// (.mastheadpill), guarded the same shallow way: on whether this team HAS
// bullpen arms listed, not on whether the board's rows end up non-empty once
// workload/gameDate are factored in (BullpenBoard itself still renders
// nothing in that case).
export function BullpenToggle({ hasArms, showBullpen, onToggle }) {
  if (!hasArms) return null
  return (
    <button
      type="button"
      className="mastheadpill"
      aria-pressed={showBullpen}
      onClick={() => onToggle(!showBullpen)}
    >
      <span className="mastheadpill__dot" aria-hidden="true" />
      Bullpen
    </button>
  )
}

export function BullpenBoard({ workload, teamId, gameDate, theme, masthead }) {
  // The grid is built from the WORKLOAD file's own roster for this club rather
  // than the boxscore's pregame bullpen list: that list carries rotation arms
  // parked in it, and this is a bullpen board, not a rotation one. The boxscore
  // list still gates the SURFACE (see BullpenToggle) — a club with no arms
  // listed for tonight gets no board at all.
  const rows = useMemo(() => {
    if (!workload || !gameDate || teamId == null) return null
    return staffGridFor(workload, Number(teamId), gameDate)
  }, [workload, teamId, gameDate])

  if (!rows || rows.length === 0) return null

  return (
    <section
      className={`metriccard penboard ${headerThemeClass(theme)}`.trim()}
      style={headerThemeStyle(theme, masthead?.scale)}
    >
      <SectionMasthead title="Bullpen health">
        <InfoPopover label="How bullpen availability is judged">
          Rested vs. worked from recent appearances — a workload signal, not a
          talent grade. Managers overrule it nightly.
        </InfoPopover>
      </SectionMasthead>
      <div className="metriccard__body">
        <StaffGrid rows={rows} />
      </div>
    </section>
  )
}
