// The geometry behind e2e/tab-clearance.spec.js, kept pure so test/tab-clearance.test.js can pin it.
//
// A named stamped card hangs its name tab above its top edge (card--named clears it with a
// margin), and every stamped card throws a hard shadow below its bottom edge. The tab must not sit
// on the card above: a card that ran past its cell, a gap that shrank, a margin lost to a
// parent rule all leave the tab touching it (#2587: Platoon, Roster, Tale of the tape).
//
// A box is { id, x, right, top, bottom, shadow, tabTop, inside }:
//   x, right, top, bottom  the card's border box, page coordinates
//   shadow                 px the card's shadow reaches below `bottom` (0 for a flat box)
//   tabTop                 the top of its name tab, or null for a card with none
//   inside                 ids of the boxes that contain this one in the DOM
// A card nested in another may stand under that card's own tab: containment comes from the DOM
// (`inside`), never from the numbers, because the numbers cannot tell a parent from an overlap.

export const MIN_CLEARANCE = 8
// Two boxes in different columns share no vertical neighbour, so they must overlap sideways by
// more than a border to count as stacked.
const MIN_OVERLAP = 40

// -> [{ id, above, gap }] for each named card whose tab is closer than `min` to the nearest box above it.
export function tabCollisions(boxes, { min = MIN_CLEARANCE } = {}) {
  const found = []
  for (const card of boxes) {
    if (card.tabTop == null) continue
    let nearest = null
    for (const other of boxes) {
      if (other.id === card.id || card.inside.includes(other.id) || other.inside.includes(card.id)) continue
      if (Math.min(other.right, card.right) - Math.max(other.x, card.x) < MIN_OVERLAP) continue
      // A box whose own top is below this tab is under the card, not above it.
      if (other.top >= card.tabTop) continue
      const gap = card.tabTop - (other.bottom + other.shadow)
      if (!nearest || gap < nearest.gap) nearest = { id: card.id, above: other.id, gap: Math.round(gap) }
    }
    if (nearest && nearest.gap < min) found.push(nearest)
  }
  return found
}

// Run in the page. Every stamped card and every slate card is a box; a card's tab is its
// `.card__name` child. `inside` lists the boxes that contain it, from the DOM.
export function collectBoxes() {
  const els = [...document.querySelectorAll('.card--stamped, .gamecard')]
  // A name a person can find: the block's own class (ww-platoon), else the tab's words.
  const nameOf = (el) =>
    el.className.toString().split(/\s+/).find((c) => c && !/^card(--|$)/.test(c)) ||
    el.querySelector(':scope > .card__name')?.textContent.trim() ||
    'card'
  const idOf = new Map(els.map((el, i) => [el, `${i}:${nameOf(el)}`]))
  // The stamped shadow is --stamped-offset, read once from a stamped card.
  const probe = els.find((el) => el.matches('.card--stamped'))
  const shadow = probe ? parseFloat(getComputedStyle(probe).boxShadow.split(' ').find((v) => v.endsWith('px')) ?? '0') : 0
  return els
    .filter((el) => el.getBoundingClientRect().height > 0)
    .map((el) => {
      const r = el.getBoundingClientRect()
      const tab = el.querySelector(':scope > .card__name')
      return {
        id: idOf.get(el),
        x: r.x + scrollX,
        right: r.right + scrollX,
        top: r.top + scrollY,
        bottom: r.bottom + scrollY,
        shadow: el.matches('.card--stamped') ? shadow : 0,
        tabTop: tab ? tab.getBoundingClientRect().top + scrollY : null,
        inside: els.filter((o) => o !== el && o.contains(el)).map((o) => idOf.get(o)),
      }
    })
}
