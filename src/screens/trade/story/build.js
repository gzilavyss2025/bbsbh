import { teamClubName, teamFullName, teamLocationName } from '../../../lib/teams.js'
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

// A club's season as a clause the lede and the turn can carry: "Coming off
// an 86-76 season that ended short of the postseason, " / "fresh off a World
// Series title". Null without a record.
function seasonLead(c) {
  if (!c?.w && !c?.l) return null
  if (c.postseason === 'champion') return `Fresh off a World Series title, `
  const rec = `${c.w}-${c.l}`
  if (c.postseason === 'out') return `Coming off ${/^8|^11|^18/.test(rec) ? 'an' : 'a'} ${rec} season that ended short of the postseason, `
  if (c.postseason) return `A season after losing in the ${c.postseason}, `
  return `Coming off ${/^8|^11|^18/.test(rec) ? 'an' : 'a'} ${rec} season, `
}
function seasonAside(c) {
  if (!c?.w && !c?.l) return ''
  if (c.postseason === 'champion') return `, ${c.w}-${c.l} and the reigning World Series champions,`
  if (c.postseason === 'out') return `, ${c.w}-${c.l} and out of the postseason,`
  return `, ${c.w}-${c.l} last season,`
}

// The honor the lede hangs on the star: his best major award, newest first.
function starTag(p) {
  const best = (p.honors ?? []).find((h) => HONORS.find((x) => x.key === h.key)?.major)
  if (!best) return null
  const h = HONORS.find((x) => x.key === best.key)
  return `the ${best.season} ${best.league ? `${best.league} ` : ''}${h.words.replace(/ Award$/, '')} winner`
}

// One player's paragraph: the wire's note, his honors, his rank.
const playerText = (p) => [p.note, honorsSentence(p, !!p.note), prospectSentence(p)].filter(Boolean).join(' ')

// The rest of a side, grouped: "The Diamondbacks also get X, Y and Z." then each one's line.
function groupParagraph(lead, players) {
  if (!players.length) return null
  const lines = players.map(playerText).filter(Boolean).join(' ')
  return [{ text: `${lead} ` }, ...players.flatMap((p, i) => [
    ...(i ? [{ text: i === players.length - 1 ? ' and ' : ', ' }] : []),
    { text: p.name, playerId: p.id },
  ]), { text: `.${lines ? ` ${lines}` : ''}` }]
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

  // Who gets the star (the lede's subject) and who gives him up (the turn's).
  const taker = starIsB ? a : b
  const giver = starIsB ? b : a
  const takerGets = starIsB ? sendsB : sendsA
  const giverGets = starIsB ? sendsA : sendsB

  // Lede: the news and the motive in one sentence.
  const tag = starTag(star)
  const leadIn = seasonLead(clubs[taker])
  const lede = [
    { text: `${leadIn ?? ''}${leadIn ? 'the' : 'The'} ` },
    { text: teamFullName(taker), teamId: taker },
    { text: ` ${variant({ id: star.id }, date, 2) ? 'acquired' : 'landed'} ` },
    { text: star.name, playerId: star.id },
    { text: `${tag ? `, ${tag},` : ''} from the ` },
    { text: teamFullName(giver), teamId: giver },
    { text: ` in ${/^(eight|eleven|eighteen)/.test(word(n)) ? 'an' : 'a'} ${word(n)}-player deal.` },
  ]

  const starPara = playerText(star) ? [{ text: playerText(star) }] : null
  const takerRest = groupParagraph(`The ${club(taker)} also get`, takerGets.filter((p) => p.id !== star.id))

  // The turn: what the other club gets back, led by its best player.
  const back = starOf(giverGets)
  const turn = back
    ? [
        { text: `In return, the ${club(giver)}${seasonAside(clubs[giver])} get ${word(giverGets.length)} ${giverGets.length === 1 ? 'player' : 'players'}${giverGets.length > 1 ? ', led by ' : ': '}` },
        { text: back.name, playerId: back.id },
        { text: `.${playerText(back) ? ` ${playerText(back)}` : ''}` },
      ]
    : null
  const giverRest = back ? groupParagraph(`They also get`, giverGets.filter((p) => p.id !== back.id)) : null

  // The money and the roster, in one sentence.
  let money_ = null
  if (deal) {
    const gainer = deal.payroll.a > 0 ? a : b
    const moved = Math.abs(deal.payroll.a)
    const over = [a, b].map((id) => [id, (id === a ? deal.fortyAfter.a : deal.fortyAfter.b) - 40]).find(([, k]) => k > 0)
    const parts = []
    if (moved >= 1e5) parts.push(`The deal moves ${money(moved)} of ${nextYear} payroll to ${teamLocationName(gainer) ?? club(gainer)}`)
    if (over) parts.push(`${parts.length ? ', and the' : 'The'} ${club(over[0])} will have to clear ${num(over[1])} 40-man ${over[1] === 1 ? 'spot' : 'spots'}`)
    money_ = parts.length ? [{ text: `${parts.join('')}.` }] : null
  }

  // The record, as the wire prints it, set last.
  const record = cutline?.length
    ? [{ text: 'The full trade: ' }, { text: `the ${teamFullName(a)} ` }, ...cutline.map((s, i) => (i === 0 ? { ...s, text: s.text.replace(/^Acquired/, 'acquired').replace(/^Traded/, 'traded') } : s))]
    : null

  // The kicker: a champion's title defense, else nothing.
  const champ = [a, b].find((id) => clubs[id]?.postseason === 'champion')
  const kickers = champ
    ? [
        `The ${club(champ)} begin their title defense with a different roster than the one that won it.`,
        `For the reigning champions, the work of defending a title has started.`,
      ]
    : []
  const kicker = kickers.length ? kickers[variant({ id: star.id }, date, kickers.length)] : null

  const paragraphs = [lede, starPara, takerRest, turn, giverRest, money_, record, kicker ? [{ text: kicker }] : null].filter(Boolean)
  // The star rides along for the story's photo (photo.js).
  return { headline, dek, paragraphs, star: { id: star.id, name: star.name, pos: star.pos ?? null } }
}
