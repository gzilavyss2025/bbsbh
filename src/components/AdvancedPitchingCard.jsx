// The player page's "Advanced" card for pitchers: the run-prevention rates
// behind the headline tiles — FIP, league-adjusted ERA−, the K/BB rates, the
// ground-ball share, what hitters bat against him, and a role-aware last cell
// (quality starts / inherited runners). Shaped by person.js's
// advancedPitchingView from one live statsapi request (see
// person-fetch.js's fetchPitchingAdvanced). Full-season aggregates — same
// spoiler footing as the vs-L/R season splits, and labeled so. MLB-only at
// the source; MiLB pitchers get no card.
export function AdvancedPitchingCard({ adv }) {
  if (!adv?.facts?.length) return null
  return (
    <div className="advcard">
      <h3 className="section__title">
        <span>Advanced</span>
        <em>full season</em>
      </h3>
      <dl className="factgrid">
        {adv.facts.map((f) => (
          <div className="fact" key={f.label}>
            <dt className="fact__label">{f.label}</dt>
            <dd className="fact__value">{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="hint hint--prose advcard__hint">
        FIP counts only what a pitcher alone controls — strikeouts, walks and
        home runs. ERA− sets his ERA against the league: 100 is average, lower
        is better.
      </p>
    </div>
  )
}
