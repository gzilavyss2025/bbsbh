import { useMemo, useRef, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchLevelSeasonDates } from '../../api/schedule/fetch.js'
import { extraManCandidates, fetchClubDay, findReplies, gameReply } from '../../api/transactions/replies.js'
import { apDate } from '../../lib/time/apDate.js'
import { useNav } from '../../lib/nav.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

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

// The count rule (rule 4) holds to the regular season, so it needs each
// season's dates: one small league read per year on the page (a club ledger
// opens on next year's file and scrolls back into this one). Until they
// answer, or if one fails, rules 1-3 still draw and rule 4 stays silent there.
// -> [{ start, end }] for every year that answered.
function useSeasons(items) {
  const years = [...new Set(items.filter((i) => i.kind === 'story').map((i) => i.date.slice(0, 4)))].sort().join(',')
  const { data } = useAsync(
    () =>
      Promise.all(
        (years ? years.split(',') : []).map((y) =>
          fetchLevelSeasonDates(1, Number(y)).then((rows) => rows?.find((l) => l.regularSeasonStartDate) ?? null),
        ),
      ),
    [years],
  )
  return useMemo(
    () => (data ?? []).filter(Boolean).map((l) => ({ start: l.regularSeasonStartDate, end: l.regularSeasonEndDate })),
    [data],
  )
}

// The 27th men among the call-ups on the page: each candidate (up, and back
// down by the next day) checked against his club's schedule that day, one
// small read per candidate. -> [{ id, backId, team, date, playerId, game }],
// or null until every read has answered (the count waits for it).
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
  return useMemo(() => (data ? data.filter((m) => m?.game) : null), [data])
}

// items (flattenDays) -> { [storyId]: [{ id, date, story } | { id, game }] }.
export function useReplies(items) {
  const seasons = useSeasons(items)
  const days = useMemo(() => {
    const byDate = new Map()
    for (const item of items) {
      if (item.kind !== 'story') continue
      if (!byDate.has(item.date)) byDate.set(item.date, { date: item.date, stories: [] })
      byDate.get(item.date).stories.push(item.story)
    }
    return [...byDate.values()]
  }, [items])
  const extraMen = useExtraMen(days)
  return useMemo(() => {
    const byId = new Map(days.flatMap((d) => d.stories.map((s) => [s.id, s])))
    const out = {}
    for (const [id, quotes] of Object.entries(findReplies(days, { season: seasons, extraMen }))) {
      out[id] = quotes.map((q) => (q.game ? q : { ...q, story: byId.get(q.id) })).filter((q) => q.game || q.story)
    }
    return out
  }, [days, seasons, extraMen])
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

// The quote names no verb. It is a carbon copy of the earlier move: its date in
// a small stamped box with a hook toward it (the ledger runs newest first, so
// the original sits further down the page), then the sentence, muted. Several
// stamps stacked are several moves; a stamp that reads GAME is the 27th man's
// game. The words live in the accessible name only.
const stamp = (when) => (
  <span className="wire__stamp" aria-hidden="true">
    <span className="wire__hook">↪</span>
    {when}
  </span>
)

// One quoted move. A sentence cut at two lines opens in full on the first tap,
// and the second goes to the move; one that fits goes there at once.
function MoveQuote({ id, when, text, label }) {
  const [open, setOpen] = useState(false)
  const textRef = useRef(null)
  const onClick = () => {
    const el = textRef.current
    if (!open && el && el.scrollHeight > el.clientHeight + 1) setOpen(true)
    else jumpTo(id)
  }
  return (
    <button type="button" className="wire__quote" aria-label={label} onClick={onClick}>
      {stamp(when)}
      <span ref={textRef} className={`wire__quotetext${open ? ' wire__quotetext--open' : ''}`}>
        {text}
      </span>
    </button>
  )
}

// A 27th man's quote: his game, as two club marks, linked to its lineup page.
function GameQuote({ game }) {
  const navigate = useNav()
  return (
    <button type="button" className="wire__quote" aria-label={`Called up for the game: ${game.label}`} onClick={() => navigate(game.href)}>
      {stamp('Game')}
      <span className="wire__quotetext">
        <span className="wire__matchup">
          <TeamLogo teamId={game.awayId} size={16} />
          @
          <TeamLogo teamId={game.homeId} size={16} />
        </span>{' '}
        · {game.detail}
      </span>
    </button>
  )
}

// quotes: [{ id, date, story } | { id, game }]; date: the reply's own day,
// which a same-day quote stamps as "Same day" instead of a date.
export function ReplyQuotes({ quotes, date }) {
  if (!quotes?.length) return null
  return (
    <div className="wire__reply">
      {quotes.map((q) => {
        if (q.game) return <GameQuote key={q.id} game={q.game} />
        // The stamp writes the date as a scorer would, 8/15.
        const when = q.date === date ? 'Same day' : `${Number(q.date.slice(5, 7))}/${Number(q.date.slice(8, 10))}`
        const text = flatText(q.story.cutline)
        return (
          <MoveQuote
            key={q.id}
            id={q.id}
            when={when}
            text={text}
            label={`Answers the move of ${q.date === date ? 'the same day' : apDate(q.date)}: ${text}`}
          />
        )
      })}
    </div>
  )
}
