const DASH = '—'

// ".262" style rate: three decimals, no leading zero (baseball convention),
// same idiom as person.js's rate3.
function rate3(x) {
  if (!Number.isFinite(x)) return DASH
  return x.toFixed(3).replace(/^0(?=\.)/, '')
}

// The player page's "Batted ball" body: the hitter analog of PitchMix — a
// one-glance mix bar (each contact type a segment, colored by the
// --batted-* inks that sit alongside --arsenal-* in tokens/colors.css) over
// a per-type list of share and average vs. that contact type. `battedBall` is
// another agent's battedBallView output: { rows: [{key, name, share, avg}],
// ballsInPlay }, key one of 'ground'|'line'|'fly'|'pop'. Reuses PitchMix's
// .pitchmix classes verbatim — zero new component CSS, only new color
// modifiers — so the two cards read as one system on the page.
//
// Unlike PitchMix (sorted most-thrown pitch first), rows stay in the FIXED
// canonical order the view hands over (ground -> line -> fly -> pop) rather
// than being re-sorted by share here: two hitters' profiles then line up
// row-for-row when compared, instead of each reshuffling to its own ranking.
export function BattedBallMix({ battedBall }) {
  if (!battedBall?.rows?.length) return null
  const { rows } = battedBall
  const withShare = rows.filter((r) => r.share != null && r.share > 0)
  return (
    <div className="pitchmix">
      {withShare.length > 1 && (
        <div className="pitchmix__bar" aria-hidden="true">
          {withShare.map((r) => (
            <span
              key={r.key}
              className={`pitchmix__seg pitchmix__seg--${r.key}`}
              style={{ flexGrow: r.share }}
            />
          ))}
        </div>
      )}
      <ul className="pitchmix__list">
        {rows.map((r) => (
          <li className="pitchmix__row" key={r.key}>
            <span
              className={`pitchmix__chip pitchmix__chip--${r.key}`}
              aria-hidden="true"
            />
            <span className="pitchmix__name">{r.name}</span>
            <span className="pitchmix__usage">
              {r.share != null ? `${Math.round(r.share * 100)}%` : DASH}
            </span>
            <span className="pitchmix__velo">{rate3(r.avg)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
