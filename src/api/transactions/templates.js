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
import { apDate } from '../../lib/time/apDate.js'
import { an, gamesText, homers, ipText, nameAge, nowText, num, optionsSentence, optionsTail, ordinal, pickPhrase, roundPhrase, variant, word } from './voice.js'

// The player a move is about: the first face on the rail, else the first
// player the sentence names.
function subjectOf(story) {
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


// A short big-league stint: "pitched once", "pitched in 9 games", "played 9 games".
const playedText = (g, pitcher) => (pitcher ? `pitched ${TIMES[g] ?? `in ${g} games`}` : `played ${gamesText(g)}`)

// What he did, in words: "hit .212 with 26 homers in 125 games".
function didText(line, pitcher) {
  if (pitcher) return `posted ${an(line.era)} ${line.era} ERA over ${ipText(line.ip)} innings in ${gamesText(line.games)}`
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

// What he did in a minor-league season, after "posting" or "hitting".
function minorsText(line, pitcher) {
  return pitcher ? `posting ${an(line.era)} ${line.era} ERA over ${ipText(line.ip)} innings` : `hitting ${line.avg} with ${homers(line.hr)}`
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
  const played = g ? `${playedText(g, facts.pitcher)} for ${the(team)} in ${facts.season}` : facts.midSeason ? `has not played in the majors yet in ${facts.season}` : `did not play in the majors in ${facts.season}`
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

export function freeAgentStory(facts, moveDate = null) {
  const v = variant(facts, moveDate, 2)
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
      // The club list's first year is his debut.
      const all = new Set(facts.clubs.map((c) => c.teamId)).size === 1
      const s = sub({ cap: true })
      sentences.push(
        v === 0 || all
          ? `${s} has played ${num(facts.seasons)} seasons${all ? ', all' : ''} for ${clubList(facts)}.`
          : `A ${facts.seasons}-year veteran, ${s === 'He' ? 'he' : s} has played for ${clubList(facts)}.`,
      )
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
export function seasonSentence(facts, moveDate = null) {
  const rank = prospectPhrase(facts.prospect)
  const lead = nameAge(facts, variant(facts, moveDate, 2))
  const who = rank ? `${lead.replace(/,$/, '')}, ${rank},` : lead
  // A thin big-league season with a minor-league one: lead with where he
  // spent most of the year.
  // A trade's note stays as it read that day: his line up to the deal, for
  // the club he left.
  if (facts.trade?.line?.games && !mostlyMinors(facts)) {
    // The club only when it was his one club before the deal; a line across
    // two clubs is his season, not theirs.
    const before = new Set((facts.rows ?? []).filter((r) => r.season === facts.season && r.teamId !== facts.trade.toTeamId).map((r) => r.teamId))
    const club = before.size === 1 && before.has(facts.trade.fromTeamId) ? ` for ${the(facts.trade.fromTeamId)}` : ''
    return `${who} ${beforeText(facts.trade.line, facts.pitcher)}${club}.`
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
  return facts.midSeason ? `${who} has not played yet in ${facts.season}.` : `${who} did not play in ${facts.season}.`
}

// "in Double-A with the Biloxi Shuckers", or "across High-A and Double-A".
function minorsWhere(m) {
  if (m.team) return `in ${m.level[0]} with the ${m.team}`
  return m.level.length > 1 ? `across ${m.level.slice(0, -1).join(', ')} and ${m.level[m.level.length - 1]}` : `in ${m.level[0]}`
}


// WHERE HE CAME FROM — a minor leaguer's origin: the club that drafted him
// (round and school) or signed him, then each trade or claim since, up to the
// move on the card. "Robinson was the Athletics' 11th-round pick out of Texas
// Tech in 2024, and the Pirates got him in a May 16 trade."
function originSentence(facts, name, moveDate) {
  const before = facts.arrivals.filter((a) => !moveDate || daysBetween(a.date, moveDate) > 1)
  const parts = []
  const d = facts.draft
  const school = d?.school ? ` out of ${d.school}` : ''
  if (d && roundPhrase(d.round) && variant(facts, moveDate, 2) === 1) parts.push(`${the(d.teamId)} drafted him in ${roundPhrase(d.round)}${school} in ${d.year}`)
  else if (d) parts.push(`${name} was ${the(d.teamId)}' ${pickPhrase(d.round)}${school} in ${d.year}`)
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
    ? `${name} has ${an(l.era)} ${l.era} ERA over ${ipText(l.ip)} innings in ${games}`
    : `${name} is a ${l.avg} hitter with ${homers(l.hr > 999 ? NUMBER.format(l.hr) : l.hr)} in ${games}`
  const now = facts.seasonLine?.games ?? 0
  const tail = now ? `, ${now === l.games ? 'all' : num(now)} of them in ${facts.season}` : `, none of them in ${facts.season}`
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
function moveSentence(facts, clause, v) {
  const o = optionsSentence(facts)
  const options = o ? ` ${o}` : ''
  if (/outright/i.test(clause)) {
    if (v === 0) return `He comes off the 40-man roster but stays in the organization.${options}`
    return `The move opens a 40-man spot; he stays in the organization.${options}`
  }
  if (/designated/i.test(clause)) return `He must now be traded, released or put on waivers.${options}`
  return null
}

export function cutStory(facts, { moveDate = null, clause = '' } = {}) {
  const v = variant(facts, moveDate, 2)
  const who = nameAge(facts, v)
  const first = arrivalSentence(facts, who, moveDate)
  // Named once: "Heuer, 30, came to ..." then "He has ...".
  const name = first ? (who.startsWith(facts.lastName ?? '\u0000') ? 'He' : facts.lastName ?? 'He') : who
  return [first, careerSentence(facts, name), facts.debut && minorsYearsSentence(facts), facts.debut ? lastFullSentence(facts) : null, moveSentence(facts, clause, v)].filter(Boolean).join(' ')
}

// A big leaguer stuck in the minors this year: his last two years down there.
function minorsYearsSentence({ minors: m, minorsPrev: p, pitcher, season, ...f }) {
  if (!mostlyMinors({ minors: m, ...f })) return null
  const prev = p?.line?.games ? `, after he ${didText(p.line, pitcher)} ${minorsWhere(p)} in ${season - 1}` : ''
  return `He ${didText(m.line, pitcher)} ${minorsWhere(m)} in ${season}${prev}.`
}

// THE INJURED LIST — the move's sentence already names the list, the injury
// and the call-up who took his spot (cutline.js), so the note adds what it
// cannot: his stints earlier in the season, how he was playing before this
// one, and on an activation, the time he missed.
const COUNT = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth']
const nth = (n) => COUNT[n] ?? `${n}th`
// The feed's injury note, set in parentheses as the move's own sentence does:
// no article to guess ("a left oblique strain", but not "a plantar fasciitis").
const lower = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t)

// "was hitting .281 with nine homers in 54 games" / "had a 3.40 ERA over 98 innings".
function beforeText(line, pitcher) {
  if (!line?.games) return null
  return pitcher
    ? `had ${an(line.era)} ${line.era} ERA over ${ipText(line.ip)} innings in ${gamesText(line.games)}`
    : `was hitting ${line.avg} with ${homers(line.hr)} in ${gamesText(line.games)}`
}

// Earlier seasons' trips, newest first, at most three: "He missed 40 days in
// 2025 (left oblique strain) and 22 days in 2023."
function pastTrips(stints) {
  // A trip the feed never closed has no length to give, so it is left out.
  const trips = [...(stints ?? [])].filter((x) => x.to).reverse().slice(0, 3).map((x) => {
    const injury = x.injury ? ` (${lower(x.injury)})` : ''
    return `${daysText(daysBetween(x.from, x.to))}${injury} in ${x.filings[0].slice(0, 4)}`
  })
  if (!trips.length) return null
  const list = trips.length > 1 ? `${trips.slice(0, -1).join(', ')} and ${trips[trips.length - 1]}` : trips[0]
  return `He missed ${list}.`
}

export function injuredStory(facts, { placed, moveDate = null, clause = '' }) {
  const stint = facts.stint
  if (!stint) return null
  const v = variant(facts, moveDate, 2)
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
      const missed = prev?.to ? `he missed ${daysText(daysBetween(prev.from, prev.to))} from ${apDate(prev.from)}${prev.injury ? ` (${lower(prev.injury)})` : ''}` : ''
      const head = v === 0 ? `It is his ${nth(at + 1)} injured-list stint this season` : `${nth(at + 1)[0].toUpperCase()}${nth(at + 1).slice(1)} trip to the list this season`
      out.push(`${head}${missed ? `; ${missed}` : ''}.`)
    } else {
      const past = pastTrips(facts.pastStints)
      if (past) out.push(past)
    }
  } else {
    const days = daysText(daysBetween(stint.from, stint.to))
    // A stint that ran past the season says "did not play in 2026" (a June return has no games yet either).
    const wholeSeason = facts.season && !facts.seasonLine?.games && !((stint.to ?? moveDate)?.slice(5, 7) < '10')
    let s = wholeSeason
      ? `${name} did not play in ${facts.season}`
      : v === 0 ? `${name} missed ${days}` : `${name} returns after missing ${days}`
    if (stint.injury) s += ` (${lower(stint.injury)})`
    if (at > 0) s += `, his ${nth(at + 1)} stint this season`
    out.push(`${s}.`)
    const before = beforeText(facts.beforeLine, facts.pitcher)
    if (before) out.push(v === 0 ? `He ${before} before it.` : `He ${before} when he went down.`)
  }
  return out.join(' ')
}

// A CALL — recalled, optioned or selected. A recall gives his minor-league
// line up to it and which trip up it is; an option, how the stint went and his
// options left. A selected contract is a first call-up when he has not
// debuted yet, and otherwise a trip up like a recall.
const daysText = (n) => (n === 1 ? 'one day' : `${num(n)} days`)
const near = (a, b) => Math.abs(daysBetween(a, b)) <= 1
function tripSentence(facts, moveDate) {
  const at = (facts.calls ?? []).findIndex((c) => c.up && near(c.up, moveDate))
  if (at < 0) return null
  const prev = facts.calls[at - 1]
  const lasted = prev?.up && prev.down ? daysText(daysBetween(prev.up, prev.down)) : null
  if (variant(facts, moveDate, 2) === 1) return `He is up for the ${nth(at + 1)} time this season${lasted ? `; his last stay lasted ${lasted}` : ''}.`
  return `It is his ${nth(at + 1)} trip up this season${lasted ? `; the last lasted ${lasted}` : ''}.`
}
// A player shuttling between the two (Blake Perkins, 2026) gets both lines in one.
const briefLine = (l, pitcher) => (pitcher ? `${an(l.era)} ${l.era} ERA` : `${l.avg}${l.hr ? ` with ${homers(l.hr)}` : ''}`) + ` in ${gamesText(l.games)}`
function beforeCallSentence(facts, who) {
  const m = facts.callLine
  const mlb = facts.callMlbLine
  if (m?.line?.games && mlb?.games) {
    const where = m.team ? `the ${m.team}` : m.level.join(' and ')
    return `${who} has split the season between ${where} (${briefLine(m.line, facts.pitcher)}) and the majors (${briefLine(mlb, facts.pitcher)}).`
  }
  return m?.line?.games ? `${who} ${nowText(m.line, facts.pitcher)} ${minorsWhere(m)}.` : null
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
// "Sproat gave up four earned runs in three innings against the Pirates on Aug. 3."
function lastGameSentence(facts, name, v) {
  const { date, oppId, line } = facts.lastGame
  const vs = oppId ? ` against ${the(oppId)}` : ''
  const when = `${vs} on ${apDate(date)}`
  const last = (what) => `In his last ${what}, ${apDate(date)}${vs}, `
  if (!facts.pitcher) {
    const did = `went ${line.h}-for-${line.ab}${line.hr ? ` with ${homers(line.hr)}` : ''}`
    return v === 0 ? `${name} ${did}${when}.` : `${last('game')}${name} ${did}.`
  }
  // Innings as a box score writes them, the thirds after the point ("2.1
  // innings"), like every other note (Gary, 2026-11-03). A whole inning count
  // reads as a word: "one inning", "three innings".
  const [whole, thirds] = String(line.ip).split('.').map(Number)
  const innings = thirds ? `${whole}.${thirds} innings` : `${num(whole)} inning${whole === 1 ? '' : 's'}`
  const runs = `${num(line.er)} earned run${line.er === 1 ? '' : 's'}`
  const did = !whole && !thirds ? `gave up ${runs} without retiring a batter` : line.er ? `gave up ${runs} in ${innings}` : `threw ${innings} without an earned run`
  return v === 0 ? `${name} ${did}${when}.` : `${last('outing')}${name} ${did}.`
}
const longDate = (iso) => `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
export function callStory(facts, { kind, moveDate }) {
  const name = facts.lastName ?? 'He'
  const v = variant(facts, moveDate, 3)
  if (facts.extraMan) {
    const c = (facts.calls ?? []).find((x) => x.up && (near(x.up, moveDate) || (x.down && near(x.down, moveDate))))
    const { event } = facts.extraMan
    const at = event ? `at the ${event}` : `in the ${c?.up ? `${longDate(c.up)} ` : ''}doubleheader`
    // No options line: the extra man's trip back is not an ordinary option.
    if (kind === 'option') return v === 0 ? `${name} was the 27th man ${at}.` : `${name} goes back down after a day as the 27th man ${at}.`
    return `${name} came up as the 27th man for the ${event ?? 'doubleheader'}${c?.down ? `${event ? ',' : ''} and went back down ${apDate(c.down)}` : ''}.`
  }
  // A send-down after time in the majors: his last game, then his season to
  // that day (Brandon Sproat, Aug. 4, 2026).
  if (kind === 'option' && facts.lastGame && facts.seasonToDate?.games) {
    const season = facts.pitcher
      ? `He ${nowText(facts.seasonToDate, true)} this season${optionsTail(facts)}.`
      : `He ${nowText(facts.seasonToDate, false)}${optionsTail(facts)}.`
    return [lastGameSentence(facts, name, v % 2), season].join(' ')
  }
  if (kind === 'option') {
    const c = (facts.calls ?? []).find((x) => x.down && near(x.down, moveDate))
    // No day count: a trip can hold a stint on the injured list.
    const line = facts.stintLine
    if (line?.games) return `${name} ${didText(line, facts.pitcher)} ${c?.up ? 'on this trip' : 'this season'}${optionsTail(facts)}.`
    if (c?.up) return `${name} did not ${facts.pitcher ? 'pitch' : 'play'} on this trip${optionsTail(facts)}.`
    return optionsSentence(facts) ?? ''
  }
  if (kind === 'selected' && (!facts.debut || facts.debut >= moveDate)) {
    const rank = prospectPhrase(facts.prospect)
    const lead = nameAge(facts, v % 2)
    const who = rank ? `${lead.replace(/,$/, '')}, ${rank},` : lead
    const head = ['It is his first call to the majors.', 'First call-up.', 'He gets his first call to the majors.'][v]
    return [head, beforeCallSentence(facts, who), originSentence(facts, name, moveDate)].filter(Boolean).join(' ')
  }
  return [beforeCallSentence(facts, name), tripSentence(facts, moveDate)].filter(Boolean).join(' ')
}

// A RETIREMENT — the career in one sentence: seasons, clubs, his line.
export function retiredStory(facts, moveDate = null) {
  const l = facts.careerLine
  if (!facts.debut || !l) return null
  const name = facts.lastName ?? 'He'
  const games = `${NUMBER.format(l.games)} games`
  const seasons = facts.seasons === 1 ? 'one season' : `${num(facts.seasons)} seasons`
  if (variant(facts, moveDate, 2) === 0) {
    const did = facts.pitcher ? `posted ${an(l.era)} ${l.era} ERA over ${ipText(l.ip)} innings` : `hit ${l.avg} with ${homers(l.hr)}`
    return `${name} ${did} in ${games} over ${seasons} with ${clubList(facts)}.`
  }
  const did = facts.pitcher ? `posting ${an(l.era)} ${l.era} ERA over ${ipText(l.ip)} innings in ${games}` : `hitting ${l.avg} with ${homers(l.hr)} in ${games}`
  return `${name} played ${seasons} in the majors for ${clubList(facts)}, ${did}.`
}

// AN ARRIVAL from outside affiliated ball — an independent club: where he
// comes from, then his last season in affiliated ball (or his big-league line).
export function arrivalStory(facts, moveDate = null) {
  const from = facts.arrival?.how === 'purchase' ? facts.arrival.fromName : null
  if (!from) return null
  const v = variant(facts, moveDate, 2)
  const who = nameAge(facts, v)
  const a = facts.affiliated
  const head = v === 0 ? `${who} comes from the independent ${from}.` : `${who} was bought from the independent ${from}.`
  const last = a ? `He last played in affiliated ball in ${a.season}${a.level ? `, in ${a.level}` : ''}.` : null
  return [head, last, facts.debut ? careerSentence(facts, 'He') : null].filter(Boolean).join(' ')
}

// The card's fact line: up to two short lines, or none for the fallback.
// The card's draft sentence, run on after the note: "The Padres drafted him
// out of Duke in the 13th round in 2022." Null for a player never drafted.
export function draftSentence(facts) {
  const d = facts?.draft
  if (!d) return null
  const club = the(d.teamId)
  const round = roundPhrase(d.round)
  return `${club[0].toUpperCase()}${club.slice(1)} drafted him${d.school ? ` out of ${d.school}` : ''}${round ? ` in ${round}${d.pick ? ` (${ordinal(d.pick)} overall)` : ''}` : ''} in ${d.year}.` // caps-js-exempt: sentence case
}

// A player traded away for cash (Easton McGee, July 14, 2026): his time with
// the club and his whole line for it, in one of three shapes (`variant`).
function soldStory(facts, { teamId, moveDate = null }) {
  const stint = (facts.clubs ?? []).filter((c) => c.teamId === teamId).at(-1)
  if (!stint) return null
  const name = facts.lastName ?? 'He'
  const club = the(teamId)
  const l = facts.clubTotals?.[teamId]
  if (!l?.games) return `${name} had been with ${club} since ${stint.from}.`
  const n = facts.season - stint.from + 1
  const shape = variant(facts, moveDate, 3)
  if (shape === 1) return `${name} joined ${club} in ${stint.from} and ${didText(l, facts.pitcher)} for them.`
  if (shape === 2 && n > 1) return `${name} leaves ${club} after ${num(n)} seasons, ${minorsText(l, facts.pitcher)} in ${gamesText(l.games)}.`
  return `${name} ${didText(l, facts.pitcher)} for ${club} since ${stint.from}.`
}

export { variant } from './voice.js'

export function factLines(template, facts, ctx = {}) {
  if (!facts || template === 'fallback') return []
  if (template === 'minor-deal' || template === 'trade') {
    const origin = facts.debut ? null : originSentence(facts, facts.lastName ?? 'He', ctx.moveDate)
    return [seasonSentence(facts, ctx.moveDate), origin].filter(Boolean)
  }
  if (template === 'free-agency' || template === 'signing') {
    return [freeAgentStory(facts, ctx.moveDate)]
  }
  if (template === 'cut') return [cutStory(facts, ctx)]
  if (template === 'sold') return [soldStory(facts, ctx)].filter(Boolean)
  if (template === 'il-placed' || template === 'il-activated') {
    const note = injuredStory(facts, { placed: template === 'il-placed', moveDate: ctx.moveDate, clause: ctx.clause ?? '' })
    return note ? [note] : []
  }
  const note = CALLS.has(template) ? callStory(facts, { kind: template, moveDate: ctx.moveDate })
    : template === 'retired' ? retiredStory(facts, ctx.moveDate) : template === 'arrival' ? arrivalStory(facts, ctx.moveDate) : null
  if (note) return [note]

  return []
}
