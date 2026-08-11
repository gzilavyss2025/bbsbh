// Joins related moves, in two strictly separate passes — because "related"
// covers two things that are not equally knowable.
//
//   Pass A — one player's moves on one day at one club. PROVABLE. The rows
//   share a person id; nothing is being guessed. A signing and the activation
//   that follows it are one arrival, and a claim followed by an option is one
//   arrival too.
//
//   Pass B — one club's remaining moves on one day. ORGANISATIONAL. These rows
//   share nothing but a club and a date. Presenting them together is a claim
//   about the page's layout, NOT a claim that one move caused another. The
//   moment a feed says "recalled X to replace Y" it has guessed, and the old
//   club-page pipeline is full of exactly that guess.
//
// Run: node .scratch/home-transactions/join-related.mjs [windowDays] [backtestDays]
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchContext, fetchWire, buildFeed, iso } from './wire.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const DAYS = Number(process.argv[2]) || 2
const BACKTEST_DAYS = Number(process.argv[3]) || 140
const today = new Date()
const season = today.getUTCFullYear()

const windowStart = iso(new Date(today.getTime() - (DAYS - 1) * 86400000))
const windowEnd = iso(today)
const backtestStart = iso(new Date(today.getTime() - (BACKTEST_DAYS - 1) * 86400000))
const fetchStart = iso(new Date(today.getTime() - (BACKTEST_DAYS + 5) * 86400000))

const ctx = await fetchContext(season)
const fetched = await fetchWire(fetchStart, windowEnd)
console.log(`fetched ${fetched.length} rows\n`)

// ---------------------------------------------------------------------------
// Pass A — a player's own chain.
// ---------------------------------------------------------------------------
// Keyed on club + player + day. The club has to be in the key: a player traded
// in the morning and optioned by his NEW club in the afternoon has two moves at
// two clubs, and folding them into one entry would put a Cincinnati move under
// a Cleveland heading.
function chainKey(line) {
  return `${line.date}|${line.club?.id ?? 'none'}|${line.personId ?? 'none'}`
}

function buildChains(feed) {
  const byKey = new Map()
  for (const line of feed) {
    // A line naming no player cannot chain — there is nothing to chain it on.
    const key = line.personId == null ? `${line.key}|solo` : chainKey(line)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(line)
  }
  const entries = []
  for (const [key, lines] of byKey) {
    // Wire order within the day: the id ascends as the day goes on, so a
    // signing precedes the activation that completes it.
    lines.sort((a, b) => (a.row.id ?? 0) - (b.row.id ?? 0))
    entries.push({
      key,
      date: lines[0].date,
      club: lines[0].club,
      personId: lines[0].personId,
      personName: lines[0].personName,
      lines,
      joined: lines.length > 1,
    })
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.lines[0].row.id ?? 0) - (b.lines[0].row.id ?? 0))
  return entries
}

// ---------------------------------------------------------------------------
// Pass B — a club's day.
// ---------------------------------------------------------------------------
// A two-club move (a trade, a waiver claim) is deliberately NOT filed under a
// club block: it belongs to both, and filing it under one would put a Mariners
// claim under a heading that says Mariners while the Rangers half vanishes.
// Those stand alone, tagged with both clubs, exactly as in the flat feed.
function buildClubDays(entries) {
  const days = new Map()
  for (const e of entries) {
    if (!days.has(e.date)) days.set(e.date, { date: e.date, clubs: new Map(), standalone: [] })
    const day = days.get(e.date)
    const isTwoClub = e.lines.some((l) => l.twoClubs)
    if (isTwoClub || !e.club) {
      day.standalone.push(e)
      continue
    }
    const id = e.club.id
    if (!day.clubs.has(id)) day.clubs.set(id, { club: e.club, entries: [] })
    day.clubs.get(id).entries.push(e)
  }
  return [...days.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((day) => ({
      date: day.date,
      standalone: day.standalone,
      clubs: [...day.clubs.values()].sort((a, b) => b.entries.length - a.entries.length || a.club.abbr.localeCompare(b.club.abbr)),
    }))
}

function summarise(label, base) {
  const entries = buildChains(base.feed)
  const clubDays = buildClubDays(entries)
  const chained = entries.filter((e) => e.joined)
  const blockSizes = clubDays.flatMap((d) => d.clubs.map((c) => c.entries.length))
  const result = {
    label,
    start: base.start,
    end: base.end,
    counts: {
      ...base.counts,
      entriesAfterChaining: entries.length,
      chainsFormed: chained.length,
      linesInsideChains: chained.reduce((n, e) => n + e.lines.length, 0),
      linesSavedByChaining: chained.reduce((n, e) => n + e.lines.length - 1, 0),
      clubBlocks: blockSizes.length,
      clubBlocksWithMoreThanOne: blockSizes.filter((s) => s > 1).length,
      biggestClubBlock: blockSizes.length ? Math.max(...blockSizes) : 0,
      standaloneEntries: clubDays.reduce((n, d) => n + d.standalone.length, 0),
    },
    // Chaining turns out to be a second de-duplication net, and this counts how
    // big a one. Rule 2 can only collapse rows that print the SAME sentence. A
    // player optioned to Toledo also gets "reassigned to the minor leagues" and
    // "roster status changed by Detroit Tigers" — three sentences, one demotion,
    // and no two of them are the same string. They only become visibly one event
    // once the player's rows sit together.
    echoes: (() => {
      const ECHO = /roster status changed|reassigned to the minor leagues/i
      const chainsWithEcho = chained.filter(
        (e) => e.lines.some((l) => ECHO.test(l.description || '')) && e.lines.some((l) => !ECHO.test(l.description || '')),
      )
      return {
        chains: chainsWithEcho.length,
        lines: chainsWithEcho.reduce((n, e) => n + e.lines.filter((l) => ECHO.test(l.description || '')).length, 0),
        examples: chainsWithEcho.slice(0, 4).map((e) => ({
          date: e.date, club: e.club, personName: e.personName,
          lines: e.lines.map((l) => ({ typeCode: l.typeCode, description: l.description })),
        })),
      }
    })(),
    chainKinds: (() => {
      const m = new Map()
      for (const e of chained) {
        const k = e.lines.map((l) => l.typeCode).join(' → ')
        m.set(k, (m.get(k) ?? 0) + 1)
      }
      return [...m].map(([kinds, n]) => ({ kinds, n })).sort((a, b) => b.n - a.n)
    })(),
    entries,
    clubDays,
  }
  return result
}

const windowBase = buildFeed(fetched, ctx, windowStart, windowEnd)
const backtestBase = buildFeed(fetched, ctx, backtestStart, windowEnd)
const windowJoined = summarise('window', windowBase)
const backtestJoined = summarise('backtest', backtestBase)

// The busiest single club-day in the backtest — the shape this layout has to
// survive on a deadline day, not on a quiet Monday.
const worstBlock = backtestJoined.clubDays
  .flatMap((d) => d.clubs.map((c) => ({ date: d.date, club: c.club, entries: c.entries })))
  .sort((a, b) => b.entries.length - a.entries.length)[0]

// Example chains worth printing on the page, longest first.
const exampleChains = backtestJoined.entries
  .filter((e) => e.joined)
  .sort((a, b) => b.lines.length - a.lines.length)
  .slice(0, 12)
  .map((e) => ({
    date: e.date,
    club: e.club,
    personName: e.personName,
    lines: e.lines.map((l) => ({ typeCode: l.typeCode, description: l.description })),
  }))

writeFileSync(join(here, 'joined.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  window: {
    start: windowJoined.start,
    end: windowJoined.end,
    counts: windowJoined.counts,
    chainKinds: windowJoined.chainKinds,
    echoes: windowJoined.echoes,
    entries: windowJoined.entries,
    clubDays: windowJoined.clubDays,
    byCode: windowBase.byCode,
  },
  backtest: {
    start: backtestJoined.start,
    end: backtestJoined.end,
    counts: backtestJoined.counts,
    chainKinds: backtestJoined.chainKinds,
    echoes: backtestJoined.echoes,
  },
  exampleChains,
  worstBlock: worstBlock && {
    date: worstBlock.date,
    club: worstBlock.club,
    entries: worstBlock.entries.map((e) => ({
      personName: e.personName,
      lines: e.lines.map((l) => ({ typeCode: l.typeCode, description: l.description })),
    })),
  },
}, null, 1))

for (const r of [windowJoined, backtestJoined]) {
  console.log(`--- ${r.label.toUpperCase()}  ${r.start} .. ${r.end} ---`)
  console.log(`  flat lines                 ${r.counts.printed}`)
  console.log(`  entries after chaining     ${r.counts.entriesAfterChaining}  (${r.counts.chainsFormed} chains absorbed ${r.counts.linesSavedByChaining} lines)`)
  console.log(`  club blocks                ${r.counts.clubBlocks}, of which more than one entry: ${r.counts.clubBlocksWithMoreThanOne}`)
  console.log(`  biggest club block         ${r.counts.biggestClubBlock} entries`)
  console.log(`  standalone (two-club)      ${r.counts.standaloneEntries}`)
  console.log('  chain shapes:')
  for (const k of r.chainKinds.slice(0, 8)) console.log(`     ${String(k.n).padStart(4)}  ${k.kinds}`)
  console.log()
}
console.log('wrote joined.json')
