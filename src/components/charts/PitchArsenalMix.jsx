import { useState } from 'react'

// The times-through tabs are labelled by the look they show, matching the
// player page's Pitches card (components/charts/PitchMix.jsx). Ordinals
// rather than "TTO 2", which is broadcast shorthand a scorer staging a game
// has no reason to know.
const LOOK_LABEL = { 1: '1st', 2: '2nd', 3: '3rd+' }

// The opposing starter's season pitch-type mix — one row per pitch, his
// share of pitches thrown as a percentage, with his average velocity for
// that pitch trailing it. `arsenal` is api/pitchArsenal.js's
// pitchArsenalFor() output — already sorted most-thrown first, pre-filtered
// to a real sample — so this component does no filtering or sorting of its
// own. Renders nothing if there's no arsenal (below the qualifier floor, or
// the level carries no pitch tracking).
//
// `tto` is the same module's arsenalTtoView: the same season split by how
// many times he had already faced that batter in the game. Null for an arm
// the nightly file carries no split for and for anyone with only one
// qualifying look, in which case no filter renders and the card is the
// season, exactly as before.
export function PitchArsenalMix({ arsenal, tto, className = '' }) {
  // `null` is the season, a number is that look. Held here, not lifted, and
  // deliberately not persisted: a scorer opening the next game's lineup wants
  // the season first, same rule the player page's card follows.
  const [look, setLook] = useState(null)
  if (!arsenal || arsenal.length === 0) return null

  // The tabs are the looks the file actually carries, never a fixed three.
  const looks = tto ?? []
  const selected = look == null ? null : looks.find((l) => l.look === look) ?? null

  // Pitch NAMES come from the season rows either way. The split carries the
  // same spelling today, but a name that changes when you tap a tab would
  // read as a different pitch rather than the same one on a different look.
  const nameByCode = new Map(arsenal.map((t) => [t.code, t.description || t.code]))
  const rows = selected
    ? selected.rows.map((r) => ({
        code: r.code,
        name: nameByCode.get(r.code) ?? r.name,
        pct: Math.round(r.usage * 1000) / 10,
        avgVelo: r.velo,
      }))
    : arsenal.map((t) => ({
        code: t.code,
        name: t.description || t.code,
        pct: t.pct,
        avgVelo: t.avgVelo,
      }))

  return (
    <div className={`arsenal ${className}`.trim()}>
      <div className="arsenal__head">
        <h4 className="arsenal__title">Pitch mix</h4>
        {looks.length > 0 && (
          <div className="arsenal__tabs" role="group" aria-label="Times facing a batter in a game">
            <LookTab label="All" active={look == null} onSelect={() => setLook(null)} />
            {looks.map((l) => (
              <LookTab
                key={l.look}
                label={LOOK_LABEL[l.look]}
                active={look === l.look}
                onSelect={() => setLook(l.look)}
              />
            ))}
          </div>
        )}
      </div>
      {looks.length > 0 && <p className="arsenal__tabnote">Times facing a batter in a game</p>}
      <ul className="arsenal__list">
        {rows.map((t) => (
          <li key={t.code} className="arsenal__row">
            <span className="arsenal__name">{t.name}</span>
            <span className="arsenal__pct">{t.pct}%</span>
            {t.avgVelo != null && <span className="arsenal__velo">{t.avgVelo} mph</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LookTab({ label, active, onSelect }) {
  return (
    <button
      type="button"
      className={`arsenal__tab${active ? ' is-active' : ''}`}
      aria-pressed={active}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}
