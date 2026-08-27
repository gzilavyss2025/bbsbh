// Grouping, the bulk rule, and patch composition for the historical-contract
// identity workbench (/admin/contracts, ADR-0066). Pure: no React, no fetch,
// no DOM. The page file owns every side effect; this file owns the rules a
// reviewer's keystroke and a reviewer's button click have to agree on, so the
// two paths can never resolve a group two different ways.
//
// WHY GROUP AT ALL. The pending queue repeats itself. One misspelling in one
// source file yields one row per season that player appears in, so most of the
// backlog is the same question asked over and over. Grouping asks it once.
//
// NOTHING HERE IS SCORE-BEARING — historical contract records and MLB ids only.

// The three review MODES. They are NOT the three confidence tiers, and that
// difference is the whole design: the matcher already picked somebody for
// every `fuzzy` row (a non-null mlbId, and an empty candidate list), so a
// fuzzy row has nothing to rank and everything to confirm. `ambiguous` and
// `unresolved`-with-candidates ask the identical question — which of these two
// or three people is it — so they are reviewed on one screen. What is left
// over is the cold set: no id, no shortlist, nothing but a name and a season.
export const MODE_CONFIRM = 'confirm'
export const MODE_CHOOSE = 'choose'
export const MODE_COLD = 'cold'
export const MODES = [MODE_CONFIRM, MODE_CHOOSE, MODE_COLD]

export const MODE_LABEL = {
  [MODE_CONFIRM]: 'Confirm',
  [MODE_CHOOSE]: 'Choose',
  [MODE_COLD]: 'Cold',
}

export function modeForRow(row) {
  if (row?.confidence === 'fuzzy') return MODE_CONFIRM
  if (row?.candidates?.length) return MODE_CHOOSE
  return MODE_COLD
}

// Confidence is IN the key on purpose. Without it a couple of names carry rows
// in two different tiers, and one group would then straddle two tabs — its
// mode would depend on which of its rows happened to be read first.
export function groupKeyFor(row) {
  return `${row.sourceFile}|${row.confidence}|${row.rawName}`
}

// A group's mode when its rows disagree: confirm outranks choose outranks
// cold. Rows only disagree inside `unresolved` (one season had a shortlist,
// another had an empty pool), and the answer a reviewer gives is the same
// person either way — so show the shortlist rather than hide it.
function modeForRows(rows) {
  if (rows.some((r) => modeForRow(r) === MODE_CONFIRM)) return MODE_CONFIRM
  if (rows.some((r) => modeForRow(r) === MODE_CHOOSE)) return MODE_CHOOSE
  return MODE_COLD
}

function distinctMlbIds(rows) {
  const ids = []
  for (const row of rows) {
    if (row.mlbId != null && !ids.includes(row.mlbId)) ids.push(row.mlbId)
  }
  return ids.sort((a, b) => a - b)
}

// Every candidate any row in the group offered, deduped by id, ranked by the
// BEST score any row gave it, and labelled with how many of the group's rows
// named it. A candidate list that differs row to row is expected, not a
// warning: each row was matched against its own season's roster, so somebody
// who was not on a 1994 roster cannot appear in the 1994 row's shortlist.
export function unionCandidates(rows) {
  const byId = new Map()
  for (const row of rows) {
    const seen = new Set()
    for (const c of row.candidates ?? []) {
      const prev = byId.get(c.id)
      if (!prev) {
        byId.set(c.id, {
          id: c.id,
          lastFirstName: c.lastFirstName,
          score: c.score ?? 0,
          reasons: [...(c.reasons ?? [])],
          inRows: 1,
          ofRows: rows.length,
        })
      } else {
        if (!seen.has(c.id)) prev.inRows += 1
        if ((c.score ?? 0) > prev.score) {
          prev.score = c.score ?? 0
          prev.lastFirstName = c.lastFirstName
        }
        for (const reason of c.reasons ?? []) {
          if (!prev.reasons.includes(reason)) prev.reasons.push(reason)
        }
      }
      seen.add(c.id)
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score || a.id - b.id)
}

// THE BULK RULE, and it reads differently in each mode.
//
//   confirm — offered ONLY when every row in the group carries the same
//     mlbId. A few groups disagree, and a disagreement is real information:
//     same-named rows in one file that the matcher sent to two different
//     people. Those get per-row actions and a banner naming the ids, never a
//     single button that would quietly pick one of them for all of them.
//   choose  — ALWAYS offered. See unionCandidates above for why differing
//     shortlists do not mean a different person.
//   cold    — the only thing there is to say in bulk is "no match exists".
export function bulkPlan(group) {
  const rows = group.rows ?? []
  if (group.mode === MODE_CONFIRM) {
    const ids = distinctMlbIds(rows)
    if (ids.length === 1) {
      return { offered: true, action: 'confirm', conflictIds: [], candidates: [] }
    }
    return { offered: false, action: null, conflictIds: ids, candidates: [] }
  }
  if (group.mode === MODE_CHOOSE) {
    return {
      offered: true,
      action: 'candidate',
      conflictIds: [],
      candidates: unionCandidates(rows),
    }
  }
  return { offered: true, action: 'dismiss', conflictIds: [], candidates: [] }
}

export function buildGroups(rows) {
  const byKey = new Map()
  for (const row of rows ?? []) {
    const key = groupKeyFor(row)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(row)
  }
  const groups = [...byKey.entries()].map(([key, groupRows]) => {
    const seasons = groupRows.map((r) => r.season).filter((s) => s != null)
    const group = {
      key,
      sourceFile: groupRows[0].sourceFile,
      confidence: groupRows[0].confidence,
      rawName: groupRows[0].rawName,
      rows: groupRows,
      count: groupRows.length,
      mode: modeForRows(groupRows),
      mlbIds: distinctMlbIds(groupRows),
      firstSeason: seasons.length ? Math.min(...seasons) : null,
      lastSeason: seasons.length ? Math.max(...seasons) : null,
    }
    group.bulk = bulkPlan(group)
    return group
  })
  // Biggest first: the group that answers a dozen rows at once is worth more
  // of a reviewer's attention than the one that answers a single row. `key`
  // breaks whatever ties remain, so queue order never depends on the order
  // rows happened to arrive in.
  return groups.sort(
    (a, b) =>
      b.count - a.count ||
      (a.rawName < b.rawName ? -1 : a.rawName > b.rawName ? 1 : 0) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
}

export function isRowResolved(row, overrides) {
  return Boolean(overrides?.[row.rowKey])
}

export function isGroupResolved(group, overrides) {
  return (group.rows ?? []).every((row) => isRowResolved(row, overrides))
}

export function openRows(group, overrides) {
  return (group.rows ?? []).filter((row) => !isRowResolved(row, overrides))
}

export function tierCounts(groups, overrides) {
  const counts = {}
  for (const mode of MODES) counts[mode] = { groups: 0, rows: 0, open: 0, openGroups: 0 }
  for (const group of groups) {
    const bucket = counts[group.mode]
    if (!bucket) continue
    bucket.groups += 1
    bucket.rows += group.count
    const open = openRows(group, overrides).length
    bucket.open += open
    if (open > 0) bucket.openGroups += 1
  }
  return counts
}

// ---- Patch composition -----------------------------------------------------
//
// Every action is ONE patch naming every rowKey it touches, so a group is
// written inside a single request and can never land half-applied.
// `confidence: 'exact'` is the human confirmation; `originalConfidence` keeps
// the tier the automated pipeline had assigned, so a later audit can still
// tell a confirmed fuzzy match apart from a confirmed cold guess. A `null`
// value clears that row's override outright.

export function confirmPatch(rows) {
  const patch = {}
  for (const row of rows) {
    if (row.mlbId == null) continue
    patch[row.rowKey] = { mlbId: row.mlbId, confidence: 'exact', originalConfidence: 'fuzzy' }
  }
  return patch
}

export function candidatePatch(rows, mlbId) {
  const patch = {}
  for (const row of rows) {
    patch[row.rowKey] = { mlbId, confidence: 'exact', originalConfidence: row.confidence }
  }
  return patch
}

export function dismissPatch(rows) {
  const patch = {}
  for (const row of rows) patch[row.rowKey] = { dismissed: true }
  return patch
}

export function undoPatch(rows) {
  const patch = {}
  for (const row of rows) patch[row.rowKey] = null
  return patch
}
