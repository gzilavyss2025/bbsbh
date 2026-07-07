// "Path to the Majors" — a chevron strip showing every MiLB level a pre-debut
// player has climbed (from wherever his career started — levels below that
// are dropped, not dimmed, since he's never going back), when he reached it
// (a year range, for a level spanning multiple seasons), and career games
// there, with the current level highlighted and levels still ahead dimmed.
// Each rung is shaped as a chevron pointing at the next one, so the right-hand
// edge of the strip literally arrows toward MLB; the final MLB rung is the
// destination, so it gets a flat trailing edge instead of another point.
// Never rendered for a debuted player (see PlayerPage.jsx's `data.progression`
// gate).
const MLB_TARGET = { sportId: 1, label: 'MLB', reached: false, isCurrent: false, target: true }

export function LevelProgressionCard({ levels }) {
  if (!levels?.length) return null
  const steps = [...levels, MLB_TARGET]
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
                {lvl.lastYear > lvl.firstYear ? `–${lvl.lastYear}` : ''} · {lvl.games}G
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
