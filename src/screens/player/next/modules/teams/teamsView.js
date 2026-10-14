// Team history's pure view (#2019): the season ledger over teamSeasonsView (api/person.js), which
// already applies the app's floors (a short stint drops, a post-debut one under the rehab cap is
// flagged). This adds the games, the short names, the trade chips, the rehab note, the run folding
// and "Here now". Years come from the splits and the season prop, never the clock.

const span = (a, b) => (a === b ? `${a}` : `${a}–${String(b).slice(2)}`)
const listWords = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const gamesText = (g) => (g ? `${g} G` : '—')
const md = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}/${date.slice(2, 4)}`

// "Nashville Sounds" + "Sounds" -> "Nashville"; a big-league club reads as its nickname ("Brewers").
// A name that does not end in the nickname (a renamed club, "AZL Brewers") stays whole.
export function shortName(name, nick, mlb) {
  if (!nick) return name
  if (mlb) return nick
  return name.endsWith(` ${nick}`) && name.length > nick.length + 1 ? name.slice(0, -nick.length - 1) : name
}

function gamesBy(splits) {
  const out = new Map()
  for (const s of splits ?? []) {
    if (!s.team?.id) continue
    const key = `${Number(s.season)}|${s.team.id}`
    out.set(key, (out.get(key) ?? 0) + (Number(s.stat?.gamesPlayed) || 0))
  }
  return out
}

// `ledger`: teamSeasonsView's result. `nick(teamId)`: the club's nickname, or undefined.
// `trades`: his TR transaction rows. `currentTeamId`: null on a dated page.
export function teamsView({ ledger, splits, trades = [], nick = () => undefined, currentTeamId = null, season, asOfSeason }) {
  const seasons = (ledger?.seasons ?? []).filter((s) => !asOfSeason || s.season <= asOfSeason)
  if (!seasons.some((s) => s.stints)) return null
  const games = gamesBy(splits)
  const name = (x) => shortName(x.teamName, nick(x.teamId), x.sportId === 1)

  const rows = seasons.map(({ season: y, stints, noSeason }) => {
    if (noSeason) return { years: `${y}`, from: y, to: y, noSeason: true, text: 'No minor league season.', items: [] }
    const g = (x) => games.get(`${y}|${x.teamId}`) ?? 0
    let real = stints.filter((x) => !x.rehab)
    const rehab = stints.filter((x) => x.rehab)
    const items = []
    const moves = trades.filter((t) => t.date?.startsWith(`${y}-`))
    // Old org first, then a chip before the first stint with the new one. ponytail: one trade per season orders the badges.
    if (moves[0]) real = [...real].sort((a, b) => (b.orgId === moves[0].fromTeam?.id) - (a.orgId === moves[0].fromTeam?.id))
    for (const x of real) {
      for (const t of moves) if (x.orgId === t.toTeam?.id && !items.some((i) => i.t === t)) items.push({ kind: 'trade', t, to: t.toTeam.id, date: md(t.date) })
      const orgNick = x.sportId !== 1 && x.orgId ? nick(x.orgId) : null
      items.push({
        kind: 'badge',
        teamId: x.teamId,
        mlb: x.sportId === 1,
        name: name(x),
        full: x.teamName,
        level: x.level,
        games: g(x),
        sub: `${x.level || '—'} · ${gamesText(g(x))}`,
        flip: orgNick ? { teamId: x.orgId, name: orgNick, sub: `${x.level} affiliate` } : null,
      })
    }
    for (const t of moves) if (!items.some((i) => i.t === t)) items.push({ kind: 'trade', t, to: t.toTeam?.id, date: md(t.date) })
    const rg = rehab.reduce((n, x) => n + g(x), 0)
    const note = rehab.length
      ? `Rehab ${rehab.length > 1 ? 'stints' : 'stint'}: ${listWords(rehab.map(name))}${rg ? `, ${rg} G` : ''}.`
      : null
    return { years: `${y}`, from: y, to: y, items, note }
  })

  // Fold a run of identical big-league-only seasons ("2024–26"): no note, no trade, same clubs.
  const key = (r) => !r.noSeason && !r.note && r.items.every((i) => i.kind === 'badge' && i.mlb) && r.items.map((i) => i.teamId).join()
  const folded = []
  for (const r of rows) {
    const prev = folded.at(-1)
    if (prev && key(r) && key(prev) === key(r) && prev.to + 1 === r.from) {
      prev.to = r.to
      prev.years = span(prev.from, r.to)
      prev.items = prev.items.map((b, i) => {
        const games = b.games + r.items[i].games
        return { ...b, games, sub: `${b.level} · ${gamesText(games)}` }
      })
    } else folded.push({ ...r })
  }

  const last = folded.at(-1)
  const nowAt = currentTeamId && (!season || last.to >= season - 1) ? last.items.findIndex((i) => i.kind === 'badge' && i.teamId === currentTeamId) : -1
  if (nowAt >= 0) {
    last.items = last.items.map((b, i) => (i === nowAt ? { ...b, cur: true } : b))
    last.here = true
  }
  const clubs = new Set(folded.flatMap((r) => r.items.filter((i) => i.kind === 'badge').map((i) => i.teamId))).size
  return { rows: folded, count: `${clubs} ${clubs === 1 ? 'club' : 'clubs'}` }
}

// A relative's line, "LF · Mariners · 1993–94 · 78 G", from his MLB year-by-year splits.
export function relativeLine(pos, splits, nick) {
  const rows = (splits ?? []).filter((s) => s.team?.id)
  if (!rows.length) return pos || ''
  const byTeam = new Map()
  for (const s of rows) byTeam.set(s.team.id, (byTeam.get(s.team.id) ?? 0) + (Number(s.stat?.gamesPlayed) || 0))
  const [top] = [...byTeam].sort((a, b) => b[1] - a[1])[0]
  const ys = rows.map((s) => Number(s.season))
  const g = [...byTeam.values()].reduce((a, b) => a + b, 0)
  return [pos, nick(top), span(Math.min(...ys), Math.max(...ys)), gamesText(g)].filter(Boolean).join(' · ')
}
