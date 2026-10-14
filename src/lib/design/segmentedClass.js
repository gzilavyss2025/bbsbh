import { buttonAria, buttonClassName } from './buttonClass.js'

// THE SEGMENTED CONTROL (#2073) — a joined row of 44px toggles for a choice inside a
// card (the Game Log's All / Regular season / Postseason, the Similar card's Usage /
// Velocity). It is not a third control: every option is a .btn, with the class list
// and the aria-pressed that Button writes (buttonClass.js), and
// styles/system/segmented/segmented.css re-skins .btn inside the group. Pure, so
// node --test can render it: a .jsx file cannot be imported there.

export function segmentedClassName({ fill = false, className = '' } = {}) {
  const parts = ['segmented']
  if (fill) parts.push('segmented--fill')
  if (className) parts.push(className)
  return parts.join(' ')
}

// One entry per option. `pressed` compares with Object.is, so a value of 0 (an index)
// works. A count of 0 still shows; only null or undefined hides the count.
export function segmentedOptions(options = [], value) {
  return options.map((o) => ({
    key: String(o.value),
    value: o.value,
    label: o.label,
    count: o.count ?? null,
    disabled: Boolean(o.disabled),
    pressed: Object.is(o.value, value),
  }))
}

// The markup, built with `h` (React's createElement), so this file imports no React.
export function segmentedMarkup(h, { label, value, onChange, options, fill = false, className = '' }) {
  const btn = buttonClassName({ className: 'segmented__btn' })
  return h(
    'div',
    { role: 'group', 'aria-label': label, className: segmentedClassName({ fill, className }) },
    segmentedOptions(options, value).map((o) =>
      h(
        'button',
        {
          key: o.key,
          type: 'button',
          className: btn,
          disabled: o.disabled || undefined,
          onClick: () => onChange?.(o.value),
          ...buttonAria({ pressed: o.pressed }),
        },
        o.label,
        o.count != null ? h('span', { className: 'segmented__count' }, o.count) : null,
      ),
    ),
  )
}
