import { rankPos, rankThird } from './rankBar.js'
import '../../../styles/system/report/rankbar.css'

// THE RANK BAR (#1107, row 7b), modeled on the player page's Percentile rank card: a 2px ink box,
// best at the RIGHT edge, a hollow square at the middle club. Pure drawing: the number it stands
// for is printed beside it, so the bar is hidden from a screen reader.
//
//   RankBar    one rank: the box fills from the left to the tick, tinted by its third.
//   RankStrip  many ranks: one tick per split, the best third washed.
//
// `of` is the level's club count. The thirds come from it, not from a fixed 30.
const pct = (rank, of) => `${(rankPos(rank, of) * 100).toFixed(1)}%`

export function RankBar({ rank, of }) {
  return (
    <span className="rankbar" aria-hidden="true">
      <span className={`rankbar__fill rankbar__fill--${rankThird(rank, of)}`} style={{ width: pct(rank, of) }} />
      <span className="rankbar__mid" />
      <span className="rankbar__tick" style={{ left: pct(rank, of) }} />
    </span>
  )
}

export function RankStrip({ ranks, of }) {
  return (
    <span className="rankbar rankbar--strip" aria-hidden="true">
      <span className="rankbar__mid" />
      {ranks.map((r, i) => (
        <span key={i} className="rankbar__tick" style={{ left: pct(r, of) }} />
      ))}
    </span>
  )
}
