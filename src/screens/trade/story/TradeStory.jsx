import { useState } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'
import { Button } from '../../../components/ui/control/Button.jsx'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { fetchPlayerFacts, factRequest } from '../../../api/transactions/playerFacts.js'
import { factLines, subjectsOf } from '../../../api/transactions/templates.js'
import { loadStoryData } from '../../../api/trade/storyData.js'
import { teamClubName } from '../../../lib/teams.js'
import { isoToday } from '../../../lib/dates.js'
import { honorsOf, allStarSeasons } from './honors.js'
import { clubSeason } from './clubs.js'
import { buildStory } from './build.js'
import { asDepth, lineupAfter } from '../../../lib/trade/lineup.js'
import { storyPhoto } from './photo.js'
import { storySeason } from '../../../api/trade/storyData.js'

// Each player's wire note, the same read the deal's wire row makes (so it is
// usually already in memory).
async function notesFor(story, date) {
  const subjects = subjectsOf(story)
  const lines = await Promise.all(subjects.map(({ playerId, template }) =>
    fetchPlayerFacts(...factRequest(story, date, { playerId, template }))
      .then((facts) => factLines(template, facts, { moveDate: date }).join(' '))
      .catch(() => ''),
  ))
  return new Map(subjects.map((s, i) => [s.playerId, lines[i]]))
}

async function loadStory({ a, b, sendsA, sendsB, story, deal, nextYear, depthA, depthB }, date) {
  const [data, notes] = await Promise.all([loadStoryData(), notesFor(story, date)])
  const dress = (p, fromId) => ({
    ...p,
    fromId,
    note: notes.get(p.id) || null,
    honors: honorsOf(p.id, data.awards),
    allStars: allStarSeasons(p.id, data.allStars),
  })
  const clubs = Object.fromEntries([a, b].map((id) => [id, clubSeason(id, data.season, data.standings, data.postseason)]))
  const lineups = {
    ...(depthA && { [a]: lineupAfter(depthA, { out: sendsA.map(asDepth), inn: sendsB.map(asDepth) }) }),
    ...(depthB && { [b]: lineupAfter(depthB, { out: sendsB.map(asDepth), inn: sendsA.map(asDepth) }) }),
  }
  return buildStory({
    a, b, deal, nextYear, date, clubs, lineups,
    sendsA: sendsA.map((p) => dress(p, a)),
    sendsB: sendsB.map((p) => dress(p, b)),
    cutline: story?.cutline ?? null,
  })
}

function Segments({ segs }) {
  return segs.map((s, i) => (s.playerId ? <PlayerLink key={i} id={s.playerId} name={s.text}>{s.text}</PlayerLink>
    : s.teamId ? <TeamLink key={i} id={s.teamId}>{s.text}</TeamLink>
      : <span key={i}>{s.text}</span>))
}

// The deal written up as a beat writer files it, in the deal card where the
// wire row was. Until the facts arrive it shows the plain wire sentence.
const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
// "Nov. 20, 2026" for the byline, AP style.
const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
// The photo's caption, filled in like a newspaper's: "Jackson Chourio of the
// Brewers against the Rays in the postseason on Oct. 28." Each blank drops out
// when the game does not say it.
function captionOf(star, clubId, photo) {
  const [m, d] = (photo.date ?? '').split('/').map(Number)
  const rest = [
    clubId && `of the ${teamClubName(clubId)}`,
    photo.opponentId && `against the ${teamClubName(photo.opponentId)}`,
    photo.postseason && 'in the postseason',
    MONTHS[m - 1] && d && `on ${MONTHS[m - 1]} ${d}`,
  ].filter(Boolean).join(' ')
  // The subject's name leads in bold, as a newspaper caption sets it.
  return <><b>{star.name}</b>{rest ? ` ${rest}` : ''}.</>
}

export function TradeStory({ fallback, ...deal }) {
  const date = isoToday()
  // Everything the story says: the players, the wire's sentence (picks and cash
  // ride in it), and the deal's payroll and 40-man counts.
  const key = [
    // Ids sorted: taking a player out and putting him back is the same deal.
    Boolean(deal.depthA), Boolean(deal.depthB), deal.a, deal.b, ...deal.sendsA.map((p) => p.id).sort(), '|', ...deal.sendsB.map((p) => p.id).sort(),
    // The sentence's pieces, in any order (it names players in the order they were added).
    (deal.story?.cutline ?? []).map((s) => s.text).sort().join('|'),
    deal.deal?.payroll.a, deal.deal?.fortyAfter.a, deal.deal?.fortyAfter.b,
  ].join(',')
  // Written on request, not on every change: the reader builds a deal a player
  // at a time, and each story is a dozen reads. `written` is the deal the story
  // on screen was written for; a deal that has moved on since shows the
  // rewrite bar above the headline instead of rewriting itself.
  const [written, setWritten] = useState(null)
  const state = useAsync(() => (written ? loadStory(deal, date) : Promise.resolve(null)), [written, date])
  const s = state.data
  const stale = written != null && written !== key
  // The art: one game photo of the headline player, loaded after the words so it never holds them up.
  const star = s?.star
  const photo = useAsync(
    () => (star ? storyPhoto(star.id, ['P', 'TWP', 'SP', 'RP'].includes(star.pos) ? 'pitching' : 'hitting', storySeason()).catch(() => null) : Promise.resolve(null)),
    [star?.id],
  )
  // Not asked for yet, or a write that failed: the sentence and the button (again).
  if (written == null || (!s && !state.loading)) {
    return (
      <div className="tradestory__ask">
        <p className="tradedesk__wiretext">{fallback}</p>
        <Button size="control" skin="ink" onClick={() => setWritten(key)}>Write the story</Button>
      </div>
    )
  }
  if (!s) return <p className="tradedesk__wiretext" aria-busy="true">{fallback}</p>
  return (
    <article className="tradestory__body" aria-busy={state.loading}>
      {stale && (
        <div className="tradestory__stale" role="status">
          <span className="tradestory__stalemark" aria-hidden="true">↻</span>
          <span>The deal changed since this story was written</span>
          <Button size="control" skin="ink" onClick={() => setWritten(key)}>Rewrite</Button>
        </div>
      )}
      <h2 className="tradestory__headline">{s.headline}</h2>
      {s.dek && <p className="tradestory__dek">{s.dek}</p>}
      <p className="tradestory__byline">Tally Wire <time dateTime={date}>{longDate(date)}</time></p>
      {photo.data && (
        <figure className="tradestory__art">
          <a href={photo.data.href} target="_blank" rel="noreferrer">
            <img src={photo.data.thumb} alt={`${star.name}${photo.data.caption ? `: ${photo.data.caption}` : ''}`} loading="lazy" />
          </a>
          <figcaption className="tradestory__credit">{captionOf(star, deal.sendsA.some((p) => p.id === star.id) ? deal.a : deal.b, photo.data)}</figcaption>
        </figure>
      )}
      {s.paragraphs.map((p, i) => (
        <p key={i} className="tradestory__graf">
          {i === 0 && s.dateline && <span className="tradestory__dateline">{s.dateline} — </span>}
          <Segments segs={p} />
        </p>
      ))}
    </article>
  )
}
