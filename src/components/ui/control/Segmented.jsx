import { createElement } from 'react'
import { segmentedMarkup } from '../../../lib/design/segmentedClass.js'

// THE SEGMENTED CONTROL (#2073): a joined row of 44px .btn toggles for a choice
// inside a card. One option is always on; a tap on another moves the fill.
//
//   label     the group's aria-label ("Show games").
//   value     the selected option's value.
//   onChange  called with the tapped option's value.
//   options   [{ value, label, count?, disabled? }]. `count` is a figure in mono
//             after the label ("All 22").
//   fill      the buttons share the row's width (flex: 1).
//   className the caller's namespace on the group, for its place on the card.
//
// It is a group of Buttons, not a third control (src/CLAUDE.md, "One control, one
// door"): each option wears .btn, and styles/system/segmented/segmented.css only
// re-skins it. The markup is in lib/design/segmentedClass.js so node can test it.
export function Segmented(props) {
  return segmentedMarkup(createElement, props)
}
