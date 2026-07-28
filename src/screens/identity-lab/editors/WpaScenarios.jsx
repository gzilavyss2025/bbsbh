import { WinProbChart } from '../../../components/WinProbChart.jsx'
import { teamAbbr } from '../../../lib/teams.js'

// Three fixed win-probability states — a losing team gets a small band, a tied
// game splits evenly, a winning team gets a large one — so the "how does this
// tile's band actually read at different score states" question WpaPreview's
// single always-50/50-ish live edit can't answer gets answered directly.
// `homePct` feeds a single real data point (plus WinProbChart's own synthetic
// 50%-at-first-pitch origin), so each mockup draws as a real, if short,
// win-prob line rather than a flat cut.
const WPA_MOCK_SCENARIOS = [
  { key: 'losing', label: 'Losing', homePct: 20 },
  { key: 'tied', label: '50/50', homePct: 50 },
  { key: 'winning', label: 'Winning', homePct: 80 },
]

// Three side-by-side mockups of the REAL two-team win-probability chart
// (WinProbChart.jsx itself, not a hand-rolled stand-in — no drift risk) at the
// three score states above. This tile's own team is always the HOME band —
// "home" is a rendering slot, not a claim about which treatment is being
// previewed; only the color/layout/mark override fed in via
// homeBandOverride/homeLayoutOverride/homeMarkOverride changes between
// tiles. `wpaLayout`/`wpaBandOverride`/`wpaMarkOverride` are the SAME
// resolved values WpaPreview's fields show (`wpaMarkOverride` only when
// "Use Logo Art" is unchecked — see profiles/mlb.jsx), so an in-progress
// edit shows up here live rather than only once landed.
//
// `lastOpponent` (this team's most recent completed game's rival, TeamLabRow's
// own lazy fetch) plays the AWAY band on their own Main look — unaffected by
// this tile's draft — so the split reads as a real, recognizable matchup
// instead of a placeholder club. Renders nothing until it resolves:
// `undefined` (still fetching) and `null` (never found, e.g. before Opening
// Day) both skip the row rather than showing a broken half-built chart.
//
// `headerColors` (this treatment's resolved Header colors, shared with
// HeaderPreview so the two can't drift) recolors each mockup's OWN real
// .winprob__head bar, not a second fake header: WinProbChart's header reads the
// plain --navy/--seal/--text-on-ink tokens, and CSS custom properties cascade,
// so setting those three as inline style on this wrapper overrides them for
// everything inside it without touching the real tokens (or any other chart on
// the page).
export function WpaScenarios({
  teamId,
  name,
  treatment,
  lastOpponent,
  headerColors,
  wpaLayout,
  wpaBandOverride,
  wpaMarkOverride,
}) {
  if (!lastOpponent) return null
  const homeAbbr = teamAbbr({ id: teamId, name })
  return (
    <div
      className="colorlab__wpascenarios"
      style={{ '--navy': headerColors.bar, '--seal': headerColors.accent, '--text-on-ink': headerColors.onBar }}
    >
      {WPA_MOCK_SCENARIOS.map((s) => (
        <div className="colorlab__wpascenario" key={s.key}>
          <span className="colorlab__wpascenariolabel">{s.label}</span>
          <WinProbChart
            points={[{ home: s.homePct, inning: 1, half: 'top' }]}
            awayId={lastOpponent.id}
            homeId={teamId}
            awayAbbr={lastOpponent.abbreviation}
            homeAbbr={homeAbbr}
            awayTreatment="main"
            homeLayoutOverride={wpaLayout}
            homeBandOverride={wpaBandOverride}
            homeTreatment={treatment}
            homeMarkOverride={wpaMarkOverride}
          />
        </div>
      ))}
    </div>
  )
}
