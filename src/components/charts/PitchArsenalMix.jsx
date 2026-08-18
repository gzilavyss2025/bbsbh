import { useState } from 'react'
import { MIN_LOOK_SHIFT } from '../../api/pitchArsenal.js'

// Direction of a pitch's usage between one look and the look before it. The
// SHAPE carries the direction and the colour only agrees with it — the same
// rule the standings trend glyph and the prospect movement pill follow, so
// the arrow still reads for a reader who cannot separate the two inks.
//
// DRAWN, not the ▲/▼ characters those two use. A typeface sets those glyphs
// at roughly half the height of the digits beside them and no font-size can
// fix that without making the arrow's own box bigger than the row — the
// triangle is a fraction of its em box, and how big a fraction is the font's
// business. A path in a box sized in em is exactly as tall as the figure it
// annotates, at any row size.
const SHIFT_PATH = {
  up: 'M5 0.5 9.6 9.5 0.4 9.5Z',
  down: 'M5 9.5 0.4 0.5 9.6 0.5Z',
}

// The times-through tabs, labelled by the look they show. Ordinals rather
// than "TTO 2", which is broadcast shorthand a scorer staging a game has no
// reason to know.
//
// The word "look" is carried by the FIRST tab only and the rest run on as a
// series — "1st look, 2nd, 3rd+" — the way a sentence names a unit once. It
// is what replaced a caption line under the strip reading "times facing a
// batter in a game": four bare ordinals need something nearby to say first
// WHAT, but a whole line of chrome to say it, under a control this small and
// on a card that is already a stack of dated facts, was more filter than
// filtered. Spelling the unit into the tab says the same thing in the space
// the tab already occupies. The full sentence still reaches a screen reader,
// as the group's aria-label.
const LOOK_LABEL = { 1: '1st look', 2: '2nd', 3: '3rd+' }

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
        // How this look differs from the one before it. Only on a look, and
        // never on the season, which has nothing to be a change FROM.
        delta: r.delta,
      }))
    : arsenal.map((t) => ({
        code: t.code,
        name: t.description || t.code,
        pct: t.pct,
        avgVelo: t.avgVelo,
        delta: null,
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
      <ul className="arsenal__list">
        {rows.map((t) => (
          <li key={t.code} className="arsenal__row">
            <span className="arsenal__name">{t.name}</span>
            <span className="arsenal__pct">
              {t.pct}%
              <ShiftGlyph delta={t.delta} />
            </span>
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

// The arrow beside a look's share: up in green when he went to the pitch more
// than he did the look before, down in clay when he went to it less, nothing
// at all under MIN_LOOK_SHIFT or on a pitch the previous look never saw.
//
// The figure it moved BY is not printed. Two numbers in a 5ch column is a
// column of arithmetic, and the shares of the neighbouring look are one tap
// away for a reader who wants the subtraction. It reaches a screen reader
// through the label, which has room for it.
function ShiftGlyph({ delta }) {
  if (delta == null || Math.abs(delta) < MIN_LOOK_SHIFT) return null
  const dir = delta > 0 ? 'up' : 'down'
  const points = Math.abs(Math.round(delta * 1000) / 10)
  return (
    <span
      className={`arsenal__shift arsenal__shift--${dir}`}
      role="img"
      aria-label={`${dir === 'up' ? 'Up' : 'Down'} ${points} points from the previous look`}
    >
      <svg viewBox="0 0 10 10" focusable="false" aria-hidden="true">
        <path d={SHIFT_PATH[dir]} />
      </svg>
    </span>
  )
}
