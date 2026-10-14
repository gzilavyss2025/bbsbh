import { buttonAria, buttonClassName } from '../../../lib/design/buttonClass.js'

// THE MENU RAIL'S PURE CORE AND MARKUP (#2073, slice 05). MenuRail.jsx holds the state and
// calls menuRailMarkup(createElement, …); node --test renders the same builder with
// react-dom/server (a .jsx file cannot be imported there).
//
// The view is { picked, shownKey, gen }:
//   picked    what the caller says is picked now (a key or null)
//   shownKey  what the panel shows. It is the pick, or the LAST pick while the panel
//             folds shut, so the content does not vanish before the fold ends
//   gen       counts the picks. A new pick adds one, so the panel body swaps between
//             its a and b class and the rise restarts without a remount (canvas fgen)

export const BODY_A = 'menurail__body--a'
export const BODY_B = 'menurail__body--b'

export const firstView = (picked = null) => ({ picked, shownKey: picked, gen: 0 })

// One render's step. The same pick returns the SAME object, so the caller can test
// `next !== view` before it sets state during render.
export function nextView(view, picked = null) {
  if (picked === view.picked) return view
  if (picked == null) return { ...view, picked: null }
  return { picked, shownKey: picked, gen: view.gen + 1 }
}

export const bodyClass = (gen) => `menurail__body ${gen % 2 ? BODY_B : BODY_A}`

// A tap on the picked card closes the panel; a tap on any other card picks it.
export const pickFor = (key, picked) => (picked === key ? null : key)

export function rootProps({ picked = null, railMeta = false, className = '' } = {}) {
  const open = picked != null
  return {
    className: ['menurail', open && 'menurail--rail', railMeta && 'menurail--railmeta', className]
      .filter(Boolean)
      .join(' '),
    'data-state': open ? 'rail' : 'menu',
  }
}

// The card's props. `pressed` is always a boolean, so every card is a toggle
// (aria-pressed "true" or "false"), never an ordinary action.
export function cardProps(item, picked = null) {
  return {
    className: ['menurail__card', item.className].filter(Boolean).join(' '),
    pressed: picked != null && picked === item.key,
    disabled: item.disabled ? true : undefined,
    'aria-label': item.label,
    style: item.style,
  }
}

// A closed panel is inert: nothing in it takes focus or a tap while it is folded.
export const panelProps = (open) => ({
  className: open ? 'menurail__panel menurail__panel--open' : 'menurail__panel',
  inert: !open,
})

// The whole part. `view` is the step nextView returned for this render.
export function menuRailMarkup(h, { label, items, picked = null, onPick, panel, backLabel, railMeta = false, className = '', view }) {
  const open = picked != null
  const card = (item) => {
    const { pressed, className: cls, ...rest } = cardProps(item, picked)
    return h(
      'button',
      {
        key: item.key,
        type: 'button',
        className: buttonClassName({ className: cls }),
        ...buttonAria({ pressed }),
        ...rest,
        onClick: () => onPick(pickFor(item.key, picked)),
      },
      h(
        'span',
        { className: 'menurail__top' },
        item.mark != null && h('span', { className: 'menurail__mark', 'aria-hidden': 'true' }, item.mark),
        h('span', { className: 'menurail__title' }, item.title),
        item.meta != null && h('span', { className: 'menurail__meta' }, item.meta),
      ),
      item.figures != null &&
        h(
          'span',
          { className: 'menurail__fold' },
          h('span', { className: 'menurail__figs' }, h('span', { className: 'menurail__figsin' }, item.figures)),
        ),
    )
  }
  const cells = items.flatMap((item) => [
    item.heading ? h('span', { key: `${item.key}:head`, className: 'menurail__head' }, item.heading) : null,
    card(item),
  ])
  const back =
    backLabel &&
    h(
      'button',
      { type: 'button', className: buttonClassName({ skin: 'ghost', className: 'menurail__back' }), onClick: () => onPick(null) },
      h('span', { className: 'btn__icon', 'aria-hidden': 'true' }, '←'),
      backLabel,
    )
  const body = panel && view.shownKey != null && h('div', { className: bodyClass(view.gen) }, panel(view.shownKey))
  return h(
    'div',
    rootProps({ picked, railMeta, className }),
    h('div', { className: 'menurail__menu', role: 'group', 'aria-label': label }, ...cells),
    panel &&
      h(
        'div',
        panelProps(open),
        h('div', { className: 'menurail__panelin' }, h('div', { className: 'menurail__inner' }, back, body)),
      ),
  )
}
