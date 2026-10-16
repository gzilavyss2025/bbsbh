// WHAT THE HOVER CARD PRINTS FOR ONE MAN ON THE ABS CHALLENGES CARD — pure data
// in the shape components/player/PlayerHoverCard.jsx's HoverDetail draws (the
// card's own band, a table of the numbers that placed him on the plot, and one
// mark per review he made).
//
// The figures are the plot's own. The Called view's are his reviews, the
// pitches behind them (or the innings, until the file carries pitches received)
// and the rate; the Success view's are the reviews he called, the ones he won,
// and the share. A rate that is over the league's reads in clay, the same
// mark as the ring on his face.
import { resultsStrip } from '../../../../../api/around-the-game/absClubCard.js'

// `row` is one of the job's rows (absClubCard.js); `job` the whole job model.
export function challengeDetail(job, measure, row) {
  const success = measure === 'success'
  const lgSuccess = job.league.success
  const columns = success ? ['Called', 'Won', 'Success'] : ['Calls', job.exposureLabel, 'Rate']
  const cells = success
    ? [{ v: String(row.calls) }, { v: row.won == null ? '—' : String(row.won) }, { v: row.successText, over: row.pct != null && lgSuccess != null && row.pct > lgSuccess }]
    : [{ v: String(row.calls) }, { v: row.exposureText }, { v: row.rateText ?? '—', over: row.over }]
  const strip = row.results == null ? null : { label: 'Reviews', ...(resultsStrip(row.results) ?? {}) }
  return { columns, row: { label: 'Season', cells }, strip }
}
