import { franchiseLedger } from './franchiseLedger.js'
import { pennantsFor } from './leaguePennants.js'

// A club's franchise summary (#2600), derived from its season ledger (#2595) and its pennants.
// No file of its own. Finished seasons only: the ledger stops the season before today's, while
// `pennants` is pennantsFor as it stands, so it can hold the current season's pennant.
//
// Winningest manager: each manager's w-l summed over the ledger seasons that carry it (a season
// he managed alone, or a shared season split by scripts/manager-transitions-seed.json). A shared
// season with no seed entry has no split on file, so it does not count. The manager data starts in
// 1969, so `managersFrom` names the first season counted and the screen says "since" it.

// Pure. -> { names: [{ name, from, to }], seasons: { from, to, count } | null, record: { w, l },
//   postseasons: [season], titles: [season], pennants, winningestManager: { id, name, w, l, seasons } | null,
//   managersFrom: season | null }
export function summarizeFranchise(rows, pennants) {
  const list = [...(rows ?? [])].sort((a, b) => a.season - b.season)
  const names = []
  const byManager = new Map()
  let managersFrom = null
  for (const r of list) {
    const last = names[names.length - 1]
    if (last?.name === r.name) last.to = r.season
    else names.push({ name: r.name, from: r.season, to: r.season })
    if (r.managers?.length && managersFrom == null) managersFrom = r.season
    for (const m of r.managers ?? []) {
      if (m.w == null || m.l == null) continue
      const t = byManager.get(m.id) ?? { id: m.id, name: m.name, w: 0, l: 0, seasons: 0 }
      t.w += m.w
      t.l += m.l
      t.seasons += 1
      byManager.set(m.id, t)
    }
  }
  const best = [...byManager.values()].sort((a, b) => b.w - a.w || a.l - b.l || a.id - b.id)[0] ?? null
  return {
    names,
    seasons: list.length ? { from: list[0].season, to: list[list.length - 1].season, count: list.length } : null,
    record: { w: list.reduce((t, r) => t + (r.w ?? 0), 0), l: list.reduce((t, r) => t + (r.l ?? 0), 0) },
    postseasons: list.filter((r) => r.postseason).map((r) => r.season),
    titles: list.filter((r) => r.postseason?.round === 'World Series' && r.postseason.won).map((r) => r.season),
    pennants: pennants ?? [],
    winningestManager: best,
    managersFrom,
  }
}

export async function franchiseSummary(teamId) {
  const [{ through, rows }, pennants] = await Promise.all([franchiseLedger(teamId), pennantsFor(teamId)])
  return { teamId: Number(teamId), through, ...summarizeFranchise(rows, pennants) }
}
