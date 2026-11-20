import { teamClubName, teamFullName, teamLocationName } from '../../../lib/teams.js'
import { num, word, variant } from '../../../api/transactions/voice.js'
import { money } from '../../../lib/trade/deal.js'
import { verdictOf } from '../../../lib/trade/value.js'
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
// Gloves". Single honors from one season share its year: "won a Silver Slugger
// and a Gold Glove and made the All-MLB First Team in 2026".
function honorClauses(honors) {
  const won = []
  const made = []
  const mixed = []
  const bySeason = new Map()
  const slot = (season) => bySeason.get(season) ?? bySeason.set(season, { won: [], made: [] }).get(season)
  for (const h of HONORS) {
    const mine = honors.filter((x) => x.key === h.key)
    if (!mine.length) continue
    if (h.major) {
      for (const x of mine) won.push(`the ${x.season} ${x.league ? `${x.league} ` : ''}${h.words}`)
    } else if (mine.length > 1) {
      if (h.team) made.push(`the ${h.words} ${word(mine.length)} times`)
      else won.push(`${word(mine.length)} ${h.plural}`)
    } else {
      slot(mine[0].season)[h.team ? 'made' : 'won'].push(h.team ? `the ${h.words}` : `a ${h.words}`)
    }
  }
  for (const [season, g] of [...bySeason].sort(([x], [y]) => x - y)) {
    if (g.won.length && g.made.length) mixed.push(`won ${listOf(g.won)} and made ${listOf(g.made)} in ${season}`)
    else if (g.won.length) won.push(`${listOf(g.won)} in ${season}`)
    else made.push(`${listOf(g.made)} in ${season}`)
  }
  return [won.length ? `won ${listOf(won)}` : null, made.length ? `made ${listOf(made)}` : null, ...mixed].filter(Boolean)
}

// His honors in one sentence. After his wire note he is "He"; alone, his last name.
function honorsSentence(p, afterNote) {
  const clauses = honorClauses(p.honors ?? [])
  const stars = p.allStars?.length ?? 0
  if (stars) clauses.push(stars === 1 ? `was an All-Star in ${p.allStars[0]}` : `is a ${word(stars)}-time All-Star`)
  if (!clauses.length) return null
  // Every honor from one season: the year once, at the end ("…, all in 2026").
  const years = new Set([...(p.honors ?? []).map((h) => h.season), ...(p.allStars ?? [])])
  if (years.size === 1 && clauses.length > 1) {
    const [y] = years
    const bare = clauses.map((c) => c.replaceAll(` in ${y}`, '').replaceAll(`the ${y} `, 'the '))
    return `${afterNote ? 'He' : lastName(p.name)} ${listOf(bare)}${clauses.length > 2 ? ',' : ''} ${clauses.length > 2 ? 'all ' : ''}in ${y}.`
  }
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

// The angle the lede hangs on, strongest first, with the reason it won:
// the star's major award; a ranked prospect the taker gave up for him; a deal
// that tilts well one way by surplus value; else the taker's season.
const SPOT_WORDS = { C: 'behind the plate', '1B': 'at first base', '2B': 'at second base', SS: 'at shortstop', '3B': 'at third base', LF: 'in left field', CF: 'in center field', RF: 'in right field', DH: 'at designated hitter' }
const WEAK_SPOT = 1
// The same spots as a headline's modifier: "fill left-field hole".
const SPOT_HEAD = { C: 'catcher', '1B': 'first-base', '2B': 'second-base', SS: 'shortstop', '3B': 'third-base', LF: 'left-field', CF: 'center-field', RF: 'right-field', DH: 'designated-hitter' }
function pickAngle({ star, giverGets, deal, lineup, giverSeason, giver }) {
  if (starTag(star)) return { key: 'award', reason: `${star.name} has a major award` }
  const prospect = [...giverGets].filter((p) => p.topRank).sort((x, y) => x.topRank - y.topRank)[0]
  if (prospect) return { key: 'prospects', reason: `${prospect.name} is a top-100 prospect`, player: prospect }
  // The star takes over a starting spot the taker had weak (under 1.0 WAR) or empty.
  const hole = lineup?.spots?.find((x) => x.after?.id === star.id && SPOT_WORDS[x.spot] && (x.before?.war ?? -9) < WEAK_SPOT)
  if (hole) return { key: 'fit', reason: `${star.name} takes over a weak ${hole.spot}`, spot: hole.spot }
  // A club out of the postseason that gets only ranked prospects back is restocking.
  if (giverSeason?.postseason === 'out' && giverGets.length && giverGets.every((p) => p.orgRank || p.topRank)) return { key: 'restock', reason: `the ${club(giver)} missed the postseason and get ranked prospects`, club: giver }
  const v = deal?.value?.a
  if (Number.isFinite(v) && ['big', 'steal'].includes(verdictOf(v))) return { key: 'value', reason: `surplus value is ${verdictOf(v)}`, value: v }
  return { key: 'season', reason: 'nothing stronger to lead on' }
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

export function buildStory({ a, b, sendsA, sendsB, cutline, clubs = {}, lineups = {}, deal = null, nextYear, date }) {
  const all = [...sendsA, ...sendsB]
  if (!all.length) return null
  const star = starOf(all)
  const starIsB = sendsB.some((p) => p.id === star.id)
  const n = all.length
  const plainHead = starIsB
    ? `${club(a)} acquire ${star.name} in ${word(n)}-player deal with ${club(b)}`
    : `${club(a)} trade ${star.name} to ${club(b)} in ${word(n)}-player deal`
  // The dek turns to the other side: what it lands, and that player's best honor.
  const other = starIsB ? sendsA : sendsB
  const otherClub = starIsB ? b : a
  const otherStar = starOf(other)
  const otherHonor = otherStar ? honorClauses((otherStar.honors ?? []).slice(0, 1)).find((c) => c.startsWith('won the')) : null
  const dekText = otherStar
    ? `The ${club(otherClub)} land ${otherStar.name}${otherHonor ? `, who ${otherHonor},` : ''} in a deal that moves ${word(n)} players.`
    : null

  // Who gets the star (the lede's subject) and who gives him up (the turn's).
  const taker = starIsB ? a : b
  const giver = starIsB ? b : a
  const takerGets = starIsB ? sendsB : sendsA
  const giverGets = starIsB ? sendsA : sendsB

  // Lede: the news and the motive in one sentence.
  const angle = pickAngle({ star, giverGets, deal, lineup: lineups[taker], giverSeason: clubs[giver], giver })
  const tag = starTag(star)
  const leadIn = seasonLead(clubs[taker])
  const dealWords = ` in ${/^(eight|eleven|eighteen)/.test(word(n)) ? 'an' : 'a'} ${word(n)}-player deal`
  const close = angle.key === 'prospects'
    ? [{ text: `${dealWords} that costs them ` }, { text: angle.player.name, playerId: angle.player.id }, { text: `, MLB Pipeline's No. ${angle.player.topRank} prospect.` }]
    : angle.key === 'restock'
      ? [{ text: `${dealWords} that restocks the ${club(angle.club)} with prospects.` }]
      : angle.key === 'fit'
      ? [{ text: `${dealWords} that fills their hole ${SPOT_WORDS[angle.spot]}.` }]
      : angle.key === 'value'
      ? [{ text: `${dealWords} that tilts well toward the ${club(angle.value > 0 ? a : b)} by surplus value.` }]
      : [{ text: `${dealWords}.` }]
  const lede = [
    { text: `${leadIn ?? ''}${leadIn ? 'the' : 'The'} ` },
    { text: teamFullName(taker), teamId: taker },
    { text: ` ${variant({ id: star.id }, date, 2) ? 'acquired' : 'landed'} ` },
    { text: star.name, playerId: star.id },
    { text: `${tag ? `, ${tag},` : ''} from the ` },
    { text: teamFullName(giver), teamId: giver },
    ...close,
  ]
  // The headline follows the angle; award, value and season keep the plain one.
  const headline = angle.key === 'fit'
    ? `${club(taker)} fill ${SPOT_HEAD[angle.spot]} hole with ${star.name} in ${word(n)}-player deal with ${club(giver)}`
    : angle.key === 'prospects'
      ? `${club(taker)} send top prospect ${angle.player.name} to ${club(giver)} for ${star.name}`
      : angle.key === 'restock'
        ? `${club(giver)} trade ${star.name} to ${club(taker)} for prospects`
        : plainHead
  // The dek would name the prospect the headline and lede already name: drop it.
  const dek = angle.key === 'prospects' && otherStar?.id === angle.player.id ? null : dekText
  // The lede named the prospect's rank; his own paragraph does not say it again.
  const said = (p) => (angle.key === 'prospects' && p.id === angle.player.id ? { ...p, topRank: null } : p)

  const starPara = playerText(star) ? [{ text: playerText(star) }] : null
  const takerRest = groupParagraph(`The ${club(taker)} also get`, takerGets.filter((p) => p.id !== star.id))

  // The turn: what the other club gets back, led by its best player.
  const back = said(starOf(giverGets) ?? {})
  const turn = back.id
    ? [
        { text: `In return, the ${club(giver)}${seasonAside(clubs[giver])} get ${word(giverGets.length)} ${giverGets.length === 1 ? 'player' : 'players'}${giverGets.length > 1 ? ', led by ' : ': '}` },
        { text: back.name, playerId: back.id },
        { text: `.${playerText(back) ? ` ${playerText(back)}` : ''}` },
      ]
    : null
  const giverRest = back.id ? groupParagraph(`They also get`, giverGets.filter((p) => p.id !== back.id).map(said)) : null

  // The money and the roster, in one sentence.
  let money_ = null
  if (deal) {
    const gainer = deal.payroll.a > 0 ? a : b
    const moved = Math.abs(deal.payroll.a)
    const over = [a, b].map((id) => [id, (id === a ? deal.fortyAfter.a : deal.fortyAfter.b) - 40]).find(([, k]) => k > 0)
    const parts = []
    if (moved >= 1e5) parts.push(`The deal moves ${money(moved)} of ${nextYear} payroll to ${teamLocationName(gainer) ?? club(gainer)}`)
    if (over) parts.push(`${parts.length ? ', and the' : 'The'} ${club(over[0])} will have to clear ${num(over[1])} 40-man ${over[1] === 1 ? 'spot' : 'spots'}`)
    // What it means: who comes out ahead by surplus value (value.js's bands).
    const v = deal.value?.a
    let means = null
    if (Number.isFinite(v) && angle.key !== 'value') {
      const verdict = verdictOf(v)
      const ahead = club(v > 0 ? a : b)
      means = verdict === 'fair'
        ? 'By surplus value, the deal comes out close to even.'
        : `By surplus value, the ${ahead} come out ${verdict === 'win' ? 'ahead' : 'well ahead,'} by about ${money(Math.abs(v))}.`
    }
    const sentences = [parts.length ? `${parts.join('')}.` : null, means].filter(Boolean)
    money_ = sentences.length ? [{ text: sentences.join(' ') }] : null
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
  // The dateline: the home of the club that lands the headline player.
  return { headline, dek, dateline: teamLocationName(taker) ?? null, paragraphs, angle: { key: angle.key, reason: angle.reason }, star: { id: star.id, name: star.name, pos: star.pos ?? null } }
}
