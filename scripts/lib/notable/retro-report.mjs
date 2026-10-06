// The pure half of `gen-notable.mjs --check-retrosheet`, part 2: the report a person reads.
// A matched game is a count and no line. Every other game is a line with what a person
// needs to check it by hand: the Retrosheet gid, the date, the clubs as Retrosheet codes
// them, the score and the gamePk when the API has one.
import { LABELS } from './retro-check.mjs'

export function countLabels(results) {
  const counts = Object.fromEntries(LABELS.map((label) => [label, 0]))
  for (const r of results) counts[r.label] += 1
  return counts
}

const gamePkText = (r) => (r.gamePks.length ? `gamePk ${r.gamePks.join(', ')}` : 'no gamePk')

function line(r) {
  const parts = [
    r.kind, r.gid, r.date, `game ${r.number}`, `${r.vis}@${r.home}`, `${r.vruns}-${r.hruns}`,
    r.gametype, `${r.side} side`, gamePkText(r),
  ]
  if (r.forfeit) parts.push(`forfeit ${r.forfeit}`)
  if (r.api?.length) parts.push(`API: ${r.api.join('; ')}`)
  return `  ${parts.join('  ')}`
}

const indexLine = (r) =>
  `  ${r.kind}  gamePk ${r.gamePk}  ${r.officialDate}  game ${r.gameNumber}  ${r.away}@${r.home}  ${r.awayRuns}-${r.homeRuns}  ${r.side} side`

// -> the report as lines of text. `report` is { results, indexOnly } from checkRetrosheet.
export function formatReport({ results, indexOnly }) {
  const counts = countLabels(results)
  const out = [`Retrosheet cross-check: ${results.length} games`]
  for (const label of LABELS) {
    out.push('', `${label}: ${counts[label]}`)
    if (label !== 'matched') out.push(...results.filter((r) => r.label === label).map(line))
  }
  out.push('', `index-only: ${indexOnly.length} (an index row Retrosheet does not hold; not an error)`)
  out.push(...indexOnly.map(indexLine))
  return out.join('\n')
}

// The JSON a --report file holds: the counts, every game with its label, and index-only.
export const reportJson = ({ results, indexOnly }) => ({ counts: countLabels(results), results, indexOnly })
