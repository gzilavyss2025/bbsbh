// "Path to the Majors" — a chevron strip showing every MiLB level a pre-debut
// player has climbed, when he first reached it, and career games there, with
// the current level highlighted and unreached levels dimmed. Never rendered
// for a debuted player (see PlayerPage.jsx's `data.progression` gate).
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
              <span className="levelprog__detail">{lvl.firstYear} · {lvl.games}G</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
