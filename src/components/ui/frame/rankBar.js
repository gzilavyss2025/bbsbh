// The pure half of RankBar / RankStrip (components/ui/frame/RankBar.jsx): where a
// rank sits on the bar, and which third it is in. Best is at the RIGHT edge, as on the
// player page's Percentile card, so rank 1 of 30 is position 1 and 30 of 30 is 0.
// The thirds come from the level size, not from a fixed 30.

// 0..1 along the bar. A level of one club has only a best.
export const rankPos = (rank, of) => (of > 1 ? (of - rank) / (of - 1) : 1)

// 'top' for the best third, 'low' for the worst, 'mid' between.
export function rankThird(rank, of) {
  const third = Math.round(of / 3)
  if (rank <= third) return 'top'
  return rank > of - third ? 'low' : 'mid'
}
