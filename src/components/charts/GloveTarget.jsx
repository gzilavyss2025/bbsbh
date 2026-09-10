import '../../styles/26d-command-map.css'
import '../../styles/26f-glove-target.css'
import { useState } from 'react'
import {
  REFERENCE_RINGS,
  RIM_IN,
  gloveTargetBias,
  gloveTargetTypes,
  gloveTargetView,
} from '../../api/gloveTarget.js'
import { attributionFor, pitchLabel } from '../../api/targetCommand.js'
import { pitchFamily } from '../../api/pitchArsenal.js'

// THE GLOVE TARGET — where a pitcher's misses actually land, relative to the
// glove he was throwing at.
//
// THE GLOVE IS AT THE CENTRE FOR EVERY DOT, which is the whole idea. Each dot
// is one pitch's miss VECTOR (actual minus target), not its location, so the
// origin is the target by construction rather than by averaging. That is what
// makes the dashed ring mean something: it is the pitcher's median miss, so it
// halves the cloud — and it is the same number the Target Command strip prints
// for this pitch type, because both are the median of these same distances.
// scripts/gen-command-zone.mjs carries the full argument, including why a
// scatter of absolute locations around an average target does not work.
//
// IT IS A TARGET, SO IT IS DRAWN AS ONE. Concentric rings at ten, twenty and
// thirty inches, ruled faintly in pencil the way the Command Map rules its
// thirds; the pitcher's own median in navy; the league's in graphite beside it,
// so "is he better than most" is a comparison of two circles rather than a
// number a reader has to hold in their head. No strike zone: this card's space
// is a miss offset, and a miss has no zone to sit inside — which is also why it
// borrows the Command Map's CHIPS (that card's own .cmdmap__chip rules, not a
// copy of them) but none of its zone geometry.
//
// Catcher's eye, matching the Command Map above it: right on the card is the
// catcher's right, up is up.
//
// Renders nothing when the pitcher has no cloud — a hitter, a season outside
// OpenCommand's 2024-on coverage, or every pitch type under the sample floor.
//
// THE viewBox IS 1:1 WITH THE RENDERED PIXEL. 320 units wide, capped at 320px,
// so a user unit IS a CSS pixel — which is what lets the ring labels take a
// real --fs-* token and come out the size that token means. A smaller viewBox
// scaled up would multiply the type along with the geometry and quietly make
// an 11px caption 15px on screen.
const VB = 320
const CENTRE = VB / 2
// Inches to viewBox units. The rim is the frame's inner edge, with a little air
// so a dot sitting exactly on it is not half-clipped by the border, and room
// above it for the outermost ring's own label.
const PAD = 22
const scale = (CENTRE - PAD) / RIM_IN
const px = (inches) => inches * scale

export function GloveTarget({ entry, data }) {
  const types = gloveTargetTypes(entry)
  const [code, setCode] = useState('ALL')
  const view = gloveTargetView(entry, code)
  if (!view || !types.length) return null

  const credit = attributionFor(data)
  const leagueMiss = data?.median?.[code] ?? null
  const bias = gloveTargetBias(view)
  // Lower-cased for a SENTENCE, not for display: this only ever lands mid-way
  // through the plot's spoken aria-label ("Glove target for fastball: …"), which
  // the CSS invariant never reaches.
  const label = code === 'ALL' ? 'every pitch' : pitchLabel(code).toLowerCase() // caps-js-exempt

  return (
    <div className="glovetarget">
      <div className="cmdmap__chips cmdmap__chips--types" role="group" aria-label="Pitch type">
        {types.map((t) => (
          <button
            key={t.code}
            type="button"
            className={`cmdmap__chip cmdmap__chip--sm${t.code === code ? ' cmdmap__chip--on' : ''}`}
            onClick={() => setCode(t.code)}
            aria-pressed={t.code === code}
            data-family={t.code === 'ALL' ? undefined : pitchFamily(t.code)}
          >
            {t.code === 'ALL' ? 'All' : t.code}
          </button>
        ))}
      </div>

      <svg
        className="glovetarget__plot"
        viewBox={`0 0 ${VB} ${VB}`}
        role="img"
        aria-label={
          `Glove target for ${label}: ${view.n.toLocaleString()} pitches, ` +
          `median miss ${view.miss} inches from the catcher's target` +
          (leagueMiss != null ? `, against a league median of ${leagueMiss} inches` : '') +
          (bias ? `. He misses ${bias.text} more often than not.` : '')
        }
      >
        {/* The ruled reference rings, outermost first so the inner ones draw
            over them, and each one labelled in figures — an unlabelled ring is
            decoration, and the entire point of this card is that the distances
            are in real inches. */}
        {REFERENCE_RINGS.map((r) => (
          <g key={r}>
            <circle className="glovetarget__ring" cx={CENTRE} cy={CENTRE} r={px(r)} />
            <text className="glovetarget__ringlabel" x={CENTRE + 3} y={CENTRE - px(r) - 3}>
              {r}&#8243;
            </text>
          </g>
        ))}

        {/* The cross-hairs through the target. Not decoration: without them
            "high and to the left" is a judgement about a cloud with no axis to
            judge it against. */}
        <line className="glovetarget__axis" x1={PAD} y1={CENTRE} x2={VB - PAD} y2={CENTRE} />
        <line className="glovetarget__axis" x1={CENTRE} y1={PAD} x2={CENTRE} y2={VB - PAD} />

        {/* The league's median miss for this pitch, in graphite — the same ink
            the percentile strip gives its league baseline figure, so the two
            cards say "this is the league" the same way. */}
        {leagueMiss != null && (
          <circle className="glovetarget__league" cx={CENTRE} cy={CENTRE} r={px(leagueMiss)} />
        )}

        {/* Every dot is one pitch. SVG y grows downward, so a miss ABOVE the
            target subtracts. */}
        {view.dots.map((d, i) => (
          <circle
            key={i}
            className={`glovetarget__dot${d.clamped ? ' glovetarget__dot--rim' : ''}`}
            cx={CENTRE + px(d.x)}
            cy={CENTRE - px(d.z)}
            r="3.4"
          />
        ))}

        {/* His own median, drawn LAST so it survives the densest part of the
            cloud — the Command Map makes the same move with its zone frame. */}
        <circle className="glovetarget__median" cx={CENTRE} cy={CENTRE} r={px(view.miss)} />

        {/* The glove. A small filled mark at dead centre, so the thing every
            dot is measured from is visible rather than implied by an
            intersection of two rules. */}
        <circle className="glovetarget__glove" cx={CENTRE} cy={CENTRE} r="4.5" />
      </svg>

      <p className="glovetarget__key">
        <span className="glovetarget__keyitem glovetarget__keyitem--glove">Catcher&#8217;s target</span>
        <span className="glovetarget__keyitem glovetarget__keyitem--dot">One pitch</span>
        <span className="glovetarget__keyitem glovetarget__keyitem--median">His median miss</span>
        {leagueMiss != null && (
          <span className="glovetarget__keyitem glovetarget__keyitem--league">League</span>
        )}
      </p>

      {/* THE DIRECTION CLAUSE IS SILENT WHEN THERE IS NO DIRECTION, rather
          than printing "no consistent direction" every time. Measured over the
          whole 2026 dataset, only 3.6% of pitcher-and-pitch-type rows clear the
          two-inch floor — a clause that reads the same way on nineteen cards in
          twenty is a constant wearing a fact's clothes, which is the trap
          zoneGeometry.js's own `inHeart` note records paying for once already.
          A pitcher whose misses are centred simply has nothing said about it,
          and the picture already shows a cloud around the glove. */}
      <p className="hint glovetarget__note">
        {view.miss}&#8243; from the glove, against {leagueMiss != null ? `${leagueMiss}″ league-wide` : 'no league figure for this pitch'}
        {bias ? ` · misses ${bias.text}` : ''} · {view.n.toLocaleString()} pitches, shown as{' '}
        {view.dots.length} spread evenly across his season&#8217;s range · a miss past {RIM_IN}&#8243; is
        drawn on the rim
      </p>

      {/* The licence term, wherever the data is shown — see TargetCommand.jsx. */}
      <p className="pctstrip__source glovetarget__source">
        <a href={credit.href} rel="noreferrer noopener" target="_blank">
          {credit.text}
        </a>
      </p>
    </div>
  )
}
