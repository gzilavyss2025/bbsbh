// The opposing starter's season pitch-type mix — one row per pitch, his
// share of pitches thrown as a percentage, with his average velocity for
// that pitch trailing it. `arsenal` is api/pitchArsenal.js's
// pitchArsenalFor() output — already sorted most-thrown first, pre-filtered
// to a real sample — so this component does no filtering or sorting of its
// own. Renders nothing if there's no arsenal (below the qualifier floor, or
// the level carries no pitch tracking).
export function PitchArsenalMix({ arsenal, className = '' }) {
  if (!arsenal || arsenal.length === 0) return null
  return (
    <div className={`arsenal ${className}`.trim()}>
      <h4 className="arsenal__title">Pitch mix</h4>
      <ul className="arsenal__list">
        {arsenal.map((t) => (
          <li key={t.code} className="arsenal__row">
            <span className="arsenal__name">{t.description || t.code}</span>
            <span className="arsenal__pct">{t.pct}%</span>
            {t.avgVelo != null && <span className="arsenal__velo">{t.avgVelo} mph</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
