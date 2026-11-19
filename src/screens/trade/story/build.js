import { teamClubName, teamFullName } from '../../../lib/teams.js'
import { num, word, variant } from '../../../api/transactions/voice.js'
import { money } from '../../../lib/trade/deal.js'
import { HONORS, honorWeight } from './honors.js'

// The trade simulator's "news story": the deal as a beat writer files it.
// Pure. In: the deal (both sides' players, picks, cash, the deal summary), the
// wire story's cutline (dealStory.js), each player's wire note and honors, and
// each club's season (standings row and postseason result). Out: a headline, a
// dek and paragraphs of segments { text, playerId?, teamId? }, the shape the
// wire's cutline uses, so names render as links. Every sentence returns null
// when its facts are missing and drops out: a story never prints a blank, a
// guess, "undefined" or a number it didn't read. Plan: docs/trade-story-plan.html.

const ORDINAL_WORDS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth']
const lastName = (name) => String(name ?? '').trim().split(/\s+/).slice(1).join(' ') || name
const listOf = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const club = (id) => teamClubName(id) ?? teamFullName(id)

// The headline player: the best honor, else the most WAR.
function starOf(players) {
  return [...players].sort((x, y) => honorWeight(y.honors) - honorWeight(x.honors) || (y.war ?? -9) - (x.war ?? -9))[0] ?? null
}

// "won the 2026 NL Cy Young Award, a Silver Slugger in 2025 and two Gold
// Gloves", then "made the All-MLB First Team in 2023": one verb per kind.
function honorClauses(honors) {
  const won = []
  const made = []
  for (const h of HONORS) {
    const mine = honors.filter((x) => x.key === h.key)
    if (!mine.length) continue
    if (h.major) {
      for (const x of mine) won.push(`the ${x.season} ${x.league ? `${x.league} ` : ''}${h.words}`)
    } else if (h.team) {
      made.push(`the ${h.words} ${mine.length === 1 ? `in ${mine[0].season}` : `${word(mine.length)} times`}`)
    } else {
      won.push(mine.length === 1 ? `a ${h.words} in ${mine[0].season}` : `${word(mine.length)} ${h.plural}`)
    }
  }
  return [won.length ? `won ${listOf(won)}` : null, made.length ? `made ${listOf(made)}` : null].filter(Boolean)
}

// His honors in one sentence. After his wire note he is "He"; alone, his last name.
function honorsSentence(p, afterNote) {
  const clauses = honorClauses(p.honors ?? [])
  const stars = p.allStars?.length ?? 0
  if (stars) clauses.push(stars === 1 ? `was an All-Star in ${p.allStars[0]}` : `is a ${word(stars)}-time All-Star`)
  if (!clauses.length) return null
  return `${afterNote ? 'He' : lastName(p.name)} ${listOf(clauses)}.`
}

function prospectSentence(p) {
  // The wire's note already names a ranked prospect's rank.
  if (/prospect/i.test(p.note ?? '')) return null
  if (p.topRank) return `He is MLB Pipeline's No. ${p.topRank} prospect.`
  if (p.orgRank) return `He ranks No. ${p.orgRank} among the ${club(p.fromId)} prospects.`
  return null
}

// One paragraph per player: the wire's own note, then his honors, then his rank.
function playerParagraph(p) {
  const text = [p.note, honorsSentence(p, !!p.note), prospectSentence(p)].filter(Boolean).join(' ')
  return text ? [{ text }] : null
}

// "The Brewers went 103-59 in 2026, first in the NL Central, and won the World Series."
function clubSentence(id, c) {
  if (!c?.w && !c?.l) return null
  const finish = c.rank && ORDINAL_WORDS[c.rank] && c.division ? `, ${ORDINAL_WORDS[c.rank]} in the ${c.division},` : ''
  const october = c.postseason === 'champion' ? ' and won the World Series'
    : c.postseason === 'out' ? ' and missed the postseason'
      : c.postseason ? ` and lost in the ${c.postseason}` : ''
  return `The ${club(id)} went ${c.w}-${c.l} in ${c.season}${finish}${october}.`.replace(',.', '.')
}

// What the deal does to one club's payroll and 40-man roster.
function meansSentence(id, payroll, fortyAfter, nextYear) {
  const parts = []
  if (Math.abs(payroll) >= 1e5) parts.push(`${payroll > 0 ? 'adds' : 'takes'} ${money(payroll)} ${payroll > 0 ? 'to' : 'off'} the ${club(id)}' ${nextYear} payroll`)
  if (fortyAfter > 40) parts.push(`leaves them ${num(fortyAfter - 40)} over the 40-man limit`)
  return parts.length ? `The deal ${listOf(parts)}.` : null
}

export function buildStory({ a, b, sendsA, sendsB, cutline, clubs = {}, deal = null, nextYear, date }) {
  const all = [...sendsA, ...sendsB]
  if (!all.length) return null
  const star = starOf(all)
  const starIsB = sendsB.some((p) => p.id === star.id)
  const n = all.length
  const headline = starIsB
    ? `${club(a)} acquire ${star.name} in ${word(n)}-player deal with ${club(b)}`
    : `${club(a)} trade ${star.name} to ${club(b)} in ${word(n)}-player deal`
  // The dek turns to the other side: what it lands, and that player's best honor.
  const other = starIsB ? sendsA : sendsB
  const otherClub = starIsB ? b : a
  const otherStar = starOf(other)
  const otherHonor = otherStar ? honorClauses((otherStar.honors ?? []).slice(0, 1)).find((c) => c.startsWith('won the')) : null
  const dek = otherStar
    ? `The ${club(otherClub)} land ${otherStar.name}${otherHonor ? `, who ${otherHonor},` : ''} in a deal that moves ${word(n)} players.`
    : null

  // The lede is the wire's own sentence with the club as its subject.
  const lede = cutline?.length
    ? [{ text: `The ${teamFullName(a)} ` }, ...cutline.map((s, i) => (i === 0 ? { ...s, text: s.text.replace(/^Acquired/, 'acquired').replace(/^Traded/, 'traded') } : s))]
    : null

  const players = [...sendsB, ...sendsA].map(playerParagraph)
  const season = [clubSentence(a, clubs[a]), clubSentence(b, clubs[b])].filter(Boolean)
  const means = deal ? [meansSentence(a, deal.payroll.a, deal.fortyAfter.a, nextYear), meansSentence(b, deal.payroll.b, deal.fortyAfter.b, nextYear)].filter(Boolean) : []

  // The kicker: a champion's title defense, else nothing.
  const champ = [a, b].find((id) => clubs[id]?.postseason === 'champion')
  const kickers = champ
    ? [
        `The ${club(champ)} begin their title defense with a different roster than the one that won it.`,
        `For the reigning champions, the work of defending a title has started.`,
      ]
    : []
  const kicker = kickers.length ? kickers[variant({ id: star.id }, date, kickers.length)] : null

  const paragraphs = [
    lede,
    ...players,
    season.length ? [{ text: season.join(' ') }] : null,
    means.length ? [{ text: means.join(' ') }] : null,
    kicker ? [{ text: kicker }] : null,
  ].filter(Boolean)
  // The star rides along for the story's photo (photo.js).
  return { headline, dek, paragraphs, star: { id: star.id, name: star.name, pos: star.pos ?? null } }
}
