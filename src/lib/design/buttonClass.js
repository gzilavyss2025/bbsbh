// THE BUTTON'S CLASS LIST (#1130) — the one place a size and a skin turn into
// class names, shared by components/ui/control/Button.jsx and its tests. Pure,
// so node --test can pin it: a .jsx file cannot be imported there.
//
// Two axes, and the defaults carry NO class. `tap` is the base .btn height and
// `outline` is the base .btn skin (styles/system/button.css), so a class that
// restated either would be a second copy of the default — a second place for
// it to drift. An unknown size or skin is a caller's typo, and it throws: a
// silent fallback would ship an outline button where someone asked for danger.

export const SIZES = ['tap', 'control']
export const SKINS = ['outline', 'ink', 'ghost', 'danger', 'seal']

export function buttonClassName({ size = 'tap', skin = 'outline', className = '' } = {}) {
  if (!SIZES.includes(size)) throw new Error(`Button: unknown size "${size}" (${SIZES.join(', ')})`)
  if (!SKINS.includes(skin)) throw new Error(`Button: unknown skin "${skin}" (${SKINS.join(', ')})`)
  const parts = ['btn']
  if (size !== 'tap') parts.push(`btn--${size}`)
  if (skin !== 'outline') parts.push(`btn--${skin}`)
  if (className) parts.push(className)
  return parts.join(' ')
}

// The ARIA the two stateful props write. `pressed` is tri-state on purpose:
// undefined means "this is not a toggle" and writes nothing, while false is a
// toggle that is off — a screen reader announces those differently, and the
// selected state in button.css keys on the attribute, not on a class.
export function buttonAria({ pressed, busy = false } = {}) {
  const aria = {}
  if (pressed !== undefined) aria['aria-pressed'] = pressed ? 'true' : 'false'
  if (busy) aria['aria-busy'] = 'true'
  return aria
}
