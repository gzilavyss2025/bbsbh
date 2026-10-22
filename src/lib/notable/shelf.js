import { isRealDate, slateToday } from '../dates.js'
import { gamePath } from '../route.js'
import { featLine } from '../../api/notable/notable.js'

// THE NOTABLE SHELF's rows (#2508): one kind's rows from public/data/notable/, shaped for
// the page. Pure; the page owns the fetch.
//
// SPOILER FOOTING. The shelf is an open page that shows final scores, behind a labelled
// door (ADR-0081). A row opens a box score, and a box score opens with no tap only for a
// game dated before the slate's today (ADR-0117). So a row dated today or later is left off:
// its score would be on the shelf while its box score is still sealed. A row with no real
// date is left off for the same reason; the date is the only evidence it is past.
//
// THIN DATA (.scratch/old-games/plan.md, section 3). A name the feed left out prints no
// name; a club with no abbreviation or no id still prints its row but cannot build a game
// address, so the row is not a link; a missing score prints a dash. An old doubleheader's
// game number only picks the address and the "Game 2" tag, and the index uses the API's own
// gamePk, so the row and the page agree.

const runs = (side) => (Number.isInteger(side?.runs) ? side.runs : null)

export function shelfRows(kind, doc, now = new Date()) {
  const today = slateToday(now)
  return (doc?.rows ?? [])
    .filter((row) => row && isRealDate(row.officialDate) && row.officialDate < today)
    .sort(
      (a, b) =>
        b.officialDate.localeCompare(a.officialDate) ||
        (b.gameNumber ?? 1) - (a.gameNumber ?? 1) ||
        (b.gamePk ?? 0) - (a.gamePk ?? 0),
    )
    .map((row) => {
      const { away, home } = row
      const number = row.gameNumber > 1 ? row.gameNumber : 1
      return {
        key: `${row.gamePk}-${kind}`,
        date: row.officialDate,
        gameNumber: number,
        away: { id: away?.id ?? null, abbr: away?.abbr ?? '', name: away?.name ?? '', runs: runs(away) },
        home: { id: home?.id ?? null, abbr: home?.abbr ?? '', name: home?.name ?? '', runs: runs(home) },
        feat: featLine(kind, row),
        href:
          away?.abbr && home?.abbr
            ? gamePath(row.officialDate, away.abbr, home.abbr, 'boxscore', number)
            : null,
      }
    })
}
