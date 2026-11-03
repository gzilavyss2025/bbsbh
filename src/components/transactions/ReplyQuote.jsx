import { useMemo } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchLevelSeasonDates } from '../../api/schedule.js'
import { apShortDate, extraManCandidates, fetchClubDay, findReplies, gameReply } from '../../api/transactions/replies.js'
import { useNav } from '../../lib/nav.js'

// A reply on the transactions list: the faded quote of the move a row answers,
// joined to it by a thin curved line (iMessage style), above the row's own
// kicker. The pairing rules are transactions/replies.js; this only draws them.
// The reply stays on its own day; tapping a quote scrolls to the original.
//
// Replies are found among the rows ON the page (MoveItems passes what it
// draws), so every quote's original is there to scroll to. A 27th man's quote
// is his GAME (teams and date, never a score), and it links to the lineup page.
// A roster move and its date carry no score, so nothing here is sealed.

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

// The 27th men among the call-ups on the page: each candidate (up, and back
// down by the next day) checked against his club's schedule that day, one
// small read per candidate. -> [{ id, team, date, playerId, game }]
function useExtraMen(days) {
  const candidates = useMemo(() => extraManCandidates(days), [days])
  const key = candidates.map((c) => c.id).join(',')
  const { data } = useAsync(
    () =>
      Promise.all(
        candidates.map((c) =>
          fetchClubDay(c.team, c.date)
            .then((games) => ({ ...c, game: gameReply(games, c.date) }))
            .catch(() => null),
        ),
      ),
    [key],
  )
  return useMemo(() => (data ?? []).filter((m) => m?.game), [data])
}

// items (flattenDays) -> { [storyId]: [{ id, date, story } | { game }] }.
// `teamId` is the club a club ledger's stories belong to (they carry none).
export function useReplies(items, teamId = null) {
  const season = useSeason(items)
  const days = useMemo(() => {
    const byDate = new Map()
    for (const item of items) {
      if (item.kind !== 'story') continue
      if (!byDate.has(item.date)) byDate.set(item.date, { date: item.date, stories: [] })
      const story = item.story.teamId == null && teamId ? { ...item.story, teamId } : item.story
      byDate.get(item.date).stories.push(story)
    }
    return [...byDate.values()]
  }, [items, teamId])
  const extraMen = useExtraMen(days)
  return useMemo(() => {
    const byId = new Map(days.flatMap((d) => d.stories.map((s) => [s.id, s])))
    const replies = findReplies(days, { season, extraMen })
    const out = {}
    for (const [id, quotes] of Object.entries(replies)) {
      out[id] = quotes.map((q) => ({ ...q, story: byId.get(q.id) })).filter((q) => q.story)
    }
    for (const m of extraMen) out[m.id] = [{ id: `game-${m.id}`, game: m.game }]
    return out
  }, [days, season, extraMen])
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
  const navigate = useNav()
  if (!quotes?.length) return null
  // A 27th man replies to his game: a link to its lineup page.
  const game = quotes[0].game
  if (game) {
    return (
      <div className="wire__reply">
        <button type="button" className="wire__quote" onClick={() => navigate(game.href)}>
          <span className="wire__quotetext">Replying to {game.label}</span>
        </button>
      </div>
    )
  }
  return (
    <div className="wire__reply">
      {quotes.length > 1 && <span className="wire__replyto">Replying to {quotes.length} moves</span>}
      {quotes.map((q) => (
        <button key={q.id} type="button" className="wire__quote" onClick={() => jumpTo(q.id)}>
          <span className="wire__quotetext">
            {q.date !== date && <span className="wire__quotedate">{apShortDate(q.date)} · </span>}
            {flatText(q.story.cutline)}
          </span>
        </button>
      ))}
    </div>
  )
}
