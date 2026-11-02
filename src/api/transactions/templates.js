// WIRE TEMPLATES — which background a roster move shows, and the words for it.
// Each player a move names gets the template for his own part of the sentence
// (subjectsOf), and the template turns his facts (transactions/playerFacts.js)
// into the card's note. Spoiler-free: season and career stats, never a score.
//
// Tuned together in the Wire Lab (/wire-lab):
//   free-agency   elected free agency: the season and deal, debut, every club
//   signing       a big-league signing: the same narrative
//   minor-deal    a minor-league contract: one sentence, his season and level
//   trade         one side of a trade: the same sentence, plus a minor
//                 leaguer's draft and trades since
//   cut           outrighted, designated, released, claimed: how he got here,
//                 his career line, what the move means, his options
//   il-placed     onto the injured list: his stints this season, his line
//   il-activated  off it: the days missed, his line before it
//   fallback      every other move: no note, the sheet on a tap
// Note the feed's own codes: DFA is "declared free agency", DES is designated.
import { teamAbbr, teamClubName, teamLocationName } from '../../lib/teams.js'

const TEMPLATE_CODES = [
  ['free-agency', ['DFA']],
  ['cut', ['OUT', 'DES', 'REL', 'CLW']],
  ['deal', ['SFA', 'SGN', 'TR']],
]

export function templateFor(story) {
  const codes = new Set(story.codes ?? [])
  return TEMPLATE_CODES.find(([, list]) => list.some((code) => codes.has(code)))?.[0] ?? 'fallback'
}

// The player a move is about: the first face on the rail, else the first
// player the sentence names.
export function subjectOf(story) {
  return story.rail?.find((slot) => slot.playerId)?.playerId ?? story.cutline?.find((seg) => seg.playerId)?.playerId ?? null
}

// Every player a story names, each with the template for HIS move. A club's
// busy day folds several moves into one sentence ("Activated RHP A from the
// 60-day injured list; selected the contract of LHP B; RHP C elected free
// agency"), its parts split by semicolons, and the verb sits on either side of
// the name. So each part is read on its own, and its players share it (a
// trade's sides both read as the deal).
const CLAUSE_TEMPLATES = [
  ['free-agency', /elected free agency/i],
  ['cut', /outright|designated|released|claimed/i],
  ['il-placed', /placed .*injured list/i],
  ['il-activated', /activated .*from the .*injured list/i],
  ['minor-deal', /minor league contract/i],
  ['trade', /traded|acquired/i],
  ['signing', /signed/i],
]
export function subjectsOf(story) {
  const parts = [{ text: '', players: [] }]
  for (const seg of story.cutline ?? []) {
    if (seg.playerId) {
      parts[parts.length - 1].players.push({ playerId: seg.playerId, name: seg.text })
      parts[parts.length - 1].text += seg.text
      continue
    }
    const pieces = (seg.text ?? '').split(';')
    parts[parts.length - 1].text += pieces[0]
    for (const piece of pieces.slice(1)) parts.push({ text: piece, players: [] })
  }
  const seen = new Set()
  const out = []
  for (const part of parts) {
    const template = CLAUSE_TEMPLATES.find(([, re]) => re.test(part.text))?.[0] ?? 'fallback'
    for (const p of part.players) {
      if (seen.has(p.playerId)) continue
      seen.add(p.playerId)
      out.push({ ...p, template, clause: part.text })
    }
  }
  if (!out.length) {
    const id = subjectOf(story)
    const byCodes = templateFor(story)
    const template = byCodes === 'deal' ? ((story.codes ?? []).includes('TR') ? 'trade' : 'signing') : byCodes
    if (id != null) out.push({ playerId: id, name: null, template, clause: '' })
  }
  return out
}

const abbr = (teamId) => teamAbbr({ id: teamId })
// THE NARRATIVE — a free agent's card reads as two short sentences, the way a
// newspaper transaction note does: the season just played (with the deal he
// played it on), then the career. A split season names each club instead, and
// the deal becomes its own sentence.
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const word = (n) => WORDS[n] ?? String(n)
const club = (teamId) => teamClubName(teamId) ?? abbr(teamId)
const the = (teamId) => `the ${club(teamId)}`

// Cot's "6 y/$50M (20-25)+26-27 opts" as "six-year, $50 million"; null for a
// deal with no dollars, which says nothing.
export function dealPhrase(terms) {
  const m = /^(\d+) y\/\$([\d.,]+)(M|K)?/.exec(terms ?? '')
  if (!m) return null
  const money = m[3] === 'M' ? `$${m[2]} million` : m[3] === 'K' ? `$${m[2]} thousand` : `$${m[2]}`
  return `${word(Number(m[1]))}-year, ${money}`
}

// What he did, in words: "hit .212 with 26 homers in 125 games".
function didText(line, pitcher) {
  const games = line.games === 1 ? 'one game' : `${line.games} games`
  if (pitcher) return `posted ${an(line.era)} ${line.era} ERA over ${line.ip} innings in ${games}`
  const hr = line.hr === 0 ? 'no homers' : line.hr === 1 ? 'one homer' : `${line.hr} homers`
  return `hit ${line.avg} with ${hr} in ${games}`
}

// A season this short says little on its own: below it the note says how
// little he played and why, and reaches back to his last full season.
export const FULL_SEASON = { hitter: 20, pitcher: 10 }
const isFull = (line, pitcher) => line && line.games >= (pitcher ? FULL_SEASON.pitcher : FULL_SEASON.hitter)
const TIMES = ['', 'once', 'twice']
// More games in the minors than the majors: "spent most of the year" is true.
// A rehab stint (a game or two down there) is not.
const mostlyMinors = (facts) => (facts.minors?.line?.games ?? 0) > (facts.seasonLine?.games ?? 0)

// "a 4.06 ERA", "an 11.12 ERA", "an 8.10 ERA".
const an = (num) => (/^(8|11|18)/.test(String(num)) ? 'an' : 'a')
// What he did in a minor-league season, after "posting" or "hitting".
function minorsText(line, pitcher) {
  return pitcher ? `posting ${an(line.era)} ${line.era} ERA over ${line.ip} innings` : `hitting ${line.avg} with ${line.hr === 0 ? 'no homers' : line.hr === 1 ? 'one homer' : `${line.hr} homers`}`
}

// Who a later sentence is about: his last name the first time after "The
// 35-year-old", then "he". `cap` starts a sentence; `pos` is the possessive.
function subjectFor(facts) {
  let named = !facts.lastName
  return ({ cap = false, pos = false } = {}) => {
    if (!named) {
      named = true
      return pos ? `${facts.lastName}'s` : facts.lastName
    }
    const w = pos ? 'his' : 'he'
    return cap ? w[0].toUpperCase() + w.slice(1) : w
  }
}

function shortSeason(facts, who, sub) {
  const g = facts.seasonLine?.games ?? 0
  const team = facts.clubs[facts.clubs.length - 1]?.teamId
  const last = [...facts.years].reverse().find((y) => y.season < facts.season && isFull(y.line, facts.pitcher))
  // A few big-league games and a minor-league year: where he spent most of it.
  if (g && mostlyMinors(facts)) {
    const up = facts.pitcher ? `pitched ${TIMES[g] ?? `in ${g} games`}` : `played ${g === 1 ? 'one game' : `${g} games`}`
    const why = facts.injured === 'long' ? ' He spent most of the year on the injured list.' : ''
    const out = [`${who} spent most of ${facts.season} ${minorsWhere(facts.minors)}, ${minorsText(facts.minors.line, facts.pitcher)}, and ${up} for ${the(team)}.${why}`]
    if (last) out.push(`In ${last.season} ${sub()} ${didText(last.line, facts.pitcher)}.`)
    return out
  }
  // No big-league games but a minor-league year: where he spent it, then his
  // last big-league season.
  if (!g && facts.minors?.line) {
    const m = facts.minors
    const out = [`${who} spent ${facts.season} ${minorsWhere(m)}, ${minorsText(m.line, facts.pitcher)}.`]
    if (last) out.push(`${sub({ cap: true, pos: true })} last big-league season was ${last.season}: ${didText(last.line, facts.pitcher).replace(/^(hit|posted) /, '').replace(/^a /, `${an(last.line.era)} `)}.`)
    return out
  }
  const played = !g
    ? `did not play in the majors in ${facts.season}`
    : facts.pitcher
      ? `pitched ${TIMES[g] ?? `in ${g} games`} for ${the(team)} in ${facts.season}`
      : `played ${g === 1 ? 'one game' : `${g} games`} for ${the(team)} in ${facts.season}`
  const why = facts.injured === 'long' ? ' and spent most of the year on the injured list' : facts.injured ? ' and spent time on the injured list' : ''
  const out = [`${who} ${played}${why}.`]
  if (last) {
    const did = didText(last.line, facts.pitcher)
    out.push(`In ${last.season} ${sub()} ${did}.`)
  }
  return out
}

// Every club he has played for, in the order he reached them: "the Tigers,
// Reds, Mariners and D-backs". A return to an old club is not a new one.
// Each club carries its years, every stint: "Reds (2015-22, 2026)".
// A club's years are its own set, joined where they run on, so a split
// season's two clubs (listed in either order) can't break a stint in two.
function spansOf(years) {
  const out = []
  for (const y of [...years].sort((a, b) => a - b)) {
    const last = out[out.length - 1]
    if (last && y === last[1] + 1) last[1] = y
    else out.push([y, y])
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}-${String(b).slice(2)}`))
}
function clubList(facts) {
  const years = new Map()
  for (const c of facts.clubs) {
    const set = years.get(c.teamId) ?? new Set()
    for (let y = c.from; y <= c.to; y += 1) set.add(y)
    years.set(c.teamId, set)
  }
  const names = [...years].map(([teamId, set]) => `${club(teamId)} (${spansOf(set).join(', ')})`)
  const list = names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `the ${list}`
}

export function freeAgentStory(facts) {
  const who = facts.age ? `The ${facts.age}-year-old` : 'He'
  const deal = dealPhrase(facts.contract?.terms)
  const sentences = []
  const sub = subjectFor(facts)
  const short = !isFull(facts.seasonLine, facts.pitcher)
  if (short) {
    sentences.push(...shortSeason(facts, who, sub))
  } else if (facts.seasonClubs.length) {
    const parts = facts.seasonClubs.map((c) => `${c.line.games} for ${the(c.teamId)}`)
    const last = facts.seasonClubs[facts.seasonClubs.length - 1].teamId
    const claimed = facts.arrival?.how === 'waiver claim' && facts.arrival.teamId === last ? ' after a waiver claim' : ''
    sentences.push(`${who} ${didText(facts.seasonLine, facts.pitcher)} in ${facts.season}, ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}${claimed}.`)
  } else {
    const team = facts.clubs[facts.clubs.length - 1]?.teamId
    sentences.push(`${who} ${didText(facts.seasonLine, facts.pitcher)} for ${the(team)} in ${facts.season}${deal ? `, on a ${deal} deal` : ''}.`)
  }
  if (deal && (facts.seasonClubs.length || short)) sentences.push(`${sub({ cap: true })} is coming off a ${deal} deal.`)
  else if (facts.seasons) {
    if (facts.seasons === 1 && facts.years[0]?.season === facts.season) sentences.push(`${facts.season} was his first season in the majors.`)
    else {
      const debut = facts.debut?.slice(0, 4) ?? facts.years[0]?.season
      const all = new Set(facts.clubs.map((c) => c.teamId)).size === 1 ? 'all ' : ''
      sentences.push(`${sub({ cap: true })} made his major league debut in ${debut} and has played ${facts.seasons} seasons ${all}for ${clubList(facts)}.`)
    }
  }
  return sentences.join(' ')
}

// "MLB's No. 45 prospect", or "the Athletics' No. 12 prospect" off his club's list.
function prospectPhrase(p) {
  if (!p) return null
  return p.teamId == null ? `MLB's No. ${p.rank} prospect` : `${the(p.teamId)}' No. ${p.rank} prospect`
}

// ONE SENTENCE — a minor-league deal, or one side of a trade: his age and the
// season he just had, where he had it. A trade's note adds that it was his
// first big-league season when it was; a player with no big-league games in
// the season gets his minor-league line (one extra read, playerFacts.js).
export function seasonSentence(facts) {
  const rank = prospectPhrase(facts.prospect)
  const who = `${facts.age ? `The ${facts.age}-year-old` : facts.lastName ?? 'He'}${rank ? `, ${rank},` : ''}`
  // A thin big-league season with a minor-league one: lead with where he
  // spent most of the year.
  if (facts.seasonLine && mostlyMinors(facts) && !isFull(facts.seasonLine, facts.pitcher)) {
    const team = facts.clubs[facts.clubs.length - 1]?.teamId
    const g = facts.seasonLine.games
    const up = facts.pitcher ? `pitched ${TIMES[g] ?? `in ${g} games`}` : `played ${g === 1 ? 'one game' : `${g} games`}`
    return `${who} spent most of ${facts.season} ${minorsWhere(facts.minors)}, ${minorsText(facts.minors.line, facts.pitcher)}, and ${up} for ${the(team)}.`
  }
  if (facts.seasonLine) {
    const team = facts.clubs[facts.clubs.length - 1]?.teamId
    const first = facts.seasons === 1 && facts.years[0]?.season === facts.season ? ', his first season in the majors' : ''
    return `${who} ${didText(facts.seasonLine, facts.pitcher)} for ${the(team)} in ${facts.season}${first}.`
  }
  const m = facts.minors
  if (m?.line) return `${who} ${didText(m.line, facts.pitcher)} ${minorsWhere(m)} in ${facts.season}.`
  return `${who} did not play in ${facts.season}.`
}

// "in Double-A with the Biloxi Shuckers", or "across High-A and Double-A".
function minorsWhere(m) {
  if (m.team) return `in ${m.level[0]} with the ${m.team}`
  return m.level.length > 1 ? `across ${m.level.slice(0, -1).join(', ')} and ${m.level[m.level.length - 1]}` : `in ${m.level[0]}`
}

const ordinal = (n) => {
  const v = Number(n)
  const s = v % 100 >= 11 && v % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] ?? 'th'
  return `${v}${s}`
}

// WHERE HE CAME FROM — a minor leaguer's origin: the club that drafted him
// (round and school) or signed him, then each trade or claim since, up to the
// move on the card. "Robinson was the Athletics' 11th-round pick out of Texas
// Tech in 2024, and the Pirates got him in a May 16 trade."
function originSentence(facts, name, moveDate) {
  const before = facts.arrivals.filter((a) => !moveDate || daysBetween(a.date, moveDate) > 1)
  const parts = []
  const d = facts.draft
  if (d) parts.push(`${name} was ${the(d.teamId)}' ${d.round ? `${ordinal(d.round)}-round pick` : 'draft pick'}${d.school ? ` out of ${d.school}` : ''} in ${d.year}`)
  else {
    const signed = before.find((a) => a.how === 'signing' || a.how === 'free agent')
    if (signed) parts.push(`${name} signed with ${the(signed.teamId)} in ${signed.date.slice(0, 4)}`)
  }
  for (const a of before.filter((x) => x.how === 'trade' || x.how === 'waiver claim')) {
    const when = `${apDate(a.date)}${a.date.slice(0, 4) === String(facts.season) ? '' : `, ${a.date.slice(0, 4)}`}`
    parts.push(a.how === 'trade' ? `${the(a.teamId)} got him in ${/^(Aug|April|Oct)/.test(when) ? 'an' : 'a'} ${when} trade` : `${the(a.teamId)} claimed him on ${when}`)
  }
  if (!parts.length) return null
  parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1)
  // Independent clauses: commas between them, ", and" before the last.
  const last = parts.pop()
  return `${parts.length ? `${parts.join(', ')}, and ${last}` : last}.`
}

// A CUT — outrighted, designated, released or claimed: how he came to the club,
// then what he has done in the majors. The newspaper's month style ("Aug. 3",
// "June 9").
// A month with no day is spelled out ("December 2025").
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const AP_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
function apDate(iso) {
  const [, m, d] = iso.split('-').map(Number)
  return `${AP_MONTHS[m - 1]} ${d}`
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const place = (teamId) => teamLocationName(teamId) ?? club(teamId)
const NUMBER = new Intl.NumberFormat('en-US')

function arrivalSentence(facts, who, moveDate) {
  const a = facts.arrival
  // A claim is its own arrival: the move already says how he got here.
  if (!a || (moveDate && daysBetween(a.date, moveDate) <= 1)) return null
  const year = a.date.slice(0, 4) === String(facts.season) ? '' : `, ${a.date.slice(0, 4)}`
  const when = `${apDate(a.date)}${year}`
  let s
  if (a.how === 'trade' && a.fromTeamId) s = `${who} came to ${the(a.teamId)} from ${the(a.fromTeamId)} in ${/^(Aug|April|Oct)/.test(when) ? 'an' : 'a'} ${when}${year ? ',' : ''} trade`
  else if (a.how === 'waiver claim' && a.fromTeamId) s = `${who} was claimed off waivers from ${the(a.fromTeamId)} on ${when}`
  else if (a.how === 'draft') s = `${who} was drafted by ${the(a.teamId)} in ${a.date.slice(0, 4)}`
  else if (a.how === 'Rule 5 draft')
    s = `${who} was a Rule 5 pick by ${the(a.teamId)}${a.fromTeamId ? ` from ${the(a.fromTeamId)}` : ''} in ${MONTH_NAMES[Number(a.date.slice(5, 7)) - 1]} ${a.date.slice(0, 4)}`
  else if (a.how === 'purchase') s = `${who} was bought by ${the(a.teamId)}${a.fromTeamId ? ` from ${the(a.fromTeamId)}` : ''} on ${when}`
  else s = `${who} signed with ${the(a.teamId)} on ${when}`
  // Back with a club he played for before he left.
  const before = spansOf(new Set(facts.clubs.filter((c) => c.teamId === a.teamId && c.to < Number(a.date.slice(0, 4))).flatMap((c) => range(c.from, c.to))))
  if (before.length) s += `, back with the club he played for in ${before.join(' and ')}`
  // The step before, when it came only days earlier.
  const prev = [...facts.arrivals].reverse().find((t) => t.teamId === a.fromTeamId && t.date < a.date)
  const gap = prev ? daysBetween(prev.date, a.date) : null
  if (prev && gap <= 14 && prev.fromTeamId) {
    const days = gap === 1 ? 'a day' : `${word(gap)} days`
    s += `, ${days} after ${place(prev.teamId)} got him from ${place(prev.fromTeamId)}`
  }
  return `${s}.`
}

function careerSentence(facts, name) {
  if (!facts.debut) {
    const m = facts.minors
    return m?.line
      ? `${name} has not reached the majors; he ${didText(m.line, facts.pitcher)} ${minorsWhere(m)} in ${facts.season}.`
      : `${name} has not reached the majors.`
  }
  const l = facts.careerLine
  // A debut with no career split for his group on file: say nothing rather than guess.
  if (!l) return null
  const games = `${NUMBER.format(l.games)} big-league games`
  const what = facts.pitcher
    ? `${name} has ${an(l.era)} ${l.era} ERA over ${l.ip} innings in ${games}`
    : `${name} is a ${l.avg} hitter with ${l.hr === 0 ? 'no homers' : l.hr === 1 ? 'one homer' : `${NUMBER.format(l.hr)} homers`} in ${games}`
  const now = facts.seasonLine?.games ?? 0
  const tail = now ? `, ${now === l.games ? 'all' : now} of them in ${facts.season}` : `, none of them in ${facts.season}`
  return `${what}${tail}.`
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

// His last full season, when the one just played was short. Not for a
// reliever: he rides between Triple-A and the majors, so he rarely has one,
// and the sentence lands on whatever brief stint cleared the bar.
const isReliever = (facts) => facts.pitcher && (facts.careerLine?.starts ?? 0) * 2 < (facts.careerLine?.games ?? 0)
function lastFullSentence(facts) {
  if (isReliever(facts) || isFull(facts.seasonLine, facts.pitcher)) return null
  const last = [...facts.years].reverse().find((y) => y.season < facts.season && isFull(y.line, facts.pitcher))
  if (!last) return null
  return `His last full season was ${last.season}, when he ${didText(last.line, facts.pitcher)}.`
}

// What the move does, in the roster's own terms (docs/transactions-wire.md):
// an outright takes him off the 40-man but keeps him in the organization; a
// designation is a limbo the club must resolve.
function moveSentence(facts, clause) {
  const left = facts.contract?.options
  const options = left == null ? '' : left === 0 ? ' He is out of minor-league options.' : ` He has ${word(left)} minor-league option${left === 1 ? '' : 's'} left.`
  if (/outright/i.test(clause)) return `The move clears a 40-man roster spot, and he stays in the organization.${options}`
  if (/designated/i.test(clause)) return `He must now be traded, released or passed through waivers.${options}`
  return null
}

export function cutStory(facts, { moveDate = null, clause = '' } = {}) {
  const who = facts.age ? `The ${facts.age}-year-old` : 'He'
  const first = arrivalSentence(facts, who, moveDate)
  const name = first ? facts.lastName ?? 'He' : who
  return [first, careerSentence(facts, name), facts.debut ? lastFullSentence(facts) : null, moveSentence(facts, clause)].filter(Boolean).join(' ')
}

// THE INJURED LIST — the move's sentence already names the list, the injury
// and the call-up who took his spot (cutline.js), so the note adds what it
// cannot: his stints earlier in the season, how he was playing before this
// one, and on an activation, the time he missed.
const COUNT = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth']
// The feed's injury note, set in parentheses as the move's own sentence does:
// no article to guess ("a left oblique strain", but not "a plantar fasciitis").
const lower = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t)

// "He was hitting .281 with 9 homers in 54 games" / "had a 3.40 ERA over 98.0 innings".
function beforeText(line, pitcher) {
  if (!line?.games) return null
  return pitcher
    ? `had ${an(line.era)} ${line.era} ERA over ${line.ip} innings in ${line.games === 1 ? 'one game' : `${line.games} games`}`
    : `was hitting ${line.avg} with ${line.hr === 0 ? 'no homers' : line.hr === 1 ? 'one homer' : `${line.hr} homers`} in ${line.games === 1 ? 'one game' : `${line.games} games`}`
}

export function injuredStory(facts, { placed }) {
  const stint = facts.stint
  if (!stint) return null
  const name = facts.lastName ?? 'He'
  const at = facts.stints.findIndex((x) => x.from === stint.from)
  const earlier = facts.stints.slice(0, at)
  const out = []
  if (placed) {
    const prev = earlier[earlier.length - 1]
    let s = `It is ${name}'s ${COUNT[at + 1] ?? `${at + 1}th`} stint on the injured list in ${facts.season}`
    if (prev?.to) s += `; he missed ${daysBetween(prev.from, prev.to)} days from ${apDate(prev.from)}${prev.injury ? ` (${lower(prev.injury)})` : ''}`
    out.push(`${s}.`)
    const before = beforeText(facts.beforeLine, facts.pitcher)
    if (before) out.push(`He ${before}.`)
  } else {
    let s = `${name} missed ${daysBetween(stint.from, stint.to)} days`
    if (stint.injury) s += ` (${lower(stint.injury)})`
    if (at > 0) s += `, his ${COUNT[at + 1] ?? `${at + 1}th`} stint of ${facts.season}`
    out.push(`${s}.`)
    const before = beforeText(facts.beforeLine, facts.pitcher)
    if (before) out.push(`He ${before} before it.`)
  }
  return out.join(' ')
}

// The card's fact line: up to two short lines, or none for the fallback.
export function factLines(template, facts, ctx = {}) {
  if (!facts || template === 'fallback') return []
  if (template === 'minor-deal' || template === 'trade') {
    const origin = facts.debut ? null : originSentence(facts, facts.lastName ?? 'He', ctx.moveDate)
    return [seasonSentence(facts), origin].filter(Boolean)
  }
  if (template === 'free-agency' || template === 'signing') {
    return [freeAgentStory(facts)]
  }
  if (template === 'cut') return [cutStory(facts, ctx)]
  if (template === 'il-placed' || template === 'il-activated') {
    const note = injuredStory(facts, { placed: template === 'il-placed' })
    return note ? [note] : []
  }

  return []
}
