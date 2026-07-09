import { useState } from 'react'
import { prospectBadge } from '../api/prospects.js'
import { PlayerLink } from './PlayerLink.jsx'
import { ProspectPill } from './ProspectPill.jsx'

// Persistent roster reference, collapsed by default: starters (who won't
// enter once the rotation's set), the bullpen (with handedness as LHP/RHP),
// and the bench (with position) as they stood at first pitch, for lookup
// while scoring. A player who has entered the game is struck through — no
// longer eligible — but ONLY once his entry sits at or below the reveal mark;
// a substitution the user hasn't revealed their way to yet renders like any
// other available player, so the card never hints at a sealed inning.
export function RosterPanel({ title, roster, revealedThrough, prospectsData }) {
  const [open, setOpen] = useState(false)
  const empty =
    roster.starters.length === 0 && roster.bullpen.length === 0 && roster.bench.length === 0
  const entered = (p) => p.enteredIdx != null && p.enteredIdx <= revealedThrough
  const rowClass = (p) => `roster__row ${entered(p) ? 'is-entered' : ''}`
  return (
    <section className="roster">
      <button
        className="roster__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="roster__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="roster__body">
          {empty && <p className="hint">Not posted yet.</p>}

          {roster.bullpen.length > 0 && (
            <>
              <h4 className="roster__group">Bullpen</h4>
              <ul className="roster__list">
                {roster.bullpen.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst.toUpperCase()}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{handAbbr(p.hand)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {roster.bench.length > 0 && (
            <>
              <h4 className="roster__group">Bench</h4>
              <ul className="roster__list">
                {roster.bench.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst.toUpperCase()}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{p.position}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {roster.starters.length > 0 && (
            <>
              <h4 className="roster__group">Starters</h4>
              <ul className="roster__list">
                {roster.starters.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst.toUpperCase()}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{handAbbr(p.hand)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}

// 'Left' / 'Right' handedness -> pitcher shorthand.
function handAbbr(hand) {
  const h = (hand || '').toLowerCase()
  if (h.startsWith('l')) return 'LHP'
  if (h.startsWith('r')) return 'RHP'
  return ''
}
