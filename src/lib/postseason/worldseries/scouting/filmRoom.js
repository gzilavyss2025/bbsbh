// The Film room card's model (#2316): the clubs' past regular-season meetings, ready to draw.
// Pure. The meetings come from api/postseason/meetings.js, already cut off the day before the
// slate date (ADR-0087, ADR-0117, selectMeetings), so every number here is open.
import { teamClubNameShort } from '../../../teams.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i

// 'Luis Garcia Jr.' -> 'Garcia'
export const surnameOf = (name) => name.split(' ').filter((w) => !SUFFIX.test(w)).at(-1) ?? ''

// 'Luis Garcia Jr.' -> 'Garcia, Luis'; a one-word name stays as it is.
export function listNameOf(name) {
  const words = name.split(' ').filter((w) => !SUFFIX.test(w))
  return words.length < 2 ? (words[0] ?? '') : `${words.at(-1)}, ${words.slice(0, -1).join(' ')}`
}

// 'T1' -> { tag: '▲1', half: 'top', num: '1' }, 'B6' -> { tag: '▼6', ... }: the arrow the box score's scoring
// summary uses (▲ top, ▼ bottom).
function inningTag(inning) {
  const top = inning.startsWith('T')
  return { tag: `${top ? '▲' : '▼'}${inning.slice(1)}`, half: top ? 'top' : 'bottom', num: inning.slice(1) }
}

// 'Mon Aug 4' from 'YYYY-MM-DD'; '' for a date that is not one.
function dayLabel(date) {
  const d = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? '' : `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

// { FF: 52, SL: 30 } -> [{ code, pct }] biggest first, percents summing to 100
// (largest remainder). [] for an empty mix.
function mixPercents(mix) {
  const entries = Object.entries(mix ?? {})
  const total = entries.reduce((n, [, c]) => n + c, 0)
  if (!total) return []
  const rows = entries.map(([code, c]) => ({ code, c, pct: Math.floor((c * 100) / total), rem: (c * 100) % total }))
  const byRem = [...rows].sort((a, b) => b.rem - a.rem || b.c - a.c || a.code.localeCompare(b.code))
  const left = 100 - rows.reduce((n, r) => n + r.pct, 0)
  for (let i = 0; i < left; i++) byRem[i].pct++
  return rows.sort((a, b) => b.pct - a.pct || a.code.localeCompare(b.code)).map(({ code, pct }) => ({ code, pct }))
}

function starterOf(side) {
  const s = side.starter
  if (!s?.id) return null
  const line = [
    s.ip != null && `${s.ip} IP`,
    s.h != null && `${s.h} H`,
    s.er != null && `${s.er} ER`,
    s.bb != null && `${s.bb} BB`,
    s.k != null && `${s.k} K`,
    s.pitches != null && `${s.pitches} P`,
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    id: s.id,
    abbr: side.abbr,
    name: s.name,
    surname: surnameOf(s.name),
    listName: listNameOf(s.name),
    hand: s.hand ? `${s.hand}HP` : '',
    line,
    // The same line as seven cells (a missing figure stays a cell, so the two arms line up).
    stats: [['IP', s.ip], ['H', s.h], ['R', s.r], ['ER', s.er], ['BB', s.bb], ['K', s.k], ['P', s.pitches]].map(([label, value]) => ({ label, value: value ?? null })),
    mix: mixPercents(s.mix),
  }
}

// -> one entry per meeting, oldest first (the order handed in):
// { gamePk, date, gameNumber, day, ump, awayAbbr, homeAbbr, rows: [{ id, abbr, runs, hits, errors, win }],
//   innings: [{ abbr, runs: [n | null] }] (one row per club, one cell per inning; [] with no linescore),
//   decisions, starters: [{ id, abbr, name, surname, listName, hand, line, stats: [{ label, value }], mix: [{ code, pct }] }],
//   scoring?: [{ inning, tag, half, num, text }], lineups? }  (the last two only when not `compact`)
export function filmRoomModel(meetings, { compact = false } = {}) {
  return (meetings ?? []).map((m) => {
    const sides = [m.away, m.home]
    const top = Math.max(...sides.map((s) => s.runs ?? -1))
    const { w, l, s } = m.decisions
    const out = {
      gamePk: m.gamePk,
      date: m.date,
      gameNumber: m.gameNumber ?? 1,
      day: dayLabel(m.date),
      ump: m.ump,
      awayAbbr: m.away.abbr,
      homeAbbr: m.home.abbr,
      rows: sides.map((x) => ({ id: x.id, abbr: x.abbr, runs: x.runs, hits: x.hits, errors: x.errors, win: x.runs != null && x.runs === top && sides.filter((y) => y.runs === top).length === 1 })),
      innings: (m.innings ?? []).length ? sides.map((x, i) => ({ abbr: x.abbr, runs: m.innings.map((inn) => inn[i] ?? null) })) : [],
      decisions: [w && `W ${w}`, l && `L ${l}`, s && `SV ${s}`].filter(Boolean).join(' · '),
      starters: sides.map(starterOf).filter(Boolean),
    }
    if (!compact) {
      out.scoring = (m.scoring ?? []).map((p) => ({ ...p, ...inningTag(p.inning) }))
      out.lineups = sides.map((x) => ({ abbr: x.abbr, players: x.lineup }))
    }
    return out
  })
}

// "Brewers 2-1": the club's wins and losses in these meetings.
export function filmRoomNote(meetings, clubId) {
  if (!meetings?.length) return ''
  let w = 0
  let l = 0
  for (const m of meetings) {
    const mine = [m.away, m.home].find((s) => s.id === clubId)
    const theirs = [m.away, m.home].find((s) => s.id !== clubId)
    if (mine?.runs == null || theirs?.runs == null) continue
    if (mine.runs > theirs.runs) w++
    else if (mine.runs < theirs.runs) l++
  }
  return `${teamClubNameShort(clubId)} ${w}-${l}`
}
