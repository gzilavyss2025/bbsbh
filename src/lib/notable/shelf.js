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
//
// WHO. `row.side` is the club that did it (threw the no-hitter, hit for the cycle, turned
// the triple play), for all three kinds (scripts/lib/notable/kinds.mjs). `doerId` and `foeId`
// carry that, so the page can filter by a club on either end. `players` are the people the
// row is about, for headshots: the pitchers of a no-hitter, the cycle's hitter, none for a
// triple play (the index holds no names for one). A person with no id is left out.

const people = (kind, row) =>
  (kind === 'nohitters' ? (row.pitchers ?? []) : kind === 'cycles' ? [row.player] : [])
    .filter((p) => Number.isInteger(p?.id))
    .map((p) => ({ id: p.id, name: p.name ?? '' }))

const sideId = (row, side) => (side === 'home' || side === 'away' ? row[side]?.id ?? null : null)

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
        players: people(kind, row),
        doerId: sideId(row, row.side),
        foeId: sideId(row, row.side === 'home' ? 'away' : row.side === 'away' ? 'home' : null),
        href:
          away?.abbr && home?.abbr
            ? gamePath(row.officialDate, away.abbr, home.abbr, 'boxscore', number)
            : null,
      }
    })
}

// The rows a club was in. `role`: 'did' (the club did it), 'against' (it was done to the
// club), or 'either'. No club picked leaves the rows alone. A row whose side is unknown
// has no doer, so it matches only 'either' through its two clubs.
export function filterByClub(rows, clubId, role = 'either') {
  if (clubId == null) return rows
  return rows.filter((row) => {
    if (role === 'did') return row.doerId === clubId
    if (role === 'against') return row.foeId === clubId
    return row.away.id === clubId || row.home.id === clubId
  })
}
