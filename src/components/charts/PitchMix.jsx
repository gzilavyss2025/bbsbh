import { useState } from 'react'
import { pitchFamily } from '../../api/pitchArsenal.js'

const DASH = '—'

// The times-through tabs are labelled by the look they show. Ordinals rather
// than "TTO 2", which is broadcast shorthand a scorer reading this page has no
// reason to know.
const LOOK_LABEL = { 1: '1st', 2: '2nd', 3: '3rd+' }

// The player page's "Pitches" body: an ink slab carrying one row per pitch —
// the pitch by name, its family spelled out, a usage meter, its share, and the
// average velocity — over a band naming his 100 mph work when he has any.
// `arsenal` is person.js's arsenalView output (already sorted most-thrown
// first); `heat` is pitchArsenal.js's heatView, null for any arm under the
// century floor; `tto` is its arsenalTtoView, null for any arm the nightly
// file carries no times-through split for, in which case no filter renders.
//
// WHY THIS IS INK AND THE REST OF THE PAGE IS PAPER. Velocity and mix are the
// numbers a reader opens a pitcher's page for, and in the old dress they were
// the quietest things on it: a 10px chart chip carried the family, the share
// was rounded to whole percent (so a 11.0% slider and a 10.6% curveball both
// read "11%", and the bar above them was the only place the difference
// existed), and the velocity sat at body size in the last column. Inverting
// the card puts the figures at the size they earn.
//
// THE FAMILY IS A WORD NOW, NOT A CHIP. Colour still agrees with it — the
// meter, the word and the share figure all take the family's ink so a number
// pairs with its bar without a legend — but colour no longer CARRIES it. The
// old chip was identity by low-chroma colour alone at 10px.
//
// The old `.pitchmix` classes are deliberately left alone rather than
// restyled: BattedBallMix.jsx reuses them verbatim for the hitter's "Batted
// balls" card, and this redesign was asked for on the pitcher's card only.
// See src/styles/69-pitch-arsenal.css.
export function PitchMix({ arsenal, heat, tto }) {
  // `null` is the season, a number is that look. Held here rather than lifted:
  // nothing else on the page reacts to it, and it deliberately does NOT
  // persist — a reader who comes back to a pitcher wants the season first.
  const [look, setLook] = useState(null)
  if (!arsenal?.length) return null

  // A look the file no longer carries can't be selected, so the tabs are the
  // looks that exist, never a fixed three. A reliever with only first looks
  // gets no filter at all (arsenalTtoView returns null), and a swingman who
  // has been through twice gets two tabs beside All.
  const looks = tto ?? []
  const selected = look == null ? null : looks.find((l) => l.look === look) ?? null

  // Pitch NAMES come from the live feed's view either way. The nightly file
  // spells the same pitch differently ("Four-Seam Fastball" vs "Four-seam
  // FB"), and a name that changes when you tap a tab reads as a different
  // pitch rather than the same one on a different look.
  const nameByCode = new Map(arsenal.map((p) => [p.code, p.name]))
  const rows = selected
    ? selected.rows.map((r) => ({ ...r, name: nameByCode.get(r.code) ?? r.name }))
    : arsenal

  // The season's pitch count, footed from the rows themselves. Every row has
  // to carry a count for the total to be honest, so one missing count drops
  // the line rather than under-reporting the season.
  const total = selected
    ? selected.total
    : arsenal.every((p) => p.count != null)
      ? arsenal.reduce((n, p) => n + p.count, 0)
      : null
  return (
    <div className="pitchslab">
      <div className="pitchslab__rule" />
      <div className="pitchslab__head">
        <span className="pitchslab__title">Arsenal</span>
        {total != null && (
          <span className="pitchslab__total">{total.toLocaleString()} pitches</span>
        )}
      </div>
      {looks.length > 0 && (
        <>
          <div className="pitchslab__tabs" role="group" aria-label="Times facing a batter in a game">
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
          <p className="pitchslab__tabnote">Times facing a batter in a game</p>
        </>
      )}
      <ul className="pitchslab__list">
        {rows.map((p) => {
          const family = pitchFamily(p.code)
          return (
            <li className="pitchslab__row" key={p.code}>
              <div className="pitchslab__line">
                <span className="pitchslab__id">
                  <span className="pitchslab__name">{p.name}</span>
                  <span className={`pitchslab__family pitchslab__family--${family}`}>{family}</span>
                </span>
                <span className="pitchslab__velo">
                  {p.velo != null ? (
                    <>
                      {p.velo.toFixed(1)}
                      <span className="pitchslab__unit">mph</span>
                    </>
                  ) : (
                    DASH
                  )}
                </span>
              </div>
              <div className="pitchslab__meterrow">
                {/* Decorative: the share it encodes is spelled out right
                    beside it, same rule the old bar followed. */}
                <div className="pitchslab__meter" aria-hidden="true">
                  {p.usage != null && (
                    <div
                      className={`pitchslab__fill pitchslab__fill--${family}`}
                      style={{ width: `${p.usage * 100}%` }}
                    />
                  )}
                </div>
                <span className={`pitchslab__pct pitchslab__pct--${family}`}>
                  {p.usage != null ? `${(p.usage * 100).toFixed(1)}%` : DASH}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {heat && <HeatBand heat={heat} />}
    </div>
  )
}

function LookTab({ label, active, onSelect }) {
  return (
    <button
      type="button"
      className={`pitchslab__tab${active ? ' is-active' : ''}`}
      aria-pressed={active}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

// The 100 mph band. Two facts always (how many, and his hardest), a third when
// the nightly file carries a rank — see heatView, which leaves rank null until
// gen-pitch-arsenal.mjs writes one.
function HeatBand({ heat }) {
  return (
    <div className="pitchslab__heat">
      <div className="pitchslab__flame">
        <Flame />
      </div>
      <div className="pitchslab__heatfacts">
        <div className="pitchslab__fact">
          <span className="pitchslab__factnum">{heat.count.toLocaleString()}</span>
          <span className="pitchslab__factlabel">At 100+ mph</span>
        </div>
        {heat.maxVelo != null && (
          <div className="pitchslab__fact">
            <span className="pitchslab__factnum">{heat.maxVelo.toFixed(1)}</span>
            <span className="pitchslab__factlabel">Tops out at</span>
          </div>
        )}
        {heat.rank != null && heat.of != null && (
          <div className="pitchslab__fact pitchslab__fact--rank">
            <span className="pitchslab__factnum">
              {heat.rank} of {heat.of}
            </span>
            <span className="pitchslab__factlabel">MLB rank</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Drawn rather than an emoji so it takes the band's inks and scales with it.
// Two paths: the body in the band's own accent, a core knocked back to the
// slab ink so the shape reads as a flame and not a leaf at 26px.
function Flame() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 1.5c.6 2.9 2.1 4.6 3.6 6.3C17.4 9.9 19 11.9 19 14.8 19 18.9 15.9 22 12 22s-7-3.1-7-7.2c0-2.2 1-3.9 2.3-5.4C8.9 7.5 10 5.6 10.4 3.4c1 1.6 1.6 3.2 1.8 4.9.5-2.1.3-4.4-.2-6.8z"
        fill="var(--heat-band)"
      />
      <path
        d="M12 13c1.3 1.3 2.4 2.2 2.4 3.7 0 1.4-1.1 2.5-2.4 2.5s-2.4-1.1-2.4-2.5c0-1.3.9-2.2 2.4-3.7z"
        fill="var(--heat-slab)"
      />
    </svg>
  )
}
