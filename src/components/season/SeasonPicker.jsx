import '../../styles/season/season-picker.css'
import { useNav } from '../../lib/nav.js'
import { compareOptions, seasonOptions } from '../../lib/seasons/view.js'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { Pill } from '../ui/control/Pill.jsx'

// THE SEASON PICKER (#1202): which season a season-store page shows, every
// season combined, or one season compared with another. Each choice is an
// ADDRESS (lib/route.js's season segment and `?vs=`), so a pick is shareable
// and Back undoes it. `view` is useSeasonView's; `pathFor({ seasonYear, vs })`
// builds this page's address.
//
// Pill controls, because a pill control FILTERS the content under it (#1131's
// rule, Pill.jsx). Never a hand-drawn chip.
//
//   compare  false on a surface that has no compare view.
//   mode     'change' or 'side', with `onMode`: a leader board's compare shows
//            a change column, or the two seasons side by side (#1199, question
//            3). Page state, not an address: it changes how a board is drawn,
//            not what it holds.
//
// Renders nothing when one season is on file: one choice is not a choice.
export function SeasonPicker({ view, pathFor, compare = true, mode, onMode }) {
  const navigate = useNav()
  const seasons = seasonOptions(view)
  if (!seasons.length) return null
  const versus = compare ? compareOptions(view) : []
  const go = (seasonYear, vs) => navigate(pathFor({ seasonYear, vs }))

  return (
    <Stack gap="snug" className="seasonpick">
      <Cluster gap="tight" align="center" role="group" aria-label="Season">
        <span className="seasonpick__label" aria-hidden="true">Season</span>
        {seasons.map((o) => (
          <Pill
            key={o.key}
            role="control"
            fill="paper"
            pressed={view.shown === o.key}
            onClick={() => go(o.key, view.vs)}
          >
            {o.label}
          </Pill>
        ))}
      </Cluster>
      {versus.length > 0 && (
        <Cluster gap="tight" align="center" role="group" aria-label={`Compare ${view.label} with`}>
          <span className="seasonpick__label" aria-hidden="true">Compare</span>
          {versus.map((o) => (
            <Pill
              key={o.key}
              role="control"
              fill="paper"
              pressed={view.vs === o.key}
              // A second tap on the lit season ends the comparison.
              onClick={() => go(view.shown, view.vs === o.key ? null : o.key)}
            >
              {o.label}
            </Pill>
          ))}
        </Cluster>
      )}
      {view.vs != null && onMode && (
        <Cluster gap="tight" align="center" role="group" aria-label="Show the comparison as">
          <span className="seasonpick__label" aria-hidden="true">Show</span>
          <Pill role="control" fill="paper" pressed={mode === 'change'} onClick={() => onMode('change')}>
            Change
          </Pill>
          <Pill role="control" fill="paper" pressed={mode === 'side'} onClick={() => onMode('side')}>
            Side by side
          </Pill>
        </Cluster>
      )}
    </Stack>
  )
}
