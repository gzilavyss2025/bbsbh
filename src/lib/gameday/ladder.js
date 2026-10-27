// Gameday's size ladder (#2568, part of #2566): a window size picks a tier, a
// tier picks the blocks it shows; the rest go to the menu. Pure: no React, no
// DOM, no CSS. Tiers are P phone, T tablet portrait, L iPad landscape, D desktop.
// Widths 740, 1000 and 1200 are on the width guard's list; heights have no guard.

export function tierOf(width, height) {
  if (width >= 1200 && height >= 780) return 'D'
  if (width >= 1000 && height >= 700 && width > height) return 'L'
  if (width >= 740 && height >= 900) return 'T'
  return 'P'
}

// [block, tiers that show it]. The first four never fold.
const BLOCKS = [
  ['band', 'PTLD'], ['stage', 'PTLD'], ['hero', 'PTLD'], ['bar', 'PTLD'],
  ['navigator', 'TLD'], ['trail', 'TLD'],
  ['battingOrder', 'LD'], ['reference', 'LD'], ['eventLog', 'D'],
]

export const blocksFor = (tier) => BLOCKS.filter(([, on]) => on.includes(tier)).map(([b]) => b)

// The blocks a tier folds into the menu, in table order.
export const foldedFor = (tier) => BLOCKS.filter(([, on]) => !on.includes(tier)).map(([b]) => b)

// The Menu's list. L and D give the event log's slot to the defense drawer, so it reads here (L
// already folds it).
export const menuFor = (tier) => (tier === 'D' ? [...foldedFor(tier), 'eventLog'] : foldedFor(tier))
