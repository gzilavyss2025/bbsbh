import { useLayoutEffect, useRef } from 'react'
import { useNav, useLinkScope } from '../lib/nav.js'
import { playerPath } from '../lib/route.js'

// Running pitching lines for every pitcher who has appeared in a revealed
// half-inning — a separate block per team, each led by the team name with its
// own header row. Lines are cumulative through the reveal mark (see
// api/pitchers.js); nothing sealed is shown. Deliberately not behind a SealBox —
// it mirrors the running line's reveal state. Sized to fit a phone with no
// horizontal scroll: the caps-locked name auto-shrinks to one line (PitcherName)
// while the numeric columns hold their size, and the jersey number is inked in
// clay red and right-aligned within its own slot in the Pitcher cell.
//
// A pure numeric stat grid — the season-context/health prose that used to
// stack under each row moved to the ranked "Margin Notes" digest
// (MarginNotes.jsx, api/pitcher-callouts.js's buildMarginNotes), which spans
// both teams' pitchers and is capped/sorted by worthiness rather than listed
// per row regardless of how many qualify.
export function PitchersSection({ teams }) {
  const shown = teams.filter((t) => t.rows.length > 0)
  if (shown.length === 0) return null
  return (
    <section className="pitchers">
      <h3 className="pitchers__title">Pitchers</h3>
      {shown.map((t) => (
        <div className="pitchers__team" key={t.name}>
          <h4 className="pitchers__teamname">{t.name}</h4>
          <table className="pitchers__grid">
            <thead>
              <tr>
                <th className="pitchers__pitcher">Pitcher</th>
                <th>R/L</th>
                <th>IP</th>
                <th>P</th>
                <th>BF</th>
                <th>H</th>
                <th>R</th>
                <th>ER</th>
                <th>BB</th>
                <th>K</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((p) => (
                <tr key={p.id}>
                  <td className="pitchers__pitcher">
                    <div className="pitchers__cell">
                      <PitcherName id={p.id} last={p.last} first={p.first} />
                      {p.jersey ? (
                        <span className="pitchers__num">{p.jersey}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{p.hand || '—'}</td>
                  <td>{p.ip}</td>
                  <td>{p.pitches}</td>
                  <td>{p.bf}</td>
                  <td>{p.h}</td>
                  <td>{p.r}</td>
                  <td>{p.er}</td>
                  <td>{p.bb}</td>
                  <td>{p.k}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}

// A pitcher's name, always drawn in caps (see .pitchers__pname), auto-shrunk to
// fit its column on one line so a long name never widens the table into a
// horizontal scroll. Only the NAME shrinks — the numeric columns keep their
// size. The name span is `flex: 1` so its box always fills the space the layout
// gives it (stable clientWidth); we step the font down from the CSS max until
// the rendered text (scrollWidth) fits, or we hit the floor. A ResizeObserver
// re-fits when the column width changes (extra innings unlocking, rotation).
const NAME_MAX_PX = 12
const NAME_MIN_PX = 11
function PitcherName({ id, last, first }) {
  const ref = useRef(null)
  const navigate = useNav()
  const { asOf, sportId } = useLinkScope()
  const text = `${last}${first ? `, ${first}` : ''}`

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      let size = NAME_MAX_PX
      el.style.fontSize = `${size}px`
      while (size > NAME_MIN_PX && el.scrollWidth > el.clientWidth) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])

  // The clickable element IS the ref'd, auto-shrunk element (a plain span when
  // there's no id) so the fit logic measures the same box either way and the
  // table layout is unchanged.
  if (!id) {
    return (
      <span className="pitchers__pname" ref={ref}>
        {text}
      </span>
    )
  }
  return (
    <button
      type="button"
      ref={ref}
      className="plink pitchers__pname"
      onClick={() => navigate(playerPath(id, { d: asOf, s: sportId }))}
    >
      {text}
    </button>
  )
}
