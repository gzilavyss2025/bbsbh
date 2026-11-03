import { useMemo } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchLevelSeasonDates } from '../../api/schedule.js'
import { findReplies } from '../../api/transactions/replies.js'

// A reply on the transactions list: the faded quote of the move a row answers,
// joined to it by a thin curved line (iMessage style), above the row's own
// kicker. The pairing rules are transactions/replies.js; this only draws them.
// The reply stays on its own day; tapping a quote scrolls to the original.
//
// Replies are found among the rows ON the page (MoveItems passes what it
// draws), so every quote's original is there to scroll to. A roster move and
// its date carry no score, so nothing here is sealed.

const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
const shortDate = (iso) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}

// The DOM id a row carries, so a quote can scroll to it.
export const moveAnchor = (storyId) => `move-${storyId}`

// The count rule (rule 4) holds to the regular season, so it needs the
// season's dates: one small, cached-by-the-browser league read. Until it
// answers, or if it fails, rules 1-3 still draw and rule 4 stays silent.
function useSeason(items) {
  const year = items.find((i) => i.kind === 'story')?.date?.slice(0, 4) ?? null
  const { data } = useAsync(
    () => (year ? fetchLevelSeasonDates(1, Number(year)) : Promise.resolve(null)),
    [year],
  )
  const mlb = data?.find((l) => l.regularSeasonStartDate) ?? null
  return mlb ? { start: mlb.regularSeasonStartDate, end: mlb.regularSeasonEndDate } : null
}

// items (flattenDays) -> { [storyId]: [{ id, date, story }] }
export function useReplies(items) {
  const season = useSeason(items)
  return useMemo(() => {
    const byId = new Map()
    const days = new Map()
    for (const item of items) {
      if (item.kind !== 'story') continue
      byId.set(item.story.id, item.story)
      if (!days.has(item.date)) days.set(item.date, { date: item.date, stories: [] })
      days.get(item.date).stories.push(item.story)
    }
    const replies = findReplies([...days.values()], { season })
    const out = {}
    for (const [id, quotes] of Object.entries(replies)) {
      out[id] = quotes.map((q) => ({ ...q, story: byId.get(q.id) })).filter((q) => q.story)
    }
    return out
  }, [items, season])
}

const flatText = (segments) => (segments ?? []).map((seg) => seg.text).join('')

function jumpTo(id) {
  const el = document.getElementById(moveAnchor(id))
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('wire__row--found')
  // Restart the brief highlight even on a second tap.
  void el.offsetWidth
  el.classList.add('wire__row--found')
}

// quotes: [{ id, date, story }]; date: the reply's own day, so a quote filed the
// same day leaves its date off.
export function ReplyQuotes({ quotes, date }) {
  if (!quotes?.length) return null
  return (
    <div className="wire__reply">
      {quotes.length > 1 && <span className="wire__replyto">Replying to {quotes.length} moves</span>}
      {quotes.map((q) => (
        <button key={q.id} type="button" className="wire__quote" onClick={() => jumpTo(q.id)}>
          {q.date !== date && <span className="wire__quotedate">{shortDate(q.date)} · </span>}
          {flatText(q.story.cutline)}
        </button>
      ))}
    </div>
  )
}
