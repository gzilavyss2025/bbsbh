import { useAsync } from '../../../hooks/useAsync.js'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { fetchPlayerFacts, factRequest } from '../../../api/transactions/playerFacts.js'
import { factLines, subjectsOf } from '../../../api/transactions/templates.js'
import { loadStoryData } from '../../../api/trade/storyData.js'
import { isoToday } from '../../../lib/dates.js'
import { honorsOf, allStarSeasons } from './honors.js'
import { clubSeason } from './clubs.js'
import { buildStory } from './build.js'
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

async function loadStory({ a, b, sendsA, sendsB, story, deal, nextYear }, date) {
  const [data, notes] = await Promise.all([loadStoryData(), notesFor(story, date)])
  const dress = (p, fromId) => ({
    ...p,
    fromId,
    note: notes.get(p.id) || null,
    honors: honorsOf(p.id, data.awards),
    allStars: allStarSeasons(p.id, data.allStars),
  })
  const clubs = Object.fromEntries([a, b].map((id) => [id, clubSeason(id, data.season, data.standings, data.postseason)]))
  return buildStory({
    a, b, deal, nextYear, date, clubs,
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
export function TradeStory({ fallback, ...deal }) {
  const date = isoToday()
  // Everything the story says: the players, the wire's sentence (picks and cash
  // ride in it), and the deal's payroll and 40-man counts.
  const key = [
    deal.a, deal.b, ...deal.sendsA.map((p) => p.id), '|', ...deal.sendsB.map((p) => p.id),
    (deal.story?.cutline ?? []).map((s) => s.text).join(''),
    deal.deal?.payroll.a, deal.deal?.fortyAfter.a, deal.deal?.fortyAfter.b,
  ].join(',')
  const state = useAsync(() => loadStory(deal, date), [key, date])
  const s = state.data
  // The art: one game photo of the headline player, loaded after the words so it never holds them up.
  const star = s?.star
  const photo = useAsync(
    () => (star ? storyPhoto(star.id, ['P', 'TWP', 'SP', 'RP'].includes(star.pos) ? 'pitching' : 'hitting', storySeason()).catch(() => null) : Promise.resolve(null)),
    [star?.id],
  )
  if (!s) return <p className="tradedesk__wiretext">{fallback}</p>
  return (
    <article className="tradestory__body" aria-busy={state.loading}>
      <h3 className="tradestory__headline">{s.headline}</h3>
      {s.dek && <p className="tradestory__dek">{s.dek}</p>}
      {photo.data && (
        <figure className="tradestory__art">
          <a href={photo.data.href} target="_blank" rel="noreferrer">
            <img src={photo.data.thumb} alt={`${star.name}${photo.data.caption ? `: ${photo.data.caption}` : ''}`} loading="lazy" />
          </a>
          <figcaption className="tradestory__credit">{star.name}{photo.data.date ? ` · ${photo.data.date}` : ''}</figcaption>
        </figure>
      )}
      {s.paragraphs.map((p, i) => <p key={i} className="tradestory__graf"><Segments segs={p} /></p>)}
    </article>
  )
}
