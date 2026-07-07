// "Path to the Majors" — a chevron strip showing every MiLB level a player
// has climbed (from wherever his career started — levels below that are
// dropped, not dimmed, since he's never going back), when he reached it (a
// year range, for a level spanning multiple seasons), and his career workload
// there (at-bats for a position player, innings pitched for a pitcher), with
// the current level highlighted and levels still ahead dimmed. Each rung is
// shaped as a chevron pointing at the next one, so the right-hand edge of the
// strip literally arrows toward MLB; the final MLB rung is the destination,
// so it gets a flat trailing edge instead of another point.
//
// A pre-debut player gets a dimmed, unreached MLB rung (the climb still
// ahead). A debuted player passes `debutYear`, which fills that rung in as
// reached — PlayerPage.jsx then moves the whole card down to sit just above
// Firsts, reading as "how he got here" instead of "how far he's got left."
export function LevelProgressionCard({ levels, debutYear }) {
  if (!levels?.length) return null
  // A debuted player's MLB rung is where he is now — it takes the blue
  // "current" highlight, unless he's presently back at a lower level (a MiLB
  // rung already carries isCurrent), so the chain always marks exactly where
  // he stands. A pre-debut player's MLB rung is the unreached destination.
  const someLevelCurrent = levels.some((l) => l.isCurrent)
  const mlbTarget = debutYear
    ? { sportId: 1, label: 'MLB', reached: true, isCurrent: !someLevelCurrent, target: true, firstYear: debutYear, lastYear: debutYear }
    : { sportId: 1, label: 'MLB', reached: false, isCurrent: false, target: true }
  const steps = [...levels, mlbTarget]
  return (
    <section className="levelprog">
      <h3 className="section__title"><span>Path to the Majors</span></h3>
      <div className="levelprog__arrow" aria-label="Minor league level progression">
        {steps.map((lvl) => (
          <div
            key={lvl.sportId}
            className={[
              'levelprog__step',
              lvl.isCurrent && 'is-current',
              !lvl.reached && 'is-unreached',
              lvl.target && 'is-target',
            ].filter(Boolean).join(' ')}
          >
            <span className="levelprog__label">{lvl.label}</span>
            {lvl.reached && (
              <span className="levelprog__detail">
                {lvl.firstYear}
                {lvl.lastYear > lvl.firstYear ? `–${lvl.lastYear}` : ''}
                {lvl.stat ? ` · ${lvl.stat}` : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
