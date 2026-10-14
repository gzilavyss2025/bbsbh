import { createElement, useState } from 'react'
import { firstView, menuRailMarkup, nextView } from './menuRail.js'

// THE MENU RAIL (#2073, slice 05): one shared menu of cards that folds into a rail, with
// a focus panel under it for the picked card. Arsenal, Splits, Plate approach and Contact
// use it. Drawn once, in styles/system/menurail/menurail.css; it moves in
// styles/motion/menurail.css. No baseball knowledge (ui/CLAUDE.md).
//
//   label     the menu's aria-label.   items  [{ key, title, meta, figures, mark,
//             label, disabled, heading, style, className }]
//   picked    a key, or null for the full menu.   onPick(key | null)
//   panel     optional (key) => node: the focus panel. It stays mounted, so it can fold.
//   backLabel optional: a ghost button at the top of the panel that closes it.
//   railMeta  keep `meta` on the rail (Arsenal keeps the mph).
//   className the caller's namespace on the root; it may set --menurail-card and
//             --menurail-rail (the two flex bases).
//
// The markup is menuRail.js's builder, so node --test renders exactly what ships. Each
// card is a .btn (the markup Button.jsx writes), so the focus ring, the disabled state and
// the stamp-press are the button's own.
export function MenuRail(props) {
  const picked = props.picked ?? null
  // Adjust state during render (React's documented escape hatch, as useBecameTrue does):
  // the committed DOM carries the new body class from its first frame.
  const [view, setView] = useState(() => firstView(picked))
  const next = nextView(view, picked)
  if (next !== view) setView(next)
  return menuRailMarkup(createElement, { ...props, picked, view: next })
}
