// The Foul balls cards' shared number formats (#1891, #2016): percent, signed gap, the baseline row.
export const DASH = '—'
export const MINUS = '−'

export const pct = (x, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : DASH)
export const signed = (n, text) => (n === 0 ? text : `${n > 0 ? '+' : MINUS}${text}`)
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
export const place = (v, scale) => (Number.isFinite(v) ? Math.min(100, (v / scale) * 100) : 0)

// "+12.3 pts" for two fouls-per-swing fractions.
export const diffPts = (his, lg) => {
  if (his == null || lg == null) return DASH
  const d = Number(((his - lg) * 100).toFixed(1))
  return `${signed(d, Math.abs(d).toFixed(1))} pts`
}

export function baseline({ key, label, title, his, lg, hisText, lgText, sub, lgSub, gap, scale }) {
  const top = Math.max(scale, his ?? 0, lg ?? 0)
  return {
    key, label, title, sub, lgSub, gap,
    his: hisText,
    lg: lg == null ? DASH : lgText,
    gapNote: !gap || gap === DASH ? '' : /^[+−]/.test(gap) ? `${gap} for him` : 'level with the league',
    fill: place(his, top),
    tick: lg == null ? null : place(lg, top),
  }
}
