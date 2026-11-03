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
//   recall        up from the minors: his minor-league line, which trip up it is
//   option        sent down: how the stint went, his options left
//   selected      onto the 40-man: a first call-up says so; else a recall
//   arrival       from outside affiliated ball: where from, his last season in it
//   retired       the whole career in a sentence
//   fallback      every other move: no note, the sheet on a tap
// Note the feed's own codes: DFA is "declared free agency", DES is designated.
import { teamAbbr, teamClubName, teamLocationName } from '../../lib/teams.js'

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
  ['il-placed', /placed .*injured list|transferred .*60-day injured list/i],
  ['il-activated', /activated .*from the .*injured list/i],
  ['recall', /recalled/i],
  ['option', /optioned/i],
  ['selected', /selected the contract/i],
  ['retired', /retired/i],
  ['minor-deal', /minor league contract/i],
  // From an independent club: no trade, so nothing went the other way.
  ['arrival', /\bobtained\b|\bpurchased\b|\bacquired\b(?![^;]*\bfor\b)/i],
  // Within one clause (they split at ';'), so a club may lead it.
  ['sold', /\btraded\b[^;]*\bfor cash\b/i],
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
    // A linked club is in affiliated ball: an "acquired" from it is a trade.
    if (seg.teamId) parts[parts.length - 1].linked = true
    const pieces = (seg.text ?? '').split(';')
    parts[parts.length - 1].text += pieces[0]
    for (const piece of pieces.slice(1)) parts.push({ text: piece, players: [] })
  }
  const seen = new Set()
  const out = []
  for (const part of parts) {
    let template = CLAUSE_TEMPLATES.find(([, re]) => re.test(part.text))?.[0] ?? 'fallback'
    if (template === 'arrival' && part.linked && !/obtained|purchased/i.test(part.text)) template = 'trade'
    for (const p of part.players) {
      if (seen.has(p.playerId)) continue
      seen.add(p.playerId)
      out.push({ ...p, template, clause: part.text })
    }
  }
  // A sentence that names no player: the story's first face, sheet only.
  if (!out.length) {
    const id = subjectOf(story)
    if (id != null) out.push({ playerId: id, name: null, template: 'fallback', clause: '' })
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

// "no homers" / "one homer" / "26 homers"; "one game" / "125 games".
const homers = (n) => (n === 0 ? 'no homers' : n === 1 ? 'one homer' : `${n} homers`)
const gamesText = (n) => (n === 1 ? 'one game' : `${n} games`)
// A short big-league stint: "pitched once", "pitched in 9 games", "played 9 games".
const playedText = (g, pitcher) => (pitcher ? `pitched ${TIMES[g] ?? `in ${g} games`}` : `played ${gamesText(g)}`)

// What he did, in words: "hit .212 with 26 homers in 125 games".
function didText(line, pitcher) {
  if (pitcher) return `posted ${an(line.era)} ${line.era} ERA over ${line.ip} innings in ${gamesText(line.games)}`
  return `hit ${line.avg} with ${homers(line.hr)} in ${gamesText(line.games)}`
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
  return pitcher ? `posting ${an(line.era)} ${line.era} ERA over ${line.ip} innings` : `hitting ${line.avg} with ${homers(line.hr)}`
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
    const up = playedText(g, facts.pitcher)
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
  const played = g ? `${playedText(g, facts.pitcher)} for ${the(team)} in ${facts.season}` : `did not play in the majors in ${facts.season}`
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
  // A trade's note stays as it read that day: his line up to the deal, for
  // the club he left.
  if (facts.trade?.line?.games && !mostlyMinors(facts)) {
    // The club only when it was his one club before the deal; a line across
    // two clubs is his season, not theirs.
    const before = new Set((facts.rows ?? []).filter((r) => r.season === facts.season && r.teamId !== facts.trade.toTeamId).map((r) => r.teamId))
    const club = before.size === 1 && before.has(facts.trade.fromTeamId) ? ` for ${the(facts.trade.fromTeamId)}` : ''
    return `${who} ${didText(facts.trade.line, facts.pitcher)}${club} in ${facts.season} before the trade.`
  }
  if (facts.seasonLine && mostlyMinors(facts) && !isFull(facts.seasonLine, facts.pitcher)) {
    const team = facts.clubs[facts.clubs.length - 1]?.teamId
    const g = facts.seasonLine.games
    const up = playedText(g, facts.pitcher)
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
    parts.push(a.how === 'trade' ? `${the(a.teamId)} got him in ${aMonth(when)} ${when} trade` : `${the(a.teamId)} claimed him on ${when}`)
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
export function apDate(iso) {
  const [, m, d] = iso.split('-').map(Number)
  return `${AP_MONTHS[m - 1]} ${d}`
}
// "an Aug. 3 trade", "a July 11 trade".
const aMonth = (when) => (/^(Aug|April|Oct)/.test(when) ? 'an' : 'a')
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
  if (a.how === 'trade' && a.fromTeamId) s = `${who} came to ${the(a.teamId)} from ${the(a.fromTeamId)} in ${aMonth(when)} ${when}${year ? ',' : ''} trade${a.tradedFor ? ` for ${a.tradedFor}` : ''}`
  else if (a.how === 'waiver claim' && a.fromTeamId) s = `${who} was claimed off waivers from ${the(a.fromTeamId)} on ${when}`
  else if (a.how === 'draft') s = `${who} was drafted by ${the(a.teamId)} in ${a.date.slice(0, 4)}`
  else if (a.how === 'Rule 5 draft')
    s = `${who} was a Rule 5 pick by ${the(a.teamId)}${a.fromTeamId ? ` from ${the(a.fromTeamId)}` : ''} in ${MONTH_NAMES[Number(a.date.slice(5, 7)) - 1]} ${a.date.slice(0, 4)}`
  // A club outside affiliated ball has no club name of ours: the feed's own.
  else if (a.how === 'purchase') {
    const from = a.fromTeamId && teamClubName(a.fromTeamId) ? the(a.fromTeamId) : a.fromName ? `the ${a.fromName}` : null
    s = `${who} was bought by ${the(a.teamId)}${from ? ` from ${from}` : ''} on ${when}`
  }
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
    : `${name} is a ${l.avg} hitter with ${homers(l.hr > 999 ? NUMBER.format(l.hr) : l.hr)} in ${games}`
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
function optionsSentence(facts) {
  const left = facts.contract?.options
  return left == null ? null : left === 0 ? 'He is out of minor-league options.' : `He has ${word(left)} minor-league option${left === 1 ? '' : 's'} left.`
}
function moveSentence(facts, clause) {
  const o = optionsSentence(facts)
  const options = o ? ` ${o}` : ''
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
    ? `had ${an(line.era)} ${line.era} ERA over ${line.ip} innings in ${gamesText(line.games)}`
    : `was hitting ${line.avg} with ${homers(line.hr)} in ${gamesText(line.games)}`
}

// Earlier seasons' trips, newest first, at most three: "He missed 40 days in
// 2025 (left oblique strain) and 22 days in 2023."
function pastTrips(stints) {
  // A trip the feed never closed has no length to give, so it is left out.
  const trips = [...(stints ?? [])].filter((x) => x.to).reverse().slice(0, 3).map((x) => {
    const injury = x.injury ? ` (${lower(x.injury)})` : ''
    return `${daysBetween(x.from, x.to)} days${injury} in ${x.filings[0].slice(0, 4)}`
  })
  if (!trips.length) return null
  const list = trips.length > 1 ? `${trips.slice(0, -1).join(', ')} and ${trips[trips.length - 1]}` : trips[0]
  return `He missed ${list}.`
}

export function injuredStory(facts, { placed, moveDate = null, clause = '' }) {
  const stint = facts.stint
  if (!stint) return null
  const name = facts.lastName ?? 'He'
  const at = facts.stints.findIndex((x) => x.from === stint.from)
  const earlier = facts.stints.slice(0, at)
  const out = []
  if (placed) {
    // How big the loss is comes first.
    const before = beforeText(facts.beforeLine, facts.pitcher)
    if (before) out.push(`${name} ${before}.`)
    // A later filing of a stint already open (a transfer to the 60-day list)
    // often carries no injury: the first filing's one is his.
    const refiled = moveDate && stint.filings.length > 1 && Math.abs(daysBetween(stint.filings[0], moveDate)) > 1
    // The injury only when the move's own words leave it out.
    const borrowed = stint.injury && !clause.toLowerCase().includes(stint.injury.toLowerCase()) ? ` (${lower(stint.injury)})` : ''
    // Traded while on the list: his new club files him again (JoJo Romero, Aug. 3, 2026).
    const dealt = refiled && facts.arrivals?.find((a) => a.how === 'trade' && near(a.date, moveDate) && a.teamId !== stint.club)
    if (dealt && stint.club) out.push(`He went on ${the(stint.club)}' injured list ${apDate(stint.from)}${borrowed} and came over in the ${apDate(dealt.date)} trade.`)
    else if (refiled) out.push(`He first went on the list ${apDate(stint.from)}${borrowed}.`)
    if (at > 0) {
      const prev = earlier[earlier.length - 1]
      let s = `It is his ${COUNT[at + 1] ?? `${at + 1}th`} stint on the injured list in ${facts.season}`
      if (prev?.to) s += `; he missed ${daysBetween(prev.from, prev.to)} days from ${apDate(prev.from)}${prev.injury ? ` (${lower(prev.injury)})` : ''}`
      out.push(`${s}.`)
    } else {
      const past = pastTrips(facts.pastStints)
      if (past) out.push(past)
    }
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

// A CALL � recalled, optioned or selected. A recall gives his minor-league
// line up to it and which trip up it is; an option, how the stint went and his
// options left. A selected contract is a first call-up when he has not
// debuted yet, and otherwise a trip up like a recall.
const daysText = (n) => (n === 1 ? 'one day' : `${n} days`)
const near = (a, b) => Math.abs(daysBetween(a, b)) <= 1
function tripSentence(facts, moveDate) {
  const at = (facts.calls ?? []).findIndex((c) => c.up && near(c.up, moveDate))
  if (at < 0) return null
  const prev = facts.calls[at - 1]
  const last = prev?.up && prev.down ? `; the last lasted ${daysText(daysBetween(prev.up, prev.down))}` : ''
  return `It is his ${COUNT[at + 1] ?? `${at + 1}th`} trip up this season${last}.`
}
// A player shuttling between the two (Blake Perkins, 2026) gets both lines in one.
const briefLine = (l, pitcher) => (pitcher ? `${an(l.era)} ${l.era} ERA` : `${l.avg}${l.hr ? ` with ${homers(l.hr)}` : ''}`) + ` in ${gamesText(l.games)}`
function beforeCallSentence(facts, who) {
  const m = facts.callLine
  const mlb = facts.callMlbLine
  if (m?.line?.games && mlb?.games) {
    const where = m.team ? `the ${m.team}` : m.level.join(' and ')
    return `${who} has split ${facts.season} between ${where} (${briefLine(m.line, facts.pitcher)}) and the majors (${briefLine(mlb, facts.pitcher)}) before the call.`
  }
  return m?.line?.games ? `${who} ${didText(m.line, facts.pitcher)} ${minorsWhere(m)} in ${facts.season} before the call.` : null
}
// A call-up told beside an injured-list placement: only his line before the
// call, so it can run on after the injured player's note (Blake Perkins for
// Sal Frelick, July 18, 2026).
export function callUpSentence(facts) {
  return beforeCallSentence(facts, facts.lastName ?? 'He')
}
export const CALLS = new Set(['recall', 'option', 'selected'])
// The extra man: up for the day, back down after it, for a doubleheader or a
// special event (Little League Classic, Field of Dreams). The feed never says
// so; `extraMan` is a one-day trip that opened on such a day, `event` the
// schedule's name for a special event (null for a doubleheader).
// "Sproat last pitched Aug. 3 against the Pirates, allowing 4 earned runs over 3 innings."
function lastGameSentence(facts, name) {
  const { date, oppId, line } = facts.lastGame
  const head = `${name} last ${facts.pitcher ? 'pitched' : 'played'} ${apDate(date)}${oppId ? ` against ${the(oppId)}` : ''}`
  if (!facts.pitcher) return `${head}, going ${line.h}-for-${line.ab}${line.hr ? ` with ${homers(line.hr)}` : ''}.`
  // The feed writes thirds after the point: "2.1" is 2 1/3 innings.
  const [whole, thirds] = String(line.ip).split('.').map(Number)
  const frac = thirds ? `${thirds}/3` : ''
  const innings = whole ? `${whole}${frac ? ` ${frac}` : ''} inning${whole === 1 && !frac ? '' : 's'}` : `${frac} of an inning`
  const runs = `${line.er} earned run${line.er === 1 ? '' : 's'}`
  if (!whole && !thirds) return `${head}, allowing ${runs} without retiring a batter.`
  return `${head}, ${line.er ? `allowing ${runs} over` : 'going'} ${innings}${line.er ? '' : ' without an earned run'}.`
}
const longDate = (iso) => `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
export function callStory(facts, { kind, moveDate }) {
  const name = facts.lastName ?? 'He'
  if (facts.extraMan) {
    const c = (facts.calls ?? []).find((x) => x.up && (near(x.up, moveDate) || (x.down && near(x.down, moveDate))))
    const { event } = facts.extraMan
    const at = event ? `at the ${event}` : `in the ${c?.up ? `${longDate(c.up)} ` : ''}doubleheader`
    // No options line: the extra man's trip back is not an ordinary option.
    if (kind === 'option') return `${name} goes back down after serving as the 27th man ${at}.`
    return `${name} came up as the 27th man for the ${event ?? 'doubleheader'}${c?.down ? `${event ? ',' : ''} and went back down ${apDate(c.down)}` : ''}.`
  }
  // A send-down after time in the majors: his last game, then his season to
  // that day (Brandon Sproat, Aug. 4, 2026).
  if (kind === 'option' && facts.lastGame && facts.seasonToDate?.games) {
    return [lastGameSentence(facts, name), `He ${didText(facts.seasonToDate, facts.pitcher)} this season before the move.`, optionsSentence(facts)]
      .filter(Boolean)
      .join(' ')
  }
  if (kind === 'option') {
    const c = (facts.calls ?? []).find((x) => x.down && near(x.down, moveDate))
    // No day count: a trip can hold a stint on the injured list.
    const line = facts.stintLine
    let stint = null
    if (line?.games) stint = `${name} ${didText(line, facts.pitcher)}${c?.up ? '' : ` in ${facts.season}`} before the move.`
    else if (c?.up) stint = `${name} did not get into a game on this trip.`
    return [stint, optionsSentence(facts)].filter(Boolean).join(' ')
  }
  if (kind === 'selected' && (!facts.debut || facts.debut >= moveDate)) {
    const rank = prospectPhrase(facts.prospect)
    const who = `${facts.age ? `The ${facts.age}-year-old` : name}${rank ? `, ${rank},` : ''}`
    return ['It is his first call to the majors.', beforeCallSentence(facts, who), originSentence(facts, name, moveDate)].filter(Boolean).join(' ')
  }
  return [beforeCallSentence(facts, name), tripSentence(facts, moveDate)].filter(Boolean).join(' ')
}

// A RETIREMENT � the career in one sentence: seasons, clubs, his line.
export function retiredStory(facts) {
  const l = facts.careerLine
  if (!facts.debut || !l) return null
  const games = `${NUMBER.format(l.games)} games`
  const did = facts.pitcher ? `posting ${an(l.era)} ${l.era} ERA over ${l.ip} innings in ${games}` : `hitting ${l.avg} with ${homers(l.hr)} in ${games}`
  const seasons = facts.seasons === 1 ? 'one season' : `${facts.seasons} seasons`
  return `${facts.lastName ?? 'He'} played ${seasons} in the majors for ${clubList(facts)}, ${did}.`
}

// AN ARRIVAL from outside affiliated ball � an independent club: where he
// comes from, then his last season in affiliated ball (or his big-league line).
export function arrivalStory(facts) {
  const from = facts.arrival?.how === 'purchase' ? facts.arrival.fromName : null
  if (!from) return null
  const who = facts.age ? `The ${facts.age}-year-old` : facts.lastName ?? 'He'
  const a = facts.affiliated
  const last = a ? `His last season in affiliated ball was ${a.season}${a.level ? `, in ${a.level}` : ''}.` : null
  return [`${who} comes from the ${from}, outside affiliated ball.`, last, facts.debut ? careerSentence(facts, facts.lastName ?? 'He') : null].filter(Boolean).join(' ')
}

// The card's fact line: up to two short lines, or none for the fallback.
// The card's draft sentence, run on after the note: "The Padres drafted him
// out of Duke in the 13th round in 2022." Null for a player never drafted.
export function draftSentence(facts) {
  const d = facts?.draft
  if (!d) return null
  const club = the(d.teamId)
  return `${club[0].toUpperCase()}${club.slice(1)} drafted him${d.school ? ` out of ${d.school}` : ''}${d.round ? ` in the ${ordinal(d.round)} round${d.pick ? ` (${ordinal(d.pick)} overall)` : ''}` : ''} in ${d.year}.` // caps-js-exempt: sentence case
}

// A player traded away for cash (Easton McGee, July 14, 2026): his time with
// the club and his whole line for it. A wire runs many of these, so the
// sentence takes one of three shapes, fixed per player so it never shifts.
const SEASONS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
function soldStory(facts, { teamId }) {
  const stint = (facts.clubs ?? []).filter((c) => c.teamId === teamId).at(-1)
  if (!stint) return null
  const name = facts.lastName ?? 'He'
  const club = the(teamId)
  const l = facts.clubTotals?.[teamId]
  if (!l?.games) return `${name} had been with ${club} since ${stint.from}.`
  const did = `${didText(l, facts.pitcher)} for them`
  const n = facts.season - stint.from + 1
  const shape = (facts.id ?? 0) % 3
  if (shape === 1) return `${name} joined ${club} in ${stint.from} and ${did}.`
  if (shape === 2 && n > 1) return `${name} leaves ${club} after ${SEASONS[n] ?? n} seasons, in which he ${did}.`
  return `${name} had been with ${club} since ${stint.from}, and in that time he ${did}.`
}

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
  if (template === 'sold') return [soldStory(facts, ctx)].filter(Boolean)
  if (template === 'il-placed' || template === 'il-activated') {
    const note = injuredStory(facts, { placed: template === 'il-placed', moveDate: ctx.moveDate, clause: ctx.clause ?? '' })
    return note ? [note] : []
  }
  const note = CALLS.has(template) ? callStory(facts, { kind: template, moveDate: ctx.moveDate })
    : template === 'retired' ? retiredStory(facts) : template === 'arrival' ? arrivalStory(facts) : null
  if (note) return [note]

  return []
}
