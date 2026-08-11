// A clean-slate census of the transaction wire: every type code MLB uses this
// season, how often, how much of it touches an MLB club, and the most recent
// examples of each — verbatim, with the player and club records resolved.
//
// No pipeline. No filter. No grouping. This reads the API and nothing else, so
// a home-page feed can be designed from what the wire actually carries rather
// than from what the team-page pipeline already decided to keep.
//
// Run: node .scratch/home-transactions/type-census.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../src/api/statsapi.js'

const here = dirname(fileURLToPath(import.meta.url))
const EXAMPLES = 5
const iso = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const season = today.getUTCFullYear()

const seasonMeta = (await getJson(`/api/v1/seasons/${season}?sportId=1`)).seasons?.[0] ?? {}
const startDate = seasonMeta.regularSeasonStartDate
const endDate = iso(today)
console.log(`census ${startDate} .. ${endDate}`)

const orgTeams = (await getJson('/api/v1/teams?sportId=1')).teams ?? []
const orgIds = new Set(orgTeams.map((t) => t.id))
const orgById = new Map(orgTeams.map((t) => [t.id, t]))

const affil = await getJson(`/api/v1/teams/affiliates?teamIds=${[...orgIds].join(',')}&season=${season}`)
const affilToOrg = new Map()
const teamById = new Map(orgTeams.map((t) => [t.id, t]))
for (const t of affil.teams ?? []) {
  teamById.set(t.id, t)
  if (t.id != null && t.parentOrgId != null) affilToOrg.set(t.id, t.parentOrgId)
}

const raw = (await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)).transactions ?? []
console.log(`rows: ${raw.length}`)

const dateOf = (t) => t.effectiveDate || t.date || ''
const touchesMlb = (t) => orgIds.has(t.fromTeam?.id) || orgIds.has(t.toTeam?.id)

// ---------------------------------------------------------------------------
// Sub-families. A type code is not the same thing as a kind of move: SC alone
// covers the injured list, the restricted list, paternity, bereavement and a
// bare "roster status changed". Whatever a home feed ends up showing, THESE are
// the units it will be choosing between — so the census names them.
//
// Order matters: the first pattern that matches wins.
// ---------------------------------------------------------------------------
const SUBFAMILIES = [
  ['SC', 'placed on the injured list', /placed .* on the (\d+-day )?(injured|disabled) list/i],
  ['SC', 'moved between injured lists', /transferred .* (injured|disabled) list/i],
  ['SC', 'activated off the injured list', /activat|reinstat/i, /(injured|disabled) list/i],
  ['SC', 'placed on the restricted list', /restricted list/i],
  ['SC', 'placed on the paternity list', /paternity/i],
  ['SC', 'placed on the bereavement list', /bereavement|family medical/i],
  ['SC', 'moved to or from the development list', /development list/i],
  ['SC', 'activated, no list named', /activat/i],
  ['SC', 'reassigned to the minor leagues', /reassigned/i],
  ['SC', 'roster status changed, unexplained', /roster status changed/i],
  ['ASG', 'sent on a rehab assignment', /rehab assignment/i],
  ['ASG', 'assigned between clubs', /assigned to/i],
  ['TR', 'traded', /traded/i],
  ['SGN', 'signed', /signed/i],
  ['SFA', 'signed as a free agent', /signed/i],
  ['REL', 'released', /released/i],
  ['OPT', 'optioned', /optioned/i],
  ['CU', 'recalled', /recalled/i],
  ['SE', 'contract selected', /selected/i],
  ['DES', 'designated for assignment', /designated/i],
  ['OUT', 'outrighted', /outright/i],
  ['CLW', 'claimed off waivers', /claimed/i],
  ['DFA', 'elected free agency', /free agency/i],
  ['ACQ', 'acquired from outside affiliated ball', /acquired/i],
  ['RET', 'retired', /retire/i],
  ['SU', 'suspended', /suspend/i],
  ['NUM', 'changed number', /number/i],
]

function subFamily(t) {
  const d = t.description || ''
  for (const [code, label, re, re2] of SUBFAMILIES) {
    if (t.typeCode !== code) continue
    if (!re.test(d)) continue
    if (re2 && !re2.test(d)) continue
    return label
  }
  return t.typeCode === 'SC' ? 'other status change' : 'other'
}

// ---------------------------------------------------------------------------
// Group by code, then by sub-family, newest first.
// ---------------------------------------------------------------------------
const sorted = raw.slice().sort((a, b) => {
  const d = dateOf(b).localeCompare(dateOf(a))
  return d !== 0 ? d : (b.id ?? 0) - (a.id ?? 0)
})

const codes = new Map()
for (const t of sorted) {
  const c = t.typeCode
  if (!codes.has(c)) {
    codes.set(c, { code: c, desc: t.typeDesc, total: 0, mlb: 0, families: new Map(), latest: [], latestMlb: [] })
  }
  const e = codes.get(c)
  e.total += 1
  const isMlb = touchesMlb(t)
  if (isMlb) e.mlb += 1
  if (e.latest.length < EXAMPLES) e.latest.push(t)
  if (isMlb && e.latestMlb.length < EXAMPLES) e.latestMlb.push(t)

  const fam = subFamily(t)
  if (!e.families.has(fam)) e.families.set(fam, { label: fam, total: 0, mlb: 0, latest: [], latestMlb: [] })
  const f = e.families.get(fam)
  f.total += 1
  if (isMlb) f.mlb += 1
  if (f.latest.length < EXAMPLES) f.latest.push(t)
  if (isMlb && f.latestMlb.length < EXAMPLES) f.latestMlb.push(t)
}

// ---------------------------------------------------------------------------
// Resolve the people and clubs the examples name — nothing else.
// ---------------------------------------------------------------------------
const shown = []
for (const e of codes.values()) {
  shown.push(...e.latest, ...e.latestMlb)
  for (const f of e.families.values()) shown.push(...f.latest, ...f.latestMlb)
}
const personIds = [...new Set(shown.map((t) => t.person?.id).filter(Boolean))]
const people = {}
for (let i = 0; i < personIds.length; i += 100) {
  const batch = personIds.slice(i, i + 100)
  const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}`)
  for (const p of data.people ?? []) {
    people[p.id] = {
      fullName: p.fullName,
      position: p.primaryPosition?.abbreviation || '',
      positionName: p.primaryPosition?.name || '',
      batSide: p.batSide?.code || '',
      pitchHand: p.pitchHand?.code || '',
      age: p.currentAge ?? null,
      height: p.height || '',
      weight: p.weight ?? null,
      birthDate: p.birthDate || '',
      birthPlace: [p.birthCity, p.birthStateProvince, p.birthCountry].filter(Boolean).join(', '),
      mlbDebutDate: p.mlbDebutDate || null,
      active: p.active ?? null,
    }
  }
}
console.log(`people resolved: ${Object.keys(people).length} of ${personIds.length}`)

const teams = {}
for (const t of shown) {
  for (const side of [t.fromTeam, t.toTeam]) {
    if (!side?.id || teams[side.id]) continue
    const rec = teamById.get(side.id)
    teams[side.id] = {
      id: side.id,
      name: side.name,
      isMlbClub: orgIds.has(side.id),
      abbreviation: rec?.abbreviation ?? '',
      level: rec?.sport?.name ?? '',
      league: rec?.league?.name ?? '',
      parentOrgId: affilToOrg.get(side.id) ?? null,
      parentOrgName: orgById.get(affilToOrg.get(side.id))?.name ?? '',
      known: Boolean(rec),
    }
  }
}

// Field presence across the whole season, so the shape claims are measured.
const fieldCount = {}
for (const t of raw) for (const k of Object.keys(t)) fieldCount[k] = (fieldCount[k] ?? 0) + 1

const out = {
  generatedAt: new Date().toISOString(),
  window: { startDate, endDate, season },
  totals: {
    rows: raw.length,
    mlbTouching: raw.filter(touchesMlb).length,
    distinctIds: new Set(raw.map((t) => t.id)).size,
    codes: codes.size,
  },
  fieldCount,
  codes: [...codes.values()]
    .sort((a, b) => b.total - a.total)
    .map((e) => ({
      code: e.code,
      desc: e.desc,
      total: e.total,
      mlb: e.mlb,
      latest: e.latest,
      latestMlb: e.latestMlb,
      families: [...e.families.values()].sort((a, b) => b.total - a.total),
    })),
  people,
  teams,
}

writeFileSync(join(here, 'census.json'), JSON.stringify(out, null, 1))
console.log(`\n${'code'.padEnd(6)}${'total'.padStart(8)}${'MLB'.padStart(8)}  families`)
for (const e of out.codes) {
  console.log(`${e.code.padEnd(6)}${String(e.total).padStart(8)}${String(e.mlb).padStart(8)}  ${e.families.map((f) => `${f.label} (${f.total}/${f.mlb})`).join(', ')}`)
}
console.log('\nwrote census.json')
