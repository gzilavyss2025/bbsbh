// Pulls the last N days (default 21) of league-wide transactions and runs them
// through the EXACT pipeline the Team Transactions card uses
// (src/api/teamTransactions.js, imported — not re-implemented), then writes a
// full trace to window.json for the report page to render.
//
// The question this exists to answer: what would a HOME-PAGE transaction log
// show, and where would it duplicate or misreport a move? So the trace records,
// for every raw row: its verbatim API fields, which MLB orgs claim it, whether
// dedupe collapsed it, whether the noise filter dropped it (and by which gate),
// which story it landed in, and what prose that story printed.
//
// Run: node .scratch/home-transactions/pull-window.mjs [days]
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../src/api/statsapi.js'
import {
  bucketToOrg,
  dedupeTransactions,
  filterStoryworthy,
  groupIntoStories,
} from '../../src/api/teamTransactions.js'

const here = dirname(fileURLToPath(import.meta.url))
const DAYS = Number(process.argv[2]) || 21
const iso = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const startDate = iso(new Date(today.getTime() - DAYS * 86400000))
const endDate = iso(today)
const season = today.getUTCFullYear()

console.log(`window ${startDate} .. ${endDate} (${DAYS} days)`)

// ---------------------------------------------------------------------------
// Fetch — the same four calls gen-team-transactions.mjs makes.
// ---------------------------------------------------------------------------
const orgTeams = (await getJson('/api/v1/teams?sportId=1')).teams ?? []
const orgIds = orgTeams.map((t) => t.id)
const orgById = new Map(orgTeams.map((t) => [t.id, t]))

const affilData = await getJson(`/api/v1/teams/affiliates?teamIds=${orgIds.join(',')}&season=${season}`)
const affilToOrg = new Map()
const affilById = new Map()
for (const t of affilData.teams ?? []) {
  affilById.set(t.id, t)
  if (t.id != null && t.parentOrgId != null) affilToOrg.set(t.id, t.parentOrgId)
}

const raw = (await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)).transactions ?? []
console.log(`raw rows: ${raw.length}`)

// One batched /people pass — positions + who has ever played in an MLB game.
const personIds = [...new Set(raw.map((t) => t.person?.id).filter(Boolean))]
const people = new Map()
const positions = {}
const debutedIds = new Set()
for (let i = 0; i < personIds.length; i += 100) {
  const batch = personIds.slice(i, i + 100)
  const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}`)
  for (const p of data.people ?? []) {
    people.set(p.id, p)
    positions[p.id] = p.primaryPosition?.abbreviation || ''
    if (p.mlbDebutDate) debutedIds.add(p.id)
  }
}
console.log(`people resolved: ${people.size} of ${personIds.length}`)

// ---------------------------------------------------------------------------
// Row identity. The feed's own `id` repeats across a trade's two-perspective
// mirror, so a trace key needs the row's own position in the response too.
// ---------------------------------------------------------------------------
const rowKey = new Map()
raw.forEach((t, i) => rowKey.set(t, `${t.id ?? 'x'}#${i}`))
const key = (t) => rowKey.get(t)
const txnDate = (t) => t.effectiveDate || t.date || ''

// ---------------------------------------------------------------------------
// Per-org run of the real pipeline, recording what happened at each stage.
// ---------------------------------------------------------------------------
const trace = new Map() // rowKey -> { row, orgs: [{orgId, stage, ...}] }
for (const t of raw) trace.set(key(t), { row: t, orgs: [] })

const orgRuns = []
for (const orgId of orgIds) {
  const bucketed = bucketToOrg(raw, orgId, affilToOrg)
  const deduped = dedupeTransactions(bucketed)
  const dedupedSet = new Set(deduped.map(key))
  const kept = filterStoryworthy(deduped, { orgId, debutedIds })
  const keptSet = new Set(kept.map(key))
  const days = groupIntoStories(kept, { positions, orgId, debutedIds })

  // Story <- row association. groupIntoStories returns shaped stories with no
  // back-pointer to their rows, so rows are matched to a story by (date,
  // personId) against the union of that story's rail + cutline playerIds. The
  // method's own failures are reported rather than hidden: a kept row matching
  // NO story is a row the pipeline silently swallowed; matching more than one
  // is an association this trace can't resolve.
  const storyIndex = []
  for (const day of days) {
    for (const story of day.stories) {
      const ids = new Set()
      for (const slot of story.rail) if (slot.playerId != null) ids.add(slot.playerId)
      for (const seg of story.cutline) if (seg.playerId != null) ids.add(seg.playerId)
      storyIndex.push({ date: day.date, story, playerIds: ids })
    }
  }

  for (const t of bucketed) {
    const entry = trace.get(key(t))
    const inDedupe = dedupedSet.has(key(t))
    const inKept = keptSet.has(key(t))
    let storyId = null
    let matches = 0
    if (inKept) {
      const d = txnDate(t)
      const pid = t.person?.id
      for (const s of storyIndex) {
        if (s.date !== d) continue
        if (pid != null && s.playerIds.has(pid)) {
          matches += 1
          if (!storyId) storyId = s.story.id
        }
      }
    }
    entry.orgs.push({
      orgId,
      collapsedByDedupe: !inDedupe,
      droppedByFilter: inDedupe && !inKept,
      storyId,
      storyMatches: matches,
    })
  }

  orgRuns.push({
    orgId,
    orgName: orgById.get(orgId)?.name ?? String(orgId),
    orgAbbr: orgById.get(orgId)?.abbreviation ?? '',
    counts: {
      bucketed: bucketed.length,
      deduped: deduped.length,
      kept: kept.length,
      days: days.length,
      stories: days.reduce((n, d) => n + d.stories.length, 0),
    },
    days,
  })
}

// ---------------------------------------------------------------------------
// Why was a row dropped? Re-derives the noise filter's own gates so the report
// can name the reason instead of only the fact. Mirrors filterStoryworthy's
// conditions in the same order it applies them.
// ---------------------------------------------------------------------------
const STORY_WORTHY_CODES = new Set([
  'TR', 'SFA', 'SGN', 'IFA', 'SE', 'CU', 'OPT', 'OUT', 'DES', 'REL', 'URL',
  'CLW', 'PUR', 'WA', 'RET', 'SU', 'DFA',
])
const SIGNING_CODES = new Set(['SFA', 'SGN', 'IFA'])
const mentionsIl = (t) => /injured list|disabled list/i.test(t.description || '')
const isIlRow = (t) =>
  t.typeCode === 'SC' && mentionsIl(t) &&
  (/placed/i.test(t.description || '') || /transferred/i.test(t.description || '') ||
    (/activat/i.test(t.description || '') && !/all-stars? activated/i.test(t.description || '')))

function dropReason(t, orgId) {
  if (t.typeCode !== 'DFA' && t.fromTeam?.id !== orgId && t.toTeam?.id !== orgId) {
    return 'affiliate-only (never touches the MLB club directly)'
  }
  if (SIGNING_CODES.has(t.typeCode) && t.person?.id != null && !debutedIds.has(t.person.id)) {
    return 'signing of a player with no MLB debut on file'
  }
  if (t.typeCode === 'SC') return isIlRow(t) ? null : 'status change that is not an injured-list move'
  if (!STORY_WORTHY_CODES.has(t.typeCode)) return `typeCode ${t.typeCode} is not on the story whitelist`
  return 'unknown'
}

// ---------------------------------------------------------------------------
// The home-feed simulation: every org's stories merged into one league feed,
// then de-duplicated on the story's own identity minus its org prefix
// (`{orgId}-{date}-{type}-{anchorRowId}`), which is what makes a trade logged
// by both clubs show up twice.
// ---------------------------------------------------------------------------
const feedByKey = new Map()
for (const run of orgRuns) {
  for (const day of run.days) {
    for (const story of day.stories) {
      const k = story.id.slice(String(run.orgId).length + 1) // drop the "{orgId}-" prefix
      if (!feedByKey.has(k)) feedByKey.set(k, { key: k, date: day.date, copies: [] })
      feedByKey.get(k).copies.push({ orgId: run.orgId, orgAbbr: run.orgAbbr, story })
    }
  }
}
const feed = [...feedByKey.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

// Per-day counts, and how much of the feed is a cross-org duplicate.
const byDay = new Map()
for (const item of feed) {
  if (!byDay.has(item.date)) byDay.set(item.date, { date: item.date, unique: 0, copies: 0 })
  const d = byDay.get(item.date)
  d.unique += 1
  d.copies += item.copies.length
}

// ---------------------------------------------------------------------------
// Correctness audit — heuristics that flag a story likely to READ wrong.
// ---------------------------------------------------------------------------
const cutlineText = (segs) => segs.map((s) => s.text).join('')
const flags = []
function flag(kind, detail, ref) {
  flags.push({ kind, detail, ...ref })
}

for (const run of orgRuns) {
  for (const day of run.days) {
    for (const story of day.stories) {
      const text = cutlineText(story.cutline)
      const railIds = story.rail.map((s) => s.playerId)
      if (!text.trim() || text.trim() === '.') {
        flag('empty cutline', 'the story printed no prose at all', { orgId: run.orgId, storyId: story.id })
      }
      if (!story.cutline.some((s) => s.playerId)) {
        flag('no linked player', `no name in the cutline is a link: "${text}"`, { orgId: run.orgId, storyId: story.id })
      }
      for (const slot of story.rail) {
        if (!slot.playerId) flag('rail slot with no player id', `banner "${slot.banner}"`, { orgId: run.orgId, storyId: story.id })
        if (!slot.surname) flag('rail slot with no name', `banner "${slot.banner}"`, { orgId: run.orgId, storyId: story.id })
        if (!slot.pos) flag('rail slot with no position', `${slot.name || '(unnamed)'}`, { orgId: run.orgId, storyId: story.id })
      }
      // A player pictured in the rail whose name never appears in the prose.
      for (const slot of story.rail) {
        if (slot.name && !text.includes(slot.name) && !text.includes(slot.surname)) {
          flag('pictured but not mentioned', `${slot.name} is in the rail, absent from: "${text}"`, { orgId: run.orgId, storyId: story.id })
        }
      }
      if (/\bundefined\b|\bnull\b|\s{2,}|\s\./.test(text)) {
        flag('malformed prose', `"${text}"`, { orgId: run.orgId, storyId: story.id })
      }
      if (new Set(railIds.filter(Boolean)).size !== railIds.filter(Boolean).length) {
        flag('same player twice in one rail', text, { orgId: run.orgId, storyId: story.id })
      }
      if (text.length > 320) {
        flag('very long cutline', `${text.length} characters`, { orgId: run.orgId, storyId: story.id })
      }
    }
  }
}

// Rows the trace could not tie to any story, and rows tied to several.
let swallowed = 0
let ambiguous = 0
const swallowedRows = []
for (const entry of trace.values()) {
  for (const o of entry.orgs) {
    if (o.droppedByFilter || o.collapsedByDedupe) continue
    if (o.storyMatches === 0) {
      swallowed += 1
      swallowedRows.push({ key: key(entry.row), orgId: o.orgId, row: entry.row })
    } else if (o.storyMatches > 1) ambiguous += 1
  }
}

// Rows that touch an MLB club directly but were dropped anyway — the set most
// worth eyeballing, because each one is a real MLB move the feed won't show.
const droppedMlbRows = []
for (const entry of trace.values()) {
  for (const o of entry.orgs) {
    if (!o.droppedByFilter) continue
    const t = entry.row
    if (t.fromTeam?.id !== o.orgId && t.toTeam?.id !== o.orgId) continue
    droppedMlbRows.push({ key: key(t), orgId: o.orgId, reason: dropReason(t, o.orgId), row: t })
  }
}

// ---------------------------------------------------------------------------
// Enrichment catalog — what else is joinable to a row, resolved for real.
// ---------------------------------------------------------------------------
const enriched = {}
for (const [pid, p] of people) {
  enriched[pid] = {
    fullName: p.fullName,
    firstName: p.useName || p.firstName,
    lastName: p.lastName,
    position: p.primaryPosition?.abbreviation || '',
    positionName: p.primaryPosition?.name || '',
    batSide: p.batSide?.code || '',
    pitchHand: p.pitchHand?.code || '',
    age: p.currentAge ?? null,
    height: p.height || '',
    weight: p.weight ?? null,
    birthDate: p.birthDate || '',
    birthCity: p.birthCity || '',
    birthCountry: p.birthCountry || '',
    mlbDebutDate: p.mlbDebutDate || null,
    currentTeamId: p.currentTeam?.id ?? null,
    currentTeamName: p.currentTeam?.name || '',
    active: p.active ?? null,
    headshot: `https://midfield.mlbstatic.com/v1/people/${pid}/spots/120`,
  }
}

const teamsSeen = new Map()
for (const t of raw) {
  for (const side of [t.fromTeam, t.toTeam]) {
    if (!side?.id || teamsSeen.has(side.id)) continue
    const org = orgById.get(side.id)
    const aff = affilById.get(side.id)
    teamsSeen.set(side.id, {
      id: side.id,
      name: side.name,
      isMlbClub: Boolean(org),
      abbreviation: org?.abbreviation ?? aff?.abbreviation ?? '',
      sportId: (org ?? aff)?.sport?.id ?? null,
      level: (org ?? aff)?.sport?.name ?? '',
      parentOrgId: affilToOrg.get(side.id) ?? null,
      parentOrgName: orgById.get(affilToOrg.get(side.id))?.name ?? '',
    })
  }
}

// ---------------------------------------------------------------------------
// Write it out.
// ---------------------------------------------------------------------------
const rowsOut = []
for (const entry of trace.values()) {
  const t = entry.row
  const orgs = entry.orgs.map((o) => ({
    ...o,
    dropReason: o.droppedByFilter ? dropReason(t, o.orgId) : null,
    directTouch: t.fromTeam?.id === o.orgId || t.toTeam?.id === o.orgId,
  }))
  rowsOut.push({ key: key(t), raw: t, orgs })
}

const dupIds = new Map()
for (const t of raw) dupIds.set(t.id, (dupIds.get(t.id) ?? 0) + 1)

const out = {
  generatedAt: new Date().toISOString(),
  window: { startDate, endDate, days: DAYS, season },
  totals: {
    rawRows: raw.length,
    distinctIds: dupIds.size,
    repeatedIds: [...dupIds.values()].filter((n) => n > 1).length,
    peopleResolved: people.size,
    peopleRequested: personIds.length,
    rowsClaimedByAnOrg: rowsOut.filter((r) => r.orgs.length).length,
    rowsInAStory: rowsOut.filter((r) => r.orgs.some((o) => o.storyId)).length,
    rowsInMoreThanOneOrgStory: rowsOut.filter((r) => r.orgs.filter((o) => o.storyId).length > 1).length,
    orgStories: orgRuns.reduce((n, r) => n + r.counts.stories, 0),
    feedItemsUnique: feed.length,
    feedItemsDuplicated: feed.filter((f) => f.copies.length > 1).length,
    swallowedRows: swallowed,
    ambiguousAssociations: ambiguous,
    droppedButTouchesMlbClub: droppedMlbRows.length,
    flags: flags.length,
  },
  typeCodes: (() => {
    const m = new Map()
    for (const t of raw) {
      const k = t.typeCode
      if (!m.has(k)) m.set(k, { code: k, desc: t.typeDesc, raw: 0, kept: 0, whitelisted: STORY_WORTHY_CODES.has(k) || k === 'SC' })
      m.get(k).raw += 1
    }
    for (const r of rowsOut) {
      if (r.orgs.some((o) => o.storyId)) m.get(r.raw.typeCode).kept += 1
    }
    return [...m.values()].sort((a, b) => b.raw - a.raw)
  })(),
  perDay: [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1)),
  orgRuns,
  feed,
  rows: rowsOut,
  droppedMlbRows,
  swallowedRows,
  flags,
  people: enriched,
  teams: [...teamsSeen.values()],
}

mkdirSync(here, { recursive: true })
writeFileSync(join(here, 'window.json'), JSON.stringify(out, null, 1))

console.log(`
orgs run              ${orgRuns.length}
rows claimed by an org ${out.totals.rowsClaimedByAnOrg}
rows in a story        ${out.totals.rowsInAStory}
  in >1 org's story    ${out.totals.rowsInMoreThanOneOrgStory}
org stories (total)    ${out.totals.orgStories}
feed items (unique)    ${out.totals.feedItemsUnique}
  duplicated cross-org ${out.totals.feedItemsDuplicated}
dropped, MLB-touching  ${out.totals.droppedButTouchesMlbClub}
rows in no story       ${out.totals.swallowedRows}
ambiguous associations ${out.totals.ambiguousAssociations}
display flags          ${out.totals.flags}
wrote window.json`)
