// A factual level-by-level dossier: reached levels retain their year and
// workload, the live assignment is explicit, and unreached levels remain the
// path ahead. Performance analysis belongs to ProspectCard, so this component
// never repeats or interprets a current-level percentile.
export function LevelProgressionCard({ levels, debutYear }) {
  if (!levels?.length) return null

  const someLevelCurrent = levels.some((level) => level.isCurrent)
  const mlbTarget = debutYear
    ? { sportId: 1, label: 'MLB', reached: true, isCurrent: !someLevelCurrent, target: true, firstYear: debutYear, lastYear: debutYear }
    : { sportId: 1, label: 'MLB', reached: false, isCurrent: false, target: true }
  const steps = [...levels, mlbTarget]
  const current = steps.find((level) => level.isCurrent)

  return (
    <section className="levelprog">
      <header className="levelprog__head">
        <div>
          <span className="levelprog__kicker">Player development</span>
          <h3 className="levelprog__title">Path to the Majors</h3>
        </div>
        {current && (
          <p className="levelprog__current">
            <span>Current assignment</span>
            <strong>{current.label}</strong>
          </p>
        )}
      </header>
      <div className="levelprog__body">
        <ol
          className="levelprog__path"
          aria-label="Minor league level progression"
          style={{ '--level-count': steps.length }}
        >
          {steps.map((level) => {
            const status = level.isCurrent ? 'Current' : level.reached ? 'Reached' : level.target ? 'MLB destination' : 'Next level'
            return (
              <li
                key={level.sportId}
                className={[
                  'levelprog__step',
                  level.isCurrent && 'is-current',
                  !level.reached && 'is-unreached',
                  level.target && 'is-target',
                ].filter(Boolean).join(' ')}
                aria-current={level.isCurrent ? 'step' : undefined}
              >
                <span className="levelprog__status">{status}</span>
                <span className="levelprog__label">{level.label}</span>
                {level.reached && (
                  <span className="levelprog__detail">
                    {level.firstYear}
                    {level.lastYear > level.firstYear ? `–${level.lastYear}` : ''}
                    {level.stat ? ` · ${level.stat}` : ''}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
